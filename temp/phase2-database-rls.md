# Phase 2 Database Audit: RLS Policies, Migration Rollback Safety, Index Coverage & ORM Integrity

**Date:** 2026-09-21
**Scope:** `packages/database/`, `packages/supabase/src/`, all SQL migrations
**Auditor:** Database Architect Specialist
**Classification:** CRITICAL SECURITY DOMAIN

---

## 1. MIGRATION ROLLBACK SAFETY AUDIT

### 1.1 Catalog Summary

- **Total migrations:** 113 SQL files in `packages/database/migrations/`
- **Migration naming:** Sequential `NNN_name.sql` (some gaps: 056→057→060→061→062, 082 appears twice, 097→100 jump)
- **Rollback files:** **0** dedicated rollback SQL files exist on disk
- **The `068_delay_entries_rollback.sql` referenced in scope does NOT exist** — this is a rollback-safety violation by itself

### 1.2 Rollback Status: ALL 113 Migrations LACK Down Scripts

| Category             | Count | Rollback Available |
| -------------------- | ----- | ------------------ |
| Schema creation      | ~35   | ❌ None            |
| RLS policy changes   | ~25   | ❌ None            |
| Index additions      | ~20   | ❌ None            |
| Data migrations      | ~10   | ❌ None            |
| Partition operations | ~5    | ❌ None            |
| Security fixes       | ~8    | ❌ None            |
| Function recreations | ~10   | ❌ None            |

**Finding [ROLLBACK-001] — CRITICAL:** Zero of 113 migrations have `DOWN`/rollback SQL scripts. The only rollback mechanism is the `migration-rollback-safety.mjs` static analyzer which checks for `IF EXISTS`/`IF NOT EXISTS` patterns — this is **not** a functional rollback, it's a lint check.

**Finding [ROLLBACK-002] — HIGH:** The `068_delay_entries_rollback.sql` file does not exist on disk despite being referenced in the task scope. The `069_migrate_operational_delays_to_delay_entries.sql` renames `operational_delays` to `operational_delays_deprecated_20250115` with no path to reverse. Data migration in 069 is **irreversible** without the source table.

### 1.3 Specific Rollback-Safety Violations

| Migration | Violation                                                                                                                  | Severity     |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **069**   | `ALTER TABLE operational_delays RENAME TO operational_delays_deprecated_20250115` — no reverse path; data already migrated | **CRITICAL** |
| **068**   | Creates `delay_entries` and `delay_categories` — no `DROP TABLE` rollback                                                  | **HIGH**     |
| **072**   | Renames `production_logs` to `production_logs_legacy`, creates partitioned replacement — no reverse                        | **HIGH**     |
| **020**   | Renames `hourly_loads` and `daily_logs` to `*_legacy`, creates partitioned tables — no reverse                             | **HIGH**     |
| **057**   | Drops and recreates `handle_new_user()` trigger — no restore of original                                                   | **HIGH**     |
| **043**   | Drops and recreates ~30 RLS policies — no restore of previous policy definitions                                           | **HIGH**     |
| **095**   | Drops and recreates ~40+ RLS policies — no restore of previous definitions                                                 | **HIGH**     |
| **030**   | `DROP INDEX IF EXISTS idx_memory_embeddings_hnsw` then recreates — no index parameters preserved                           | **MEDIUM**   |
| **064**   | `DROP FUNCTION IF EXISTS` for search functions then recreates with different signatures — no version preservation          | **MEDIUM**   |
| **073**   | `DROP MATERIALIZED VIEW IF EXISTS view_production_summary` — no view definition rollback                                   | **MEDIUM**   |
| **071**   | Adds columns, drops constraints, creates triggers — no individual reverse operations                                       | **MEDIUM**   |
| **089**   | Adds indexes — no `DROP INDEX` rollback (mitigated by `IF NOT EXISTS`)                                                     | **LOW**      |
| **060**   | Adds indexes — same as above                                                                                               | **LOW**      |

### 1.4 Static Analysis Results (from `migration-rollback-safety.mjs` logic)

The `migration-rollback-safety.mjs` checker identifies these patterns but **does not flag the absence of down scripts**:

