import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (isApi) return NextResponse.next();
  const isStatic =
    request.nextUrl.pathname.startsWith("/_next/") ||
    request.nextUrl.pathname.startsWith("/favicon") ||
    request.nextUrl.pathname === "/_not-found";
  if (isStatic) return NextResponse.next();

  const hasService = Boolean(request.cookies.get("docs_service_slug")?.value?.trim());
  if (hasService) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (pathname === "/") return NextResponse.next();

  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const out = request.nextUrl.clone();
  out.pathname = "/api/resolve-docs-url";
  out.search = "";
  out.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(out);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
