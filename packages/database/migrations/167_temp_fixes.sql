-- 1. Fleet 500 Hotfix
GRANT SELECT ON public.fleet TO authenticated;

-- 2. Breakdowns Select Sharing Hotfix (from .temp/tasks.md)
DROP POLICY IF EXISTS "breakdowns_select_engineering" ON breakdowns;
CREATE POLICY "breakdowns_select_engineering"
  ON breakdowns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR e.department_id = breakdowns.department_id
          OR breakdowns.department_id = ANY(e.accessible_departments)
          OR breakdowns.shared_with_departments ? (SELECT name FROM departments WHERE id = e.department_id)
        )
    )
  );

-- 3. Performance Indexes (from .temp/tasks.md Task 1.1)
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON employees(auth_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_employees_accessible_departments ON employees USING GIN(accessible_departments);

-- 4. handle_new_user accessible_departments fix (Task 1.4)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employees (
    auth_id,
    first_name,
    last_name,
    email,
    role,
    department_id,
    accessible_departments,
    employee_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator'),
    (NEW.raw_user_meta_data->>'department_id')::uuid,
    ARRAY[(NEW.raw_user_meta_data->>'department_id')::uuid],
    COALESCE(NEW.raw_user_meta_data->>'employee_id', split_part(NEW.id::text, '-', 1))
  );
  RETURN NEW;
END;
$$;
