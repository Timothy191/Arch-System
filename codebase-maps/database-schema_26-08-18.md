# Database Schema Map

**Generated:** 2026-08-18  
**System:** Arch-System Mining Operations Portal

## Overview

This map details the complete database architecture, including all tables, relationships, RLS policies, and security rules for the PostgreSQL/Supabase database.

---

## 1. Core Tables by Domain

### Identity & Access Control

#### departments

**Migration:** 001_initial.sql
**Columns:** id, name, display_name, icon, description, color, created_at
**Purpose:** Organizational departments with visual metadata
**RLS:** All authenticated users can read
**Unique:** name

#### employees

**Migration:** 001_initial.sql
**Columns:** id, auth_id, department_id, full_name, role, accessible_departments[], created_at
**Purpose:** Links Supabase auth users to departments with role-based access
**Roles:** admin, supervisor, operator, access_control, control_room_operator
**RLS:** Self-select or admin; insert by admin only
**Foreign Keys:** auth_id → auth.users, department_id → departments

#### roles

**Migration:** 070_control_room_operator_role_and_lookup.sql
**Columns:** id, name, description, permissions
**Purpose:** Role definitions with permission mappings

---

### Access Control System

#### personnel

**Migration:** 028_access_control_system.sql
**Columns:** id, emp_code, first_name, surname, id_number, job_title, department_id, induction_expiry, medical_expiry, status, area
**Purpose:** Physical personnel records for QR access system
**Unique:** emp_code, id_number
**Foreign Keys:** department_id → departments

#### visitors

**Migration:** 028_access_control_system.sql
**Columns:** id, name, company, purpose, host_id, check_in_time, check_out_time, status
**Purpose:** Visitor tracking and management
**Foreign Keys:** host_id → personnel

#### badges

**Migration:** 028_access_control_system.sql
**Columns:** id, qr_code, entity_type, personnel_id, visitor_id, fleet_id, equipment_id, is_active, issued_at, revoked_at
**Purpose:** QR code assignments for personnel, visitors, vehicles, equipment
**Unique:** qr_code
**Foreign Keys:** personnel_id → personnel, visitor_id → visitors, fleet_id → fleet, equipment_id → equipment

#### access_logs

**Migration:** 028_access_control_system.sql
**Columns:** id, badge_id, access_type, direction, gate_location, access_granted, denial_reason, scanned_at, department_id
**Purpose:** Gate access event logging
**Indexes:** scanned_at DESC, gate_location
**Foreign Keys:** badge_id → badges, department_id → departments

---

### Fleet & Equipment

#### machines

**Migration:** 001_initial.sql
**Columns:** id, department_id, name, machine_type, serial_number, active, bin_factor, site_id, report_exempt, created_at
**Purpose:** Mining equipment registry
**RLS:** Department-scoped access
**Foreign Keys:** department_id → departments

#### fleet

**Migration:** 035_fleet_and_equipment_tables.sql
**Columns:** id, fleet_code, vehicle_type, registration_number, make, model, year, department_id, status, last_service_date, next_service_date
**Purpose:** Vehicle fleet management
**Unique:** fleet_code
**Foreign Keys:** department_id → departments

#### equipment

**Migration:** 035_fleet_and_equipment_tables.sql
**Columns:** id, equip_code, equipment_type, serial_number, manufacturer, model, department_id, assigned_to, status, calibration_expiry
**Purpose:** Non-vehicle portable/fixed assets
**Unique:** equip_code
**Foreign Keys:** department_id → departments

#### tires

**Migration:** 0146_tire_management.sql
**Columns:** id, machine_id, serial_number, position, brand, model, size, status, install_date, current_hours, estimated_remaining_hours
**Purpose:** Tire tracking and lifecycle management
**Unique:** serial_number
**Foreign Keys:** machine_id → machines

#### tire_inspections

