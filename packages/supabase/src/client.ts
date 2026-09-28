import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
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
