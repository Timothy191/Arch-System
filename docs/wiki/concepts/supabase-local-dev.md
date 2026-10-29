---
title: Supabase Local Development
created: 2026-05-15
updated: 2026-10-29
type: concept
tags: [database, infrastructure, workflow, convention]
sources: [docs/wiki/raw/articles/arch-systems-project-overview.md, packages/database/package.json]
confidence: high
---

# Supabase Local Development

[[arch-systems|Arch-Systems]] uses **Supabase** (PostgreSQL 17, Auth, Realtime CDC, and Storage) as its backend data platform. Developers can run against a local Supabase CLI stack or synchronize with a linked cloud project while maintaining `packages/database/migrations/` as the single source of truth.

## Migration Single Source of Truth

All SQL migrations live in `packages/database/migrations/` (with `packages/supabase/migrations` symlinked to it).

- **Naming convention**: Zero-padded 3-digit prefix + `snake_case` description (e.g., `163_shift_closeout_rpc.sql`, `185_plant_processing_tables.sql`).
- **Immutability**: Applied migrations are never renamed or renumbered. Schema changes always require a new forward migration and a matching Zod schema update in `@repo/contract`.

## Essential Commands

```bash
# Start portal with automated Supabase connectivity checks
pnpm dev

# Run migration rollback-safety and offline-mutation security checks
pnpm --filter @repo/database test

# Regenerate TypeScript types from the active Supabase schema
pnpm --filter @repo/database db:types

# Lint changed migrations (Squawk + RLS verification)
pnpm lint:migrations

# Verify zero drift between SQL migrations and @repo/contract Zod schemas
pnpm audit:drift
```

## Client Factories (`@repo/supabase`)

Direct imports of `packages/database` from `apps/*` are prohibited by `tools/repo/policy-compiler.cjs`. Always use the typed client factories exported by `@repo/supabase`:

- **Server Components / Server Actions / Route Handlers**: `createServerSupabaseClient()` from `@repo/supabase/server`
- **Client Components (Realtime CDC only)**: `createBrowserSupabaseClient()` from `@repo/supabase/client`
- **Request Proxy / Middleware**: `updateSession()` in `apps/portal/server/proxy.ts`
- **Typed Query Builder**: `createKyselyClient()` from `@repo/supabase/kysely`

## Row Level Security (RLS) Verification

Every table created in `packages/database/migrations/` must enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and wrap `auth.uid()` inside an initplan subselect (`(SELECT auth.uid())`) for optimal PostgreSQL query performance. See [[rls-policy]] and [[database-schema]] for policy templates.

## Related

- [[arch-systems]] — parent system overview
- [[database-schema]] — full PostgreSQL schema and table reference
- [[rls-policy]] — Row Level Security standards and helpers
- [[auth-middleware]] — authentication and RBAC proxy pipeline
- [[turborepo-monorepo]] — monorepo package boundaries and build scripts