**Migration:** 0146_tire_management.sql
**Columns:** id, tire_id, inspection_date, inspector_id, tread_depth, condition_notes, damage_photos[], status
**Purpose:** Tire inspection records
**Foreign Keys:** tire_id → tires

---

### Control Room Operations

#### operators

**Migration:** 002_control_room_tables.sql
**Columns:** id, full_name, employee_code, role, active, created_at
**Purpose:** Operator reference for dropdowns
**Unique:** employee_code

#### sites

**Migration:** 002_control_room_tables.sql
**Columns:** id, name, site_code, active, created_at
**Purpose:** Site/location reference
**Unique:** site_code

#### machine_operations

**Migration:** 002_control_room_tables.sql
**Columns:** id, department_id, machine_id, operator_id, site_id, shift_date, shift_type, start_time, end_time, hours_worked (computed), created_by, created_at, updated_at
**Purpose:** Daily machine operation tracking
**Unique:** machine_id, shift_date, shift_type, start_time
**RLS:** Department-scoped
**Foreign Keys:** department_id → departments, machine_id → machines, operator_id → operators, site_id → sites

#### hourly_loads

**Migration:** 003_control_room_revisions.sql
**Columns:** id, department_id, machine_id, load_date, shift_type, hour_01-12, total_loads (computed), created_at, updated_at
**Purpose:** 12-hour shift load tracking per hour
**Unique:** machine_id, load_date, shift_type
**Partitioned:** By date (monthly partitions)
**Foreign Keys:** department_id → departments, machine_id → machines

#### excavator_activity

**Migration:** 002_control_room_tables.sql
**Columns:** id, department_id, machine_id, operator_id, activity_date, shift_type, passes, loads, avg_cycle_time_seconds, material_type, estimated_tonnes, notes
**Purpose:** Excavator performance metrics
**Unique:** machine_id, activity_date, shift_type
**Foreign Keys:** department_id → departments, machine_id → machines, operator_id → operators

#### dozer_rolls

**Migration:** 002_control_room_tables.sql
**Columns:** id, department_id, machine_id, operator_id, roll_date, shift_type, blade_passes, push_count, area_covered_sqm, material_moved_tonnes, hours_operated, notes
**Purpose:** Dozer/roll-over activity tracking
**Unique:** machine_id, roll_date, shift_type
**Foreign Keys:** department_id → departments, machine_id → machines, operator_id → operators

#### shift_status

**Migration:** 0145_shift_closeout.sql
**Columns:** id, department_id, shift_date, shift_type, status, closed_by, closed_at
**Purpose:** Shift open/close workflow
**Unique:** department_id, shift_date, shift_type
**Foreign Keys:** department_id → departments

---

### Delay Management

#### delay_categories

**Migration:** 068_delay_entries_table.sql
**Columns:** id, name, description, is_active, created_at, updated_at
**Purpose:** Delay classification (External, Production, Engineering)
**Unique:** name

#### delay_entries

**Migration:** 068_delay_entries_table.sql
**Columns:** id, machine_operation_id, delay_category_id, delay_start_time, delay_end_time, duration_hours (computed), is_manual_override, manual_duration_hours, description, status (draft/committed), committed_at, committed_by, uncommitted_at, uncommitted_by, uncommit_reason, deleted_at, deleted_by, deleted_reason, created_by, created_at, updated_at
**Purpose:** Granular delay tracking with draft/committed workflow
**RLS:** Draft entries editable by operators; committed read-only
**Constraint:** Max 12 hours per operation (with manual override exception)
**Foreign Keys:** machine_operation_id → machine_operations, delay_category_id → delay_categories

---

### Engineering & Safety

#### breakdowns

**Migration:** 004_breakdowns.sql
**Columns:** id, department_id, fleet_id, machine_type, date_in, time_in, date_out, time_out, reason, repair_notes, status, missing_book_in, created_by, completed_by, deleted_at, created_at, updated_at
**Purpose:** Machine breakdown book-in/book-out workflow
**RLS:** Operators, supervisors, admins can insert/update
**Indexes:** department_id, status, fleet_id, date_in DESC
**Foreign Keys:** department_id → departments, fleet_id → fleet

