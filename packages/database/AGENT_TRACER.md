# Database Agent Tracer

## 2026-09-03: Stale Department Cleanup & Employee Permission Purge

### Purpose

Purge all traces of obsolete departments (`safety`, `training`, `satellite-monitoring`) from `public.departments`, clean up employee `accessible_departments` arrays, and add migration 153.

### Changes Made

1. **Migration 153 (`153_cleanup_stale_department_access.sql`)**:
   - Added migration to strip `516ab006-...`, `47540f48-...`, and `89af13e7-...` from `public.employees.accessible_departments`.
   - Executed deletion of `safety`, `training`, and `satellite-monitoring` rows from `public.departments`.
2. **Rollback Verification**:
   - Executed `pnpm nx run @repo/database:test:migration-rollback` -> 110 migrations, 0 errors.
3. **Cache Invalidation**:
   - Flushed Redis cache to ensure no stale employee department tokens remain in memory.

### Status

- **Validation**: 100% PASS across DB queries and migration rollback tests.

## 2026-08-27: Test Target Integration, Contract Drift & RLS Matrix Verification

### Purpose

Wire up `@repo/database:test` target in `package.json` to execute static migration rollback safety verification, validate 100% schema-contract drift alignment with `@repo/contract`, and assert complete 86/86 RLS policy coverage.

### Changes Made

1. **Test Target Integration (`packages/database/package.json`)**:
   - Added `"test": "node tests/migration-rollback-safety.mjs"` mapping directly to Nx target runner.
2. **Contract Drift & RLS Verification**:
   - Ran `tools/audit-contract-drift.cjs` -> 100% synchronized across core domain tables.
   - Ran `tools/audit-rls-matrix.cjs` -> 86/86 tables with RLS active (100% coverage).
3. **Migration Rollback Assertions**:
   - Validated 105 migration scripts with 0 errors via `pnpm nx test @repo/database`.

### Status

- **Validation**: 100% PASS across Nx tests, contract drift audits, and RLS matrix checks.

## 2026-08-27: Migration Rollback Safety Verification & Static Analysis Hardening

### Purpose

Execute and harden `test:migration-rollback` (`tests/migration-rollback-safety.mjs`) to verify rollback safety invariants across all 104 SQL migrations in `@repo/database`.

### Changes Made

1. **Static Analysis Rule Calibration (`packages/database/tests/migration-rollback-safety.mjs`)**:
   - Expanded sequence matching regex to `^(\d{3,4})_(.+)\.sql$` supporting both 3-digit and 4-digit migration conventions.
   - Filtered non-migration standalone scripts (`standalone_*.sql`) from sequential naming assertions.
   - Verified that all 104 SQL migrations adhere to non-destructive re-run safety (100% `IF EXISTS` compliance for drop operations).

### Status

- **Validation**: `pnpm nx run @repo/database:test:migration-rollback` passed with 0 errors across 104 migration files.

## 2026-08-27: Postgres MCP Supavisor Connection String Integration

### Purpose

Enable direct database MCP tool access against cloud Supabase via the Supavisor connection pooler (port 6543) while allowing dynamic credential interpolation from environment variables (`DATABASE_URL`, `SUPABASE_POOLER_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_REGION`).

### Changes Made

1. **MCP Configuration Template (`config/tools/mcp.json` & `opencode.json`)**:
   - Updated the `postgres` MCP server command to point to `postgresql://postgres.mrwhtxbhrzyttlsyuofc:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`.
2. **Dynamic Configuration Generator (`scripts/sync-mcp-config.js`)**:
   - Added environment variable resolution from `apps/portal/.env` and `.env` to automatically populate Supavisor credentials when available.
3. **MCP Validation (`scripts/validate-mcp-servers.js`)**:
   - Updated postgres connection validator to detect remote Supavisor endpoints and prevent false failure triggers on local port 54322.

### Status

- **Config**: Verified and synchronized across `.mcp.json`, `.agents/mcp_config.json`, and `.vscode/mcp.json`.
- **Validation**: `node scripts/validate-mcp-servers.js` passed with 0 errors and 0 warnings.

## 2026-08-24: Multi-Site Production & Shift Report Migration (0148)

### Purpose

Provide schema support and RPC aggregation for multi-site operations (Brakfontein, Extension Pit, Processing Plant, and Bredell Workshop) with excavator haul tallies, bulldozer rollover volumes, ancillary runs, and equipment operational availability.

