<!-- cspell:ignore mrwhtxbhrzyttlsyuofc Squawk InitPlan -->

# Migrations Overview

This directory (`packages/database/migrations/`) is the canonical source of truth for **Arch-System** PostgreSQL 17 schema migrations, synced to Cloud Supabase (`mrwhtxbhrzyttlsyuofc`).

Deploy-time paths (`packages/supabase/migrations` and `packages/database/supabase/migrations`) resolve here via symlinks.

## Authoring Standards

1. **Sequential Naming**: Use 3-digit zero-padded immutable filenames (`NNN_snake_case.sql`). Never rename, renumber, or delete applied `.sql` migrations.
2. **Rollback & Idempotency Safety**: Always guard DDL with `IF NOT EXISTS` / `IF EXISTS` (`pnpm --filter @repo/database check-migrations`).
3. **PG17 Squawk Linting**: All migrations must pass Squawk (`pnpm --filter @repo/database lint:migrations`). Annotate transactional index drops on legacy duplicate indexes with `-- squawk-ignore require-concurrent-index-deletion`.
4. **RLS & InitPlan Performance**: Every `public` table must enable Row-Level Security, consult `(SELECT auth.uid())` (InitPlan-wrapped) and `public.employees` / `public.has_department_access()`, and pass `pnpm --filter @repo/database test` and `pnpm audit:rls-matrix`.