#### engineering_notes

**Migration:** 003_control_room_revisions.sql
**Columns:** id, department_id, note_date, shift_type, issue_type, severity, machine_id, description, action_taken, requires_follow_up, status, resolved_at, created_by, created_at, updated_at
**Purpose:** Engineering issue tracking
**Issue Types:** mechanical, electrical, structural, hydraulic, other
**Foreign Keys:** department_id → departments, machine_id → machines

#### safety_severities

**Migration:** 006_safety_department.sql
**Columns:** id, level, weight, color, sort_order
**Purpose:** Safety severity levels (low, medium, high, critical)

#### safety_incident_categories

**Migration:** 006_safety_department.sql
**Columns:** id, name, description, color, icon, sort_order
**Purpose:** Safety incident categorization

#### safety_incidents

**Migration:** 006_safety_department.sql
**Columns:** id, department_id, incident_date, shift_type, category_id, severity_id, incident_type, description, location, injured_parties, reported_by, reviewed_by, root_cause, corrective_action, status, closed_at, created_at, updated_at
**Purpose:** Safety incident reporting and tracking
**Incident Types:** near-miss, incident, lost-time, equipment-damage
**Foreign Keys:** department_id → departments, category_id → safety_incident_categories, severity_id → safety_severities

---

### Drill Operations

#### drill_operations

**Migration:** 024_drill_operations.sql
**Columns:** id, machine_id, department_id, operation_date, open_hours, close_hours, total_hours (computed), operator_id, operator_name, block_drilled, holes, meters_drilled, production_delays, non_productional_delays, engineering_delays, shift_id, shift_type, status, notes, created_at, updated_at, created_by, updated_by
**Purpose:** Daily drilling operations tracking
**Unique:** machine_id, operation_date
**Indexes:** machine_id, operation_date; department_id, operation_date; operator_id; shift_id
**Foreign Keys:** machine_id → machines, department_id → departments

#### machine_telemetry

**Migration:** 025_machine_telemetry.sql
**Columns:** id, machine_id, department_id, recorded_at, year_month (computed), engine_rpm, engine_temp, hydraulic_pressure, hydraulic_temp, bit_depth, hole_depth, weight_on_bit, rotation_torque, penetration_rate, standpipe_pressure, mud_flow_rate, ambient_temp, vibration_level, operating_hours, fuel_level, alert_count, alert_codes[], created_at
**Purpose:** Real-time drill rig telemetry with monthly archival
**Unique:** machine_id, recorded_at
**Indexes:** machine_id, recorded_at DESC; year_month; department_id
**Foreign Keys:** machine_id → machines, department_id → departments

#### machine_telemetry_archive

**Migration:** 025_machine_telemetry.sql
**Purpose:** Archived telemetry with aggregated daily summaries

---

### Daily Logs & Production

#### daily_logs

**Migration:** 001_initial.sql
**Columns:** id, department_id, log_date, shift, notes, created_at
**Purpose:** Daily shift log headers
**Unique:** department_id, log_date, shift
**Partitioned:** By date (monthly partitions)
**Foreign Keys:** department_id → departments

#### machine_hours

**Migration:** 001_initial.sql
**Columns:** id, daily_log_id, machine_id, hours_worked, created_at
**Purpose:** Hours worked per machine per shift
**Foreign Keys:** daily_log_id → daily_logs, machine_id → machines

#### fuel_logs

**Migration:** 001_initial.sql
**Columns:** id, daily_log_id, machine_id, diesel_litres, created_at
**Purpose:** Fuel consumption tracking
**Foreign Keys:** daily_log_id → daily_logs, machine_id → machines

#### production_logs

