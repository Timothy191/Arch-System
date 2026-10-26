-- 197_align_delay_entries_rls_with_department_policies.sql
-- Reconcile remote drift on public.delay_entries.
--
-- The linked project carried `delay_entries_all_authenticated` (ALL, USING true)
-- and `delay_entries_select_all` (SELECT, USING true). Permissive policies are
-- OR-ed, so the department-scoped policies from 068 were ineffective and every
-- authenticated user could read and mutate all departments' delays.
--
-- This migration is idempotent: it drops both drifted policies and the 068 set
-- before recreating the department-scoped set, so it is a no-op on databases
-- where 068 already defined the intended policies.

DROP POLICY IF EXISTS "delay_entries_all_authenticated" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_select_all" ON public.delay_entries;

DROP POLICY IF EXISTS "delay_entries_select_department" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_insert_operator" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_update_draft" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_delete_draft" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_soft_delete" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_commit_supervisor" ON public.delay_entries;
DROP POLICY IF EXISTS "delay_entries_uncommit_supervisor" ON public.delay_entries;

-- AGENT-TRACE: Exclude soft-deleted records from SELECT
CREATE POLICY "delay_entries_select_department"
  ON public.delay_entries FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.departments d ON mo.department_id = d.id
      JOIN public.employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.department_id = mo.department_id
          OR mo.department_id = ANY(e.accessible_departments)
        )
    )
  );

CREATE POLICY "delay_entries_insert_operator"
  ON public.delay_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
          OR (
            e.department_id = mo.department_id
            AND e.role IN ('operator', 'supervisor')
          )
        )
    )
    AND status = 'draft'
    AND deleted_at IS NULL
  );

CREATE POLICY "delay_entries_update_draft"
  ON public.delay_entries FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
          OR (
            e.department_id = mo.department_id
            AND e.role = 'operator'
          )
        )
    )
    AND status = 'draft'
  )
  WITH CHECK (
    status = 'draft'
  );

CREATE POLICY "delay_entries_delete_draft"
  ON public.delay_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
          OR (
            e.department_id = mo.department_id
            AND e.role = 'operator'
          )
        )
    )
    AND status = 'draft'
  );

-- AGENT-TRACE: Policy for soft delete operations (supervisors and admins)
CREATE POLICY "delay_entries_soft_delete"
  ON public.delay_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.role = 'supervisor')
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = (SELECT id FROM public.employees WHERE auth_id = auth.uid())
  );

-- Special policy for commit/uncommit operations (supervisors only)
CREATE POLICY "delay_entries_commit_supervisor"
  ON public.delay_entries FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
        )
    )
    AND status = 'draft'
  )
  WITH CHECK (
    status = 'committed'
    AND committed_by = (SELECT id FROM public.employees WHERE auth_id = auth.uid())
  );

CREATE POLICY "delay_entries_uncommit_supervisor"
  ON public.delay_entries FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
        )
    )
    AND status = 'committed'
  )
  WITH CHECK (
    status = 'draft'
    AND uncommitted_by = (SELECT id FROM public.employees WHERE auth_id = auth.uid())
    AND uncommit_reason IS NOT NULL
  );
