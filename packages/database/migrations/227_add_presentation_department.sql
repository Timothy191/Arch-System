-- ============================================================================
-- Migration: 227_add_presentation_department.sql
-- Description: Seed Presentation ('presentation') department and
--              backfill executive/manager employee department access.
-- ============================================================================

INSERT INTO public.departments (name, display_name, icon, description, color)
VALUES (
  'presentation',
  'Presentation',
  'Presentation',
  'Prebuilt executive & investor briefing deck, live platform telemetry, architecture walkthroughs & system documentation',
  'amber'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  color = EXCLUDED.color;

DO $$
DECLARE
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'presentation' LIMIT 1;

  IF v_dept_id IS NOT NULL THEN
    -- Append to legacy employees.accessible_departments array for admin and manager roles
    UPDATE public.employees
    SET accessible_departments = array_append(COALESCE(accessible_departments, ARRAY[]::UUID[]), v_dept_id)
    WHERE NOT (COALESCE(accessible_departments, ARRAY[]::UUID[]) @> ARRAY[v_dept_id])
      AND role IN ('admin', 'manager');

    -- Backfill into employee_department_access junction table if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'employee_department_access'
    ) THEN
      INSERT INTO public.employee_department_access (employee_id, department_id, access_level)
      SELECT e.id, v_dept_id, 'operate'::public.department_access_level
      FROM public.employees e
      WHERE e.role IN ('admin', 'manager')
      ON CONFLICT (employee_id, department_id) DO NOTHING;
    END IF;
  END IF;
END $$;
