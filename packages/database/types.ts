/**
 * @repo/database — generated types entry point.
 *
 * REAL SCHEMA TYPES: run `pnpm --filter @repo/database db:types` against a
 * running local Supabase (requires Docker + `supabase start`). The command
 * regenerates this file via `supabase gen types typescript`.
 *
 * This placeholder keeps type-checking deterministic in environments without
 * Supabase CLI auth. The previous committed content was a raw Supabase CLI
 * error payload (JSON) — not valid TypeScript — which broke `tsc` for any
 * consumer that reached this file. See scripts/dev.sh Phase 2 for how the
 * local stack is brought up.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export default Database;
