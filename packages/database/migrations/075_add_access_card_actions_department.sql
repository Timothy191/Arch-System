-- Migration 075: Add Access Card Actions Department
INSERT INTO departments (name, display_name, icon, description, color)
VALUES ('access-card-actions', 'Access Card Actions', 'CreditCard', 'Manage printed badges, print cards & QR generation', 'blue')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  dept_id UUID;
BEGIN
  SELECT id INTO dept_id FROM departments WHERE name = 'access-card-actions';
  IF dept_id IS NOT NULL THEN
    -- Append the new department ID to existing admin and access control employees
    UPDATE employees
    SET accessible_departments = array_append(accessible_departments, dept_id)
    WHERE NOT (accessible_departments @> ARRAY[dept_id])
      AND role IN ('admin', 'access_control');
  END IF;
END $$;
