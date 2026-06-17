import { NextRequest, NextResponse } from "next/server";

// Paths that don't require authentication
const publicPaths = ["/login", "/reset-password", "/update-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for authentication token (Supabase session)
  const hasAuthCookie =
    request.cookies.has("sb-access-token") ||
    [...request.cookies.getAll()].some(
      (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
    );

  // If no auth cookie and trying to access protected route, redirect to login
  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If we have an auth cookie, allow the request to proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico|json|txt|woff2?|css|js)$).*)",
  ],
};
