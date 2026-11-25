-- ============================================================================
-- Migration: 231_control_room_rls_breakdowns_trigger_and_hygiene.sql
-- Description:
--   1. Allow all authenticated active employees to read shared fleet machines
--      (while keeping writes admin/department-scoped) so Control Room users
--      without primary Production department assignment see fleet machinery.
--   2. Fix public.compute_breakdown_shift_delay() crash caused by calling
--      trim(time without time zone) on breakdowns.time_in.
--   3. Update public.delay_entries RLS to use public.has_department_access(),
--      include the 'control_room_operator' role, check deleted_at IS NULL, and
--      wrap auth.uid() calls in (SELECT auth.uid()) InitPlan subselects.
--   4. Consolidate overlapping/broken RLS policies on public.breakdowns,
--      public.shift_status, public.material_density, and public.operators.
--   5. Drop 4 exact duplicate redundant indexes in public schema.
-- ============================================================================

-- ============================================================================
-- 1. public.machines — Shared Active Fleet Read Access
-- ============================================================================
DROP POLICY IF EXISTS "machines_select_department_active" ON public.machines;
CREATE POLICY "machines_select_department_active" ON public.machines
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 2. public.compute_breakdown_shift_delay() — Fix time_in btrim() crash
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_breakdown_shift_delay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_hour INT;
  v_diff_hours NUMERIC(5, 2);
BEGIN
  IF NEW.time_in IS NOT NULL THEN
    v_hour := EXTRACT(HOUR FROM NEW.time_in)::INT;
    IF v_hour >= 6 AND v_hour < 18 THEN
      NEW.shift_type := COALESCE(NEW.shift_type, 'day');
    ELSE
      NEW.shift_type := COALESCE(NEW.shift_type, 'night');
    END IF;
  END IF;

  IF (NEW.delay_hours IS NULL OR NEW.delay_hours = 0)
     AND NEW.date_in IS NOT NULL AND NEW.time_in IS NOT NULL
     AND NEW.date_out IS NOT NULL AND NEW.time_out IS NOT NULL THEN
    BEGIN
      v_diff_hours := EXTRACT(
        EPOCH FROM ((NEW.date_out + NEW.time_out) - (NEW.date_in + NEW.time_in))
      ) / 3600.0;
      IF v_diff_hours > 0 THEN
        NEW.delay_hours := LEAST(12.0, ROUND(v_diff_hours, 2));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Preserve existing delay_hours on timestamp arithmetic overflow/invalid input
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. public.delay_entries — Cross-Dept Access, control_room_operator & InitPlan
-- ============================================================================
DROP POLICY IF EXISTS "delay_entries_select_department" ON public.delay_entries;
CREATE POLICY "delay_entries_select_department" ON public.delay_entries
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          (SELECT public.is_admin())
          OR public.has_department_access(mo.department_id)
        )
    )
  );

DROP POLICY IF EXISTS "delay_entries_insert_operator" ON public.delay_entries;
CREATE POLICY "delay_entries_insert_operator" ON public.delay_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'draft'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e
        ON e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR (
            public.has_department_access(mo.department_id)
            AND e.role IN ('supervisor', 'operator', 'control_room_operator')
          )
        )
    )
  );

DROP POLICY IF EXISTS "delay_entries_update_draft" ON public.delay_entries;
CREATE POLICY "delay_entries_update_draft" ON public.delay_entries
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'draft'
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e
        ON e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR (
            public.has_department_access(mo.department_id)
            AND e.role IN ('supervisor', 'operator', 'control_room_operator')
          )
        )
    )
  )
  WITH CHECK (status = 'draft');

DROP POLICY IF EXISTS "delay_entries_delete_draft" ON public.delay_entries;
CREATE POLICY "delay_entries_delete_draft" ON public.delay_entries
  FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e
        ON e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR (
            public.has_department_access(mo.department_id)
            AND e.role IN ('supervisor', 'operator', 'control_room_operator')
          )
        )
    )
  );

DROP POLICY IF EXISTS "delay_entries_commit_supervisor" ON public.delay_entries;
CREATE POLICY "delay_entries_commit_supervisor" ON public.delay_entries
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'draft'
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e
        ON e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      WHERE mo.id = delay_entries.machine_operation_id
        AND e.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    status = 'committed'
    AND committed_by = (
      SELECT e.id
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "delay_entries_uncommit_supervisor" ON public.delay_entries;
CREATE POLICY "delay_entries_uncommit_supervisor" ON public.delay_entries
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'committed'
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e
        ON e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      WHERE mo.id = delay_entries.machine_operation_id
        AND e.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    status = 'draft'
    AND uncommitted_by = (
      SELECT e.id
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      LIMIT 1
    )
    AND uncommit_reason IS NOT NULL
  );

