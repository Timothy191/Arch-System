---
source_url: internal
ingested: 2026-05-15
sha256: d0e491545037afaed210632eac5e47345af0191bafe0c915174434f15dd15ed2
---

# Database Schema Source

Extracted from `packages/database/migrations/` (16 migration files):

- 001_initial.sql — Core tables, auth helpers, trigger
- 002_control_room_tables.sql — Operators, sites, machine_operations, hourly_loads, shift_notes, excavator_activity, dozer_rolls
- 003_control_room_revisions.sql — 12-hour grid, engineering_notes, operational_delays, bin_factor
- 004_breakdowns.sql — Breakdowns table with indexes and trigger
- 005_seed_data.sql — Department, machine, site, operator, delay category seeds
- 006_safety_department.sql — Safety incidents, severities, categories
- 007_audit_logs.sql — Audit trail table and policies
- 008_excavator_activity_redesign.sql — Excavator activity + dumper assignments
- 009_ai_memory.sql — AI memory system with vector embeddings
- 010_schema_optimization.sql — FK indexes, enum types, soft deletes, timestamps
- 011_automated_auditing.sql — Automated audit triggers
- 012_rls_refinement.sql — RLS policy refinements
- 013_json_validation.sql — JSON validation constraints
- 014_schema_refinement.sql — Composite indexes, precision constraints, comments
- 015_shift_closeout.sql — Shift closeout workflow
- 016_schema_enhancements.sql — Native enum migration, audit columns, generated columns
