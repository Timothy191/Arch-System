import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { instrumentedFetch } from "./server";

/**
 * Creates a Supabase client pointed at the read replica (if configured).
 * Falls back to the primary URL when SUPABASE_READ_REPLICA_URL is not set.
 *
 * Use this for read-only Server Component queries (dashboards, reports, hub page).
 * Always use createServerSupabaseClient() for mutations.
 */
export async function createReadReplicaClient(cookieList?: Array<{ name: string; value: string }>) {
  let cookieStore: any = null;
  if (!cookieList) {
    cookieStore = await cookies();
  }
  const replicaUrl =
    process.env.SUPABASE_READ_REPLICA_URL && process.env.SUPABASE_READ_REPLICA_URL.trim() !== ""
      ? process.env.SUPABASE_READ_REPLICA_URL
      : process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        "https://mrwhtxbhrzyttlsyuofc.supabase.co";

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  return createServerClient(replicaUrl, anonKey, {
    global: {
      fetch: instrumentedFetch,
    },
    cookies: {
      getAll() {
        if (cookieList) return cookieList;
        return cookieStore ? cookieStore.getAll() : [];
      },
      setAll(cookiesToSet) {
        if (cookieList) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore?.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}