DROP POLICY IF EXISTS "delay_entries_soft_delete" ON public.delay_entries;
CREATE POLICY "delay_entries_soft_delete" ON public.delay_entries
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'supervisor')
        AND e.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = (
      SELECT e.id
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      LIMIT 1
    )
  );

-- ============================================================================
-- 4. Consolidate Duplicate & Over-Permissive RLS Policies
-- ============================================================================

-- 4a. public.breakdowns (drop 8 overlapping policies -> 4 clean InitPlan policies)
DROP POLICY IF EXISTS "breakdowns_select_department" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_select_engineering" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_insert_department" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_insert_engineering_only" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_update_department" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_update_engineering_only" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_delete_admin" ON public.breakdowns;
DROP POLICY IF EXISTS "breakdowns_delete_engineering_admin" ON public.breakdowns;

CREATE POLICY "breakdowns_select_access" ON public.breakdowns
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR public.has_department_access(department_id)
    OR (
      shared_with_departments ? 'control-room'
      AND public.has_department_access('0f160914-d92e-45d9-9547-d3d1a11ef6a1'::uuid)
    )
    OR (
      department_id = '1046533d-55a4-4dbd-a174-e57717d18812'::uuid
      AND public.has_department_access('0f160914-d92e-45d9-9547-d3d1a11ef6a1'::uuid)
    )
  );

CREATE POLICY "breakdowns_insert_access" ON public.breakdowns
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR public.has_department_access(department_id)
  );

CREATE POLICY "breakdowns_update_access" ON public.breakdowns
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR public.has_department_access(department_id)
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR public.has_department_access(department_id)
  );

CREATE POLICY "breakdowns_delete_admin_supervisor" ON public.breakdowns
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (
      public.has_department_access(department_id)
      AND EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.auth_id = (SELECT auth.uid())
          AND e.role = 'supervisor'
          AND e.deleted_at IS NULL
      )
    )
  );

-- 4b. public.shift_status (close permissive manage_all / select_all bypasses)
DROP POLICY IF EXISTS "shift_status_manage_all" ON public.shift_status;
DROP POLICY IF EXISTS "shift_status_select_all" ON public.shift_status;
DROP POLICY IF EXISTS "shift_status_update_access" ON public.shift_status;

CREATE POLICY "shift_status_update_access" ON public.shift_status
  FOR UPDATE TO authenticated
  USING (public.has_department_access(department_id))
  WITH CHECK (public.has_department_access(department_id));

-- 4c. public.material_density (drop 6 overlapping/broken policies -> 2 clean policies)
DROP POLICY IF EXISTS "material_density_read_all" ON public.material_density;
DROP POLICY IF EXISTS "material_density_select_all" ON public.material_density;
DROP POLICY IF EXISTS "material_density_write_admin" ON public.material_density;
DROP POLICY IF EXISTS "material_density_insert_admin" ON public.material_density;
DROP POLICY IF EXISTS "material_density_update_admin" ON public.material_density;
DROP POLICY IF EXISTS "material_density_delete_admin" ON public.material_density;

CREATE POLICY "material_density_select_authenticated" ON public.material_density
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
    )
  );

CREATE POLICY "material_density_manage_admin" ON public.material_density
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 4d. public.operators (drop shadowed select_all and wrap delete_admin in InitPlan)
DROP POLICY IF EXISTS "operators_select_all" ON public.operators;
DROP POLICY IF EXISTS "operators_delete_admin" ON public.operators;

CREATE POLICY "operators_delete_admin" ON public.operators
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- ============================================================================
-- 5. Drop Exact Duplicate Redundant Indexes in public schema
-- ============================================================================
-- squawk-ignore require-concurrent-index-deletion
DROP INDEX IF EXISTS public.idx_departments_name;
-- squawk-ignore require-concurrent-index-deletion
DROP INDEX IF EXISTS public.idx_emp_dept_access_lookup;
-- squawk-ignore require-concurrent-index-deletion
DROP INDEX IF EXISTS public.idx_fleet_code;
-- squawk-ignore require-concurrent-index-deletion
DROP INDEX IF EXISTS public.idx_equipment_code;