**Migration:** 001_initial.sql
**Columns:** id, daily_log_id, coal_tonnes, waste_tonnes, created_at
**Purpose:** Production tonnage tracking
**Partitioned:** By date (monthly partitions)
**Foreign Keys:** daily_log_id → daily_logs

#### material_density

**Migration:** 073_production_summary_view.sql
**Columns:** id, material_type, density_kg_per_m3
**Purpose:** Material density for tonnage calculations
**Unique:** material_type

---

### Documents & Reporting

#### documents

**Migration:** 036_documents.sql
**Columns:** id, department_id, title, content (jsonb), file_path, file_name, file_size, mime_type, created_by, created_at, updated_at, deleted_at
**Purpose:** Word-processing document storage with version history
**RLS:** Department access with soft-delete filtering
**Foreign Keys:** department_id → departments

#### document_versions

**Migration:** 036_documents.sql
**Columns:** id, document_id, content, title, version_number, created_by, created_at, summary
**Purpose:** Document version history
**Unique:** document_id, version_number
**Foreign Keys:** document_id → documents (ON DELETE CASCADE)

#### report_templates

**Migration:** 002_control_room_tables.sql
**Columns:** id, name, description, report_type, auto_generate, config, created_at
**Purpose:** Report template definitions

#### generated_reports

**Migration:** 002_control_room_tables.sql
**Columns:** id, template_id, department_id, report_date, shift_type, report_data, pdf_url, generated_by, generated_at
**Purpose:** Generated report instances
**Foreign Keys:** template_id → report_templates, department_id → departments

#### control_room_shift_reports

**Migration:** 096_control_room_shift_reports.sql
**Columns:** id, department_id, report_date, shift_type, total_hours, total_loads, total_tonnes, efficiency_score, anomalies_detected, report_data, created_at, updated_at
**Purpose:** Automated shift summary reports
**Unique:** department_id, report_date, shift_type
**Foreign Keys:** department_id → departments

---

### AI & Vector Search

#### memory_embeddings

**Migration:** 009_ai_memory.sql
**Columns:** id, session_id, user_id, content, embedding (vector 1536), metadata, memory_type, created_at, updated_at
**Purpose:** Vector store for AI memory (episodic, semantic)
**Indexes:** HNSW on embedding (cosine), session, user, type, metadata GIN, full-text search
**RLS:** User-owned or admin

#### embedding_cache

**Migration:** 059_embedding_cache.sql
**Purpose:** Cache for embedding generation results

#### sync_watermarks

**Migration:** 031_embedding_sync_watermarks.sql
**Purpose:** Track embedding sync progress

---

### Webhooks & Integration

#### webhook_endpoints

**Migration:** 017_webhooks.sql
**Columns:** id, url, description, event_types[], department_id, active, secret, svix_endpoint_id, deleted_at, created_at, updated_at
**Purpose:** External webhook endpoint configurations
**Foreign Keys:** department_id → departments

#### webhook_delivery_logs

**Migration:** 017_webhooks.sql
**Columns:** id, webhook_endpoint_id, event_type, payload, response_status, response_body, delivered_at, retry_count, success, error_message, created_at
**Purpose:** Webhook delivery attempt logging
**Foreign Keys:** webhook_endpoint_id → webhook_endpoints

---

### Audit & Monitoring

#### audit_logs

**Migration:** 007_audit_logs.sql
**Columns:** id, action, table_name, record_id, old_data, new_data, performed_by, department_id, ip_address, user_agent, created_at
**Purpose:** Comprehensive audit trail
**Indexes:** table_name, record_id; performed_by; department_id; created_at DESC

#### user_feedback

**Migration:** 015_user_feedback.sql
**Columns:** id, user_id, type, category, subject, description, status, assigned_to, created_at, updated_at
**Purpose:** User feedback and issue tracking

#### quick_feedback

**Migration:** 015_user_feedback.sql
**Columns:** id, page_url, rating, comment, created_at
**Purpose:** In-page quick feedback

