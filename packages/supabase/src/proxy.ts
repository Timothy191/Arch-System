/**
 * Supabase Proxy for Token Refresh in Server Components
 *
 * Per Supabase official docs (https://supabase.com/docs/guides/auth/server-side/creating-a-client):
 * - Server Components can't write cookies directly
 * - A Proxy is needed to refresh expired Auth tokens and store them
 * - The Proxy handles:
 *   1. Refreshing the Auth token by calling supabase.auth.getClaims()
 *   2. Passing the refreshed Auth token to Server Components via request.cookies.set
 *   3. Passing the refreshed Auth token to the browser via response.cookies.set
 *
 * This implementation follows the recommended pattern from Supabase docs.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Updates the session by refreshing the Auth token if needed.
 * This implements the Supabase Proxy pattern for Server Components.
 *
 * @param request - The incoming Next.js request
 * @returns The response with updated cookies
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Create response to modify
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://mrwhtxbhrzyttlsyuofc.supabase.co";
  // Per Supabase docs: use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  // Fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY for backward compatibility
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.nEt4Hfb3DGQtFPofXNRWUBX6zXyTXTJvcb9xLoBGDg";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // First, set cookies on the request for Server Components
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        // Recreate the response to apply cookie changes
        supabaseResponse = NextResponse.next({
          request,
        });

        // Then, set cookies on the response for the browser
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, {
            ...options,
            maxAge: undefined,
            expires: undefined,
            // Enforce security: HttpOnly prevents XSS, Secure ensures HTTPS-only
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          });
        });
      },
    },
  });

  // IMPORTANT: Do NOT use supabase.auth.getSession() here!
  // Per Supabase docs: "It isn't guaranteed to revalidate the Auth token"
  // Use getClaims() to verify identity (validates JWT signature)
  // or getUser() when you need fresh user data from Auth server

  try {
    // Refresh the token by calling getClaims()
    // This validates the JWT signature and refreshes if needed
    const { error } = await supabase.auth.getClaims();

    if (error) {
      // Token refresh failed - could be expired or invalid
      // The response will still be returned, but without valid auth
      console.error("Token refresh failed:", error.message);
    }
  } catch (err) {
    // Handle any unexpected errors during token refresh
    console.error("Unexpected error during token refresh:", err);
  }

  // IMPORTANT: Do NOT set any Response headers here!
  // The response headers are set by the cookie setAll above.
  // Setting additional headers here would overwrite the cookie changes.

  return supabaseResponse;
}

/**
 * Creates a Supabase client for use in the Proxy.
 * This is used internally by updateSession.
 *
 * @deprecated Use updateSession() directly instead
 */
export async function createProxyClient(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://mrwhtxbhrzyttlsyuofc.supabase.co";
  // Per Supabase docs: use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  // Fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY for backward compatibility
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.nEt4Hfb3DGQtFPofXNRWUBX6zXyTXTJvcb9xLoBGDg";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
      },
    },
  });
}