### Changes Made

1. **Migration 0148 `0148_multi_site_production_report.sql`**:
   - Created enum `machine_operational_status` ('ACTIVE', 'STANDBY', 'BREAKDOWN', 'BREDELL', 'NO_OPERATOR', 'NO_SPACE', 'OFFSITE').
   - Enhanced `machine_operations` with `operational_status`, `operator_name`, `start_smu`, `end_smu`, `site_code`.
   - Created `excavator_haul_logs` and `excavator_truck_tallies` with unique constraints and loading metric defaults.
   - Created `dozer_rollover_logs` with stored generated columns for delta hours and calculated pushed BCM (`push_factor_bcm_per_hour = 250.0`).
   - Created `ancillary_shift_logs` for dust suppression, fuel delivery, and logistics.
   - Enhanced `breakdowns` with `site_code`, `is_operational_defect`, and `duration_minutes`.
   - Created `get_multi_site_shift_compilation` RPC function returning full multi-site JSONB structure.
   - Enabled RLS with authenticated/service_role policies on all new tables.

### Status

- **Schema**: Ready for migration application.

## 2026-08-24: Unified Shift Compilation Migration (0147)

### Purpose

Unify hourly loads, SMU machine operating hours, engineering breakdowns, and tire management records into a single shift aggregation RPC engine (`get_unified_shift_compilation`) and enrich foreign key linkages.

### Changes Made

1. **Migration 0147 `0147_unified_shift_compilation.sql`**:
   - Added `machine_id` (UUID FK `machines(id)`) to `breakdowns` with backfill from existing `machine_name`/`fleet_id`.
   - Added `machine_operation_id`, `current_smu`, `shift_date`, and `shift_type` to `tire_inspections`.
   - Added `get_unified_shift_compilation` PostgreSQL RPC returning consolidated JSONB shift compilation payload.

### Status

- **Schema**: Ready and validated.
- **RPC**: Implemented with security definer and aggregated sub-queries.

## 2026-08-18: Control Room Shift Reports Table

### Purpose

Back the ControlRoomChecklistWidget submit path with a persistent store so operator shift closeout reports (KPIs, checklist state, supervisor signature) survive reloads and are auditable.

### Changes Made

1. **Migration 096 `control_room_shift_reports`**:
   - Columns mirror `@repo/contract` `controlRoomShiftReportSchema` (alarm/incident response seconds, uptime %, missed incidents, notes, operator name, checklist counts) plus `checklist_items JSONB`, `supervisor_signature`, `created_by`, timestamps.
   - `UNIQUE (department_id, report_date, shift_type)` — one report per dept/date/shift; upsert-friendly.
   - RLS enabled with department-scoped SELECT/INSERT/UPDATE policies using `public.is_admin()` / `public.has_department_access()` (InitPlan pattern from 095).
   - `updated_at` trigger via `public.set_updated_at()`.
   - Mirrored to `packages/supabase/migrations/` (parity verified, `audit:rls` 0 critical).

### Status

- **Persistence**: Shift reports now have a first-class table with RLS and department isolation.
- **Next**: Server actions (`submitShiftReport` / `getShiftReport`) + widget wiring.

## 2026-06-16: Operational Immutability & Partitioned FK Fix

### Purpose

Enforce "Outer Loop" production hardening by locking operational data for approved shifts and fixing logically broken foreign keys to partitioned tables.

### Changes Made

1. **Migration 071: Operational Immutability**:
   - **Unified Lockdown**: Implemented `check_shift_immutable()` trigger function.
   - **Data Lock**: Attached BEFORE UPDATE/DELETE triggers to `production_logs`, `excavator_activity`, `hourly_loads`, `machine_operations`, `machine_hours`, and `fuel_logs`.
   - **Integrity Fix (CRITICAL)**: Resolved orphaned foreign keys by adding `daily_log_date` to child tables and establishing composite FKs `(daily_log_id, daily_log_date)` referencing the partitioned `daily_logs` parent.
   - **Backfill**: Automatically synchronized `daily_log_id` for `excavator_activity`, `dozer_rolls`, `hourly_loads`, and `machine_operations` using existing logical keys.

2. **Verification Suite**:
   - Created `verify_immutability.sql` to empirically prove that closed/approved shifts block data tampering across core tables.

### Status