#### slo_metrics

**Migration:** 091_slo_monitoring.sql
**Columns:** id, slo_name, measurement_time, target_value, actual_value, status, error_budget_remaining, period_start, period_end, metadata, created_at
**Purpose:** SLO monitoring and compliance tracking

#### feature_flags

**Migration:** 092_feature_flags.sql
**Columns:** id, key, name, description, enabled, rollout_percentage, target_users, target_groups, variant_a, variant_b, start_date, end_date, created_at, updated_at
**Purpose:** Feature flags and A/B testing
**Unique:** key

#### feature_flag_exposures

**Migration:** 092_feature_flags.sql
**Purpose:** Log feature flag evaluations

#### ab_test_results

**Migration:** 092_feature_flags.sql
**Purpose:** A/B test results tracking

---

### Card Printing Infrastructure

#### card_printers

**Migration:** 076_card_printing_infrastructure.sql
**Columns:** id, cups_name, ip_address, location, status
**Unique:** cups_name

#### card_templates

**Migration:** 076_card_printing_infrastructure.sql
**Columns:** id, name, design_config, is_default

#### print_jobs

**Migration:** 076_card_printing_infrastructure.sql
**Columns:** id, printer_id, template_id, personnel_id, status, queued_at, printed_at, error_message
**Foreign Keys:** printer_id → card_printers, template_id → card_templates, personnel_id → personnel

#### issued_cards

**Migration:** 076_card_printing_infrastructure.sql
**Columns:** id, print_job_id, personnel_id, qr_code_data, rfid_uid, status, expires_at, issued_at
**Foreign Keys:** print_job_id → print_jobs, personnel_id → personnel

---

### Data Integrity & Performance

#### data_integrity_issues

**Migration:** 087_data_integrity_issues.sql
**Purpose:** Track data validation issues

#### shift_integrity_reports

**Migration:** 088_shift_integrity_reports.sql
**Purpose:** Daily shift data integrity validation

#### shift_completeness_alerts

**Migration:** 086_shift_completeness_alerts.sql
**Purpose:** Alert on incomplete shift data

#### cache_events

**Migration:** 067_cache_events.sql
**Purpose:** Cache event logging

#### cache_anomalies

**Migration:** 067_cache_events.sql
**Purpose:** Cache anomaly detection

#### secrets_rotation_log

**Migration:** 085_secrets_rotation_log.sql
**Purpose:** Track secrets rotation

#### machine_configurations

**Migration:** 042_machine_configurations.sql
**Columns:** id, department_id, config_json
**Unique:** department_id
**Foreign Keys:** department_id → departments

---

## 2. Key Relationships

### Department-Centric Architecture

```
departments (center)
├── employees (auth_id → auth.users)
├── machines
├── personnel
├── fleet
├── equipment
├── daily_logs
├── machine_operations
├── excavator_activity
├── dozer_rolls
├── safety_incidents
├── breakdowns
├── engineering_notes
├── documents
└── All operational tables
```

### Machine Hierarchy

```
machines
├── machine_operations → operators, sites
│   └── delay_entries → delay_categories
├── hourly_loads
├── excavator_activity
├── dozer_rolls
├── tires → tire_inspections
└── machine_telemetry → machine_telemetry_archive
```

### Daily Log Hierarchy

```
daily_logs
├── machine_hours
├── fuel_logs
└── production_logs
```

### Access Control Flow

```
auth.users
└── employees
    ├── accessible_departments[] (cross-department access)
    └── role → RLS policies
```

### Document Versioning

```
documents
└── document_versions (ON DELETE CASCADE)
```

### Badge Assignment

```
badges
├── personnel
├── visitors
├── fleet
└── equipment
```

---

## 3. RLS Policies & Security Rules

### Common RLS Patterns

**Department-Scoped Access (Most Tables)**

```sql
-- SELECT: Admin OR own department OR accessible_departments
role = 'admin'
OR department_id = user_department_id
OR department_id = ANY(accessible_departments)
```

