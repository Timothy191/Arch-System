import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a Supabase client for use in Next.js middleware.
 *
 * Per Supabase official docs (https://supabase.com/docs/guides/auth/server-side/creating-a-client):
 * - Use getClaims() to verify identity (validates JWT signature locally)
 * - Use getUser() only when you need fresh user data from Auth server
 * - Never trust getSession() for authorization decisions
 */
export async function createMiddlewareClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
        const all = request.cookies.getAll();
        const normalized = [...all];
        for (const cookie of all) {
          const match = cookie.name.match(/^__tb\d+_(sb-.*)$/);
          if (match && match[1] && !all.some((c: { name: string }) => c.name === match[1])) {
            normalized.push({ name: match[1], value: cookie.value });
          }
        }
        return normalized;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            maxAge: options?.maxAge ?? 34560000,
            path: options?.path ?? "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          }),
        );
      },
    },
  });

  return {
    supabase,
    get response() {
      return supabaseResponse;
    },
  };
}

/**
 * Refreshes the session token using getClaims().
 *
 * Per Supabase docs, this should be called in middleware to:
 * 1. Validate the JWT signature
 * 2. Refresh the token if needed
 * 3. Update cookies for both server and browser
 */
export async function refreshSession(supabase: ReturnType<typeof createServerClient>) {
  try {
    // Use getUser() to validate and refresh the token
    // This is preferred over getSession() which doesn't guarantee revalidation
    const { error } = await supabase.auth.getUser();

    if (error) {
      console.error("Session refresh failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error during session refresh:", err);
    return false;
  }
}
