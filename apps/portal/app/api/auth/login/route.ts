import { createServerSupabaseClient } from "@repo/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user with email and password
 *     description: Authenticates a user using Supabase auth with rate limiting and CSRF protection
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Authentication successful. Session is maintained by server-side cookies.
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Invalid request origin
 *       415:
 *         description: Unsupported Media Type
 *       429:
 *         description: Too many authentication attempts
 *       503:
 *         description: Authentication service unavailable
 */

/**
 * Login API Route with Server-Side Rate Limiting & CSRF Protection.
 *
 * Security invariants:
 * - Authentication state is maintained by the server-side Supabase SSR client.
 * - Access and refresh tokens are never returned in the JSON response.
 * - The complete Supabase session object is never serialized into the response.
 * - Credentials and session material are never logged here.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  if (process.env.NODE_ENV === "production") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      let appOrigin: string;
      try {
        appOrigin = new URL(appUrl).origin;
      } catch {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }

      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");

      if (origin) {
        if (origin !== appOrigin) {
          return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
        }
      } else if (referer) {
        try {
          if (new URL(referer).origin !== appOrigin) {
            return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }
    }
  }

  return withRateLimit(
    request,
    async () => {
      try {
        const body = await request.json();
        const email = typeof body?.email === "string" ? body.email.trim() : "";
        const password = typeof body?.password === "string" ? body.password : "";

        if (!email || !password) {
          return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const errMsg = error.message ? error.message.toLowerCase() : "";
          const status = (error as { status?: number }).status || 0;

          const isUpstreamFailure =
            status >= 500 ||
            errMsg.includes("fetch failed") ||
            errMsg.includes("networkerror") ||
            errMsg.includes("timeout") ||
            errMsg.includes("econnrefused") ||
            errMsg.includes("failed to fetch") ||
            errMsg.includes("invalid api key");

          if (isUpstreamFailure) {
            return NextResponse.json(
              { error: "Authentication service is temporarily unavailable. Please try again later." },
              { status: 503 },
            );
          }

          const isRateLimitError = status === 429 || errMsg.includes("rate limit");
          if (isRateLimitError) {
            return NextResponse.json(
              { error: "Too many attempts. Please wait a moment and try again." },
              { status: 429 },
            );
          }

          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Supabase SSR writes the authenticated session to server-side cookies.
        // Never return access_token, refresh_token, or the complete session object.
        return NextResponse.json({ success: true, redirectTo: "/" }, { status: 200 });
      } catch (err) {
        if (err instanceof SyntaxError) {
          return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }

        const isNetworkOrTimeout =
          err instanceof Error &&
          (err.message.toLowerCase().includes("fetch failed") ||
            err.message.toLowerCase().includes("timeout") ||
            err.message.toLowerCase().includes("econnrefused"));

        if (isNetworkOrTimeout) {
          return NextResponse.json(
            { error: "Authentication service is temporarily unavailable. Please try again later." },
            { status: 503 },
          );
        }

        return NextResponse.json({ error: "An error occurred during sign in" }, { status: 500 });
      }
    },
    {
      customLimit: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
      },
    },
  );
}