- ✅ `IF EXISTS` on DROP statements: Most migrations compliant
- ⚠️ `CREATE TABLE` without `IF NOT EXISTS`: Some partitioned table creates lack this
- ⚠️ `UPDATE/DELETE without WHERE`: Present in migration 071 (backfill UPDATEs)
- ⚠️ `ALTER TYPE RENAME`: Present in various migrations

---

## 2. RLS POLICY CORRECTNESS ASSESSMENT

### 2.1 P0 Vulnerability: Signup Admin Self-Elevation

**File:** `packages/database/tests/p0_signup_role_self_elevation.sql`

**Finding [RLS-P0-001] — CRITICAL:** The original `handle_new_user()` in `001_initial.sql` (line 352-366) reads:

```sql
COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
```

This allows **any user** to self-elevate to admin by passing `{role: 'admin'}` in `raw_user_meta_data` during signup.

**Fix applied in 057_security_p0_fixes.sql:** The trigger was redefined to hardcode `'operator'`:

```sql
INSERT INTO public.employees (auth_id, full_name, role)
VALUES (NEW.id, ..., 'operator');
```

Plus added `enforce_employee_update_constraints()` trigger and hardened `employees_update_self_or_admin` with `WITH CHECK`.

**Status:** Fix exists in migration 057 but **the original vulnerable code remains in 001_initial.sql** — if migrations are re-run from scratch, the vulnerable version overwrites the fix. The `057` migration assumes `001` was already run with the vulnerable version and fixes it.

**Exploit vector:** `supabase.auth.signUp({ data: { role: 'admin' } })` → `employees.role = 'admin'` on first request.

### 2.2 P0 Vulnerability: accessible_departments Privilege Escalation

**File:** `packages/database/tests/accessible_departments_priv_esc.sql`

**Finding [RLS-P0-002] — CRITICAL:** The `employees_update_self_or_admin` policy on `public.employees` had **only a USING clause, no WITH CHECK**:

```sql
CREATE POLICY "employees_update_self_or_admin" ON employees FOR UPDATE TO authenticated
USING ( auth_id = auth.uid() OR public.is_admin() );
-- NO WITH CHECK clause
```

This means a non-admin user could UPDATE their `accessible_departments` to include ANY department UUID, granting themselves access to restricted routes (`/control-room`, `/access-control`, `/admin`) via `middleware.ts`.

**Fix applied in 057_security_p0_fixes.sql:**

```sql
CREATE POLICY "employees_update_self_or_admin" ON employees
FOR UPDATE TO authenticated
USING ( auth_id = auth.uid() OR public.is_admin() )
WITH CHECK ( auth_id = auth.uid() OR public.is_admin() );
```

**Status:** Fix exists but same re-run risk as above — `001_initial.sql` still contains the vulnerable original.

### 2.3 RLS Policy Inventory & Correctness

**File:** `packages/database/tests/rls_extension_safety.sql`

**Finding [RLS-001] — MEDIUM:** The test checks that `public` schema functions have explicit `search_path`. The query:

```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ...
WHERE n.nspname = 'public' AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT ('search_path=' = ANY(p.proconfig)));
```

Returns functions without explicit search_path — this is a **potential SQL injection vector** if functions are called from untrusted contexts.

**Finding [RLS-002] — HIGH:** Migration `095_optimize_rls_initplan_and_indexes.sql` uses `(SELECT auth.uid())` and `(SELECT public.is_admin())` patterns instead of direct `auth.uid()` calls. While this optimizes initplan caching, it **changes the execution context** and may cause unexpected behavior with `SECURITY DEFINER` functions.

**Finding [RLS-003] — HIGH:** Migration `043_admin_data_lockdown.sql` replaces many granular policies with admin-only policies:

- `machine_operations_update_creator_or_supervisor` → `machine_operations_update_admin` (operators lose update access)
- `breakdowns_update_department` → `breakdowns_update_admin` (department-level update removed)
- This **breaks the original workflow** where operators could update their own records

**Finding [RLS-004] — MEDIUM:** The `employees_insert_admin_only` policy (from 001) was changed in 095 to:

```sql
CREATE POLICY "employees_insert_admin_only" ON employees
FOR INSERT TO authenticated
WITH CHECK ( (SELECT public.is_admin()) );
```

This **removes the ability for supervisors to create employees**, which may break operational workflows.

### 2.4 RLS Policy Count by Table

