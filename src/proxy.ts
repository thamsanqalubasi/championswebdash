import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const protectedRoutes = [
  "/dashboard",
  "/properties",
  "/tenants",
  "/finance",
  "/maintenance",
  "/contracts",
  "/settings",
  "/audit-trail",
];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  const guardEnabled = process.env.APP_ROUTE_GUARD_ENABLED === "true";

  if (!guardEnabled || !isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.APP_SESSION_SECRET;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionSecret || !sessionToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySessionToken(sessionToken, sessionSecret);
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
