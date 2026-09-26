# Database Schema Enhancement Plan

## Executive Summary

Analysis of the Arch-Systems database schema reveals a well-structured foundation with strong RLS security but opportunities for improvement in indexing, normalization, and operational best practices. This document outlines prioritized recommendations.

---

## 🔴 Completed Issues (Migrations 010-016)

### 1. Foreign Key Indexes ✅

**Status**: COMPLETED in migration 010_schema_optimization.sql, 014_schema_refinement.sql, and 016_schema_enhancements.sql

- All FK columns indexed with CONCURRENTLY
- Composite indexes for dashboard queries

### 2. `updated_at` Timestamps ✅

**Status**: COMPLETED

**Affected Tables**:

- `daily_logs`, `machine_hours`, `fuel_logs`, `production_logs` - added in 010/014
- Reference tables (`departments`, `employees`, `machines`, `sites`, `operators`, etc.) - added in 014

### 3. Native Enum Types ✅

**Status**: COMPLETED in migration 016_schema_enhancements.sql

- `role_type` enum ('admin', 'supervisor', 'operator')
- `shift_type` enum ('day', 'night')
- `incident_type` enum (all incident classifications)
- `memory_type` enum ('episodic', 'semantic') — `procedural` removed in migration 061
- All relevant columns migrated from CHECK constraints to enum types

### 4. Composite Indexes ✅

**Status**: COMPLETED in 010, 014, 016

Dashboard queries now use optimized composite indexes:

```sql
CREATE INDEX idx_daily_logs_lookup ON daily_logs(department_id, log_date DESC, shift);
CREATE INDEX idx_machine_ops_lookup ON machine_operations(department_id, shift_date DESC);
CREATE INDEX idx_hourly_loads_lookup ON hourly_loads(department_id, load_date DESC);
CREATE INDEX idx_excavator_activity_lookup ON excavator_activity(department_id, activity_date DESC);
```

### 5. Soft Delete Pattern ✅

**Status**: COMPLETED in migration 010, 014, 016

Standardized across all reference tables:

- `operators`, `sites`, `mine_blocks`, `delay_categories`, `report_templates`
- All now have `deleted_at TIMESTAMPTZ` column

### 6. Audit Trail (created_by) ✅

**Status**: COMPLETED in migration 016

Added audit trail columns to operational tables:

- `daily_logs.created_by` → tracks log creator
- `hourly_loads.created_by` → tracks load recorder
- `machine_hours.created_by` → tracks machine record creator
- `operational_delays.created_by` → tracks delay reporter
- All FK constraints properly configured

### 7. Generated Columns ✅

**Status**: COMPLETED in migration 016

Added computed columns for complex calculations:

- `breakdowns.duration_hours` — Calculates duration from date_in/time_in to date_out/time_out
- STORED generated column for persistence and query optimization

---

## 🟠 Future Enhancements (Post-Phase 3)

---

## 🟡 Medium Priority Improvements (Post-Phase 3)

### 6. Normalize `hourly_loads` Table

**Impact**: Schema flexibility, reduced maintenance
**Effort**: High
**Priority**: P2

**Current Issue**: 12 individual hour columns are denormalized.

**Option A - Keep current (simple queries)**:

```sql
-- Add check constraint to ensure non-negative values
ALTER TABLE hourly_loads ADD CONSTRAINT hour_non_negative
CHECK (hour_01 >= 0 AND hour_02 >= 0 /* ... all hours */ AND hour_12 >= 0);
```

**Option B - Hybrid approach (future migration)**:

```sql
-- Keep existing for performance, add JSONB for flexibility
ALTER TABLE hourly_loads ADD COLUMN hour_details JSONB;
```

### 7. Consolidate Delay Tracking Tables

**Impact**: Reduced redundancy, simplified queries
**Effort**: High
**Priority**: P2

**Analysis**:

- `delay_categories` (reference) - keep
- `operational_delays` - keep, rename to `delays`
- `shift_notes` was dropped, data moved to `operational_delays`

### 8. Add Audit Trail Consistency

**Impact**: Forensic capability, compliance
**Effort**: Medium
**Priority**: P2

