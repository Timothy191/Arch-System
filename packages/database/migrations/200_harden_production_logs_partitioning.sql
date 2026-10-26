-- Migration: 200_harden_production_logs_partitioning.sql
-- Description: P0 hardening for production_logs partitioned table:
--              1. Deduplicate permissive RLS policies on public.production_logs.
--              2. Revoke all privileges from anon and PUBLIC on parent and all partitions dynamically.
--              3. Explicitly grant SELECT, INSERT, UPDATE, DELETE to authenticated and service_role.
--              4. Ensure Row Level Security is enabled across all partitions.
--
-- Rollback:
-- DROP POLICY IF EXISTS "production_logs_select" ON public.production_logs;
-- DROP POLICY IF EXISTS "production_logs_insert" ON public.production_logs;
-- DROP POLICY IF EXISTS "production_logs_update" ON public.production_logs;
-- DROP POLICY IF EXISTS "production_logs_delete" ON public.production_logs;
-- GRANT ALL ON public.production_logs TO anon;

-- 1. Deduplicate RLS policies on parent partitioned table
DROP POLICY IF EXISTS "production_logs_select_access" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_select_department" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_select" ON public.production_logs;

CREATE POLICY "production_logs_select" ON public.production_logs
  FOR SELECT TO authenticated
  USING (
    has_department_access((
      SELECT dl.department_id
      FROM public.daily_logs dl
      WHERE dl.id = production_logs.daily_log_id
    ))
  );

DROP POLICY IF EXISTS "production_logs_insert_access" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_insert_department" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_insert" ON public.production_logs;

CREATE POLICY "production_logs_insert" ON public.production_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_department_access((
      SELECT dl.department_id
      FROM public.daily_logs dl
      WHERE dl.id = production_logs.daily_log_id
    ))
  );

DROP POLICY IF EXISTS "production_logs_update_admin" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_update_department" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_update" ON public.production_logs;

CREATE POLICY "production_logs_update" ON public.production_logs
  FOR UPDATE TO authenticated
  USING (
    has_department_access((
      SELECT dl.department_id
      FROM public.daily_logs dl
      WHERE dl.id = production_logs.daily_log_id
    )) OR (SELECT public.is_admin())
  )
  WITH CHECK (
    has_department_access((
      SELECT dl.department_id
      FROM public.daily_logs dl
      WHERE dl.id = production_logs.daily_log_id
    )) OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "production_logs_delete_admin" ON public.production_logs;
DROP POLICY IF EXISTS "production_logs_delete" ON public.production_logs;

CREATE POLICY "production_logs_delete" ON public.production_logs
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 2. Revoke anon/PUBLIC and grant authenticated/service_role on parent table
REVOKE ALL ON public.production_logs FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_logs TO authenticated, service_role;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

-- 3. Dynamic partition iteration: iterate pg_inherits to enforce ACL and RLS
DO $$
DECLARE
  part_record RECORD;
BEGIN
  FOR part_record IN
    SELECT inhrelid::regclass AS partition_name
    FROM pg_inherits
    WHERE inhparent = 'public.production_logs'::regclass
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon, PUBLIC', part_record.partition_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated, service_role', part_record.partition_name);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part_record.partition_name);
  END LOOP;
END $$;

