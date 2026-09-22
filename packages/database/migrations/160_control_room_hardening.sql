-- 158_control_room_hardening.sql
-- Implements Phase 1: Security & Core Logic for Control Room
-- Adds viewer role, updates operator reference constraints, and secures RLS.

-- 1. Upgrade employees role column to support viewer
-- The check constraint ensures only valid roles can be assigned.
ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN ('operator', 'supervisor', 'admin', 'viewer'));

-- Default any invalid roles back to operator just in case
UPDATE employees SET role = 'operator' WHERE role NOT IN ('operator', 'supervisor', 'admin', 'viewer');

-- 2. Tighten operators RLS (002_control_room_tables)
DROP POLICY IF EXISTS "operators_select_all" ON operators;
DROP POLICY IF EXISTS "operators_insert_admin_supervisor" ON operators;
DROP POLICY IF EXISTS "operators_update_admin_supervisor" ON operators;

-- Everyone can read
CREATE POLICY "operators_select_all"
  ON operators FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/supervisor can insert
CREATE POLICY "operators_insert_admin_supervisor"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('admin', 'supervisor')
    )
  );

-- Only admin/supervisor can update
CREATE POLICY "operators_update_admin_supervisor"
  ON operators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('admin', 'supervisor')
    )
  );

-- Only admin can delete
CREATE POLICY "operators_delete_admin"
  ON operators FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role = 'admin'
    )
  );

-- 3. Tighten shift reports RLS (096_control_room_shift_reports)
DROP POLICY IF EXISTS "control_room_shift_reports_select_department" ON control_room_shift_reports;
DROP POLICY IF EXISTS "control_room_shift_reports_insert_department" ON control_room_shift_reports;
DROP POLICY IF EXISTS "control_room_shift_reports_update_department" ON control_room_shift_reports;
DROP POLICY IF EXISTS "control_room_shift_reports_delete_admin" ON control_room_shift_reports;

-- Viewers, Operators, Supervisors, Admins can read
CREATE POLICY "control_room_shift_reports_select_department"
  ON control_room_shift_reports FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR public.has_department_access(department_id)
  );

-- Only Operator, Supervisor, Admin can insert
CREATE POLICY "control_room_shift_reports_insert_department"
  ON control_room_shift_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.has_department_access(department_id))
    AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('operator', 'supervisor', 'admin')
    )
  );

-- Only Supervisor, Admin can update
CREATE POLICY "control_room_shift_reports_update_department"
  ON control_room_shift_reports FOR UPDATE
  TO authenticated
  USING (
    (public.is_admin() OR public.has_department_access(department_id))
    AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('supervisor', 'admin')
    )
  )
  WITH CHECK (
    (public.is_admin() OR public.has_department_access(department_id))
    AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('supervisor', 'admin')
    )
  );

-- Only Admin can delete
CREATE POLICY "control_room_shift_reports_delete_admin"
  ON control_room_shift_reports FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- 4. Idempotency Support for Shift Closeout
-- Add idempotency_key to shift_reports to allow safely retrying the closeout transaction
ALTER TABLE control_room_shift_reports
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

