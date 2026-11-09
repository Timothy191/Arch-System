export interface SupabasePublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Resolves the canonical Supabase URL and publishable/anon key from environment variables.
 * Per Supabase docs: prefers NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and falls back to
 * NEXT_PUBLIC_SUPABASE_ANON_KEY for backward compatibility.
 */
export function resolveSupabasePublicConfig(): SupabasePublicConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'Missing Supabase URL: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in the environment.'
    );
  }

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
