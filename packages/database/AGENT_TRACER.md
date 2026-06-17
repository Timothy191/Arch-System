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
