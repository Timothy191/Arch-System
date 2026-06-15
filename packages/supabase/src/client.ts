import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  if (typeof window !== "undefined") {
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

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
}