**Insert/Update Restrictions**

- Admins: Full access
- Supervisors: Department-level insert/update
- Operators: Department-level insert, update only own records
- Access Control: Specialized access to personnel/visitors/badges/access_logs

**Reference Tables (Read-All)**

- departments, operators, sites, delay_categories, safety_severities, safety_incident_categories
- All authenticated users can SELECT

**Audit & System Tables**

- audit_logs: Service role can insert; authenticated can read own department
- slo_metrics, feature_flags: Service role write; authenticated read

### Special RLS Features

**Soft-Delete Pattern**

- breakdowns, documents, delay_entries: `deleted_at IS NULL` filter in SELECT
- Admin-only soft-delete via UPDATE

**Draft/Committed Workflow (delay_entries)**

- Draft: Operators can insert/update/delete
- Committed: Read-only; supervisors can uncommit with reason

**Storage RLS (documents bucket)**

- Path convention: `{department_uuid}/{employee_id}/{filename}`
- Department access via foldername extraction

**Archive Tables**

- Inherit RLS from parent via SECURITY DEFINER functions
- Department-scoped access maintained

---

## 4. Important Indexes & Constraints

### Critical Performance Indexes

**Foreign Key Indexes** (089_add_unindexed_foreign_key_indexes.sql)

- idx_breakdowns_completed_by, idx_breakdowns_created_by
- idx_employees_auth_id
- idx_excavator_activity_block_mined_id
- idx_fuel_logs_daily_log_id, idx_fuel_logs_machine_id
- idx_generated_reports_generated_by
- idx_machine_hours_daily_log_id, idx_machine_hours_machine_id
- idx_machine_operations_created_by
- idx_production_logs_daily_log_id
- idx_safety_incidents_reviewed_by
- idx_user_feedback_assigned_to, idx_user_feedback_user_id

**Composite Indexes**

- idx_breakdowns_fleet_date: (fleet_id, date_in) WHERE deleted_at IS NULL
- idx_shift_status_dept_date_shift: (department_id, shift_date DESC, shift_type)
- idx_delay_entries_machine_operation_id, idx_delay_entries_status, idx_delay_entries_delay_start_time, idx_delay_entries_delay_end_time

**Vector Search Indexes** (009_ai_memory.sql)

- HNSW index on embedding: `USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`
- GIN index on metadata
- Full-text search index on content

**Time-Series Indexes**

- idx_telemetry_machine_date: (machine_id, recorded_at DESC)
- idx_telemetry_year_month: (year_month)
- idx_access_logs_scanned_at: (scanned_at DESC)

**Materialized View Indexes** (022_materialized_views.sql)

- uidx_dept_production_summary_dept: (department_id)
- uidx_machine_utilization_weekly_machine: (machine_id)
- uidx_safety_incident_monthly: (department_id, incident_month, incident_type, status)

### Unique Constraints

**Business Logic Constraints**

- daily_logs: (department_id, log_date, shift)
- machine_operations: (machine_id, shift_date, shift_type, start_time)
- hourly_loads: (machine_id, load_date, shift_type)
- excavator_activity: (machine_id, activity_date, shift_type)
- dozer_rolls: (machine_id, roll_date, shift_type)
- drill_operations: (machine_id, operation_date)
- machine_telemetry: (machine_id, recorded_at)
- shift_status: (department_id, shift_date, shift_type)
- document_versions: (document_id, version_number)

**Identity Constraints**

- employees.employee_code
- personnel.emp_code, personnel.id_number
- badges.qr_code
- fleet.fleet_code
- equipment.equip_code
- tires.serial_number
- feature_flags.key

**Data Integrity Constraints**

- shift_completeness_alerts: (department_id, shift_date, shift_type, resolved)
- data_integrity_issues: (table_name, record_id, issue_type, resolved)
- machine_configurations: (department_id)

### Check Constraints

