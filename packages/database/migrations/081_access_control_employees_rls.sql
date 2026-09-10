-- Migration 081: Access Control Employees RLS
-- Allows the access_control role to view all employee profiles for card printing.

CREATE OR REPLACE FUNCTION is_access_control()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'access_control'
  );
$$;

DROP POLICY IF EXISTS "employees_select_access_control" ON employees;
CREATE POLICY "employees_select_access_control"
  ON employees FOR SELECT
  TO authenticated
  USING (
    is_access_control()
  );
