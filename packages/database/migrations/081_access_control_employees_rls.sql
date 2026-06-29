-- Migration 081: Access Control Employees RLS
-- Allows the access_control role to view all employee profiles for card printing.

CREATE POLICY "employees_select_access_control"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role = 'access_control'
    )
  );
