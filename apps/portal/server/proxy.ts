import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@repo/supabase/middleware";
import { cacheGet, cacheSet, cacheEvictL1ByPrefix } from "@repo/redis/cache";
import { recordJobExecution } from "@/lib/observability/metrics";

/**
 * Server-side redirect validation with canonicalization and allowlist
 *
 * Validates that redirect targets are internal and safe:
 * 1. Decodes URL-encoded redirects to reveal hidden protocols/paths
 * 2. Canonicalizes to prevent bypass techniques (//, \\, etc.)
 * 3. Checks against an allowlist of permitted path patterns
 * 4. Rejects protocol-relative URLs, data URIs, and javascript: URIs
 */
function isValidRedirect(path: string): boolean {
  if (!path) return false;

  // Decode the path to reveal URL-encoded bypass attempts
  try {
    path = decodeURIComponent(path);
  } catch {
    return false;
  }

  // Reject protocol-relative URLs, data URIs, javascript: URIs
  if (
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    path.startsWith("data:") ||
    path.startsWith("javascript:") ||
    path.startsWith("vbscript:")
  ) {
    return false;
  }

  // Must start with a single slash (internal relative path)
  if (!path.startsWith("/")) return false;

  // Allowlist of permitted path patterns
  const allowedPatterns = [
    /^\/$/, // Root
    /^\/login/, // Login page
    /^\/reset-password/, // Password reset
    /^\/update-password/, // Password update
    /^\/drilling\//, // Drilling department
    /^\/production\//, // Production department
    /^\/access-control\//, // Access control department
    /^\/engineering\//, // Engineering department
    /^\/control-room\//, // Control room department
    /^\/safety\//, // Safety department
    /^\/training\//, // Training department
    /^\/satellite-monitoring\//, // Satellite monitoring department
    /^\/hub/, // Hub
    /^\/admin\//, // Admin
  ];

  // Check if path matches any allowed pattern
  return allowedPatterns.some((pattern) => pattern.test(path));
}

// DEPARTMENT_ROUTES intentionally excludes '/admin' because admin is a top-level
// restricted route, not a sub-route under (departments). Admin access is handled
// separately via its own auth check in RESTRICTED_ROUTES.
const DEPARTMENT_ROUTES = [
  "drilling",
  "production",
  "access-control",
  "engineering",
  "control-room",
  "safety",
  "training",
  "satellite-monitoring",
];

const RESTRICTED_ROUTES: Record<string, string[]> = {
  "access-control": ["access_control", "admin"],
  "control-room": ["control_room_operator", "admin"],
  tools: ["admin", "supervisor"],
  admin: ["admin"],
};

export function normalizeRole(role: unknown): string {
  return typeof role === "string" && role.length > 0 ? role : "operator";
}

export function isTokenExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }
  const msg = String(error.message);
  return (
    msg.includes("Invalid Refresh Token") ||
    msg.includes("Refresh Token Not Found")
  );
}

function redirectWithError(
  request: NextRequest,
  error: string,
  clientResponse?: NextResponse,
) {
  const url = new URL("/", request.url);
  url.searchParams.set("error", error);
  const res = NextResponse.redirect(url);
  if (clientResponse && clientResponse.cookies) {
    clientResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expires: cookie.expires,
        maxAge: cookie.maxAge,
      });
    });
  }
  return res;
}

