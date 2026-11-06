---
name: database-migrations
description: Immutable migration sequencing, zero-downtime DDL, Squawk linting, Row Level Security (RLS) isolation, and Zod contract parity rules for PostgreSQL.
paths:
  - 'packages/database/**/*.{sql,ts,mjs}'
  - 'packages/supabase/src/**/*.ts'
  - 'packages/contract/src/schemas/**/*.ts'
  - 'tools/audits/audit-rls*.cjs'
  - 'tools/audits/audit-contract-drift.cjs'
---

# Database Migration, RLS & Schema Parity Rules

## 1. Immutable Migrations

- Canonical: `packages/database/migrations/NNN_description.sql` (3-digit prefix + snake_case, e.g. `195_add_fleet_anomaly_indices.sql`).
- `packages/supabase/migrations` and `packages/database/supabase/migrations` are symlinks — **never** write there (`check-migration-drift.mjs`).
- Never rename, renumber, delete, or mutate an applied migration (`supabase_migrations.schema_migrations` keys on prefix); add a new forward migration.

## 2. Mandatory RLS

- Every new table MUST `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` in the same migration. System-only exemptions need a reason ≥8 chars: `-- rls-exempt-table public.<t>: <reason>` (or `-- rls-exempt: <reason>`). Never `DISABLE ROW LEVEL SECURITY`.
- Explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies isolating via `public.employees` (`department_id`, `accessible_departments`, `role IN ('ADMIN', 'EXECUTIVE')`), always `e.auth_id = (SELECT auth.uid())` (scalar subquery for InitPlan caching).
- Never reference `public.employee_departments` (not in production); use `department_id = ANY(e.accessible_departments)`.
- `SECURITY DEFINER`: `SET search_path = ''` (or `public, pg_temp`), schema-qualify relations, verify `auth.uid()` + department access in body, `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;`.

## 3. Zero-Downtime DDL (`pnpm lint:migrations`)

- Add columns nullable or with non-volatile default; never `NOT NULL` without default on existing tables; never drop active columns in the same release as code removal.
- Use `IF NOT EXISTS` / `IF EXISTS`. Never `REFRESH MATERIALIZED VIEW CONCURRENTLY` in `DO $$`/plpgsql or transactional migrations (use `cron.schedule(...)`).
- Verify: `pnpm lint:migrations`, `node tools/audits/audit-rls-matrix.cjs`, `pnpm --filter @repo/database test`.

## 4. Zod Contract Parity

- Every added/modified table/column MUST have a Zod schema in `packages/contract/src/schemas/*.schema.ts` (and `_registry.ts`).
- Run `pnpm audit:drift` (`node tools/audits/audit-contract-drift.cjs`) and `pnpm --filter @repo/database db:types` (100% DHI).

## 5. Live Column Parity & Monotonic SMR

- Mocked Jest does not validate PostgREST columns. Verify every `.select`/`.eq`/`.order` column (esp. `smr_readings`, `machine_operations`, `hourly_loads`, `fleet`, `print_jobs`) against migrations and live `information_schema.columns`:
  - `smr_readings`: `(meter_id, reading, reading_at, recorded_by)` — never `(machine_id, reading_hours, reading_date)`.
  - `hourly_loads` is canonical — never `production_loads`.
  - `print_jobs`: `(photo_url, queued_at)` — never `(photo_path, created_at)`.
- Forms persisting `arch_*_draft_*` with cumulative meters MUST clamp restored baselines to `Math.max(draftStartSmu, selectedMachine.latest_smu)`.
- Forms and Server Actions enforce `start_smr >= latest_smu`, `end_smr >= start_smr`, `end_smr - start_smr <= 12.0`, and upsert on `(department_id, machine_id, shift_date, shift_type)` — no blind `.insert()`.
