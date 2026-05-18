import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isSafeRelativeReturnTo(v: string): boolean {
  const t = v.trim();
  return Boolean(t) && t.startsWith("/") && !t.includes("://");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = (url.searchParams.get("returnTo") ?? "").trim();
  if (!isSafeRelativeReturnTo(returnTo)) return NextResponse.redirect(new URL("/", url));

  const t = new URL(returnTo, url);
  const serviceSlug = t.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!serviceSlug) return NextResponse.redirect(new URL("/", url));

  const env = t.searchParams.get("env")?.trim() ?? "";

  const out = new URL("/api/select-service", url);
  out.searchParams.set("slug", serviceSlug);
  out.searchParams.set("returnTo", `${t.pathname}${t.search}`);
  if (env) out.searchParams.set("env", env);
  return NextResponse.redirect(out);
}

