import { NextResponse } from "next/server";
import { findServiceBySlug, normalizeEnvironments } from "@/lib/docsServiceContext";
import { getFirstOpenApiRouteForSpecUrl } from "@/lib/openapiSpec";

export const runtime = "nodejs";

function pickOrigin(req: Request): string {
  // request.url is always absolute in route handlers
  return new URL(req.url).origin;
}

const dev = process.env.NODE_ENV === "development";

function logSelect(...args: unknown[]) {
  if (dev) console.info("[miva-docs][select-service]", ...args);
}

function normalizeEnvQuery(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const envQuery = (url.searchParams.get("env") ?? "").trim();
  const returnToRaw = (url.searchParams.get("returnTo") ?? "").trim();
  if (!slug) {
    logSelect("abort: missing slug → redirect /");
    return NextResponse.redirect(new URL("/", url));
  }

  const safeReturnTo =
    returnToRaw && returnToRaw.startsWith("/") && !returnToRaw.includes("://") ? returnToRaw : null;

  try {
    const origin = pickOrigin(req);
    logSelect("GET", { slug, origin });

    const service = findServiceBySlug(slug);
    if (!service?.slug) {
      logSelect("abort: no service for slug", { slug }, "→ 404");
      return NextResponse.redirect(new URL("/_not-found", url));
    }

    const environments = normalizeEnvironments(service);
    const targetEnv = normalizeEnvQuery(envQuery);
    const env =
      (targetEnv ? environments.find((candidate) => candidate.name.toLowerCase() === targetEnv) : undefined) ??
      environments[0];

    if (!env?.url || !env.route || !env.specUrl) {
      logSelect("abort: no valid environment", { serviceSlug: service.slug }, "→ redirect /");
      return NextResponse.redirect(new URL("/", url));
    }

    const firstRoute = await getFirstOpenApiRouteForSpecUrl(env.specUrl, service.slug);
    const envName = env.name;
    const redirectBase = safeReturnTo ?? (firstRoute ?? "/");
    const redirectUrl = new URL(redirectBase, url);
    if (envName) redirectUrl.searchParams.set("env", envName);
    logSelect("ok", {
      serviceSlug: service.slug,
      envName,
      specUrl: env.specUrl,
      firstRoute,
      redirectTo: redirectUrl.pathname + redirectUrl.search,
    });

    const out = NextResponse.redirect(redirectUrl);
    out.cookies.set("docs_service_slug", service.slug, { path: "/" });
    out.cookies.set("docs_env_name", envName, { path: "/" });
    out.cookies.set("docs_spec_url", env.specUrl, { path: "/" });
    return out;
  } catch (err) {
    console.error("[miva-docs][select-service] error → redirect /", err);
    return NextResponse.redirect(new URL("/", url));
  }
}

