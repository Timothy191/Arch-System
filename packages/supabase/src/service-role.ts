import { createClient } from "@supabase/supabase-js";

// AGENT-TRACE: Simple APIError class for package-level use
// Removed unused options parameter to fix ESLint warnings preventing git push
// This class is intentionally simple - errors are thrown internally within the package
class APIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "APIError";
  }
}

export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new APIError(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables",
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
