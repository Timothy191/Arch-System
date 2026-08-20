# 🔒 Database Schema & Topology Map

**Generated:** 8/20/2026, 9:17:54 AM UTC  
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
\n## 🌉 Cross-Department Linkages\n\n- **Engineering & Control Room:** To see exactly how tables connect, reference `packages/database/migrations/`. For example, matching `breakdowns.fleet_id` (Engineering) to `machines.serial_number` or `machines.id` (Control Room) bridges the gap between active machine breakdowns and operational monitoring, surfacing breakdown comments where they are required in operations.
