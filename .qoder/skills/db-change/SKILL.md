---
name: db-change
description: Add or change Arch-System database schema safely. Use for new tables, columns, RLS policies, migrations, or contract parity work; covers migration numbering, Zod schemas, type regeneration, and drift gates.
---

# Database Change

Follow the order below; the drift gate fails if the contract is skipped.

## 1. Inspect current state

```bash
ls packages/database/migrations | sort | tail -5
git status --short
```

Use the next integer prefix after the highest existing migration. Never rename or renumber an applied migration; `0145_` and `0146_` are deliberate 4-digit outliers.

## 2. Write the migration

Create `packages/database/migrations/NNN_description.sql`.

- Never write under `packages/supabase/migrations`; it is a symlink to `packages/database/migrations`.
- New tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` plus explicit policies.
- Intentionally exempt tables need `-- rls-exempt-table <table>: <why>` in the migration.

## 3. Update the contract

Add or update the Zod schema under `packages/contract/src/schemas/` and export the schema plus its inferred type from `src/index.ts`.

```bash
pnpm --filter @repo/contract test
pnpm --filter @repo/contract build
```

## 4. Regenerate and verify

```bash
pnpm --filter @repo/database db:types
pnpm lint:migrations
pnpm --filter @repo/database test
pnpm audit:drift
```

## 5. Report

State the migration filename, tables/columns affected, RLS decisions, and each gate result. Do not claim contract parity unless `pnpm audit:drift` passes.
