import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envSupabaseUrl) {
    throw new Error(
      'Missing Supabase URL: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in the environment.'
    );
  }
  let supabaseUrl = envSupabaseUrl;
  // Per Supabase docs: use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  // Fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY for backward compatibility
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error(
      'Missing Supabase publishable key: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY) in the environment.'
    );
  }

  // The hostname-rewrite below exists ONLY for the LAN on-prem deployment, where the
  // browser must reach Supabase via the server's LAN IP instead of `localhost`. Hosted /
  // cloud Supabase is always served over HTTPS at a fixed `<ref>.supabase.co` hostname.
  // Rewriting that URL to the current window hostname would redirect every client call
  // to the portal itself and break auth/data. We therefore perform the rewrite only when
  // the configured Supabase URL is NOT an HTTPS (hosted/cloud) endpoint.
  if (
    typeof window !== 'undefined' &&
    !(() => {
      try {
        return new URL(supabaseUrl).protocol === 'https:';
      } catch {
        // Unparseable URL — fall back to the configured value verbatim.
        return true;
      }
    })()
  ) {
    const hostname = window.location.hostname;
    try {
      const url = new URL(supabaseUrl);
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
          url.hostname = '127.0.0.1';
          supabaseUrl = url.toString();
        }
      } else if (url.hostname !== hostname) {
        url.hostname = hostname;
        supabaseUrl = url.toString();
      }
    } catch (_e) {
      // Ignore URL parsing errors
    }
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      // Use Supabase's default cookie-based storage instead of localStorage/sessionStorage
      // This ensures tokens are stored in HttpOnly Secure cookies for better security
      storage: undefined,
    },
    cookieOptions: {
      maxAge: undefined,
      expires: undefined,
    },
  });
}