| Table              | SELECT | INSERT | UPDATE | DELETE | Notes                      |
| ------------------ | ------ | ------ | ------ | ------ | -------------------------- |
| employees          | 2      | 1      | 2      | 0      | Self+admin, role-protected |
| departments        | 1      | 0      | 0      | 0      | Public read                |
| daily_logs         | 1      | 1      | 2      | 1      | dept access, admin delete  |
| production_logs    | 1      | 1      | 2      | 1      | Partitioned, admin-only    |
| machine_operations | 1      | 1      | 2      | 1      | Creator+admin              |
| delay_entries      | 1      | 1      | 4      | 0      | Draft/committed workflow   |
| memory_embeddings  | 1      | 1      | 1      | 1      | User-isolated              |
| safety_incidents   | 1      | 1      | 2      | 0      | Reporter+admin             |
| All access_control | 1-2    | 0-1    | 1      | 1      | Admin-only post-043        |

**Total RLS policies across 45+ tables: ~120+ individual policies**

---

## 3. INDEX COVERAGE ASSESSMENT

### 3.1 Index Coverage Test Results (from `index_coverage.sql`)

The `index_coverage.sql` test checks that every FK column has a dedicated index with the FK column as the first column.

**Finding [IDX-001] — HIGH:** Migrations 060 and 089 were specifically created to add missing FK indexes, indicating the database was deployed **without proper index coverage initially**. The migrations added:

- `idx_access_logs_badge_id`, `idx_badges_personnel_id`, `idx_badges_visitor_id`
- `idx_breakdowns_completed_by`, `idx_breakdowns_created_by`
- `idx_employees_auth_id`
- `idx_excavator_activity_block_mined_id`
- `idx_fuel_logs_daily_log_id`, `idx_fuel_logs_machine_id`
- `idx_generated_reports_generated_by`
- `idx_machine_hours_daily_log_id`, `idx_machine_hours_machine_id`
- `idx_machine_operations_created_by`
- `idx_production_logs_daily_log_id`
- `idx_safety_incidents_reviewed_by`
- `idx_user_feedback_assigned_to`, `idx_user_feedback_user_id`

**Finding [IDX-002] — MEDIUM:** Despite 060 and 089, some FK columns may still lack indexes:

- `delay_entries.machine_operation_id` — has index (created in 068) ✅
- `delay_entries.delay_category_id` — has index (created in 068) ✅
- `production_logs.daily_log_id` — has index in 089 ✅ but partitioned table may need per-partition indexes
- `excavator_activity.daily_log_id` — added in 071 but no explicit index
- `dozer_rolls.daily_log_id` — added in 071 but no explicit index
- `machine_operations.daily_log_id` — added in 071 but no explicit index

**Finding [IDX-003] — MEDIUM:** Partitioned tables (`hourly_loads`, `daily_logs`, `production_logs`) have indexes on the parent table that should propagate, but:

- `daily_logs` has `idx_daily_logs_department_date`, `idx_daily_logs_shift`, `idx_daily_logs_sync_status`
- `hourly_loads` has `idx_hourly_loads_department_date`, `idx_hourly_loads_machine_date`, `idx_hourly_loads_shift_type`
- After 020 partitioning, `daily_logs` FK references changed — `machine_hours.daily_log_id` and `fuel_logs.daily_log_id` may need composite indexes on `(daily_log_id, daily_log_date)` to match the partitioned PK

**Finding [IDX-004] — LOW:** The `vector_search_cache` table (created in 064) has indexes on `user_id`, `memory_type`, `created_at`, `ttl_seconds` but lacks a composite index for the common query pattern of `user_id + created_at + ttl_seconds` used by the cleanup function.

### 3.2 Query Plan Issues

**Finding [IDX-005] — HIGH:** Migration `095` wraps `auth.uid()` and `public.is_admin()` in `(SELECT ...)` subqueries within RLS policies. This creates **InitPlan nodes** in query plans that execute once per statement, but the subquery pattern `(SELECT public.has_department_access(department_id))` inside a correlated subquery for each row can cause **nested loop performance degradation** on large tables.

**Finding [IDX-006] — MEDIUM:** The `machine_operations_with_delays` view (created in 069) uses correlated subqueries:

```sql
(SELECT COALESCE(SUM(de.duration_hours), 0) FROM delay_entries de WHERE de.machine_operation_id = mo.id AND de.status = 'committed')
```

