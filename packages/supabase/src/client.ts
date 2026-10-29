import { createBrowserClient } from '@supabase/ssr';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserSupabaseClient | null = null;

function readSupabaseEnv() {
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envSupabaseUrl) {
    throw new Error(
      'Missing Supabase URL: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in the environment.'
    );
  }
  const supabaseUrl = envSupabaseUrl;

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

  return { supabaseUrl, supabaseAnonKey };
}

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv();
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

export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: create a fresh client per request (no document/cache access)
    return createBrowserSupabaseClient();
  }
  if (!browserClient) browserClient = createBrowserSupabaseClient();
  return browserClient;
}

export function __resetBrowserSupabaseClientForTests(): void {
  browserClient = null;
}
