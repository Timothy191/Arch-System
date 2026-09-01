import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  let supabaseUrl =
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

  // The hostname-rewrite below exists ONLY for the LAN on-prem deployment, where the
  // browser must reach Supabase via the server's LAN IP instead of `localhost`. Hosted /
  // cloud Supabase is always served over HTTPS at a fixed `<ref>.supabase.co` hostname.
  // Rewriting that URL to the current window hostname would redirect every client call
  // to the portal itself and break auth/data. We therefore perform the rewrite only when
  // the configured Supabase URL is NOT an HTTPS (hosted/cloud) endpoint.
  if (
    typeof window !== "undefined" &&
    !(() => {
      try {
        return new URL(supabaseUrl).protocol === "https:";
      } catch {
        // Unparseable URL — fall back to the configured value verbatim.
        return true;
      }
    })()
  ) {
    const hostname = window.location.hostname;
    try {
      const url = new URL(supabaseUrl);
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
          url.hostname = "127.0.0.1";
          supabaseUrl = url.toString();
        }
      } else if (url.hostname !== hostname) {
        url.hostname = hostname;
        supabaseUrl = url.toString();
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  return createBrowserClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