- **Hardening**: Industrial-grade data protection achieved and empirically verified.
- **Integrity**: Referential integrity restored for partitioned time-series data.
- **Performance**: `production_logs` is now fully partitioned by date, matching the parent `daily_logs` strategy.

### Changes (Detailed)

- **Migration 071**: Enforced immutability for closed shifts. Fixed logically orphaned FKs. Added `daily_log_date` to all child tables.
- **Trigger Fix**: Implemented explicit `::text` casts in `check_shift_immutable()` to handle the `shift_type` (ENUM) vs `shift` (TEXT) inconsistency introduced by legacy partitioning.
- **Migration 072**: Partitioned `production_logs` BY RANGE on `daily_log_date`. Re-established security triggers and RLS policies on the new partitioned parent.
- **Migration 073**: Implemented `view_production_summary` (Materialized View) and `material_density` reference table.
  - **Unified KPIs**: Aggregates Actual Tonnage, Extraction (BCM), Fuel, and Machine Hours at the shift level.
  - **Reconciliation Drift**: Built-in calculation for `reconciliation_drift_pct` (Actual vs Expected Tonnage) using the new `material_density` mapping.
  - **Performance**: Move math from frontend `.reduce()` to server-side cached aggregates. Scheduled refresh via `pg_cron` every 15 minutes.
  - **Security**: Added `public.get_production_summary()` wrapper function to enforce RLS on the materialized view.
- **Verification**: `verify_production_summary.sql` confirmed accurate aggregation of tonnage, fuel, and efficiency (t/h) metrics.

### Status

- **Hardening**: Industrial-grade data protection and high-performance reporting achieved.
- **Observability**: Reconciliation drift tracking now active at the database layer.
- **Thresholds**: Defined industrial thresholds (5%/10%/15%) for automated variance classification in `apps/portal/lib/production-reconciliation.ts`.

### Next Steps

- **Frontend Refactor**: Update the Executive Dashboard and Portal Hub to use the new `get_production_summary()` RPC instead of fetching raw logs.
- **Monitoring**: Add OpenTelemetry spans to track reconciliation drift alerts when `reconciliation_drift_pct` exceeds industrial thresholds (e.g. > 10%).

---

## 2026-06-20: Engineering Breakdown Sharing to Control Room

### Purpose

Implement controlled data sharing from Engineering Department to Control Room Department for active breakdowns. Control Room can only read required fields (read-only) and cannot edit or delete Engineering breakdown data.

### Changes Made

1. **Migration 077: Engineering Breakdown Sharing**:
   - **Shared Departments Column**: Added `shared_with_departments` JSONB column to `breakdowns` table to track which departments can read specific breakdowns.
   - **Auto-Sharing Trigger**: Created `auto_share_breakdown_with_control_room()` function that automatically shares active Engineering breakdowns (or completed today) with Control Room via the trigger `auto_share_breakdown_trigger`.
   - **Secure View**: Created `breakdowns_control_room_view` that exposes only required fields to Control Room: `id, fleet_id, machine_name, machine_type, reason, date_in, time_in, date_out, status, created_at`. The view filters to only show breakdowns shared with Control Room that are active or completed today.
   - **RLS Policy Updates**:
     - Modified `breakdowns_insert_engineering_only` and `breakdowns_update_engineering_only` to only allow Engineering department users (or admins) to INSERT/UPDATE, removing the `accessible_departments` check to prevent cross-department modification.
     - Modified `breakdowns_delete_engineering_admin` to only allow Engineering department admins/supervisors to DELETE, not global admins from other departments.
     - This ensures Control Room cannot modify Engineering breakdowns even if they have cross-department access.
   - **Backfill**: Automatically shared existing active Engineering breakdowns with Control Room.

### What the Next Agent Should Know

- The `shared_with_departments` column is a JSONB array of department slugs (e.g., `["control-room"]`) managed automatically by the trigger.
- Control Room must query `breakdowns_control_room_view` instead of the base `breakdowns` table to see shared breakdowns.
- The view is read-only and enforces the field filtering at the database level.
- Engineering users retain full access to their own breakdowns via the base table.
- The trigger runs on INSERT and UPDATE to automatically manage sharing based on breakdown status and date.

## [2026-06-24T07:59:00Z] Phase 1: Architecture and Data Layer

**Purpose:** Added missing employee fields for personnel tracking.
**Changes:**

