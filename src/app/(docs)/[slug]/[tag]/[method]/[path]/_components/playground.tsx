"use client";

import { setScopedToken as setTokenServer } from "@/app/_actions/token";
import { useToken } from "@/components/token-provider";
import { Required } from "@/components/badges";
import { copyToClipboard, prettyPayload } from "@/lib/helpers";
import type { OpenApiParameter } from "@/lib/openapiSpec";
import { jwtDecode } from "jwt-decode";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Copy, Trash2, Send, ChevronDown, KeyRound } from "lucide-react";
import { usePlaygroundBody } from "./playground-body-context";
import { cn } from "@/lib/cn";

type EnvOption = { name: string };

type Props = {
  seedKey?: string;
  method: string;
  path?: string;
  apiBaseUrl?: string;
  parameters?: OpenApiParameter[];
  environments?: EnvOption[];
  activeEnvName?: string;
  serviceSlug: string;
};

type ParamIn = "path" | "query" | "header";

type ParamDef = {
  in: ParamIn;
  name: string;
  required: boolean;
  description?: string;
  type?: string;
  enumValues?: string[];
};

type HeaderRow = { name: string; value: string; required?: boolean; source?: "openapi" | "manual" };
type ManualHeaderRow = { id: string; name: string; value: string };
type QueryRow = { name: string; value: string };

type ProxyResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  ms: number;
  bytes: number;
};

function parseOpenApiParams(parameters: OpenApiParameter[] | undefined): ParamDef[] {
  const out: ParamDef[] = [];
  for (const raw of parameters ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const loc = p["in"];
    if (loc !== "path" && loc !== "query" && loc !== "header") continue;
    const name = typeof p["name"] === "string" ? (p["name"] as string) : "";
    if (!name) continue;
    const required = Boolean(p["required"]);
    const description = typeof p["description"] === "string" ? (p["description"] as string) : undefined;
    const schema =
      p["schema"] && typeof p["schema"] === "object" ? (p["schema"] as Record<string, unknown>) : undefined;
    const type = typeof schema?.["type"] === "string" ? (schema?.["type"] as string) : undefined;
    const enumValues = Array.isArray(schema?.["enum"])
      ? (schema?.["enum"] as unknown[]).map((v) => String(v))
      : undefined;

    out.push({ in: loc, name, required, description, type, enumValues });
  }
  return out;
}

function isValidHeaderName(name: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(name);
}

function isValidQueryParamName(name: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(name);
}

function parseQueryRowsFromAbsoluteUrl(rawUrl: string): QueryRow[] | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const rows: QueryRow[] = [];
    parsed.searchParams.forEach((value, name) => rows.push({ name, value }));
    return rows;
  } catch {
    return null;
  }
}

function resolvePathWithQuery(
  path: string,
  pathParams: ParamDef[],
  queryParams: ParamDef[],
  paramValues: Record<string, string>,
): string {
  let resolvedPath = path;
  for (const p of pathParams) {
    const v = (paramValues[p.name] ?? "").trim();
    if (!v) continue;
    resolvedPath = resolvedPath.replaceAll(`{${p.name}}`, encodeURIComponent(v));
  }

  const qs = new URLSearchParams();
  for (const p of queryParams) {
    const v = (paramValues[p.name] ?? "").trim();
    if (!v) continue;
    qs.set(p.name, v);
  }

  const search = qs.toString();
  return search ? `${resolvedPath}?${search}` : resolvedPath;
}