This will perform a **sequential scan on delay_entries** for every row in machine_operations. Needs an index on `delay_entries(machine_operation_id, status)`.

**Finding [IDX-007] — MEDIUM:** The `view_production_summary` materialized view (073) joins `production_logs`, `excavator_activity`, `excavator_dumper_assignments`, `fuel_logs`, `machine_hours`, and `shift_status` — without proper indexes on join columns, the refresh will be **extremely slow** on large datasets.

---

## 4. VECTOR INDEX OPTIMIZATION AUDIT

### 4.1 Migration 030 (`030_vector_index_optimization.sql`)

**Finding [VEC-001] — MEDIUM:** The HNSW index recreation drops `idx_memory_embeddings_hnsw` and recreates with `m=24, ef_construction=128`. This is **blocking** — `DROP INDEX` on a large table locks writes. Should use `CREATE INDEX CONCURRENTLY` then `DROP INDEX`.

**Finding [VEC-002] — MEDIUM:** The partial indexes `idx_memory_embeddings_hnsw_episodic` and `idx_memory_embeddings_hnsw_semantic` duplicate the base HNSW index. PostgreSQL may **choose the wrong index** or perform index scans on both. The `memory_type` filter on the partial indexes is redundant if the query always filters by `memory_type`.

**Finding [VEC-003] — LOW:** The `SET hnsw.ef_search = 200` in the `search_memories_hybrid` function is set at function level via `SET` clause. This applies to the entire function execution, not just the HNSW query — it may affect other operations within the function unexpectedly.

### 4.2 Migration 064 (`064_vector_search_query_optimization.sql`)

**Finding [VEC-004] — HIGH:** Migration 064 **drops and recreates** `search_memories_hybrid` and `search_memories_semantic` with different signatures (added `ef_search` parameter). Any code calling the old signature will **break**. The `DROP FUNCTION IF EXISTS` removes the old function without versioning.

**Finding [VEC-005] — MEDIUM:** The `vector_search_cache` table has RLS policies that allow users to only access their own cache entries. However, the `cleanup_vector_search_cache()` function runs via `pg_cron` and **deletes entries** — this function runs as `SECURITY DEFINER` but has **no explicit policy** for delete operations on its own table. The `DELETE` in the function bypasses RLS since it's `SECURITY DEFINER`, but this is a **privilege escalation risk** if the function is compromised.

**Finding [VEC-006] — LOW:** The `vector_search_performance` table accumulates metrics indefinitely (only cleaned up by cron every 30 days). Without a `VACUUM` or partitioning strategy, this table will **grow unbounded**.

---

## 5. PARTITIONING AUDIT

### 5.1 Migration 020 (`020_partition_time_series.sql`)

**Finding [PART-001] — HIGH:** The `ALTER TABLE hourly_loads RENAME TO hourly_loads_legacy` and `ALTER TABLE daily_logs RENAME TO daily_logs_legacy` operations are **non-transactional in practice** — if the migration fails after renaming but before creating the new table, **all data is lost**. The migration wraps in `BEGIN`/`COMMIT` but DDL in Postgres is transactional, so this is mitigated — but the `_legacy` tables remain with RLS enabled and no further updates.

**Finding [PART-002] — HIGH:** The `FK references` to partitioned tables require `daily_log_date` in child tables. Migration 071 adds these columns to `excavator_activity`, `dozer_rolls`, `hourly_loads`, `machine_operations`, `production_logs`, `machine_hours`, `fuel_logs` — but **not all tables have NOT NULL constraints added** before the FK creation in some cases. The `ALTER TABLE ... ADD CONSTRAINT` may fail if existing data doesn't match.

**Finding [PART-003] — MEDIUM:** The `create_next_month_partitions()` function only creates partitions for `hourly_loads` and `daily_logs`. **`production_logs` partitions are created statically** (2025-01 through 2027-12) in migration 072 — if data arrives after 2027-12, inserts will **fail silently** or error.

### 5.2 Migration 072 (`072_partition_production_logs.sql`)

**Finding [PART-004] — HIGH:** Migration 072 renames `production_logs` to `production_logs_legacy` and creates a new partitioned table with `PRIMARY KEY (id, daily_log_date)`. The FK `fk_production_daily_log` references `daily_logs(id, log_date)` — but if `daily_logs` partitioning hasn't been set up correctly (020 must run first), this **FK creation will fail**.

