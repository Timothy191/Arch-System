-- Migration 070: Add control_room_operator role and ensure roles lookup table exists
-- This migration ensures the database matches the expectations of the Control Room verification scripts.

-- 1. Ensure the roles lookup table exists
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Populate the roles lookup table with existing roles
-- This aligns with the employees_role_check constraint and the new control_room_operator role
INSERT INTO roles (name) VALUES 
  ('admin'),
  ('supervisor'),
  ('operator'),
  ('maintenance'),
  ('viewer'),
  ('access_control'),
  ('control_room_operator')
ON CONFLICT (name) DO NOTHING;

-- 3. Update the employees role check constraint to include control_room_operator
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_check'
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_role_check;
  END IF;

  -- Add the expanded constraint including control_room_operator
  ALTER TABLE employees ADD CONSTRAINT employees_role_check
    CHECK (role IN ('admin', 'supervisor', 'operator', 'maintenance', 'viewer', 'access_control', 'control_room_operator'));
END
$$;

-- 4. Enable RLS on roles table for security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read roles
CREATE POLICY "roles_select_all"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify roles
CREATE POLICY "roles_admin_all"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid() AND e.role = 'admin'
    )
  );
