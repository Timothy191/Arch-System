const LOCAL_API_PORT = "54321";
const LOCAL_STUDIO_PORT = "54323";

/**
 * Resolve Supabase Studio URL from the configured API URL.
 * - Local dev: maps API port 54321 → Studio port 54323
 * - Hosted: https://<ref>.supabase.co → Supabase dashboard project page
 * - Override: NEXT_PUBLIC_SUPABASE_STUDIO_URL when set
 */
export function resolveSupabaseStudioUrl(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_STUDIO_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const apiUrl = (supabaseUrl ?? `http://127.0.0.1:${LOCAL_API_PORT}`).trim().replace(/\/$/, "");

  const hosted = apiUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  if (hosted) {
    return `https://supabase.com/dashboard/project/${hosted[1]}`;
  }

  try {
    const parsed = new URL(apiUrl);
    if (!parsed.port || parsed.port === LOCAL_API_PORT) {
      parsed.port = LOCAL_STUDIO_PORT;
    }
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return `http://127.0.0.1:${LOCAL_STUDIO_PORT}`;
  }
}