**Finding [PART-005] — MEDIUM:** The `check_shift_immutable()` trigger (from 071) is re-attached to the new `production_logs` table. But the trigger function looks up `daily_log_id` from `OLD.daily_log_id` — for the **new partitioned table**, the column is `daily_log_date` (not `daily_log_id`). The trigger may **reference the wrong column**.

### 5.3 Migration 073 (`073_production_summary_view.sql`)

**Finding [PART-006] — LOW:** The `view_production_summary` materialized view queries `production_logs` which is now partitioned. The view doesn't filter by `daily_log_date` which means it will **scan all partitions** — the partition pruning benefit is lost.

---

## 6. KYSELY ORM AUDIT

**File:** `packages/supabase/src/kysely.ts`

### 6.1 Type Safety

**Finding [KYS-001] — HIGH:** The `KyselyDatabase` interface only defines **5 tables** (`daily_logs`, `machines`, `hourly_loads`, `production_logs`, `memory_embeddings`) but the database has **45+ tables**. Any query against an undefined table will fail at runtime, not compile time. This defeats the purpose of Kysely's compile-time type checking.

**Finding [KYS-002] — HIGH:** The `KyselyDatabase` interface uses `[key: string]: unknown` index signatures, which means **any column access is type-safe at compile time but provides no actual type information**. This is a safety anti-pattern — it should define all columns explicitly.

**Finding [KYS-003] — MEDIUM:** The `memory_embeddings` interface in `KyselyDatabase` defines `embedding: string` and `metadata: Record<string, unknown>`, but `database.types.ts` defines `embedding: string` and `metadata: Json`. The `Json` type is `string | number | boolean | null | { [key: string]: Json | undefined } | Json[]` — the Kysely interface is **less precise** than the generated types.

### 6.2 Query Patterns

**Finding [KYS-004] — MEDIUM:** There are **no example queries** in the Kysely module beyond the documentation comment. The actual query patterns are not implemented, meaning:

- No type-safe aggregation queries
- No CTE patterns
- No join patterns
- The `createKyselyClient()` function is provided but no query functions

**Finding [KYS-005] — MEDIUM:** The Kysely client uses `max: 10` connection pool size — for a monorepo with multiple services, this may be **insufficient** under concurrent load. There's no connection pool configuration for read replicas.

### 6.3 Read-Replica Usage

**Finding [KYS-006] — HIGH:** Kysely has **no read-replica awareness**. The `createKyselyClient()` always connects to `DATABASE_URL`/`SUPABASE_DATABASE_URL`. There's no `createKyselyReadReplicaClient()` function. The `read-replica.ts` module uses a separate Supabase client (not Kysely), creating an **inconsistency** in how reads vs writes are handled.

---

## 7. READ-REPLICA CONSISTENCY AUDIT

**File:** `packages/supabase/src/read-replica.ts`

### 7.1 Consistency Guarantees

**Finding [RR-001] — CRITICAL:** The read replica client has **NO consistency guarantees**. It falls back to the primary URL when `SUPABASE_READ_REPLICA_URL` is not set:

```typescript
const replicaUrl = process.env.SUPABASE_READ_REPLICA_URL && ...
  ? process.env.SUPABASE_READ_REPLICA_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL || ...;
```

This means in environments without a read replica, **reads go to the primary** — potentially stale reads if the primary has uncommitted writes.

**Finding [RR-002] — HIGH:** There is **no mechanism to ensure read-your-writes consistency**. After a mutation via `createServerSupabaseClient()`, subsequent reads via `createReadReplicaClient()` may return stale data. No session token propagation or causal consistency mechanism exists.

**Finding [RR-003] — HIGH:** The `setAll` cookie handler silently catches errors:

```typescript
setAll(cookiesToSet) {
  if (cookieList) return;
  try {
    cookiesToSet.forEach(({ name, value, options }) => cookieStore?.set(name, value, options));
  } catch { /* Called from a Server Component — safe to ignore. */ }
}
```

Silent error swallowing means **cookie failures are invisible** — authentication state may be inconsistent between primary and replica.

**Finding [RR-004] — MEDIUM:** The `getAll` cookie handler has a regex-based cookie forwarding mechanism:

```typescript
const match = cookie.name.match(/^__tb\d+_(sb-.*)$/);
```

