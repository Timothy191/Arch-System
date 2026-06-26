-- Migration 078: Enable RLS on material_density reference table
-- Objective: Address CRITICAL finding from RLS audit — material_density
-- was declared in 073 but never had ENABLE ROW LEVEL SECURITY.
-- This is a static reference/lookup table (material type → density factor),
-- so a permissive SELECT policy for authenticated users is appropriate.

BEGIN;

ALTER TABLE material_density ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read density factors (reference data).
CREATE POLICY "material_density_select_all" ON material_density
  FOR SELECT
  USING (true);

-- Restrict write access to admins only.
CREATE POLICY "material_density_insert_admin" ON material_density
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "material_density_update_admin" ON material_density
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "material_density_delete_admin" ON material_density
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

COMMIT;