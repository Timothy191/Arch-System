---
title: Database Schema
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [database, schema, architecture, system]
sources: [raw/codebase/migrations.md]
confidence: high
---

# Database Schema

The Arch-Systems portal uses a PostgreSQL database managed through Supabase. All tables use Row Level Security (RLS) policies scoped by department, with a consistent auth pattern across the schema.

## Core Tables

### departments

Primary entity for multi-departmental isolation.

| Column       | Type        | Constraints                            |
| ------------ | ----------- | -------------------------------------- |
| id           | UUID        | PRIMARY KEY DEFAULT uuid_generate_v4() |
| name         | TEXT        | NOT NULL UNIQUE                        |
| display_name | TEXT        | NOT NULL                               |
| icon         | TEXT        | NOT NULL                               |
| description  | TEXT        |                                        |
| color        | TEXT        | NOT NULL                               |
| created_at   | TIMESTAMPTZ | DEFAULT NOW()                          |

RLS: `SELECT` open to all authenticated users. No direct INSERT/UPDATE policies — seeded via migrations only.

### employees

Links auth.users to department roles. Central to all RLS policies.

| Column                 | Type        | Constraints                                 |
| ---------------------- | ----------- | ------------------------------------------- |
| id                     | UUID        | PRIMARY KEY                                 |
| auth_id                | UUID        | REFERENCES auth.users(id) ON DELETE CASCADE |
| department_id          | UUID        | REFERENCES departments(id)                  |
| full_name              | TEXT        | NOT NULL                                    |
| role                   | TEXT        | DEFAULT 'operator'                          |
| accessible_departments | UUID[]      | DEFAULT '{}'                                |
| created_at             | TIMESTAMPTZ | DEFAULT NOW()                               |

RLS: Users can SELECT/UPDATE themselves or be an admin. INSERT is admin-only.

Auth trigger `handle_new_user()` auto-creates an employee row on signup with role defaulting to 'operator'.

### machines

Equipment registry per department.

| Column        | Type        | Constraints                                           |
| ------------- | ----------- | ----------------------------------------------------- |
| id            | UUID        | PRIMARY KEY                                           |
| department_id | UUID        | NOT NULL REFERENCES departments(id) ON DELETE CASCADE |
| name          | TEXT        | NOT NULL                                              |
| machine_type  | TEXT        | NOT NULL                                              |
| serial_number | TEXT        |                                                       |
| active        | BOOLEAN     | DEFAULT true                                          |
| bin_factor    | NUMERIC     | Added in migration 003 for dump trucks                |
| created_at    | TIMESTAMPTZ | DEFAULT NOW()                                         |

RLS: SELECT by department membership. INSERT/UPDATE restricted to admin/supervisor.

## Operational Tables

### daily_logs

Parent log for each department per day/shift.

| Column        | Type        | Constraints                                           |
| ------------- | ----------- | ----------------------------------------------------- |
| id            | UUID        | PRIMARY KEY                                           |
| department_id | UUID        | NOT NULL REFERENCES departments(id) ON DELETE CASCADE |
| log_date      | DATE        | NOT NULL                                              |
| shift         | TEXT        | CHECK IN ('day', 'night')                             |
| notes         | TEXT        |                                                       |
| created_at    | TIMESTAMPTZ | DEFAULT NOW()                                         |

UNIQUE: (department_id, log_date, shift). Append-only — no DELETE policy.

Child tables: [[machine-hours]], [[fuel-logs]], [[production-logs]]

### machine_hours, fuel_logs, production_logs

Child tables referencing daily_logs. RLS checks access through the parent daily_logs row.

### breakdowns

Engineering department breakdown tracking (ported from standalone system).

| Column          | Type        | Constraints                                           |
| --------------- | ----------- | ----------------------------------------------------- |
| id              | UUID        | PRIMARY KEY                                           |
| department_id   | UUID        | NOT NULL REFERENCES departments(id) ON DELETE CASCADE |
| fleet_id        | TEXT        | NOT NULL                                              |
| machine_type    | TEXT        | NOT NULL                                              |
| date_in         | DATE        | NOT NULL                                              |
| time_in         | TIME        | DEFAULT '00:00'                                       |
| date_out        | DATE        |                                                       |
| time_out        | TIME        |                                                       |
| reason          | TEXT        | NOT NULL                                              |
| repair_notes    | TEXT        |                                                       |
| status          | TEXT        | CHECK IN ('active', 'completed')                      |
| missing_book_in | BOOLEAN     | DEFAULT false                                         |
| created_by      | UUID        | REFERENCES auth.users(id)                             |
| completed_by    | UUID        | REFERENCES auth.users(id)                             |
| deleted_at      | TIMESTAMPTZ | Soft delete                                           |
| created_at      | TIMESTAMPTZ | DEFAULT NOW()                                         |
| updated_at      | TIMESTAMPTZ | DEFAULT NOW()                                         |