```sql
-- Add created_by/updated_by to tables missing them
ALTER TABLE daily_logs ADD COLUMN created_by UUID REFERENCES employees(id);
ALTER TABLE hourly_loads ADD COLUMN created_by UUID REFERENCES employees(id);
```

---

## 🟢 Low Priority Improvements (Post-Phase 3)

### 9. Table Partitioning Strategy

**Impact**: Query performance at scale
**Effort**: High (requires downtime)
**Priority**: P3

**Candidates for partitioning**:

| Table              | Partition Key             | Reason                          |
| ------------------ | ------------------------- | ------------------------------- |
| audit_logs         | created_at (monthly)      | Append-only, large volume       |
| memory_embeddings  | created_at (monthly)      | Append-only, grows continuously |
| safety_incidents   | incident_date (yearly)    | Historical data                 |
| excavator_activity | activity_date (quarterly) | Time-series analytics           |

### 10. Add Stored Generated Columns for Common Calculations

**Impact**: Query simplification, performance
**Effort**: Low
**Priority**: P3

```sql
-- Example: Add total_delay_minutes to operational_delays
-- Already has delay_minutes, could add running totals

-- Example: Duration calculation for breakdowns
ALTER TABLE breakdowns ADD COLUMN duration_hours NUMERIC
GENERATED ALWAYS AS (
  CASE
    WHEN date_out IS NOT NULL THEN
      EXTRACT(EPOCH FROM (
        (date_out + time_out::interval) - (date_in + time_in::interval)
      )) / 3600
    ELSE NULL
  END
) STORED;
```

---

## 📊 Schema Quality Score

| Category        | Score | Notes                                                                 |
| --------------- | ----- | --------------------------------------------------------------------- |
| Security        | 10/10 | Excellent RLS coverage, consistent policies, comprehensive in 012-014 |
| Normalization   | 7/10  | Some denormalization (hourly_loads), good referential integrity       |
| Indexing        | 9/10  | FK indexes and composite indexes added in 010-014                     |
| Documentation   | 9/10  | Comprehensive table/column comments in 014                            |
| Performance     | 9/10  | Excellent index coverage, numeric precision, ready for scale          |
| Maintainability | 9/10  | Consistent patterns, clear migrations, comprehensive docs             |

---

## 🛠️ Migration Implementation Plan

### Phase 1: Critical Fixes (COMPLETED in 010-014)

- [x] Add missing foreign key indexes - Migrations 010_schema_optimization.sql, 014_schema_refinement.sql
- [x] Add updated_at to child tables - daily_logs, machine_hours, fuel_logs, production_logs
- [x] Add soft delete columns to reference tables
- [x] Add enum types for better type safety
- [x] Add composite indexes for dashboard queries
- [x] Add numeric precision constraints
- [x] Add comprehensive table/column comments
- [x] Add missing RLS policies

### Phase 2: High Priority (COMPLETED in 010-014)

- [x] Migrate columns to enum types - Migration 016_schema_enhancements.sql (Native Enums)
- [x] Add composite indexes (dashboard patterns covered in 014)
- [x] Standardize soft delete pattern (columns added in 010-014)
- [x] Add numeric precision constraints (014)
- [x] Comprehensive documentation (014)

### Phase 3: Enhancements (COMPLETED in 016)

1. [x] Add audit trail columns (created_by)
2. [x] Migrate columns to native enum types
3. [x] Column type migration from CHECK to enum types
4. [x] Add generated columns (breakdown duration)

### Phase 4: Future Enhancements (Month 2+)

1. Consider hourly_loads normalization
2. Table partitioning for large tables
3. Performance monitoring dashboard

---

## 📈 Monitoring Recommendations

```sql
-- Monitor for missing indexes
SELECT
  schemaname, tablename, attname
FROM pg_stats
WHERE schemaname = 'public'
  AND seq_scan > 0
  AND idx_scan = 0;

-- Monitor RLS policy performance
EXPLAIN ANALYZE
SELECT * FROM machines
WHERE department_id = 'uuid-here';
```

---

## 🔍 Validation Checklist

After each migration:

- [ ] Verify no sequential scans on FK columns
- [ ] Confirm RLS policies still enforce access
- [ ] Test insert/update/delete on all affected tables
- [ ] Validate application queries still work
- [ ] Check migration is reversible (if needed)
