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

## 1. Immutable Migrations & Canonical Single-Tree SSoT

- **Canonical directory**: `packages/database/migrations/NNN_description.sql` (zero-padded 3-digit prefix + `snake_case` slug, e.g., `195_add_fleet_anomaly_indices.sql`).
- **Symlink guard**: `packages/supabase/migrations` and `packages/database/supabase/migrations` are symlinks to `packages/database/migrations` — **never** write, copy, or create files directly in symlinked paths (`check-migration-drift.mjs`).
- **Strict immutability**: Never rename, renumber, delete, or mutate an applied migration (`supabase_migrations.schema_migrations` keys on the version prefix). Always create a new forward incremental migration.

## 2. Mandatory Row Level Security (RLS) & Tenant/Department Isolation

- Every newly created table MUST enable RLS in the same migration:
  ```sql
  ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
  ```
  System-only tables that intentionally omit user policies must declare an audited exemption reason (≥8 chars): `-- rls-exempt-table public.<table_name>: <reason>` (or `-- rls-exempt: <reason>`). Never issue `DISABLE ROW LEVEL SECURITY`.
- Define explicit RLS policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` enforcing tenant/department isolation via `public.employees` (`department_id`, `accessible_departments`, and `role IN ('ADMIN', 'EXECUTIVE')`). Wrap `(SELECT auth.uid())` in a scalar subquery for PostgreSQL InitPlan caching:
  ```sql
  CREATE POLICY "<table_name>_dept_read" ON public.<table_name>
    FOR SELECT USING (
      department_id IN (
        SELECT e.department_id FROM public.employees e WHERE e.auth_id = (SELECT auth.uid())
      ) OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.auth_id = (SELECT auth.uid()) AND e.role IN ('ADMIN', 'EXECUTIVE')
      )
    );
  ```
- **Forbidden legacy join tables in RLS**: Never reference `public.employee_departments` (does not exist in production). Always authorize multi-department access via `public.employees.department_id` and `department_id = ANY(e.accessible_departments)` with `e.auth_id = (SELECT auth.uid())`.
- **`SECURITY DEFINER` RPC hardening**: Always pin `SET search_path = ''` (or `public, pg_temp`), schema-qualify every relation (`public.<table>`), verify `auth.uid()` and department access inside the body, and restrict execution (`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;`).

## 3. Zero-Downtime DDL & Squawk Linting (`pnpm lint:migrations`)

- **Expand-and-contract DDL**: Add columns as nullable or with a non-volatile default; never add `NOT NULL` without a default on existing tables, and never drop active columns in the same release as application code removal.
- **Idempotency & lock safety**: Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and `DROP ... IF EXISTS`. Never run `REFRESH MATERIALIZED VIEW CONCURRENTLY` inside a `DO $$` / `plpgsql` block or transactional migration (schedule via `cron.schedule(...)`).
- **Verification**: Run `pnpm lint:migrations` (Squawk + RLS policy gate), `node tools/audits/audit-rls-matrix.cjs`, and `pnpm --filter @repo/database test`.

## 4. Canonical Zod Contract Parity (`@repo/contract`)

- Every table or column added/modified in `packages/database/migrations/` MUST have a matching Zod schema in `packages/contract/src/schemas/*.schema.ts` (and `_registry.ts`).
- Run `pnpm audit:drift` (`node tools/audits/audit-contract-drift.cjs`) and `pnpm --filter @repo/database db:types` to maintain a 100% Drift Health Index (DHI).

## 5. Live PostgreSQL Query Parity & Monotonic Telemetry Guardrails

- **Live column verification over mocked tests**: Mocked Jest unit tests do not validate PostgREST column names. Whenever writing or modifying `.from('<table>').select(...)`, `.eq(...)`, or `.order(...)` queries (especially on `smr_readings`, `machine_operations`, `hourly_loads`, `fleet`, and `print_jobs`), verify every projected and filtered column against `packages/database/migrations/` and live `information_schema.columns`:
  - `public.smr_readings` uses `(meter_id, reading, reading_at, recorded_by)` — never `(machine_id, reading_hours, reading_date)`.
  - `public.hourly_loads` is the canonical production payload table — never query `production_loads`.
  - `public.print_jobs` uses `(photo_url, queued_at)` — never `(photo_path, created_at)`.
- **Monotonic SMR odometer & `localStorage` draft clamping**:
  - Any client form that persists `arch_*_draft_*` state in `localStorage` and tracks cumulative meters (`start_smr` / `end_smr` / `latest_smu`) MUST clamp restored draft baselines to `Math.max(draftStartSmu, selectedMachine.latest_smu)` so stale browser drafts never re-introduce odometer inversions.
  - Both client forms and Server Actions must enforce `start_smr >= latest_smu` and `end_smr >= start_smr` (with `end_smr - start_smr <= 12.0` per shift) and upsert existing `(department_id, machine_id, shift_date, shift_type)` shift rows rather than issuing blind `.insert()` calls.
