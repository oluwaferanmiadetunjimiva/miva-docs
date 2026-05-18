import services from "@/app/api/services/services.json";

export type DocsServiceEnvironment = {
  name: string;
  url: string;
  route: string;
  specUrl: string;
};

export type DocsContext =
  | {
      ok: true;
      serviceSlug: string;
      envName: string;
      specUrl: string;
      apiBaseUrl: string;
      environments: DocsServiceEnvironment[];
    }
  | { ok: false; reason: "no_service_slug" | "service_not_found" | "no_environments" };

export type CookieValueGetter = (name: string) => string | undefined;

type ServiceRow = {
  id?: string;
  name?: string;
  slug?: string;
  environments?: Array<{ name?: string; url?: string; route?: string }>;
};

export function normalizeConfiguredBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

export function normalizeOpenApiSpecRoute(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    new URL(trimmed);
    return "";
  } catch {
    return trimmed;
  }
}

export function buildOpenApiSpecUrl(baseUrl: string, route: string): string {
  const normalizedBaseUrl = normalizeConfiguredBaseUrl(baseUrl);
  const normalizedRoute = normalizeOpenApiSpecRoute(route);
  if (!normalizedBaseUrl || !normalizedRoute) return "";
  try {
    return new URL(normalizedRoute, `${normalizedBaseUrl}/`).toString();
  } catch {
    return "";
  }
}

export function listServices(): ServiceRow[] {
  return Array.isArray(services) ? (services as ServiceRow[]) : [];
}

export function findServiceBySlug(slug: string): ServiceRow | undefined {
  const target = slug.trim().toLowerCase();
  return listServices().find((s) => String(s.slug ?? "").trim().toLowerCase() === target);
}

export function normalizeEnvironments(service: ServiceRow): DocsServiceEnvironment[] {
  const envs = service.environments;
  if (!Array.isArray(envs)) return [];
  const out: DocsServiceEnvironment[] = [];
  for (const e of envs) {
    const name = String(e?.name ?? "").trim();
    const url = normalizeConfiguredBaseUrl(String(e?.url ?? ""));
    const route = normalizeOpenApiSpecRoute(String(e?.route ?? ""));
    const specUrl = buildOpenApiSpecUrl(url, route);
    if (!name || !url || !route || !specUrl) continue;
    out.push({ name, url, route, specUrl });
  }
  return out;
}

function pickEnvironment(
  environments: DocsServiceEnvironment[],
  envQuery: string | null | undefined,
  cookieEnvName: string | undefined,
): DocsServiceEnvironment {
  const q = (envQuery ?? "").trim();
  if (q) {
    const lower = q.toLowerCase();
    const byQuery = environments.find((e) => e.name.toLowerCase() === lower);
    if (byQuery) return byQuery;
  }
  const c = (cookieEnvName ?? "").trim();
  if (c) {
    const lower = c.toLowerCase();
    const byCookie = environments.find((e) => e.name.toLowerCase() === lower);
    if (byCookie) return byCookie;
  }
  return environments[0]!;
}

export function resolveDocsContext(get: CookieValueGetter, envQuery?: string | null): DocsContext {
  const serviceSlug = (get("docs_service_slug") ?? "").trim();
  if (!serviceSlug) {
    return { ok: false, reason: "no_service_slug" };
  }

  const service = findServiceBySlug(serviceSlug);
  if (!service) {
    return { ok: false, reason: "service_not_found" };
  }

  const environments = normalizeEnvironments(service);
  if (environments.length === 0) {
    return { ok: false, reason: "no_environments" };
  }

  const cookieEnvName = get("docs_env_name");
  const chosen = pickEnvironment(environments, envQuery, cookieEnvName);
  const specUrl = chosen.specUrl;
  const apiBaseUrl = chosen.url;

  return {
    ok: true,
    serviceSlug,
    envName: chosen.name,
    specUrl,
    apiBaseUrl,
    environments,
  };
}
