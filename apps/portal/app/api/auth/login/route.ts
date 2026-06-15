import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";

/**
 * Login API Route with Server-Side Rate Limiting & CSRF Protection
 *
 * This endpoint wraps Supabase authentication with server-side rate limiting
 * to prevent brute-force attacks, CSRF origin validation, and content-type
 * enforcement.
 *
 * Security measures:
 * - CSRF protection via Origin/Referer header validation (production only)
 * - Content-Type enforcement (must be application/json)
 * - Rate limiting: 5 requests per 15 minutes per IP address
 * - Generic error messages to prevent account enumeration
 * - Session cookies set server-side by Supabase; response body does not
 *   expose session tokens
 *
 * Rate limits:
 * - 5 requests per 15 minutes per IP address
 * - Applies stricter limits during high system load
 */
export async function POST(request: NextRequest) {
  // ── Content-Type validation ──────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  // ── CSRF protection (production only) ────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      // Parse the app URL origin once; fail closed if config is invalid
      let appOrigin: string;
      try {
        appOrigin = new URL(appUrl).origin;
      } catch {
        return NextResponse.json(
          { error: "Invalid request origin" },
          { status: 403 },
        );
      }

      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");

      if (origin) {
        // Origin header is always protocol + host + port; compare directly
        if (origin !== appOrigin) {
          return NextResponse.json(
            { error: "Invalid request origin" },
            { status: 403 },
          );
        }
      } else if (referer) {
        // Referer includes full path; parse it and compare origins to
        // prevent subdomain suffix attacks (e.g., app.example.com.evil.com)
        try {
          const refUrl = new URL(referer);
          if (refUrl.origin !== appOrigin) {
            return NextResponse.json(
              { error: "Invalid request origin" },
              { status: 403 },
            );
          }
        } catch {
          // Invalid Referer URL — reject
          return NextResponse.json(
            { error: "Invalid request origin" },
            { status: 403 },
          );
        }
      } else {
        // Neither Origin nor Referer present — reject
        return NextResponse.json(
          { error: "Invalid request origin" },
          { status: 403 },
        );
      }
    }
  }

  return withRateLimit(
    request,
    async () => {
      try {
        const body = await request.json();
        const { email, password } = body;

        // Validate input
        if (!email || !password) {
          return NextResponse.json(
            { error: "Email and password are required" },
            { status: 400 },
          );
        }

        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Return generic error message to avoid account enumeration
          const isRateLimitError = error.message
            .toLowerCase()
            .includes("rate limit");
          return NextResponse.json(
            {
              error: isRateLimitError
                ? "Too many attempts. Please wait a moment and try again."
                : "Invalid credentials",
            },
            { status: 401 },
          );
        }

        // Session cookies are set server-side by Supabase; no need to
        // expose session tokens in the response body.
        return NextResponse.json(
          {
            success: true,
            redirectTo: "/",
          },
          { status: 200 },
        );
      } catch (err) {
        // Distinguish malformed JSON from internal server errors
        if (err instanceof SyntaxError) {
          return NextResponse.json(
            { error: "Invalid JSON in request body" },
            { status: 400 },
          );
        }
        return NextResponse.json(
          { error: "An error occurred during sign in" },
          { status: 500 },
        );
      }
    },
    {
      customLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // 5 attempts per 15 minutes
      },
    },
  );
}
