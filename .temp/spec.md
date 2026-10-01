# Complete Production Overhaul — Technical Specification

## 1. SQL Migrations (Phase 0 + Phase 1)

### 1a. `167_fleet_grant_select.sql` — hotfix for the `fleet` 500

```sql
-- Migration 167: Grant SELECT on fleet to all authenticated users
-- The RLS policy (migration 035) already restricts rows by role and
-- department. This grant just ensures the Postgres permission layer is
-- open, matching what migration 164 already did for employees and departments.
GRANT SELECT ON public.fleet TO authenticated;
```

### 1b. `168_breakdowns_select_sharing.sql` — hotfix for the `breakdowns` 500

```sql
-- Migration 168: Add engineering-breakdown sharing clause to the SELECT policy
-- Migration 077 added breakdown_sharing but the SELECT policy (migration 004)
-- never gained the sharing clause, so users whose only access is via the
-- sharing table get a 500.
DROP POLICY IF EXISTS "breakdowns_select_department" ON breakdowns;
CREATE POLICY "breakdowns_select_department"
  ON breakdowns FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR e.department_id = breakdowns.department_id
          OR breakdowns.department_id = ANY(e.accessible_departments)
          OR breakdowns.department_id IN (
            SELECT bs.department_id
            FROM breakdown_sharing bs
            WHERE bs.employee_id IN (
              SELECT emp.id FROM employees emp
              WHERE emp.auth_id = auth.uid()
            )
          )
        )
    )
  );
```

### 1c. `169_performance_indexes.sql` — fix the 19s `departments` queries

```sql
-- Migration 169: Performance indexes for RLS policy sub-plans
-- The RLS policies on machines, breakdowns, daily_logs, and other
-- department-scoped tables all correlate on employees.auth_id and
-- employees.accessible_departments. Without covering indexes, Postgres
-- does a seq scan on employees for every row checked.
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON employees(auth_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_accessible_departments
  ON employees USING gin(accessible_departments);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
```

### 1d. `170_handle_new_user_accessible.sql` — fix the `machines` 500

```sql
-- Migration 170: Populate accessible_departments in handle_new_user
-- The trigger (migration 001) created employees with full_name and role
-- but never set accessible_departments. RLS policies on machines,
-- breakdowns, and other department-scoped tables require it, so new
-- users got zero rows and PostgREST returned a 500.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employees (auth_id, full_name, role, department_id, accessible_departments)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator'),
    (NEW.raw_user_meta_data->>'department_id')::uuid,
    ARRAY[(NEW.raw_user_meta_data->>'department_id')::uuid]
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', employees.full_name),
    role = COALESCE(NEW.raw_user_meta_data->>'role', employees.role),
    department_id = COALESCE((NEW.raw_user_meta_data->>'department_id')::uuid, employees.department_id),
    accessible_departments = COALESCE(
      (SELECT array_agg(x) FROM unnest(employees.accessible_departments) AS x),
      ARRAY[(NEW.raw_user_meta_data->>'department_id')::uuid]
    );
  RETURN NEW;
END;
$$;
```