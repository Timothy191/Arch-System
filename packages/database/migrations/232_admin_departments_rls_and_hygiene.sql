-- ============================================================================
-- Migration: 232_admin_departments_rls_and_hygiene.sql
-- Description:
--   1. Ensure Row-Level Security is enabled on public.departments and grant
--      authenticated table privileges (INSERT, UPDATE, DELETE) so admin server
--      actions (adminAddDepartment, adminArchiveDepartment) execute under live
--      RLS without privilege errors.
--   2. Add PostgreSQL 17 InitPlan-wrapped ((SELECT auth.uid())) RLS policies
--      for INSERT, UPDATE, and DELETE on public.departments restricted strictly
--      to active admin employees (role = 'admin' AND deleted_at IS NULL).
--   3. Refine departments SELECT policy so active admins can also inspect
--      archived rows when managing department records while preserving active
--      department visibility for authenticated users.
-- ============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;

DROP POLICY IF EXISTS "departments_select_active" ON public.departments;
CREATE POLICY "departments_select_active" ON public.departments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role = 'admin'
        AND e.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "departments_insert_admin" ON public.departments;
CREATE POLICY "departments_insert_admin" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role = 'admin'
        AND e.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "departments_update_admin" ON public.departments;
CREATE POLICY "departments_update_admin" ON public.departments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role = 'admin'
        AND e.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role = 'admin'
        AND e.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "departments_delete_admin" ON public.departments;
CREATE POLICY "departments_delete_admin" ON public.departments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role = 'admin'
        AND e.deleted_at IS NULL
    )
  );