function applyQueryRowsToAbsoluteUrl(rawUrl: string, rows: QueryRow[]): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    parsed.search = "";
    for (const row of rows) {
      const name = row.name.trim();
      const value = row.value.trim();
      if (!name && !value) continue;
      if (!name || !value) continue;
      if (!isValidQueryParamName(name)) continue;
      parsed.searchParams.set(name, value);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

const RESERVED_HEADERS = new Set(["authorization", "content-type", "accept", "host", "content-length"]);

const TABS = ["endpoint", "custom"];
const SUPPORTED_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export default function Playground({
  seedKey,
  method,
  path,
  apiBaseUrl,
  parameters,
  environments = [],
  activeEnvName = "",
  serviceSlug,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, setToken } = useToken();
  const { bodyText, setBodyText, prefilledFromExample } = usePlaygroundBody();
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(token ?? "");

  const baseUrl = apiBaseUrl ?? "";

  const normalizedMethod = method.toLowerCase();
  const isEndpointGet = normalizedMethod === "get";

  const tokenDisplay = useMemo(() => {
    if (!token) return "Click to set token";
    if (token.length <= 10) return "••••••••••";
    return `${token.slice(0, 10)}…${token.slice(-10)}`;
  }, [token]);

  const tokenTimes = useMemo(() => {
    if (!token) return null;
    try {
      const formatTs = (unixSeconds: number): string => {
        const d = new Date(unixSeconds * 1000);
        const datePart = new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }).format(d);
        const timePart = new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(d);
        return `${datePart} ${timePart}`;
      };

      const decoded = jwtDecode<{ exp?: number; iat?: number }>(token);
      const issuedAt = decoded?.iat ? formatTs(decoded.iat) : null;
      const expiresAt = decoded?.exp ? formatTs(decoded.exp) : null;

      if (!issuedAt && !expiresAt) return null;
      return { issuedAt, expiresAt };
    } catch {
      return null;
    }
  }, [token]);

  const paramDefs = useMemo(() => parseOpenApiParams(parameters), [parameters]);
  const pathParams = useMemo(() => paramDefs.filter((p) => p.in === "path"), [paramDefs]);
  const queryParams = useMemo(() => paramDefs.filter((p) => p.in === "query"), [paramDefs]);
  const headerParams = useMemo(() => paramDefs.filter((p) => p.in === "header"), [paramDefs]);
  const hasParams = pathParams.length + queryParams.length > 0;

  const [activeComposerTab, setActiveComposerTab] = useState<"params" | "headers" | "body">(() => {
    if (isEndpointGet) return hasParams ? "params" : "headers";
    return hasParams ? "params" : "body";
  });
  const [activeResponseTab, setActiveResponseTab] = useState<"body" | "headers" | "raw">("body");

  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const requestUrl = useMemo(() => {
    if (!path) return baseUrl;
    return `${baseUrl}${resolvePathWithQuery(path, pathParams, queryParams, paramValues)}`;
  }, [baseUrl, path, pathParams, queryParams, paramValues]);

  const [manualHeaderRows, setManualHeaderRows] = useState<ManualHeaderRow[]>([]);
  const [headerValueByLowerName, setHeaderValueByLowerName] = useState<Record<string, string>>({});

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [response, setResponse] = useState<ProxyResponse | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("endpoint");

  const [customUrl, setCustomUrl] = useState("");
  const [customMethod, setCustomMethod] = useState(normalizedMethod);
  const [hasEnteredCustom, setHasEnteredCustom] = useState(false);
  const [customPathParamValues, setCustomPathParamValues] = useState<Record<string, string>>({});
  const [customQueryRows, setCustomQueryRows] = useState<QueryRow[]>([]);

  const effectiveMethod = activeTab === "custom" ? customMethod : normalizedMethod;
  const isGet = effectiveMethod === "get";

  const openApiHeaderRows = useMemo<HeaderRow[]>(() => {
    if (activeTab === "custom") return [];
    void seedKey;

    return headerParams
      .filter((p) => {
        const lower = p.name.trim().toLowerCase();
        return Boolean(lower) && !RESERVED_HEADERS.has(lower);
      })
      .map((p) => {
        const lower = p.name.trim().toLowerCase();
        return {
          name: p.name,
          value: headerValueByLowerName[lower] ?? "",
          required: p.required,
          source: "openapi",
        };
      });
  }, [activeTab, headerParams, headerValueByLowerName, seedKey]);

  const headerRows = useMemo<HeaderRow[]>(() => {
    const manualAsRows: HeaderRow[] = manualHeaderRows.map((r) => ({
      name: r.name,
      value: r.value,
      source: "manual",
    }));

    if (activeTab === "custom") return manualAsRows;

    const openApiByLower = new Set(openApiHeaderRows.map((r) => r.name.trim().toLowerCase()).filter(Boolean));
    const manualDeduped = manualAsRows.filter((r) => !openApiByLower.has(r.name.trim().toLowerCase()));
    return [...openApiHeaderRows, ...manualDeduped];
  }, [activeTab, manualHeaderRows, openApiHeaderRows]);

  const headersCount = useMemo(() => headerRows.filter((h) => h.name.trim() && h.value.trim()).length, [headerRows]);

  const missingRequiredParams = useMemo(() => {
    const missing: string[] = [];
    for (const p of paramDefs) {
      if (p.in === "header") continue;
      if (!p.required) continue;
      const v = (paramValues[p.name] ?? "").trim();
      if (!v) missing.push(p.name);
    }
    return missing;
  }, [paramDefs, paramValues]);

  const missingRequiredHeaders = useMemo(() => {
    const missing: string[] = [];
    if (activeTab === "custom") return missing;

    for (const row of openApiHeaderRows) {
      if (!row.required) continue;
      if (!row.value.trim()) missing.push(row.name);
    }
    return missing;
  }, [activeTab, openApiHeaderRows]);

  const canSend = useMemo(() => {
    if (activeTab === "custom") {
      if (!customUrl.trim()) return false;
      try {
        const u = new URL(customUrl.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      } catch {
        return false;
      }
      if (!SUPPORTED_METHODS.includes(effectiveMethod as (typeof SUPPORTED_METHODS)[number])) return false;
      return true;
    }

    return missingRequiredParams.length === 0 && missingRequiredHeaders.length === 0 && Boolean(path);
  }, [activeTab, customUrl, effectiveMethod, missingRequiredParams, missingRequiredHeaders, path]);

  function buildPathWithQuery(): { ok: true; pathWithQuery: string } | { ok: false; error: string } {
    if (!path) return { ok: false, error: "Missing OpenAPI path for this operation." };

    for (const p of pathParams) {
      const v = (paramValues[p.name] ?? "").trim();
      if (p.required && !v) return { ok: false, error: `Missing required path param: ${p.name}` };
    }

    const pathWithQuery = resolvePathWithQuery(path, pathParams, queryParams, paramValues);

    if (/\{[^}]+\}/.test(pathWithQuery.split("?")[0] ?? pathWithQuery)) {
      return { ok: false, error: "Some required path params are missing." };
    }

    for (const p of queryParams) {
      const v = (paramValues[p.name] ?? "").trim();
      if (p.required && !v) return { ok: false, error: `Missing required query param: ${p.name}` };
    }

    return { ok: true, pathWithQuery };
  }

  function buildExtraHeaders(): { headers: Record<string, string>; error?: string } {
    const headers: Record<string, string> = {};

    for (const row of headerRows) {
      const name = row.name.trim();
      const value = row.value.trim();
      if (!name && !value) continue;
      if (!name && value) return { headers: {}, error: "All header rows must have both name and value." };
      if (name && !value) {

        if (activeTab !== "custom" && row.required) return { headers: {}, error: `Missing required header: ${name}` };
        continue;
      }
      if (!isValidHeaderName(name)) return { headers: {}, error: `Invalid header name: ${name}` };

      const lower = name.toLowerCase();
      if (RESERVED_HEADERS.has(lower)) return { headers: {}, error: `Header not allowed here: ${name}` };

      headers[name] = value;
    }


    headers["Accept"] = "application/json";
    if (!isGet && bodyText.trim().length > 0) headers["Content-Type"] = "application/json";

    return { headers };
  }

  function buildCustomUrl(): { ok: true; url: string } | { ok: false; error: string } {
    const raw = customUrl.trim();
    if (!raw) return { ok: false, error: "Enter a URL." };
    const placeholderNames = Array.from(new Set(raw.match(/\{[A-Za-z0-9_-]+\}/g)?.map((m) => m.slice(1, -1)) ?? []));

    let substituted = raw;
    for (const name of placeholderNames) {
      const v = (customPathParamValues[name] ?? "").trim();
      if (!v) return { ok: false, error: `Missing required path param: ${name}` };
      substituted = substituted.replaceAll(`{${name}}`, encodeURIComponent(v));
    }

    let parsed: URL;
    try {
      parsed = new URL(substituted);
    } catch {
      return { ok: false, error: "Custom URL must be a valid absolute URL (e.g. https://example.com/path)." };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Custom URL must start with http:// or https://." };
    }

    for (const row of customQueryRows) {
      const name = row.name.trim();
      const value = row.value.trim();
      if (!name && !value) continue;
      if (!name) return { ok: false, error: "All query param rows must have both name and value." };
      if (!value) return { ok: false, error: "All query param rows must have both name and value." };
      if (!isValidQueryParamName(name)) return { ok: false, error: `Invalid query param name: ${name}` };
      parsed.searchParams.set(name, value);
    }

    return { ok: true, url: parsed.toString() };
  }

  return (
    <aside className="z-10 hidden w-lg shrink-0 flex-col border-l border-(--border) bg-(--surface-2)/80 backdrop-blur-xl xl:flex">
      <div className="flex flex-col gap-4 border-b border-(--border) bg-(--surface) px-6 pt-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight text-(--text)">Playground</h3>

          <div className="inline-flex items-center rounded-lg bg-(--surface-3) p-0.5 ring-1 ring-inset ring-(--border)">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === "custom") {
                    if (!hasEnteredCustom) {
                      setHasEnteredCustom(true);
                      setCustomUrl("");
                      setCustomMethod(normalizedMethod);
                      setCustomPathParamValues({});
                      setCustomQueryRows([]);
                    }
                    setActiveComposerTab("params");
                  } else {
                    const nextDefaultTab: "params" | "headers" | "body" = isEndpointGet
                      ? hasParams
                        ? "params"
                        : "headers"
                      : hasParams
                        ? "params"
                        : "body";
                    setActiveComposerTab(nextDefaultTab);
                  }
                  setActiveTab(tab);
                }}
                className={cn(
                  "rounded-md px-3 py-1 text-[11.5px] font-medium capitalize transition-all duration-200",
                  tab === activeTab
                    ? "bg-(--surface) text-(--text) shadow-[var(--shadow-xs)]"
                    : "text-(--text-muted) hover:text-(--text)",
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {environments.length > 0 ? (
            <div className="relative">
              <select
                value={activeEnvName}
                onChange={(e) => {
                  const next = e.target.value;
                  const sp = new URLSearchParams(searchParams.toString());
                  sp.delete("env");
                  const returnTo = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
                  const destination = `/api/select-service?slug=${encodeURIComponent(serviceSlug)}&env=${encodeURIComponent(next)}&returnTo=${encodeURIComponent(returnTo)}`;
                  window.location.assign(destination);
                }}
                className="cursor-pointer appearance-none rounded-lg border border-(--accent-border) bg-(--accent-soft) py-1 pr-7 pl-2.5 text-[11.5px] font-medium text-(--accent) outline-none transition-all focus:border-(--accent) focus:ring-2 focus:ring-(--ring) hover:bg-(--accent-soft)/80"
              >
                {environments.map((env) => (
                  <option key={env.name} value={env.name}>
                    {env.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-(--accent)" />
            </div>
          ) : null}
        </div>

        <div className="flex overflow-hidden rounded-lg border border-(--border) bg-(--surface) shadow-[var(--shadow-xs)] transition-all duration-200 focus-within:border-(--border-focus) focus-within:ring-2 focus-within:ring-(--ring)">
          {activeTab === "custom" ? (
            <select
              value={effectiveMethod}
              onChange={(e) => setCustomMethod(e.target.value.toLowerCase())}
              className="cursor-pointer border-r border-(--border) bg-(--surface-2) px-3 py-2 font-mono text-[11.5px] font-semibold text-(--text-muted) focus:outline-none"
            >
              {SUPPORTED_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex items-center border-r border-(--border) bg-(--surface-2) px-3.5 py-2 font-mono text-[11.5px] font-semibold text-(--text-muted)">
              {method.toUpperCase()}
            </span>
          )}
          <input
            type="text"
            value={activeTab === "custom" ? customUrl : requestUrl}
            readOnly={activeTab !== "custom"}
            onChange={(e) => {
              const next = e.target.value;
              setCustomUrl(next);
              const parsed = parseQueryRowsFromAbsoluteUrl(next.trim());
              if (parsed) setCustomQueryRows(parsed);
            }}
            placeholder={activeTab === "custom" ? "https://api.example.com/path?query=1" : undefined}
            className="flex-1 truncate bg-transparent px-3 py-2 font-mono text-[12.5px] text-(--text) placeholder:text-(--text-subtle) focus:outline-none"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-(--surface)">
        {activeTab !== "custom" && (
          <div className="border-b border-(--border) bg-(--surface-2)/60 px-6 py-5">
            <label className="mb-2 block text-[10.5px] font-semibold tracking-[0.12em] text-(--text-subtle) uppercase">
              Bearer Token
            </label>
            <button
              type="button"
              onClick={() => {
                setTokenDraft(token ?? "");
                setIsTokenModalOpen(true);
              }}
              className="group relative w-full rounded-lg border border-(--border) bg-(--surface) py-2 pr-4 pl-9 text-left font-mono text-[12.5px] text-(--text) shadow-[var(--shadow-xs)] transition-all duration-200 hover:bg-(--surface-hover-2) focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
              aria-label="Set bearer token"
            >
              <KeyRound className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-(--text-subtle)" />
              <span className={token ? "text-(--text)" : "text-(--text-subtle)"}>{tokenDisplay}</span>
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10.5px] font-medium text-(--text-subtle) opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Edit
              </span>
            </button>
            {tokenTimes && (
              <div className="mt-2 space-y-0.5 text-[11.5px] text-(--text-muted)">
                {tokenTimes.issuedAt && <div>Issued at {tokenTimes.issuedAt}</div>}
                {tokenTimes.expiresAt && <div>Expires at {tokenTimes.expiresAt}</div>}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end justify-between border-b border-(--border) bg-(--surface) px-6 pt-3">
          <div className="flex gap-5">
            {(hasParams || activeTab === "custom") && (
              <button
                type="button"
                onClick={() => setActiveComposerTab("params")}
                className={cn(
                  "relative pb-2.5 text-[12.5px] font-medium transition-colors duration-200",
                  activeComposerTab === "params"
                    ? "text-(--text) after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-[2px] after:rounded-full after:bg-(--accent)"
                    : "text-(--text-muted) hover:text-(--text)",
                )}
              >
                Params
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveComposerTab("headers")}
              className={cn(
                "relative flex items-center gap-1.5 pb-2.5 text-[12.5px] font-medium transition-colors duration-200",
                activeComposerTab === "headers"
                  ? "text-(--text) after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-[2px] after:rounded-full after:bg-(--accent)"
                  : "text-(--text-muted) hover:text-(--text)",
              )}
            >
              Headers
              {headersCount > 0 && (
                <span className="rounded-md bg-(--surface-3) px-1.5 py-0.5 text-[10px] font-semibold text-(--text-muted) ring-1 ring-inset ring-(--border)">
                  {headersCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveComposerTab("body")}
              disabled={isGet}
              className={cn(
                "relative pb-2.5 text-[12.5px] font-medium transition-colors duration-200",
                isGet
                  ? "cursor-not-allowed text-(--text-subtle) opacity-60"
                  : activeComposerTab === "body"
                    ? "text-(--text) after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-[2px] after:rounded-full after:bg-(--accent)"
                    : "text-(--text-muted) hover:text-(--text)",
              )}
              title={isGet ? "GET requests don't have a body" : undefined}
            >
              Body
            </button>
          </div>
          {prefilledFromExample && (
            <div className="flex items-center pb-2.5">
              <span className="md-fade-in inline-flex items-center gap-1.5 rounded-md bg-(--accent-soft) px-2 py-0.5 text-[11px] font-medium text-(--accent) ring-1 ring-inset ring-(--accent-border)">
                <Check className="h-3 w-3" />
                Prefilled
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-(--surface) p-6">
          {activeComposerTab === "params" && (hasParams || activeTab === "custom") && (
            <div className="flex-1 space-y-5 overflow-auto rounded-lg border border-(--border) bg-(--surface-2) p-4">
              {activeTab === "custom" ? (
                <>
                  {!customUrl.trim() ? (
                    <div className="text-sm text-(--text-muted)">Enter a custom URL above to configure params.</div>
                  ) : (
                    <>
                      {Array.from(
                        new Set(customUrl.match(/\{[A-Za-z0-9_-]+\}/g)?.map((m) => m.slice(1, -1)) ?? []),
                      ).length > 0 && (
                          <div>
                            <div className="mb-2 text-xs font-semibold tracking-wider text-(--text-muted) uppercase">
                              Path (from URL placeholders)
                            </div>
                            <div className="space-y-3">
                              {Array.from(
                                new Set(customUrl.match(/\{[A-Za-z0-9_-]+\}/g)?.map((m) => m.slice(1, -1)) ?? []),
                              )
                                .sort()
                                .map((name) => (
                                  <div key={`custom-path-${name}`} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="font-mono text-xs font-semibold text-(--text)">{name}</label>
                                      <span className="rounded-md bg-[#fde9ea] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#b8232f] ring-1 ring-inset ring-[#f1c8cb] dark:bg-[#ff453a]/12 dark:text-[#ff9b95] dark:ring-[#ff453a]/25">
                                        required
                                      </span>
                                    </div>
                                    <input
                                      value={customPathParamValues[name] ?? ""}
                                      onChange={(e) =>
                                        setCustomPathParamValues((s) => ({
                                          ...s,
                                          [name]: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                                      placeholder="value"
                                    />
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-semibold tracking-wider text-(--text-muted) uppercase">Query</div>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomQueryRows((s) => {
                                const next = [...s, { name: "", value: "" }];
                                const nextUrl = applyQueryRowsToAbsoluteUrl(customUrl.trim(), next);
                                if (nextUrl) setCustomUrl(nextUrl);
                                return next;
                              })
                            }
                            className="rounded-md bg-(--text) px-2.5 py-1 text-[11px] font-semibold text-(--surface) transition-colors duration-150 hover:opacity-90"
                          >
                            Add query param
                          </button>
                        </div>

                        {customQueryRows.length === 0 ? (
                          <div className="text-sm text-(--text-muted)">No query params yet.</div>
                        ) : (
                          <div className="space-y-3">
                            {customQueryRows.map((row, idx) => (
                              <div key={`custom-query-${idx}`} className="flex gap-2">
                                <input
                                  value={row.name}
                                  onChange={(e) =>
                                    setCustomQueryRows((s) => {
                                      const next = s.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r));
                                      const nextUrl = applyQueryRowsToAbsoluteUrl(customUrl.trim(), next);
                                      if (nextUrl) setCustomUrl(nextUrl);
                                      return next;
                                    })
                                  }
                                  className="w-1/2 rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                                  placeholder="name"
                                />
                                <input
                                  value={row.value}
                                  onChange={(e) =>
                                    setCustomQueryRows((s) => {
                                      const next = s.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r));
                                      const nextUrl = applyQueryRowsToAbsoluteUrl(customUrl.trim(), next);
                                      if (nextUrl) setCustomUrl(nextUrl);
                                      return next;
                                    })
                                  }
                                  className="w-1/2 rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                                  placeholder="value"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCustomQueryRows((s) => {
                                      const next = s.filter((_, i) => i !== idx);
                                      const nextUrl = applyQueryRowsToAbsoluteUrl(customUrl.trim(), next);
                                      if (nextUrl) setCustomUrl(nextUrl);
                                      return next;
                                    })
                                  }
                                  className="shrink-0 rounded-md bg-transparent px-2 py-2 text-xs font-semibold text-(--text-muted) hover:bg-(--surface-hover)"
                                  aria-label="Remove query param"
                                >
                                  <Trash2 className="h-3 w-3 text-[#b8232f] dark:text-[#ff9b95]" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {pathParams.length === 0 && queryParams.length === 0 && (
                    <div className="text-sm text-(--text-muted)">No OpenAPI params for this endpoint.</div>
                  )}

                  {pathParams.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-semibold tracking-wider text-(--text-muted) uppercase">Path</div>
                      <div className="space-y-3">
                        {pathParams.map((p) => (
                          <div key={`path-${p.name}`} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="font-mono text-xs font-semibold text-(--text)">{p.name}</label>
                              {p.required && (
                                <span className="rounded-md bg-[#fde9ea] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#b8232f] ring-1 ring-inset ring-[#f1c8cb] dark:bg-[#ff453a]/12 dark:text-[#ff9b95] dark:ring-[#ff453a]/25">
                                  required
                                </span>
                              )}
                            </div>
                            <input
                              value={paramValues[p.name] ?? ""}
                              onChange={(e) => setParamValues((s) => ({ ...s, [p.name]: e.target.value }))}
                              className="w-full rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                              placeholder={p.type ? `${p.type}` : "value"}
                            />
                            {p.description && <div className="text-xs text-(--text-muted)">{p.description}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {queryParams.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-semibold tracking-wider text-(--text-muted) uppercase">Query</div>
                      <div className="space-y-3">
                        {queryParams.map((p) => (
                          <div key={`query-${p.name}`} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="font-mono text-xs font-semibold text-(--text)">{p.name}</label>
                              {p.required && (
                                <span className="rounded-md bg-[#fde9ea] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#b8232f] ring-1 ring-inset ring-[#f1c8cb] dark:bg-[#ff453a]/12 dark:text-[#ff9b95] dark:ring-[#ff453a]/25">
                                  required
                                </span>
                              )}
                            </div>
                            {p.enumValues && p.enumValues.length > 0 ? (
                              <select
                                value={paramValues[p.name] ?? ""}
                                onChange={(e) => setParamValues((s) => ({ ...s, [p.name]: e.target.value }))}
                                className="w-full rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                              >
                                <option value="">Select…</option>
                                {p.enumValues.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={paramValues[p.name] ?? ""}
                                onChange={(e) => setParamValues((s) => ({ ...s, [p.name]: e.target.value }))}
                                className="w-full rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                                placeholder={p.type ? `${p.type}` : "value"}
                              />
                            )}
                            {p.description && <div className="text-xs text-(--text-muted)">{p.description}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeComposerTab === "headers" && (
            <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-(--border) bg-(--surface-2) p-4">
              <div className="text-xs text-(--text-muted)">
                Add extra headers. Reserved headers are managed automatically (Authorization, Accept, Content-Type,
                etc.).
              </div>
              <div className="space-y-2">
                {headerRows.length === 0 ? (
                  <div className="rounded-md border border-(--border) bg-(--surface) px-3 py-3 text-xs text-(--text-muted)">
                    No extra headers yet.
                  </div>
                ) : (
                  headerRows.map((row, idx) => (
                    <div key={idx} className="flex min-w-0 items-center gap-2">
                      <div className="flex w-0 min-w-0 flex-1 items-center">
                        {row.source === "openapi" ? (
                          <div className="flex w-0 min-w-0 flex-1 items-center rounded-md border border-(--border) bg-(--surface-hover) px-3 py-2 font-mono text-xs text-(--text-muted)">
                            <span className="truncate">{row.name}</span>
                            {row.required && <Required className="ml-2 shrink-0" />}
                          </div>
                        ) : (
                          <input
                            value={row.name}
                            onChange={(e) => {
                              const nextName = e.target.value;
                              const manualIdx = idx - openApiHeaderRows.length;
                              if (manualIdx < 0) return;
                              setManualHeaderRows((s) =>
                                s.map((r, i) => (i === manualIdx ? { ...r, name: nextName } : r)),
                              );
                            }}
                            placeholder="Header-Name"
                            className="w-0 min-w-0 flex-1 rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-xs text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                          />
                        )}
                      </div>
                      <div className="flex w-0 min-w-0 flex-1 items-center">
                        <input
                          value={row.value}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            if (row.source === "openapi") {
                              const lower = row.name.trim().toLowerCase();
                              setHeaderValueByLowerName((s) => ({ ...s, [lower]: nextValue }));
                              return;
                            }
                            const manualIdx = idx - openApiHeaderRows.length;
                            if (manualIdx < 0) return;
                            setManualHeaderRows((s) =>
                              s.map((r, i) => (i === manualIdx ? { ...r, value: nextValue } : r)),
                            );
                          }}
                          placeholder="value"
                          className="w-0 min-w-0 flex-1 rounded-md border border-(--border) bg-(--surface) px-3 py-2 font-mono text-xs text-(--text) shadow-sm focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                        />
                      </div>

                      {!(row.source === "openapi" && row.required) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.source === "openapi") {
                              const lower = row.name.trim().toLowerCase();
                              setHeaderValueByLowerName((s) => ({ ...s, [lower]: "" }));
                              return;
                            }
                            const manualIdx = idx - openApiHeaderRows.length;
                            if (manualIdx < 0) return;
                            setManualHeaderRows((s) => s.filter((_, i) => i !== manualIdx));
                          }}
                          className="shrink-0 rounded-md bg-transparent px-1 py-1 text-xs font-semibold text-(--text-muted) hover:bg-(--surface-hover)"
                          aria-label={row.source === "openapi" ? "Clear header value" : "Remove header"}
                        >
                          <Trash2 className="h-3 w-3 text-[#b8232f] dark:text-[#ff9b95]" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const id =
                      typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                    setManualHeaderRows((s) => [...s, { id, name: "", value: "" }]);
                  }}
                  className="rounded-md bg-(--text) px-2.5 py-1.5 text-[11.5px] font-semibold text-(--surface) transition-colors duration-150 hover:opacity-90"
                >
                  Add header
                </button>
              </div>
            </div>
          )}

          {activeComposerTab === "body" && (
            <div className="relative flex-1 overflow-hidden rounded-lg border border-(--border) bg-(--surface-2) transition-all duration-150 focus-within:border-(--border-focus) focus-within:ring-2 focus-within:ring-(--ring)">
              {isGet ? (
                <div className="p-4 text-sm text-(--text-muted)">GET requests don’t have a body.</div>
              ) : (
                <>
                  <div className="absolute top-0 bottom-0 left-0 flex w-10 flex-col border-r border-(--border) bg-(--surface-hover) py-4 pr-2 text-right font-mono text-xs text-(--text-subtle) select-none">
                    {Array.from({ length: Math.max(6, (bodyText || "").split("\n").length) })
                      .slice(0, 200)
                      .map((_, i) => (
                        <span key={i}>{i + 1}</span>
                      ))}
                  </div>
                  <textarea
                    className="h-full w-full resize-none bg-transparent py-4 pr-4 pl-14 font-mono text-[13px] leading-relaxed text-(--text) focus:outline-none"
                    spellCheck={false}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                  />
                </>
              )}
            </div>
          )}

          {sendError && (
            <div className="md-fade-in mt-4 rounded-md bg-[#fde9ea] px-3 py-2 text-[12px] font-medium text-[#b8232f] ring-1 ring-inset ring-[#f1c8cb] dark:bg-[#ff453a]/10 dark:text-[#ff9b95] dark:ring-[#ff453a]/25">
              {sendError}
            </div>
          )}

          <button
            type="button"
            disabled={!canSend || isSending}
            onClick={async () => {
              setHasSubmitted(true);
              setSendError(null);
              setResponse(null);

              const built =
                activeTab === "custom" ? buildCustomUrl() : (buildPathWithQuery() as ReturnType<typeof buildPathWithQuery>);
              if (!built.ok) {
                setSendError(built.error);
                return;
              }

              const extra = buildExtraHeaders();
              if (extra.error) {
                setSendError(extra.error);
                return;
              }

              setIsSending(true);
              try {
                const res = await fetch("/api/playground", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    method: effectiveMethod,
                    ...(activeTab === "custom" ? { url: (built as { url: string }).url } : { pathWithQuery: (built as { pathWithQuery: string }).pathWithQuery }),
                    headers: extra.headers,
                    bodyText: isGet ? undefined : bodyText,
                  }),
                });

                const json = (await res.json()) as ProxyResponse | { message?: string };
                if (!res.ok) {
                  const msg =
                    typeof (json as { message?: string }).message === "string"
                      ? ((json as { message?: string }).message as string)
                      : `Request failed (${res.status})`;
                  setSendError(msg);
                  return;
                }
                setResponse(json as ProxyResponse);
                setActiveResponseTab("body");
              } catch (e) {
                setSendError(e instanceof Error ? e.message : "Failed to send request.");
              } finally {
                setIsSending(false);
              }
            }}
            className={cn(
              "mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13.5px] font-semibold text-white transition-all duration-200 ease-[var(--ease-apple)]",
              !canSend || isSending
                ? "cursor-not-allowed bg-(--accent)/55 shadow-[var(--shadow-xs)]"
                : "bg-(--accent) shadow-[var(--shadow-sm)] hover:bg-(--accent-hover) hover:shadow-[var(--shadow-md)] active:scale-[0.985] active:bg-(--accent-pressed)",
            )}
          >
            {isSending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isSending ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>

      {hasSubmitted && (
        <div className="md-fade-in z-20 flex h-1/3 min-h-70 flex-col border-t border-(--border) bg-(--surface)">
          <div className="flex items-center justify-between border-b border-(--border) bg-(--surface-2)/80 px-6 py-2.5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11.5px] font-semibold ring-1 ring-inset",
                  response
                    ? response.status >= 200 && response.status < 300
                      ? "bg-[#e7f6ee] text-[#117a3f] ring-[#c8e3d3] dark:bg-[#34c759]/12 dark:text-[#7ee2a3] dark:ring-[#34c759]/25"
                      : "bg-[#fde9ea] text-[#b8232f] ring-[#f1c8cb] dark:bg-[#ff453a]/12 dark:text-[#ff9b95] dark:ring-[#ff453a]/25"
                    : "bg-(--surface-3) text-(--text-muted) ring-(--border)",
                )}
              >
                {response ? `${response.status} ${response.statusText}` : "—"}
              </span>
              <div className="h-3.5 w-px bg-(--border)" />
              <div className="flex items-center gap-3 text-[11.5px]">
                <span className="font-mono font-medium text-(--text-muted)">
                  {response ? `${response.ms} ms` : "—"}
                </span>
                <span className="font-mono font-medium text-(--text-muted)">
                  {response ? `${response.bytes} B` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-(--border) bg-(--surface) px-6">
            <div className="flex gap-5">
              {(["body", "headers", "raw"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveResponseTab(t)}
                  className={cn(
                    "relative py-2.5 text-[12.5px] font-medium capitalize transition-colors duration-200",
                    activeResponseTab === t
                      ? "text-(--text) after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-[2px] after:rounded-full after:bg-(--accent)"
                      : "text-(--text-muted) hover:text-(--text)",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 py-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!response) return;
                  if (activeResponseTab === "headers") {
                    const headersText = Object.entries(response.headers)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([k, v]) => `${k}: ${v}`)
                      .join("\n");
                    copyToClipboard(headersText);
                    return;
                  }

                  if (activeResponseTab === "raw") {
                    const raw =
                      `HTTP/1.1 ${response.status} ${response.statusText}\n` +
                      Object.entries(response.headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("\n") +
                      `\n\n${response.bodyText ?? ""}`;
                    copyToClipboard(raw);
                    return;
                  }

                  copyToClipboard(prettyPayload(response.bodyText));
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text)"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-(--surface-2)/60 p-6">
            {!response ? (
              <div className="text-sm text-(--text-muted)">{isSending ? "Sending request…" : "No response yet."}</div>
            ) : activeResponseTab === "headers" ? (
              <pre className="font-mono text-[13px] leading-relaxed text-(--text)">
                <code>
                  {Object.entries(response.headers)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")}
                </code>
              </pre>
            ) : activeResponseTab === "raw" ? (
              <pre className="font-mono text-[13px] leading-relaxed text-(--text)">
                <code>
                  {`HTTP/1.1 ${response.status} ${response.statusText}\n` +
                    Object.entries(response.headers)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join("\n") +
                    `\n\n${response.bodyText ?? ""}`}
                </code>
              </pre>
            ) : (
              <pre className="font-mono text-[13px] leading-relaxed text-(--text)">
                <code>{prettyPayload(response.bodyText)}</code>
              </pre>
            )}
          </div>
        </div>
      )}

      {activeTab !== "custom" && isTokenModalOpen && (
        <div
          className="md-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Bearer token modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsTokenModalOpen(false);
          }}
        >
          <div className="md-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-(--border) bg-(--surface) shadow-[var(--shadow-pop)]">
            <div className="border-b border-(--border) px-6 py-4">
              <div className="text-[14px] font-semibold tracking-tight text-(--text)">Set bearer token</div>
              <div className="mt-0.5 text-[12.5px] text-(--text-muted)">
                Stored server-side and sent as <span className="font-mono">Authorization: Bearer …</span>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-semibold tracking-[0.12em] text-(--text-subtle) uppercase">
                  Token
                </label>
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="paste token here"
                  className="w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 font-mono text-[12.5px] text-(--text) shadow-[var(--shadow-xs)] transition-all duration-150 placeholder:text-(--text-subtle) focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-hover) hover:text-(--text)"
                  onClick={() => setIsTokenModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-(--accent) px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[var(--shadow-xs)] transition-all duration-150 hover:bg-(--accent-hover) active:scale-[0.98]"
                  onClick={async () => {
                    const next = tokenDraft.trim();
                    await setTokenServer({ serviceSlug, envName: activeEnvName, token: next });
                    setToken(next);
                    setIsTokenModalOpen(false);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