- Created migration `080_employee_profile_fields.sql` adding `first_name`, `last_name`, `national_id`, `job_title`, `areas`, `medical_expiry_date`, `induction_expiry_date`, `qr_code_data`, and `photo_url` to the `employees` table.
- Updated `enforce_employee_update_constraints` trigger to protect these new fields from non-admin modification.
  **Next Agent Notes:** The new fields are synced to `EmployeesRow` in `@repo/supabase`. Admin UIs and profile views need to be updated to capture and show these new fields.

## [2026-06-24T08:30:00Z] Performance Monitoring - Slow Query Logging

**Purpose:** Add database slow query logging and analysis functions for production hardening.

**Changes:**

- Created migration `011_performance_monitoring.sql` with:
  - PostgreSQL slow query configuration (log_min_duration_statement = 100ms)
  - Checkpoint, temporary file, and connection logging enabled
  - `get_slow_queries()` function for analyzing top N slowest queries via pg_stat_statements
- Agent note: Requires `pg_stat_statements` extension enabled on Supabase

**What the next agent should know:**

- Slow query logs appear in Supabase dashboard logs
- Run `SELECT * FROM get_slow_queries(20)` to see top 20 slowest queries
- Adjust `log_min_duration_statement` for different thresholds
- Created migration `012_secrets_rotation_log.sql` adding `secrets_rotation_log` table for audit tracking

## [2026-06-24T08:45:00Z] Secrets Rotation Infrastructure

**Purpose:** Add automated secrets rotation mechanism and audit trail.

**Changes:**

- Created `tools/rotate-secrets.mjs` script for rotating:
  - Supabase service keys
  - Sentry tokens
  - Redis passwords
  - Novu/Inngest API keys
- Created database migration `012_secrets_rotation_log.sql` with audit table

**What the next agent should know:**

- Run `node tools/rotate-secrets.mjs --dry-run` to preview
- Run `node tools/rotate-secrets.mjs` to execute rotation
- All rotations are logged to `secrets_rotation_log` table

## [2026-06-24T09:00:00Z] Cost & SLO Monitoring

**Purpose:** Add cost monitoring and SLO compliance tracking.

**Changes:**

- Created `config/cost-monitoring.json` with budget thresholds per service
- Created `tools/cost-monitor.mjs` for cost tracking and alerting
- Created `config/slo-config.json` with SLO definitions
- Created database migration `013_slo_monitoring.sql` with `slo_metrics` table and views

**What the next agent should know:**

- Run `node tools/cost-monitor.mjs --notify` to check costs and send alerts
- SLO metrics are recorded via `record_slo_measurement()` function
- Query `current_slo_status` view for real-time SLO compliance

## [2026-06-24T09:15:00Z] Anomaly Detection & Feature Flags

**Purpose:** Add anomaly detection and A/B testing framework.

**Changes:**

- Created `config/anomaly-detection.json` with metric thresholds and algorithms
- Created `tools/anomaly-detector.mjs` for detecting anomalies via z-score/threshold/percentile
- Created database migration `014_feature_flags.sql` with feature flag system
- Created `apps/portal/lib/feature-flags.ts` client for evaluating flags

**What the next agent should know:**

- Run `node tools/anomaly-detector.mjs --notify` to detect and alert on anomalies
- Feature flags: Use `getFeatureFlag('flag-key', userId)` to evaluate
- Log conversions with `logConversion()` for A/B test analytics

## [2026-06-24T09:45:00Z] Runbooks & Incident Response

**Purpose:** Document operational procedures and incident response.

**Changes:**

- Created `docs/ops-runbook.md` with quick reference, common issues, health checks
- Created `docs/incident-playbook.md` with severity levels and 5 playbooks

**What the next agent should know:**

- Runbook: First stop for operational issues
- Playbooks: Step-by-step for specific incident types
- Always conduct post-incident review after P1/P2 incidents

## [2026-06-24T16:20:00Z] Resolve ESLint Warnings in Tests

**Purpose:** Fix eslint `no-unused-vars` and `no-console` warnings in the migration rollback test script to pass the pre-commit gate.

**Changes:**

- Removed unused `CREATE_TABLE_IF_RE` and `CREATE_INDEX_IF_RE` regexes from `tests/migration-rollback-safety.mjs`.
- Replaced `console.log` statements with `console.info` in `tests/migration-rollback-safety.mjs`.