This only forwards tunnel-broker cookies. If Supabase changes its cookie naming convention, **authentication will break silently**.

**Finding [RR-005] — LOW:** No `Authorization` header validation on read replica responses. The replica client uses the same `anonKey` as the primary — if the anonKey is compromised, **both read and write access** is compromised.

---

## 8. DATABASE TYPES DRIFT AUDIT

**File:** `packages/supabase/src/database.types.ts`

### 8.1 Type Drift Issues

**Finding [TYPES-001] — HIGH:** `database.types.ts` contains **manual type definitions** for ~25 tables but the Supabase CLI should auto-generate these from the database schema. If migrations change table structures without regenerating types, **the TypeScript types will drift from the actual database schema**.

Specific drift examples:

- `employees.accessible_departments` is typed as `string[] | null` in `database.types.ts` — but the column is `UUID[]` (array of UUIDs, not strings)
- `audit_logs.ip_address` is typed as `unknown` — should be `string | null` based on the migration definition
- `memory_embeddings` in `database.types.ts` has `metadata: Json` and `embedding: string` — but `kysely.ts` defines `embedding: string` and `metadata: Record<string, unknown>` — **inconsistent between the two files**

**Finding [TYPES-002] — HIGH:** The `Database` type in `database.types.ts` does NOT include the `delay_entries`, `delay_categories`, `vector_search_cache`, `vector_search_performance`, `material_density`, `operational_delays_deprecated_20250115`, or `machine_operations_with_delays` tables that exist in the database. This means **TypeScript has zero type safety for these tables**.

**Finding [TYPES-003] — MEDIUM:** The `__InternalSupabase.PostgrestVersion: "14.15"` is hardcoded. If the Supabase Postgrest version changes (e.g., during platform updates), **API behavior may change** without TypeScript catching the incompatibility.

**Finding [TYPES-004] — MEDIUM:** The `Constants` object at the bottom of `database.types.ts` (lines 1716+) is truncated — likely missing enum definitions and composite type definitions that should map to database enums.

### 8.2 Manual Types vs Generated Types

**Finding [TYPES-005] — MEDIUM:** `packages/supabase/src/manual-types.ts` exists alongside `database.types.ts`, suggesting **dual type systems**. If `manual-types.ts` overrides or extends `database.types.ts` without synchronization, **type conflicts** will occur.

---

## 9. ADDITIONAL FINDINGS

### 9.1 Security Concerns

**Finding [SEC-001] — HIGH:** The default Supabase anonymous key is hardcoded in `middleware.ts`:

```typescript
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.nEt4Hfb3DGQtFPofXNRWUBX6zXyTXTJvcb9xLoBGDg";
```

This is a **well-known Supabase demo key**. If it hasn't been replaced, **anyone can access the database as an unauthenticated user**.

**Finding [SEC-002] — HIGH:** Migration `052_seed_admin_user.sql` creates an admin user — if the seed data is committed to version control, the **admin credentials are in the repo**. This should use environment variables or a secure bootstrap mechanism.

**Finding [SEC-003] — MEDIUM:** The `handle_new_user()` trigger function has `SECURITY DEFINER` and `SET search_path = public` — this means it runs with the privileges of the function owner, not the caller. If the function owner is compromised, **arbitrary SQL execution** is possible.

### 9.2 Operational Concerns

**Finding [OPS-001] — MEDIUM:** Migration `097_enable_pg_graphql.sql` enables the `pg_graphql` extension — this extension provides a GraphQL API to the database. If not properly secured, it **bypasses all RLS policies** unless the `search_path` and function security are explicitly configured. The `rls_extension_safety.sql` test checks this but doesn't verify that `pg_graphql` functions have proper security.

**Finding [OPS-002] — LOW:** The `pg_cron` schedules (migrations 023, 064, 065, 073) create scheduled jobs but **don't track job ownership or provide a way to disable them**. If a job runs against a missing table or function, it will **error silently** in the cron logs.

---

## 10. SUMMARY OF CRITICAL FINDINGS

