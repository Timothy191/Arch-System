-- ============================================================================
-- Migration 236: Harden fleet, equipment, and legacy RLS InitPlan policies
-- ============================================================================
-- Forward-only security & performance hardening:
--   1. Reconciles public.fleet and public.equipment RLS policies:
--      - Adds missing USING clauses on UPDATE policies
--      - Replaces unwrapped auth.uid() & direct employees scans with
--        InitPlan-safe (SELECT public.is_admin()), (SELECT public.is_access_control()),
--        public.has_department_access(), and public.can_access_department(..., 'operate')
--      - Revokes anon/PUBLIC privileges and grants to authenticated, service_role
--   2. Wraps legacy unwrapped auth.uid() calls in (SELECT auth.uid()) on
--      public.roles, public.cache_events, public.cache_anomalies,
--      public.shift_completeness_alerts, public.data_integrity_issues, and
--      public.shift_integrity_reports when present.
-- ============================================================================

-- 1. public.fleet RLS hardening (InitPlan + UPDATE USING clause)
ALTER TABLE public.fleet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access control read fleet" ON public.fleet;
CREATE POLICY "Allow access control read fleet" ON public.fleet
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "Allow access control insert fleet" ON public.fleet;
CREATE POLICY "Allow access control insert fleet" ON public.fleet
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control update fleet" ON public.fleet;
CREATE POLICY "Allow access control update fleet" ON public.fleet
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control delete fleet" ON public.fleet;
CREATE POLICY "Allow access control delete fleet" ON public.fleet
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
  );

REVOKE ALL ON public.fleet FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet TO authenticated, service_role;

-- 2. public.equipment RLS hardening (InitPlan + UPDATE USING clause)
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access control read equipment" ON public.equipment;
CREATE POLICY "Allow access control read equipment" ON public.equipment
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "Allow access control insert equipment" ON public.equipment;
CREATE POLICY "Allow access control insert equipment" ON public.equipment
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control update equipment" ON public.equipment;
CREATE POLICY "Allow access control update equipment" ON public.equipment
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control delete equipment" ON public.equipment;
CREATE POLICY "Allow access control delete equipment" ON public.equipment
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
  );

REVOKE ALL ON public.equipment FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated, service_role;

-- 3. Wrap legacy unwrapped auth.uid() policies with (SELECT auth.uid())
DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "roles_admin_all" ON public.roles;
    CREATE POLICY "roles_admin_all" ON public.roles
      FOR ALL TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;

  IF to_regclass('public.cache_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "cache_events_select_admin" ON public.cache_events;
    CREATE POLICY "cache_events_select_admin" ON public.cache_events
      FOR SELECT TO authenticated
      USING ((SELECT public.is_admin()));

    DROP POLICY IF EXISTS "cache_events_modify_admin" ON public.cache_events;
    CREATE POLICY "cache_events_modify_admin" ON public.cache_events
      FOR ALL TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;

  IF to_regclass('public.cache_anomalies') IS NOT NULL THEN
    DROP POLICY IF EXISTS "cache_anomalies_select_admin" ON public.cache_anomalies;
    CREATE POLICY "cache_anomalies_select_admin" ON public.cache_anomalies
      FOR SELECT TO authenticated
      USING ((SELECT public.is_admin()));

    DROP POLICY IF EXISTS "cache_anomalies_modify_admin" ON public.cache_anomalies;
    CREATE POLICY "cache_anomalies_modify_admin" ON public.cache_anomalies
      FOR ALL TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;

  IF to_regclass('public.shift_completeness_alerts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read shift_completeness_alerts" ON public.shift_completeness_alerts;
    CREATE POLICY "Admins can read shift_completeness_alerts" ON public.shift_completeness_alerts
      FOR SELECT TO authenticated
      USING ((SELECT public.is_admin()));

    DROP POLICY IF EXISTS "Admins can resolve shift_completeness_alerts" ON public.shift_completeness_alerts;
    CREATE POLICY "Admins can resolve shift_completeness_alerts" ON public.shift_completeness_alerts
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));

    DROP POLICY IF EXISTS "Department members can read their shift_completeness_alerts" ON public.shift_completeness_alerts;
    CREATE POLICY "Department members can read their shift_completeness_alerts" ON public.shift_completeness_alerts
      FOR SELECT TO authenticated
      USING (
        (SELECT public.is_admin())
        OR (department_id IS NOT NULL AND public.has_department_access(department_id))
      );
  END IF;

  IF to_regclass('public.data_integrity_issues') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read data_integrity_issues" ON public.data_integrity_issues;
    CREATE POLICY "Admins can read data_integrity_issues" ON public.data_integrity_issues
      FOR SELECT TO authenticated
      USING ((SELECT public.is_admin()));

    DROP POLICY IF EXISTS "Admins can resolve data_integrity_issues" ON public.data_integrity_issues;
    CREATE POLICY "Admins can resolve data_integrity_issues" ON public.data_integrity_issues
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;

  IF to_regclass('public.shift_integrity_reports') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read shift_integrity_reports" ON public.shift_integrity_reports;
    CREATE POLICY "Admins can read shift_integrity_reports" ON public.shift_integrity_reports
      FOR SELECT TO authenticated
      USING ((SELECT public.is_admin()));
  END IF;
END $$;
