---
name: database-migrations
description: Migration sequencing, Row Level Security (RLS) enforcement, and transaction safety rules for PostgreSQL.
paths:
  - "packages/database/migrations/**/*.{sql,ts}"
  - "packages/database/tests/**/*.{sql,ts}"
  - "tools/audits/audit-rls.cjs"
---

# Database Migration & RLS Safety Rules

## 1. Migration File Naming & Zero-Padding

- Migration files must be strictly zero-padded 3-digit identifiers followed by a descriptive snake_case slug:
  `packages/database/migrations/NNN_description.sql` (e.g., `154_add_fleet_anomaly_indices.sql`).
- Never edit or mutate previously executed historical migrations. Always create new incremental migrations.

## 2. Mandatory Row Level Security (RLS)

- Every single newly created table MUST enable RLS on line 1 following table creation:
  ```sql
  ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
  ```
- Write explicit RLS policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- Policies must check employee role and department hierarchy:
  ```sql
  CREATE POLICY "<table_name>_dept_read" ON public.<table_name>
    FOR SELECT
    USING (
      department_id IN (
        SELECT e.department_id FROM public.employees e WHERE e.auth_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.employees e WHERE e.auth_id = auth.uid() AND e.role IN ('ADMIN', 'EXECUTIVE')
      )
    );
  ```

## 3. Transaction Safety & Non-Destructive Migrations

- Wrap all DDL statements in atomic transactions (`BEGIN; ... COMMIT;`).
- When adding columns, always add as nullable or with a default value first. Never add `NOT NULL` without a default on existing production tables.
- Never drop a column in the same migration where active application code references are removed. Follow expand-and-contract deployment phases.