| ID           | Severity     | Finding                                                              | File                          |
| ------------ | ------------ | -------------------------------------------------------------------- | ----------------------------- |
| ROLLBACK-001 | **CRITICAL** | 0 of 113 migrations have rollback/down scripts                       | All migrations                |
| ROLLBACK-002 | **CRITICAL** | `068_delay_entries_rollback.sql` does not exist on disk              | Task scope                    |
| RLS-P0-001   | **CRITICAL** | Original `handle_new_user()` allows admin self-elevation             | `001_initial.sql`             |
| RLS-P0-002   | **CRITICAL** | `employees_update_self_or_admin` missing `WITH CHECK`                | `001_initial.sql`             |
| KYS-001      | **HIGH**     | Kysely defines only 5 of 45+ tables                                  | `kysely.ts`                   |
| KYS-002      | **HIGH**     | `[key: string]: unknown` defeats type safety                         | `kysely.ts`                   |
| TYPES-001    | **HIGH**     | `accessible_departments` typed as `string[]` not `UUID[]`            | `database.types.ts`           |
| TYPES-002    | **HIGH**     | ~15 new tables missing from type definitions                         | `database.types.ts`           |
| SEC-001      | **HIGH**     | Default Supabase anonymous key hardcoded in middleware               | `middleware.ts`               |
| RR-001       | **CRITICAL** | Read replica has no consistency guarantees, falls back to primary    | `read-replica.ts`             |
| RR-003       | **HIGH**     | Silent cookie error swallowing in read replica                       | `read-replica.ts`             |
| VEC-004      | **HIGH**     | 064 drops/recreates search functions with breaking signature changes | `064_*.sql`                   |
| PART-001     | **HIGH**     | Partition migration renames tables without guaranteed reverse path   | `020_*.sql`                   |
| IDX-001      | **HIGH**     | FK indexes only added after separate migrations 060/089              | `060/089_*.sql`               |
| RLS-003      | **HIGH**     | 043 admin lockdown breaks operator self-update workflows             | `043_admin_data_lockdown.sql` |
| RLS-004      | **MEDIUM**   | 095 removes supervisor employee creation ability                     | `095_*.sql`                   |
| VEC-001      | **MEDIUM**   | HNSW index recreation uses non-concurrent DROP                       | `030_*.sql`                   |
| IDX-005      | **MEDIUM**   | `(SELECT auth.uid())` patterns in RLS cause initplan overhead        | `095_*.sql`                   |
| PART-004     | **HIGH**     | Production logs FK may fail if partitioning not applied first        | `072_*.sql`                   |
| TYPES-003    | **MEDIUM**   | Hardcoded PostgrestVersion may drift                                 | `database.types.ts`           |
| SEC-002      | **MEDIUM**   | Admin seed credentials in version control                            | `052_seed_admin_user.sql`     |

---

## 11. RECOMMENDED ACTIONS

### Immediate (P0)

1. **Add rollback scripts** for all 113 migrations (or implement a migration framework with down migrations)
2. **Fix `handle_new_user()` in `001_initial.sql`** to hardcode `'operator'` — the original vulnerable code is still there and will overwrite the fix on re-run
3. **Add `WITH CHECK` to `employees_update_self_or_admin`** in `001_initial.sql`
4. **Replace hardcoded anonymous key** in `middleware.ts` with environment variable
5. **Add read-replica consistency mechanism** (session token propagation or read-after-write barrier)
6. **Regenerate `database.types.ts`** from the current database schema using Supabase CLI

### Short-term (P1)

7. **Expand `KyselyDatabase`** to cover all 45+ tables with explicit column definitions
8. **Fix `accessible_departments` type** from `string[]` to `UUID[]` in `database.types.ts`
9. **Add `idx_memory_embeddings(machine_operation_id, status)`** composite index for `machine_operations_with_delays` view
10. **Add partition auto-creation** for `production_logs` beyond 2027-12
11. **Add `createKyselyReadReplicaClient()`** with proper connection pooling
12. **Remove `001_initial.sql` vulnerable code** or mark it as superseded by `057_security_p0_fixes.sql`

### Medium-term (P2)

13. **Implement migration versioning** with proper up/down scripts
14. **Add vector search cache invalidation** and partition strategy for `vector_search_performance`
15. **Audit `pg_graphql` extension security** and ensure RLS bypass is prevented
16. **Add `CONCURRENTLY` to all index creation** in migrations 030, 060, 089
17. **Create `manual-types.ts` sync mechanism** with `database.types.ts`
18. **Add query plan analysis** to CI for slow queries on partitioned tables

---

_End of Phase 2 Database Audit Report_
_Generated: 2026-09-21_
