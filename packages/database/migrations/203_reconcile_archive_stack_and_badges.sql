-- Migration: 203_reconcile_archive_stack_and_badges.sql
-- Description: Reconcile archive stack for delay_entries and harden badges and dispatch RPC:
--              1. Deduplicate permissive SELECT policies on public.badges and revoke anon.
--              2. Reconcile archive_monthly_control_room_shifts to archive delay_entries instead of dropped operational_delays,
--                 and explicitly cast ss.shift_type::text to match table column types.
--              3. Explicitly grant execute on atomic_machine_operator_dispatch to service_role.
--
-- Rollback:
-- GRANT ALL ON public.badges TO anon;

-- 1. Ensure badges schema columns exist, deduplicate SELECT policies on public.badges, and revoke anon
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS personnel_id uuid;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS visitor_id uuid;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS fleet_id uuid;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS equipment_id uuid;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS rfid_code text;

DROP POLICY IF EXISTS "Allow department members read badges" ON public.badges;
DROP POLICY IF EXISTS "Allow access control read badges" ON public.badges;
DROP POLICY IF EXISTS "badges_select" ON public.badges;

CREATE POLICY "badges_select" ON public.badges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND (
          e.role = 'admin'
          OR e.role = 'access_control'
          OR e.department_id = badges.department_id
          OR (
            badges.personnel_id IS NOT NULL AND
            e.department_id = (SELECT p.department_id FROM public.personnel p WHERE p.id = badges.personnel_id)
          )
        )
    )
  );

REVOKE ALL ON public.badges FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated, service_role;

-- 2. Reconcile archive_monthly_control_room_shifts to use delay_entries
CREATE OR REPLACE FUNCTION public.archive_monthly_control_room_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  -- machine_operations + cascade related delay_entries
  WITH moved_ops AS (
    DELETE FROM public.machine_operations mo
    WHERE mo.shift_date < cutoff
      AND EXISTS (
        SELECT 1 FROM public.shift_status ss
        WHERE ss.department_id = mo.department_id
          AND ss.shift_date     = mo.shift_date
          AND ss.shift_type::text = mo.shift_type
          AND ss.status         = 'closed'
      )
    RETURNING *
  ),
  inserted_ops AS (
    INSERT INTO public.machine_operations_archive SELECT * FROM moved_ops
    RETURNING id
  ),
  moved_delays AS (
    DELETE FROM public.delay_entries de
    WHERE de.machine_operation_id IN (SELECT id FROM inserted_ops)
    RETURNING *
  )
  INSERT INTO public.delay_entries_archive SELECT * FROM moved_delays;

  -- excavator_activity + cascade its dumper_assignments
  WITH moved_activity AS (
    DELETE FROM public.excavator_activity ea
    WHERE ea.activity_date < cutoff
      AND EXISTS (
        SELECT 1 FROM public.shift_status ss
        WHERE ss.department_id = ea.department_id
          AND ss.shift_date     = ea.activity_date
          AND ss.shift_type::text = ea.shift_type
          AND ss.status         = 'closed'
      )
    RETURNING *
  ),
  inserted_activity AS (
    INSERT INTO public.excavator_activity_archive SELECT * FROM moved_activity
    RETURNING id
  ),
  moved_assignments AS (
    DELETE FROM public.excavator_dumper_assignments eda
    WHERE eda.excavator_activity_id IN (SELECT id FROM inserted_activity)
    RETURNING *
  )
  INSERT INTO public.excavator_dumper_assignments_archive SELECT * FROM moved_assignments;

  -- dozer_rolls
  WITH moved AS (
    DELETE FROM public.dozer_rolls dr
    WHERE dr.roll_date < cutoff
      AND EXISTS (
        SELECT 1 FROM public.shift_status ss
        WHERE ss.department_id = dr.department_id
          AND ss.shift_date     = dr.roll_date
          AND ss.shift_type::text = dr.shift_type
          AND ss.status         = 'closed'
      )
    RETURNING *
  )
  INSERT INTO public.dozer_rolls_archive SELECT * FROM moved;

  -- engineering_notes
  WITH moved AS (
    DELETE FROM public.engineering_notes en
    WHERE en.note_date < cutoff
      AND EXISTS (
        SELECT 1 FROM public.shift_status ss
        WHERE ss.department_id = en.department_id
          AND ss.shift_date     = en.note_date
          AND ss.shift_type::text = en.shift_type
          AND ss.status         = 'closed'
      )
    RETURNING *
  )
  INSERT INTO public.engineering_notes_archive SELECT * FROM moved;

  RAISE NOTICE 'archive_monthly_control_room_shifts: completed for cutoff %', cutoff;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_monthly_control_room_shifts() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_monthly_control_room_shifts() TO authenticated, service_role;

-- 3. Explicitly grant execute on atomic_machine_operator_dispatch to service_role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'atomic_machine_operator_dispatch'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.atomic_machine_operator_dispatch(
      UUID, UUID, UUID, UUID, DATE, TEXT, TIME, UUID
    ) TO service_role;
  END IF;
END $$;