Indexes: department, status (WHERE deleted_at IS NULL), fleet_id, date_in DESC.
RLS: SELECT by department. INSERT by operator+/supervisor/admin. UPDATE by operator+/supervisor/admin. DELETE admin-only.

## Control Room Tables

### machine_operations

Shift-level machine operation logs with auto-calculated hours.

| Column        | Type    | Constraints                   |
| ------------- | ------- | ----------------------------- |
| id            | UUID    | PRIMARY KEY                   |
| department_id | UUID    | NOT NULL                      |
| machine_id    | UUID    | NOT NULL                      |
| operator_id   | UUID    | REFERENCES operators(id)      |
| site_id       | UUID    | REFERENCES sites(id)          |
| shift_date    | DATE    | NOT NULL                      |
| shift_type    | TEXT    | CHECK IN ('day', 'night')     |
| start_time    | TIME    | NOT NULL                      |
| end_time      | TIME    |                               |
| hours_worked  | NUMERIC | GENERATED (epoch diff / 3600) |
| created_by    | UUID    | REFERENCES employees(id)      |

UNIQUE: (machine_id, shift_date, shift_type, start_time)

### hourly_loads

12-hour shift grid for production tracking. Originally 24-hour grid in migration 002, revised to 12-hour in migration 003.

Columns: 12 hour slots (hour_01 through hour_12), total_loads GENERATED, load_date, shift_type, machine_id, department_id.

### operational_delays

Categorized delay logging with impact assessment.

| Column            | Type    | Constraints                                                                                  |
| ----------------- | ------- | -------------------------------------------------------------------------------------------- |
| delay_category_id | UUID    | REFERENCES delay_categories(id)                                                              |
| delay_type        | TEXT    | CHECK IN ('equipment', 'weather', 'safety', 'material', 'shift_change', 'operator', 'other') |
| delay_minutes     | INTEGER | CHECK > 0                                                                                    |
| status            | TEXT    | CHECK IN ('active', 'recovered', 'extended')                                                 |

### engineering_notes

Technical issue tracking with severity and follow-up.

| Column             | Type        | Constraints                                                               |
| ------------------ | ----------- | ------------------------------------------------------------------------- |
| issue_type         | TEXT        | CHECK IN ('mechanical', 'electrical', 'structural', 'hydraulic', 'other') |
| severity           | TEXT        | CHECK IN ('low', 'medium', 'high', 'critical')                            |
| requires_follow_up | BOOLEAN     | DEFAULT false                                                             |
| status             | TEXT        | CHECK IN ('open', 'in_progress', 'resolved', 'closed')                    |
| resolved_at        | TIMESTAMPTZ |                                                                           |

### excavator_activity

Pass/load/cycle tracking per machine per shift.

| Column                 | Type    | Constraints |
| ---------------------- | ------- | ----------- |
| passes                 | INTEGER | DEFAULT 0   |
| loads                  | INTEGER | DEFAULT 0   |
| avg_cycle_time_seconds | INTEGER |             |
| material_type          | TEXT    |             |
| estimated_tonnes       | NUMERIC |             |

UNIQUE: (machine_id, activity_date, shift_type)

## Safety Tables

### safety_incidents

Incident reporting with severity levels and investigation workflow.

| Column            | Type        | Constraints                                                         |
| ----------------- | ----------- | ------------------------------------------------------------------- |
| incident_type     | TEXT        | CHECK IN ('near-miss', 'incident', 'lost-time', 'equipment-damage') |
| severity_id       | UUID        | REFERENCES safety_severities(id)                                    |
| category_id       | UUID        | REFERENCES safety_incident_categories(id)                           |
| injured_parties   | INTEGER     | DEFAULT 0                                                           |
| root_cause        | TEXT        |                                                                     |
| corrective_action | TEXT        |                                                                     |
| status            | TEXT        | CHECK IN ('open', 'under-investigation', 'resolved', 'closed')      |
| closed_at         | TIMESTAMPTZ |                                                                     |

### safety_severities

Reference table: low (weight 1), medium (2), high (3), critical (4).

### safety_incident_categories

Reference table: Slip/Trip/Fall, Equipment Contact, Vehicle Incident, Hazardous Material, Environmental, Near Miss, Other.

## Audit & Reference Tables

### audit_logs (migration 007)

Central audit trail for insert/update/delete operations.

| Column        | Type        | Constraints                                  |
| ------------- | ----------- | -------------------------------------------- |
| action        | TEXT        | CHECK IN ('insert', 'update', 'delete')      |
| table_name    | TEXT        | NOT NULL                                     |
| record_id     | UUID        |                                              |
| old_data      | JSONB       |                                              |
| new_data      | JSONB       |                                              |
| performed_by  | UUID        | REFERENCES employees(id)                     |
| department_id | UUID        | REFERENCES departments(id) ON DELETE CASCADE |
| ip_address    | INET        |                                              |
| user_agent    | TEXT        |                                              |
| created_at    | TIMESTAMPTZ | DEFAULT NOW()                                |

