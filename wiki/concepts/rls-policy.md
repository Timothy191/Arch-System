---
title: RLS Policy Standards
created: 2026-05-14
updated: 2026-05-14
type: concept
tags: [security, policy, convention, database]
sources:
  [
    raw/articles/arch-systems-project-overview.md,
    raw/articles/supabase-local-dev-guide.md,
  ]
confidence: high
---

# RLS Policy Standards

Row Level Security (RLS) policies in Arch-Systems are scoped by employee auth identity and department membership.

## Requirements

- `ENABLE ROW LEVEL SECURITY` must be present on every new table
- SELECT, INSERT, UPDATE policies defined for all relevant tables
- DELETE restricted to admin or omitted for audit tables

## Auth Helpers

RLS policies should use the following security definer functions:

- `auth.user_department_id()` — returns the employee's department
- `auth.is_admin()` — checks admin role
- `auth.has_department_access()` — checks cross-department access via `employees.accessible_departments`

## Enforcement

- Middleware enforces auth + department isolation
- Unauthenticated users redirect to `/login`
- Department routes check employee role/department membership
- `employees.accessible_departments` (UUID array) allows cross-department access without changing primary department

## Policy Template

Copy this template for new tables with a `department_id` column:

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- SELECT: Users see rows in their department or accessible departments
CREATE POLICY "new_table_select" ON new_table FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.auth_id = auth.uid()
    AND (
      e.role = 'admin'
      OR e.department_id = new_table.department_id
      OR new_table.department_id = ANY(e.accessible_departments)
    )
  )
);

-- INSERT: Users insert into their own department only
CREATE POLICY "new_table_insert" ON new_table FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.auth_id = auth.uid()
    AND e.department_id = new_table.department_id
  )
);

-- UPDATE: Same scope as SELECT
CREATE POLICY "new_table_update" ON new_table FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.auth_id = auth.uid()
    AND (
      e.role = 'admin'
      OR e.department_id = new_table.department_id
      OR new_table.department_id = ANY(e.accessible_departments)
    )
  )
);

-- DELETE: Admin only (omit for audit tables)
CREATE POLICY "new_table_delete" ON new_table FOR DELETE
TO authenticated
USING (auth.is_admin());
```

## Auth Helper Function Bodies

```sql
-- Returns the current user's department UUID
CREATE OR REPLACE FUNCTION auth.user_department_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT department_id FROM employees
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- Returns true if the current user is an admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
$$;

-- Returns true if the user has access to the given department
CREATE OR REPLACE FUNCTION auth.has_department_access(dept_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE auth_id = auth.uid()
    AND (
      role = 'admin'
      OR department_id = dept_id
      OR dept_id = ANY(accessible_departments)
    )
  );
$$;
```

## Role-Based Access Matrix

| Role                    | Scope                        | Cross-Dept | Delete |
| ----------------------- | ---------------------------- | ---------- | ------ |
| `admin`                 | All departments              | Yes        | Yes    |
| `supervisor`            | Own + accessible_departments | Via array  | No     |
| `operator`              | Own department only          | Via array  | No     |
| `control_room_operator` | Own department only          | Via array  | No     |

## Related

- [[supabase-local-dev]] — test RLS policies in local Studio before pushing
- [[arch-systems]] — the portal using these policies
- [[deepeval-integration]] — RLSCompletenessMetric checks these standards
- [[auth-middleware]] — middleware enforcement of these policies
