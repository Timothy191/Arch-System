# Database Agent Tracer

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
- **Thresholds**: Defined industrial thresholds (5%/10%/15%) for automated variance classification in `00_applications/portal/lib/production-reconciliation.ts`.

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

- Created `08_developer_tooling/rotate-secrets.mjs` script for rotating:
  - Supabase service keys
  - Sentry tokens
  - Redis passwords
  - Novu/Inngest API keys
- Created database migration `012_secrets_rotation_log.sql` with audit table

**What the next agent should know:**

- Run `node 08_developer_tooling/rotate-secrets.mjs --dry-run` to preview
- Run `node 08_developer_tooling/rotate-secrets.mjs` to execute rotation
- All rotations are logged to `secrets_rotation_log` table

## [2026-06-24T09:00:00Z] Cost & SLO Monitoring

**Purpose:** Add cost monitoring and SLO compliance tracking.

**Changes:**

- Created `07_toolchain_configuration/cost-monitoring.json` with budget thresholds per service
- Created `08_developer_tooling/cost-monitor.mjs` for cost tracking and alerting
- Created `07_toolchain_configuration/slo-config.json` with SLO definitions
- Created database migration `013_slo_monitoring.sql` with `slo_metrics` table and views

**What the next agent should know:**

- Run `node 08_developer_tooling/cost-monitor.mjs --notify` to check costs and send alerts
- SLO metrics are recorded via `record_slo_measurement()` function
- Query `current_slo_status` view for real-time SLO compliance

## [2026-06-24T09:15:00Z] Anomaly Detection & Feature Flags

**Purpose:** Add anomaly detection and A/B testing framework.

**Changes:**

- Created `07_toolchain_configuration/anomaly-detection.json` with metric thresholds and algorithms
- Created `08_developer_tooling/anomaly-detector.mjs` for detecting anomalies via z-score/threshold/percentile
- Created database migration `014_feature_flags.sql` with feature flag system
- Created `00_applications/portal/lib/feature-flags.ts` client for evaluating flags

**What the next agent should know:**

- Run `node 08_developer_tooling/anomaly-detector.mjs --notify` to detect and alert on anomalies
- Feature flags: Use `getFeatureFlag('flag-key', userId)` to evaluate
- Log conversions with `logConversion()` for A/B test analytics

## [2026-06-24T09:45:00Z] Runbooks & Incident Response

**Purpose:** Document operational procedures and incident response.

**Changes:**

- Created `06_technical_documentation/ops-runbook.md` with quick reference, common issues, health checks
- Created `06_technical_documentation/incident-playbook.md` with severity levels and 5 playbooks

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
