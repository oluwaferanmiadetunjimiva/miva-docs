import "server-only";

import yaml from "js-yaml";
import { resolveDocsContext } from "@/lib/docsServiceContext";
import { buildDocsOperationRoute, getPrimaryOpenApiTag, matchesOpenApiTagRoute, slugifyOperationId } from "@/lib/helpers";
import { cookies } from "next/headers";

export type OpenApiSpec = unknown;

const TTL_MS = 5 * 60 * 1000;

export function buildOperationRoute(args: {
  serviceSlug: string;
  tag: string;
  method: string;
  operationId: string;
}): string {
  return buildDocsOperationRoute(args);
}

export type OpenApiSecurityRequirement = Record<string, unknown>;
export type OpenApiSecurity = OpenApiSecurityRequirement[];

export type OpenApiSpecShape = {
  security?: OpenApiSecurity;
  paths?: Record<string, Record<string, OpenApiOperation | unknown> | unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

export type OpenApiParameter = Record<string, unknown>;
export type OpenApiRequestBody = Record<string, unknown>;
export type OpenApiResponses = Record<string, unknown>;

export type OpenApiOperation = {
  tags?: string[];
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: OpenApiResponses;
  requires_auth?: boolean;
  [key: string]: unknown;
};

export type OpenApiOperationDetailsResult =
  | {
      ok: true;
      tag: string;
      method: string;
      pathFromSpec: string;
      operation: OpenApiOperation;
      requires_auth: boolean;
      schemaRefs: string[];
      schemas: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: "operation_not_found";
      tag: string;
      method: string;
      slug: string;
    };

type CachedEntry = {
  spec: OpenApiSpec;
  expiresAtMs: number;
  etag?: string;
  lastModified?: string;
};

const cacheByUrl = new Map<string, CachedEntry>();
const inFlightByUrl = new Map<string, Promise<OpenApiSpec>>();

async function fetchAndParseSpec(specUrl: string, cached: CachedEntry | undefined): Promise<OpenApiSpec> {
  const headers: Record<string, string> = {};
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

  const res = await fetch(specUrl, { cache: "no-store", headers });

  if (res.status === 304) {
    if (!cached) throw new Error("Received 304 Not Modified without a cached spec");
    const next = { ...cached, expiresAtMs: Date.now() + TTL_MS };
    cacheByUrl.set(specUrl, next);
    return next.spec;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI YAML: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const spec = yaml.load(text) as OpenApiSpec;

  const next: CachedEntry = {
    spec,
    expiresAtMs: Date.now() + TTL_MS,
    etag: res.headers.get("etag") ?? undefined,
    lastModified: res.headers.get("last-modified") ?? undefined,
  };
  cacheByUrl.set(specUrl, next);

  return spec;
}

async function getSpecUrlForRequest(envQuery?: string | null): Promise<string> {
  const store = await cookies();
  const ctx = resolveDocsContext((name) => store.get(name)?.value, envQuery);
  if (ctx.ok) return ctx.specUrl;
  throw new Error("NO_ACTIVE_SERVICE");
}

async function getOpenApiSpecForSpecUrl(specUrl: string): Promise<OpenApiSpec> {
  const now = Date.now();

  const cached = cacheByUrl.get(specUrl);
  if (cached && now < cached.expiresAtMs) {
    return cached.spec;
  }

  const inFlight = inFlightByUrl.get(specUrl);
  if (inFlight) return inFlight;

  const p = fetchAndParseSpec(specUrl, cached).finally(() => {
    inFlightByUrl.delete(specUrl);
  });
  inFlightByUrl.set(specUrl, p);
  return p;
}

export async function getOpenApiSpec(envQuery?: string | null): Promise<OpenApiSpec> {
  const specUrl = await getSpecUrlForRequest(envQuery);
  return getOpenApiSpecForSpecUrl(specUrl);
}

function readInfoVersion(spec: unknown): string | undefined {
  if (!spec || typeof spec !== "object") return undefined;
  const info = (spec as Record<string, unknown>)["info"];
  if (!info || typeof info !== "object") return undefined;
  const raw = (info as Record<string, unknown>)["version"];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

export async function getOpenApiSpecMeta(envQuery?: string | null): Promise<{
  specUrl: string;
  lastModified?: string;
  version?: string;
}> {
  const specUrl = await getSpecUrlForRequest(envQuery);
 
  await getOpenApiSpecForSpecUrl(specUrl);
  const cached = cacheByUrl.get(specUrl);
  return {
    specUrl,
    lastModified: cached?.lastModified,
    version: cached?.spec ? readInfoVersion(cached.spec) : undefined,
  };
}

export async function getFirstOpenApiRouteForSpecUrl(specUrl: string, serviceSlug: string): Promise<string | null> {
  const spec = (await getOpenApiSpecForSpecUrl(specUrl)) as OpenApiSpecShape;

  const paths = spec.paths;
  if (!paths || typeof paths !== "object") return null;

  const firstPath = Object.keys(paths)[0];
  if (!firstPath) return null;

  const pathItem = paths[firstPath] as Record<string, unknown> | undefined;
  if (!pathItem || typeof pathItem !== "object") return null;

  const method =
    METHOD_ORDER.find((m) => pathItem[m] && typeof pathItem[m] === "object") ?? Object.keys(pathItem)[0]?.toLowerCase();
  if (!method) return null;

  const operation = pathItem[method] as OpenApiOperation | undefined;
  if (!operation || typeof operation !== "object") return null;

  const operationId = operation.operationId;
  if (typeof operationId !== "string" || !operationId) return null;

  const tag = getPrimaryOpenApiTag(operation.tags);
  return buildOperationRoute({ serviceSlug, tag, method, operationId });
}

function requiresAuthFromSecurity(security: unknown): boolean {
  if (security === undefined) return false;
  if (!Array.isArray(security)) return false;
  return security.length > 0;
}

function getEffectiveSecurity(
  spec: OpenApiSpecShape,
  pathItem: Record<string, unknown>,
  operation: OpenApiOperation,
): unknown {
  if (operation.security !== undefined) return operation.security;
  if (pathItem["security"] !== undefined) return pathItem["security"];
  return spec.security;
}

export function getOperationRequiresAuth(
  spec: OpenApiSpecShape,
  pathItem: Record<string, unknown>,
  operation: OpenApiOperation,
): boolean {
  return requiresAuthFromSecurity(getEffectiveSecurity(spec, pathItem, operation));
}

function extractSchemaRefName(ref: string): string | null {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match?.[1] ?? null;
}

function collectSchemaRefNamesDeep(node: unknown, out: Set<string>) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectSchemaRefNamesDeep(item, out);
    return;
  }

  const record = node as Record<string, unknown>;
  const maybeRef = record["$ref"];
  if (typeof maybeRef === "string") {
    const name = extractSchemaRefName(maybeRef);
    if (name) out.add(name);
  }

  for (const v of Object.values(record)) {
    collectSchemaRefNamesDeep(v, out);
  }
}

function expandSchemasFromRefs(
  spec: OpenApiSpecShape,
  initialRefs: Iterable<string>,
): {
  schemaRefs: string[];
  schemas: Record<string, unknown>;
} {
  const schemas = (spec.components?.schemas ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const queue = Array.from(initialRefs);

  while (queue.length > 0) {
    const name = queue.pop();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const schema = schemas[name];
    if (!schema) continue;

    const nested = new Set<string>();
    collectSchemaRefNamesDeep(schema, nested);
    for (const n of nested) {
      if (!seen.has(n)) queue.push(n);
    }
  }

  const picked: Record<string, unknown> = {};
  for (const name of seen) {
    const schema = schemas[name];
    if (schema) picked[name] = schema;
  }

  return { schemaRefs: Array.from(seen).sort(), schemas: picked };
}

export async function getOpenApiOperationDetails(
  tag: string,
  method: string,
  slug: string,
  envQuery?: string | null,
): Promise<OpenApiOperationDetailsResult> {
  const spec = (await getOpenApiSpec(envQuery)) as OpenApiSpecShape;

  const normalizedMethod = method.toLowerCase();
  const targetSlug = slug.toLowerCase();

  let pathFromSpec: string | undefined;
  let operation: OpenApiOperation | undefined;
  let openapiPathItem: Record<string, unknown> | undefined;

  for (const [openapiPath, rawPathItem] of Object.entries(spec?.paths ?? {})) {
    if (!rawPathItem || typeof rawPathItem !== "object") continue;
    const pathItem = rawPathItem as Record<string, unknown>;

    const op = pathItem[normalizedMethod] as OpenApiOperation | undefined;
    if (!op || typeof op !== "object") continue;

    const opTags = Array.isArray(op.tags) ? op.tags : [];
    if (!matchesOpenApiTagRoute(tag, opTags)) continue;

    if (typeof op.operationId !== "string" || !op.operationId) continue;
    if (slugifyOperationId(op.operationId) !== targetSlug) continue;

    pathFromSpec = openapiPath;
    operation = op;
    openapiPathItem = pathItem;
    break;
  }

  if (!operation || !pathFromSpec || !openapiPathItem) {
    return { ok: false, reason: "operation_not_found", tag, method: normalizedMethod, slug };
  }

  const initialRefs = new Set<string>();
  collectSchemaRefNamesDeep(operation, initialRefs);

  const expanded = expandSchemasFromRefs(spec, initialRefs);

  const requires_auth = getOperationRequiresAuth(spec, openapiPathItem, operation);
  operation.requires_auth = requires_auth;

  return {
    ok: true,
    tag,
    method: normalizedMethod,
    pathFromSpec,
    operation,
    requires_auth,
    schemaRefs: expanded.schemaRefs,
    schemas: expanded.schemas,
  };
}

const METHOD_ORDER = ["get", "post", "put", "patch", "delete", "options", "head", "trace"] as const;

export async function getFirstOpenApiRoute(envQuery?: string | null): Promise<string | null> {
  const spec = (await getOpenApiSpec(envQuery)) as OpenApiSpecShape;
  const store = await cookies();
  const serviceSlug = store.get("docs_service_slug")?.value?.trim();
  if (!serviceSlug) return null;

  const paths = spec.paths;
  if (!paths || typeof paths !== "object") return null;

  const firstPath = Object.keys(paths)[0];
  if (!firstPath) return null;

  const pathItem = paths[firstPath] as Record<string, unknown> | undefined;
  if (!pathItem || typeof pathItem !== "object") return null;

  const method =
    METHOD_ORDER.find((m) => pathItem[m] && typeof pathItem[m] === "object") ?? Object.keys(pathItem)[0]?.toLowerCase();
  if (!method) return null;

  const operation = pathItem[method] as OpenApiOperation | undefined;
  if (!operation || typeof operation !== "object") return null;

  const operationId = operation.operationId;
  if (typeof operationId !== "string" || !operationId) return null;

  const tag = getPrimaryOpenApiTag(operation.tags);

  return buildOperationRoute({ serviceSlug, tag, method, operationId });
}
