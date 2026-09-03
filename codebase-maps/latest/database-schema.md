# 🔒 Database Schema & Topology Map

**Generated:** 9/2/2026, 11:13:16 AM UTC  
**Engine:** PostgreSQL via Supabase

---

## 📊 Core Entity Relationship Overview

- **Employees & Access**: `employees`, `departments`, `operators`
- **Operational Data**: `safety_incidents`, `breakdowns`, `hourly_loads`, `machine_operations`
- **Telemetry & Assets**: `machines`, `sites`, `mine_blocks`, `material_density`

---

## 🛡️ Security & Row Level Security (RLS) Mandates
* **Source of Truth**: `packages/database/migrations/` contains all numbered SQL migrations.
* **100% RLS Enforcement**: Every table has active RLS policy enabled.
* **Department Isolation**: Multi-tenant separation enforced via `auth.uid()` and `accessible_departments` mapping.