async function resolveDeptUuid(
  supabase: Awaited<ReturnType<typeof createMiddlewareClient>>["supabase"],
  slug: string,
): Promise<string | null> {
  const cacheKey = `dept:uuid:${slug}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  const { data } = await supabase
    .from("departments")
    .select("id")
    .eq("name", slug)
    .single();
  if (data?.id) {
    await cacheSet(cacheKey, data.id, 3600); // 1 hour
  }
  return data?.id || null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Exempt health, hardware API, and Prometheus metrics endpoints from authentication entirely
  if (
    pathname.startsWith("/api/c66") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/metrics")
  ) {
    return NextResponse.next();
  }

  // Exempt password reset and update flows from middleware auth gating
  if (
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/update-password")
  ) {
    return NextResponse.next();
  }

  // Short-circuit static public file extensions BEFORE any auth calls
  const PUBLIC_FILE_EXTENSIONS =
    /\.(jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|otf|eot|mp4|webm|mp3|wav)$/i;
  if (PUBLIC_FILE_EXTENSIONS.test(pathname)) {
    return NextResponse.next();
  }

  // Short-circuit well-known public root files (PWA manifest, robots, sitemap...)
  // These are never auth-gated and must never redirect to /login.
  const PUBLIC_ROOT_FILES = new Set([
    "/manifest.json",
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
    "/browserconfig.xml",
    "/sw.js",
    "/workbox-*.js",
  ]);
  if (
    PUBLIC_ROOT_FILES.has(pathname) ||
    // Catch hashed workbox chunks like /workbox-abc123.js
    /^\/workbox-.+\.js$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Short-circuit the login page BEFORE calling Supabase — avoids a full
  // network round-trip (~50 s cold) for a public unauthenticated route.
  // We only need auth here if there IS a session cookie (to redirect logged-in
  // users away from /login), so we check that cheaply first.
  if (pathname.startsWith("/login")) {
    const hasSession =
      request.cookies.has("sb-access-token") ||
      [...request.cookies.getAll()].some(
        (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
      );

    if (!hasSession) {
      // No session cookie at all — serve login instantly, no Supabase call
      return NextResponse.next();
    }

    // Has a session cookie — verify it and redirect if valid
    const client = await createMiddlewareClient(request);
    let sessionUser = null;
    let shouldSignOut = false;
    try {
      const result = await client.supabase.auth.getUser();
      sessionUser = result.data.user;
      if (result.error && isTokenExpiredError(result.error)) {
        shouldSignOut = true;
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        shouldSignOut = true;
      }
    }

    if (shouldSignOut) {
      // Record middleware sign-out triggered due to expired/invalid token
      try {
        recordJobExecution("auth.middleware.signout", 0, false);
        // eslint-disable-next-line no-empty
      } catch {}
      await client.supabase.auth.signOut();
      return client.response;
    }

    if (sessionUser) {
      try {
        recordJobExecution("auth.middleware.check", 0, true);
        // eslint-disable-next-line no-empty
      } catch {}
      return NextResponse.redirect(new URL("/", request.url));
    }
    try {
      recordJobExecution("auth.middleware.check", 0, false);
      // eslint-disable-next-line no-empty
    } catch {}
    return client.response;
  }

  const client = await createMiddlewareClient(request);
  let user = null;
  let shouldSignOut = false;
  try {
    const result = await client.supabase.auth.getUser();
    user = result.data.user;
    if (result.error && isTokenExpiredError(result.error)) {
      shouldSignOut = true;
    }
  } catch (error) {
    if (isTokenExpiredError(error)) {
      shouldSignOut = true;
    }
  }

  if (shouldSignOut) {
    await client.supabase.auth.signOut();
    if (user?.id) {
      cacheEvictL1ByPrefix(`arch:auth:employee:${user.id}`);
    }
    user = null;
  }

  // Not authenticated -> login
  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    // Only set redirect parameter if it passes server-side validation
    if (isValidRedirect(pathname)) {
      redirectUrl.searchParams.set("redirect", pathname);
    }
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy cookies from client.response to the redirectResponse
    if (client.response && client.response.cookies) {
      client.response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          path: cookie.path,
          domain: cookie.domain,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expires: cookie.expires,
          maxAge: cookie.maxAge,
        });
      });
    }
    return redirectResponse;
  }

  // Fetch authoritative role/department from employees table (cached)
  const employeeCacheKey = `arch:auth:employee:${user.id}`;
  let employee = await cacheGet<{
    role: string;
    department_id: string;
    accessible_departments: string[];
  } | null>(employeeCacheKey);

  if (!employee) {
    const { data } = await client.supabase
      .from("employees")
      .select("role, department_id, accessible_departments")
      .eq("auth_id", user.id)
      .single();
    employee = data ?? null;
    if (employee) {
      await cacheSet(employeeCacheKey, employee, 3600);
    }
  }

  const userRole = normalizeRole(employee?.role);
  const userDept = employee?.department_id ?? null;
  const accessible = employee?.accessible_departments ?? [];

  const pathSegments = pathname.split("/").filter(Boolean);
  const topSegment = pathSegments[0];
  const secondSegment = pathSegments[1];

  // Check restricted top-level routes
  for (const [route, allowedRoles] of Object.entries(RESTRICTED_ROUTES)) {
    if (pathname.startsWith(`/${route}`) && !allowedRoles.includes(userRole)) {
      return redirectWithError(
        request,
        "unauthorized_department",
        client.response,
      );
    }
  }

  // Also check /{dept}/tools restriction
  if (
    secondSegment === "tools" &&
    RESTRICTED_ROUTES.tools &&
    !RESTRICTED_ROUTES.tools.includes(userRole)
  ) {
    return redirectWithError(
      request,
      "unauthorized_department",
      client.response,
    );
  }

  // Check department isolation
  if (topSegment && DEPARTMENT_ROUTES.includes(topSegment)) {
    const isAdmin = userRole === "admin";

    const deptUuid = await resolveDeptUuid(client.supabase, topSegment);
    if (!deptUuid) {
      return redirectWithError(request, "unknown_department", client.response);
    }

    const hasAccess =
      isAdmin || userDept === deptUuid || accessible.includes(deptUuid);
    if (!hasAccess) {
      return redirectWithError(
        request,
        "unauthorized_department",
        client.response,
      );
    }
  }

  return client.response;
}

export const config = {
  // Exclude static assets and API routes from middleware.
  // API routes handle their own auth; running Supabase getUser() here adds
  // a redundant round-trip (and ~50 s cold-start risk) to every API call.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico).*)"],
};