Indexes: (table_name, record_id), performed_by, department_id, created_at DESC.
RLS: SELECT by admin or department membership. INSERT open to all authenticated.

### operators, sites, delay_categories

Reference tables for dropdowns. SELECT open to all authenticated. INSERT/UPDATE restricted to admin/supervisor.

## Auth Helpers

Security definer functions for RLS policies:

- `auth.user_department_id()` → UUID
- `auth.is_admin()` → BOOLEAN
- `auth.has_department_access(dept_id UUID)` → BOOLEAN

## RLS Pattern

Every operational table follows the same RLS template:

```sql
CREATE POLICY "table_select_department"
  ON table FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR e.department_id = table.department_id
          OR table.department_id = ANY(e.accessible_departments)
        )
    )
  );
```

## Migrations

Migrations live in `packages/database/migrations/` as numbered `.sql` files:

| Range     | Focus / Features                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `001–009` | Initial core tables, control room, breakdowns, safety, audit logs, excavator activity, AI memory                                                                                                 |
| `010–016` | Schema optimizations, automated auditing triggers, RLS refinements, JSON validation, shift closeout, schema enums                                                                                |
| `017–027` | Webhooks/triggers, sync metadata, time-series partitioning, missing indexes, materialized views, pg_cron schedules, drill operations, machine telemetry, delays, shift archiving                 |
| `028–033` | Access control badges, breakdowns machine name, vector HNSW optimizations, embedding sync watermark, AI usage logs, AC log archival                                                              |
| `034–040` | AC schema updates (visitors/badges), fleet & equipment tables, documents storage bucket & history, personnel area, department personality, AC operator devices, production fixes                 |
| `041–048` | RLS performance indexes, machine configurations, admin data API lockdown, control room archival, site ID mapping, report exemption flags                                                         |
| `049–054` | Control room dumpers (bin_factor), material types (waste/coal), centralized fleet CSV seeding, admin system user, telemetry webhook triggers, dozer roll date constraint checks                  |
| `055–061` | AC count metrics RPC, drilling v2 (editable sites/delays), security P0 fixes (role elevation controls), Ollama embeddings (768-dim), embedding cache, index optimization, drop procedural memory |

## Schema Improvements

Migrations 010-061 implemented the following improvements:

### Foreign Key Indexes

All foreign key columns now have explicit indexes for join performance (finalized in migration 060):

- `employees.department_id`, `machines.department_id`, `machines.site_id`
- `daily_logs` composite index on `(department_id, log_date DESC, shift)`
- All child table indexes (`machine_hours`, `fuel_logs`, `production_logs`, `access_logs`, `badges`)

### Audit Timestamps

Added `updated_at` columns to `daily_logs`, `machine_hours`, `fuel_logs`, and `production_logs`.

### Soft Delete Consistency

Added `deleted_at` columns to `operators`, `sites`, `mine_blocks`, `delay_categories`, and `report_templates`.

### Enum Types

Native PostgreSQL enum types created for `role_type`, `shift_type`, `incident_type`, `delay_type`, `safety_incident_type`, `safety_status`, and `memory_type` (dropped `procedural` in migration 061).

## Performance Scorecard

| Category        | Score | Notes                                                                                       |
| --------------- | ----- | ------------------------------------------------------------------------------------------- |
| Security        | 10/10 | Comprehensive RLS coverage, admin data API lockdown, and user trigger hardening             |
| Indexing        | 10/10 | All FKs indexed, composite patterns, pgvector HNSW index optimization                       |
| Normalization   | 8/10  | Good referential integrity, intentional denormalization for time-series                     |
| Maintainability | 10/10 | Consistent migrations, TypeScript type generation (`database.types.ts`), clean schema split |

## Scaling & Optimization Complete

### Table Partitioning (Completed - Migration 020)

Time-series tables partitioned by month to improve scale:

- `hourly_loads`, `daily_logs`, `machine_hours`, `fuel_logs`

### Connection Pooling (Completed)

PgBouncer in transaction mode configured in compose stack to cap database connections.

### Materialized Views (Completed - Migration 022)

Pre-computed aggregations refreshed via `pg_cron`:

- `dept_production_summary` — monthly tonnage + efficiency
- `machine_utilization_weekly` — weekly availability
- `safety_incident_monthly` — monthly safety counts

### Read Replicas (Completed)

Streaming replication support configured in `@repo/supabase` client to route SELECT queries away from primary databases.

### Local Embedding Caching (Completed - Migration 059)

A persistent `embedding_cache` table prevents recalculating 768-dim embeddings for user queries.
