import { cookies } from "next/headers";
import { resolveDocsContext } from "@/lib/docsServiceContext";
import { getScopedTokenFromCookies } from "@/lib/token";
import { NextResponse } from "next/server";



function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function headerEntries(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) out[k] = v;
  return out;
}

function byteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

export async function POST(req: Request) {
  const start = Date.now();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ message: "Malformed JSON body" }, { status: 400 });
  }

  if (!isRecord(json)) return NextResponse.json({ message: "Invalid request body" }, { status: 400 });

  const method = typeof json.method === "string" ? json.method.toLowerCase() : "";
  const pathWithQuery = typeof json.pathWithQuery === "string" ? json.pathWithQuery : "";
  const url = typeof json.url === "string" ? json.url : "";
  const headersObj = isRecord(json.headers) ? (json.headers as Record<string, unknown>) : {};
  const bodyText = typeof json.bodyText === "string" ? json.bodyText : undefined;

  if (!method) return NextResponse.json({ message: "Missing method" }, { status: 422 });
  if (method === "get" && bodyText && bodyText.trim().length > 0) {
    return NextResponse.json({ message: "GET requests cannot have a body" }, { status: 422 });
  }

  let upstreamUrl: string;
  const store = await cookies();
  const docsCtx = resolveDocsContext((name) => store.get(name)?.value);
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ message: "url must be a valid absolute URL" }, { status: 422 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ message: "url must start with http:// or https://" }, { status: 422 });
    }
    upstreamUrl = parsed.toString();
  } else {
    if (!pathWithQuery || !pathWithQuery.startsWith("/")) {
      return NextResponse.json({ message: "pathWithQuery must start with '/'" }, { status: 422 });
    }

    const apiBase = docsCtx.ok ? docsCtx.apiBaseUrl : process.env.API_URL;
    if (!apiBase) {
      return NextResponse.json(
        { message: docsCtx.ok ? "Could not resolve API base URL" : "No active service and API_URL is not set" },
        { status: 500 },
      );
    }
    upstreamUrl = new URL(pathWithQuery, apiBase).toString();
  }

  const upstreamHeaders = new Headers();
  for (const [k, v] of Object.entries(headersObj)) {
    if (typeof v !== "string") continue;
    const lower = k.toLowerCase();
    // prevent weird proxy behavior; these are managed by fetch/runtime
    if (lower === "host" || lower === "content-length") continue;
    upstreamHeaders.set(k, v);
  }

 
  if (!url) {
    if (docsCtx.ok) {
      const token = await getScopedTokenFromCookies({ serviceSlug: docsCtx.serviceSlug, envName: docsCtx.envName });
      if (token) upstreamHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: method.toUpperCase(),
      headers: upstreamHeaders,
      body: method === "get" ? undefined : bodyText,
      cache: "no-store",
    });

    const upstreamBodyText = await upstreamRes.text();
    const elapsed = Date.now() - start;

    return NextResponse.json(
      {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: headerEntries(upstreamRes.headers),
        bodyText: upstreamBodyText,
        ms: elapsed,
        bytes: byteSize(upstreamBodyText),
      },
      { status: 200 },
    );
  } catch (e) {
    const elapsed = Date.now() - start;
    return NextResponse.json(
      {
        message: e instanceof Error ? e.message : "Proxy request failed",
        ms: elapsed,
      },
      { status: 500 },
    );
  }
}