**Enumerated Values**

- shift: CHECK (shift IN ('day', 'night'))
- shift_type: CHECK (shift_type IN ('day', 'night'))
- status fields: Various enums per table
- delay_entries.status: CHECK (status IN ('draft', 'committed'))
- safety_incidents.incident_type: CHECK (incident_type IN ('near-miss', 'incident', 'lost-time', 'equipment-damage'))

**Computed Columns**

- machine_operations.hours_worked: Generated from (end_time - start_time)
- hourly_loads.total_loads: Sum of hour_01-12
- drill_operations.total_hours: Generated from (close_hours - open_hours)
- delay_entries.duration_hours: Generated from (delay_end_time - delay_start_time)
- machine_telemetry.year_month: Generated from recorded_at

---

## 5. Partitioning Strategy

**Partitioned Tables** (063_partition_pruning_optimization.sql, 072_partition_production_logs.sql)

- **hourly_loads**: Partitioned by date (monthly partitions)
- **daily_logs**: Partitioned by date (monthly partitions)
- **production_logs**: Partitioned by date (monthly partitions)

**Archive Tables**

- machine_operations_archive, excavator_activity_archive, dozer_rolls_archive
- operational_delays_archive, engineering_notes_archive
- drill_operations_archive, delay_entries_archive
- machine_telemetry_archive (monthly aggregated)
- access_logs_archive (weekly)

---

## 6. Security Functions

**Helper Functions** (001_initial.sql)

- `user_department_id()`: Returns current user's department
- `is_admin()`: Checks if user is admin
- `has_department_access(dept_id)`: Checks department access

**Materialized View Wrappers** (022_materialized_views.sql)

- `get_dept_production_summary()`: RLS-enforced production summary
- `get_machine_utilization_weekly()`: RLS-enforced utilization data
- `get_safety_incident_monthly()`: RLS-enforced safety data

**Vector Search Functions** (009_ai_memory.sql)

- `search_memories_hybrid()`: Semantic + keyword + temporal search
- `search_memories_semantic()`: Pure ANN search via HNSW
- `get_conversation_history()`: Episodic memory retrieval

**Telemetry Functions** (025_machine_telemetry.sql)

- `archive_telemetry_month()`: Monthly archival with aggregation
- `get_telemetry_summary()`: Daily/hourly summaries

**Feature Flag Function** (092_feature_flags.sql)

- `evaluate_feature_flag()`: Deterministic flag evaluation with bucketing

---

## 7. Triggers

**Updated At Triggers**

- Automatic `updated_at` updates on most tables with that column

**Auth Trigger** (001_initial.sql)

- `handle_new_user()`: Auto-creates employee record on auth.users signup

**Audit Triggers** (011_automated_auditing.sql)

- `process_audit_log()`: Logs INSERT/UPDATE/DELETE on key tables

**Delay Validation Triggers** (068_delay_entries_table.sql)

- `check_delay_hours_max_12_hours()`: Enforces 12-hour limit per operation
- `validate_delay_entry_time()`: Validates delay times within operation window

**Telemetry Archival Trigger** (025_machine_telemetry.sql)

- `check_and_archive_telemetry()`: Auto-archives previous month on month change

---

## Summary

This is a **department-centric mining operations portal** with:

- **Core Domains**: Access control, fleet/equipment, control room operations, engineering, safety, drilling, documents
- **Security Model**: Row-level security based on departments with cross-department access via `accessible_departments[]`
- **Role Hierarchy**: admin > supervisor > operator > access_control > control_room_operator
- **Data Architecture**: Time-series partitioning for operational data, archive tables for historical data, materialized views for dashboard performance
- **Advanced Features**: Vector search for AI memory, webhook integration, feature flags, SLO monitoring, comprehensive audit trail
- **Performance Optimization**: HNSW vector indexes, composite indexes, partition pruning, computed columns, materialized views with SECURITY DEFINER wrappers
