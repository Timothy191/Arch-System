-- Migration: 202_harden_daily_logs_and_machine_configurations.sql
-- Description: Harden daily_logs partitioned table and machine_configurations table:
--              1. Deduplicate permissive RLS policies on public.daily_logs.
--              2. Revoke all privileges from anon and PUBLIC on daily_logs parent and dynamically across all partitions.
--              3. Grant SELECT, INSERT, UPDATE, DELETE on daily_logs and partitions to authenticated, service_role.
--              4. Ensure Row Level Security is enabled across all daily_logs partitions.
--              5. Revoke all privileges from anon and PUBLIC on machine_configurations.
--              6. Grant SELECT, INSERT, UPDATE, DELETE on machine_configurations to authenticated, service_role.
--
-- Rollback:
-- GRANT ALL ON public.daily_logs TO anon;
-- GRANT ALL ON public.machine_configurations TO anon;

-- 1. Deduplicate RLS policies on parent partitioned daily_logs table
DROP POLICY IF EXISTS "daily_logs_select_access" ON public.daily_logs;
DROP POLICY IF EXISTS "daily_logs_select_department" ON public.daily_logs;
DROP POLICY IF EXISTS "daily_logs_select" ON public.daily_logs;

CREATE POLICY "daily_logs_select" ON public.daily_logs
  FOR SELECT TO authenticated
  USING (
    has_department_access(department_id) OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "daily_logs_insert_access" ON public.daily_logs;
DROP POLICY IF EXISTS "daily_logs_insert_department" ON public.daily_logs;
DROP POLICY IF EXISTS "daily_logs_insert" ON public.daily_logs;

CREATE POLICY "daily_logs_insert" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_department_access(department_id) OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "daily_logs_update_access" ON public.daily_logs;
DROP POLICY IF EXISTS "daily_logs_update_creator_or_admin" ON public.daily_logs;
DROP POLICY IF EXISTS "daily_logs_update" ON public.daily_logs;

CREATE POLICY "daily_logs_update" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING (
    has_department_access(department_id)
    OR (SELECT public.is_admin())
    OR updated_by = (SELECT auth.uid())
  )
  WITH CHECK (
    has_department_access(department_id)
    OR (SELECT public.is_admin())
    OR updated_by = (SELECT auth.uid())
  );

-- 2. Revoke anon/PUBLIC and grant authenticated/service_role on parent daily_logs table
REVOKE ALL ON public.daily_logs FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated, service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- 3. Dynamic partition iteration: iterate pg_inherits for daily_logs
DO $$
DECLARE
  part_record RECORD;
BEGIN
  FOR part_record IN
    SELECT inhrelid::regclass AS partition_name
    FROM pg_inherits
    WHERE inhparent = 'public.daily_logs'::regclass
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon, PUBLIC', part_record.partition_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated, service_role', part_record.partition_name);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part_record.partition_name);
  END LOOP;
END $$;

-- 4. Ensure machine_configurations table exists and harden privileges
CREATE TABLE IF NOT EXISTS public.machine_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  target_rpm BIGINT NOT NULL CHECK (target_rpm >= 0 AND target_rpm <= 5000),
  power_allocation BIGINT NOT NULL CHECK (power_allocation >= 0 AND power_allocation <= 100),
  hydraulic_pressure BIGINT NOT NULL CHECK (hydraulic_pressure >= 0 AND hydraulic_pressure <= 1000),
  created_by UUID REFERENCES public.employees(id),
  updated_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id)
);

ALTER TABLE public.machine_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machine_configurations_select_access" ON public.machine_configurations;
CREATE POLICY "machine_configurations_select_access"
  ON public.machine_configurations FOR SELECT
  TO authenticated
  USING (public.has_department_access(department_id) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "machine_configurations_insert_access" ON public.machine_configurations;
CREATE POLICY "machine_configurations_insert_access"
  ON public.machine_configurations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_department_access(department_id) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "machine_configurations_update_access" ON public.machine_configurations;
DROP POLICY IF EXISTS "machine_configurations_update_admin" ON public.machine_configurations;
CREATE POLICY "machine_configurations_update_admin"
  ON public.machine_configurations FOR UPDATE
  TO authenticated
  USING (public.has_department_access(department_id) OR (SELECT public.is_admin()))
  WITH CHECK (public.has_department_access(department_id) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "machine_configurations_delete_access" ON public.machine_configurations;
CREATE POLICY "machine_configurations_delete_access"
  ON public.machine_configurations FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON public.machine_configurations FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_configurations TO authenticated, service_role;