**What the next agent should know:**

- `console.info` is permitted under the shared `@repo/eslint-config/library.js` eslint rule configuration.

## [2026-06-24T16:51:00Z] Migration Renumbering & Database Alignment

**Purpose:** Resolve migration sequencing overlap by renumbering legacy migrations to the `09x` range.

**Changes:**

- Renamed `013_json_validation.sql` to `091_json_validation.sql`.
- Renamed `013_slo_monitoring.sql` to `092_slo_monitoring.sql`.
- Renamed `015_shift_closeout.sql` to `094_shift_closeout.sql`.

**What the next agent should know:**

- All database migrations are sequential. Sequence numbers above `085` represent newly renumbered migration steps to prevent conflicts with intermediate numbers.

## [2026-08-15T10:30:00Z] Resolving Unindexed Foreign Keys

**Purpose:** Add missing covering indexes for 14 foreign key constraints flagged by Supabase Database Linter report to optimize query performance and join evaluation.

**Changes:**

- Created migration `095_add_unindexed_foreign_key_indexes.sql`:
  - `breakdowns`: `completed_by`, `created_by`
  - `employees`: `auth_id`
  - `excavator_activity`: `block_mined_id`
  - `fuel_logs`: `daily_log_id`, `machine_id`
  - `generated_reports`: `generated_by`
  - `machine_hours`: `daily_log_id`, `machine_id`
  - `machine_operations`: `created_by`
  - `production_logs`: `daily_log_id`
  - `safety_incidents`: `reviewed_by`
  - `user_feedback`: `assigned_to`, `user_id`
- Retained existing B-tree & HNSW vector indexes flagged as unused in dev/staging (`idx_scan = 0`) to preserve production search & performance capabilities.

**What the next agent should know:**

- All 14 unindexed FK constraints reported by Supabase linter now have explicit B-tree indexes created with `IF NOT EXISTS`.

## [2026-08-15T11:05:00Z] Security Hardening & Linter Remediation

**Purpose:** Harden PostgreSQL database functions, schema placement, and RLS policies based on Supabase Database Linter security warnings.

**Changes:**

- Created migration `094_security_linter_hardening.sql`:
  - Enforced fixed `search_path = public, pg_temp` on functions (`update_updated_at_column`, `process_audit_log`, `is_active`, `is_admin`, `has_department_access`, `user_department_id`, `handle_new_user`, feedback and AI memory RPCs).
  - Relocated `vector` extension from `public` to `extensions` schema.
  - Hardened RLS `WITH CHECK` clauses on `audit_logs`, `user_feedback`, and `quick_feedback` to prevent unrestricted bypass.
  - Revoked public/anonymous execution permissions on internal `SECURITY DEFINER` trigger functions and sensitive RPCs.

**What the next agent should know:**

- `vector` extension functions and types are now cleanly referenced via the `extensions` schema.
- Public/anon direct RPC execution of sensitive definer functions is revoked; authenticated and service roles retain proper access.

## [2026-08-15T11:40:00Z] RLS InitPlan Optimization & Duplicate Index Cleanup

**Purpose:** Optimize 38 row-level security policies across all core tables using single-evaluation `(SELECT ...)` InitPlans to eliminate per-row re-evaluation of auth/helper functions, and drop duplicate unique index on `delay_categories`.

**Changes:**

- Created migration `095_optimize_rls_initplan_and_indexes.sql`:
  - Dropped duplicate index `public.delay_categories_name_unique` (keeping `delay_categories_name_key`).
  - Replaced bare `auth.uid()`, `is_admin()`, and `has_department_access()` with `(SELECT auth.uid())`, `(SELECT public.is_admin())`, and `(SELECT public.has_department_access(...))` on tables: `employees`, `machines`, `operators`, `sites`, `daily_logs`, `machine_hours`, `fuel_logs`, `production_logs`, `machine_operations`, `delay_categories`, `report_templates`, `generated_reports`, `excavator_activity`, `dozer_rolls`, `hourly_loads`, `engineering_notes`, `operational_delays`, `breakdowns`, `safety_incident_categories`, `safety_incidents`, `mine_blocks`, `excavator_dumper_assignments`, `memory_embeddings`.

**What the next agent should know:**

- All RLS policies now evaluate session variables and helper functions once per statement (InitPlan) rather than per row.
