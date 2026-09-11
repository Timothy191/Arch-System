---
id: "security-compliance"
name: "Security & RLS Governance Sentinel"
department: "compliance-safety"
authority_level: "L3"
schedule:
  min_interval_minutes: 30
  max_interval_minutes: 360
  backoff_factor: 2.0
signals:
  - source: "git"
    event: "migration-added"
  - source: "scheduled"
    event: "periodic-security-audit"
verification:
  commands:
    - "node tools/audits/audit-rls.cjs"
    - "node tools/audits/enforce-security-checks.cjs"
---

# Business Loop: Security & RLS Governance Sentinel

## 1. Business Intent
Guarantees that database schemas, migration files, and security policies strictly adhere to Supabase Row Level Security (RLS) standards. Flags missing RLS, open policies (`USING (true)`), unpinned search paths, or leaked credentials.

## 2. Invariants & Guardrails
- **100% RLS Coverage**: Every table created in `packages/database/migrations/` must explicitly enable RLS.
- **Department-Scoped Access**: Policies must enforce `employees.department_id` and `employees.role` checks.
- **Level 3 Protection**: Any remediation touching SQL migration files or database policies requires human approval via `corpos approve`.
