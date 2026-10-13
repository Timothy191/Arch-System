-- Migration: 181_employee_department_access.sql
-- Description: Replace accessible_departments UUID[] with typed, auditable junction table and RLS helpers

-- 1. Create department_access_level enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_access_level') THEN
    CREATE TYPE public.department_access_level AS ENUM ('read', 'operate', 'supervise', 'manage');
  END IF;
END $$;

-- 2. Create employee_department_access junction table
CREATE TABLE IF NOT EXISTS public.employee_department_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  access_level public.department_access_level NOT NULL DEFAULT 'operate',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES public.employees(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_department_access UNIQUE (employee_id, department_id)
);

-- 3. Indexes for high-frequency RLS evaluations
CREATE INDEX IF NOT EXISTS idx_emp_dept_access_lookup
  ON public.employee_department_access(employee_id, department_id);

CREATE INDEX IF NOT EXISTS idx_emp_dept_access_dept
  ON public.employee_department_access(department_id);

-- 4. Enable Row Level Security
ALTER TABLE public.employee_department_access ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employee_department_access' AND policyname = 'emp_dept_access_select'
  ) THEN
    CREATE POLICY "emp_dept_access_select"
      ON public.employee_department_access
      FOR SELECT TO authenticated
      USING (
        employee_id IN (SELECT id FROM public.employees WHERE auth_id = (SELECT auth.uid()))
        OR (SELECT public.is_admin())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employee_department_access' AND policyname = 'emp_dept_access_admin_write'
  ) THEN
    CREATE POLICY "emp_dept_access_admin_write"
      ON public.employee_department_access
      FOR ALL TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
END $$;

-- 5. Backfill from legacy employees.accessible_departments array
INSERT INTO public.employee_department_access (employee_id, department_id, access_level)
SELECT e.id, unnest(e.accessible_departments), 'operate'::public.department_access_level
FROM public.employees e
WHERE e.accessible_departments IS NOT NULL AND array_length(e.accessible_departments, 1) > 0
ON CONFLICT (employee_id, department_id) DO NOTHING;

-- 6. Helper functions with locked search_path for safe, performant RLS queries

-- 6A. Current employee id
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE auth_id = (SELECT auth.uid()) LIMIT 1;
$$;

-- 6B. Check department access level
CREATE OR REPLACE FUNCTION public.can_access_department(
  p_department_id UUID,
  p_level public.department_access_level DEFAULT 'read'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_role TEXT;
  v_home_dept UUID;
  v_access_level public.department_access_level;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role, department_id INTO v_role, v_home_dept
  FROM public.employees
  WHERE auth_id = v_auth_id
  LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_home_dept = p_department_id THEN
    RETURN TRUE;
  END IF;

  SELECT access_level INTO v_access_level
  FROM public.employee_department_access
  WHERE employee_id = (SELECT id FROM public.employees WHERE auth_id = v_auth_id LIMIT 1)
    AND department_id = p_department_id
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_access_level IS NOT NULL THEN
    IF p_level = 'read' THEN 
      RETURN TRUE; 
    END IF;
    IF p_level = 'operate' AND v_access_level IN ('operate', 'supervise', 'manage') THEN 
      RETURN TRUE; 
    END IF;
    IF p_level = 'supervise' AND v_access_level IN ('supervise', 'manage') THEN 
      RETURN TRUE; 
    END IF;
    IF p_level = 'manage' AND v_access_level = 'manage' THEN 
      RETURN TRUE; 
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- 6C. Check permission string
CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role
  FROM public.employees
  WHERE auth_id = v_auth_id
  LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF p_permission = 'can_approve_closeout' THEN
    RETURN v_role IN ('supervisor', 'admin');
  END IF;

  IF p_permission = 'can_scan_badge' THEN
    RETURN v_role IN ('operator', 'supervisor', 'admin', 'access_control');
  END IF;

  IF p_permission = 'can_view_scada' THEN
    RETURN v_role IN ('operator', 'supervisor', 'admin');
  END IF;

  RETURN FALSE;
END;
$$;
