/* global RequestInfo, RequestInit */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

import { serverLogger } from "@repo/logger";

export async function instrumentedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const start = performance.now();
  let response: Response | null = null;
  let success = false;

  try {
    response = await fetch(input, init);
    success = response.ok;
    return response;
  } finally {
    const duration = performance.now() - start;
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = init?.method ?? "GET";

    let tableName = "unknown";
    if (urlStr) {
      try {
        const url = new URL(urlStr);
        const segments = url.pathname.split("/");
        const restIndex = segments.indexOf("v1");
        if (restIndex !== -1 && segments[restIndex + 1]) {
          tableName = segments[restIndex + 1]!.split("?")[0] || "unknown";
        }
      } catch {
        // ignore
      }
    }

    const logData = {
      tableName,
      method,
      durationMs: Math.round(duration),
      success,
    };

    if (duration > 500) {
      serverLogger.warn(
        logData,
        `Slow database query detected: ${tableName} (${method}) took ${logData.durationMs}ms`,
      );
    } else if (!success) {
      serverLogger.error(logData, `Database query failed: ${tableName} (${method})`);
    } else {
      serverLogger.debug(
        logData,
        `Database query: ${tableName} (${method}) in ${logData.durationMs}ms`,
      );
    }
  }
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
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
    global: {
      fetch: instrumentedFetch,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              maxAge: undefined,
              expires: undefined,
            }),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Safely gets the current user from Supabase auth using getClaims().
 *
 * Per Supabase official docs (https://supabase.com/docs/guides/auth/server-side/creating-a-client):
 * - Use getClaims() to protect pages and user data (verifies JWT signature locally)
 * - getUser() makes a network call and should only be used when you need fresh user data
 * - getSession() should not be trusted for authorization decisions
 *
 * getClaims() is preferred because it:
 * - Validates JWT signature against published public keys
 * - Works locally via WebCrypto API (faster, no network call)
 * - Returns claims from decoding the JWT, not from a user lookup
 *
 * Returns null if the user is not authenticated or if token validation fails.
 */
export async function getUserSafely(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<User | null> {
  try {
    // Use getClaims() for identity verification (recommended by Supabase docs)
    // This validates the JWT signature locally without making a network call
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data) {
      return null;
    }

    // getClaims() returns JWT claims, not the full User object
    // If you need the full User object, use getUser() instead
    // For most authorization purposes, the claims are sufficient
    return data as unknown as User;
  } catch (error) {
    // Handle token validation errors gracefully
    // This can happen when the token is invalid, expired, or malformed
    return null;
  }
}
