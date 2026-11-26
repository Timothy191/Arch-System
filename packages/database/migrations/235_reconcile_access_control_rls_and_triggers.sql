-- ============================================================================
-- Migration: 235_reconcile_access_control_rls_and_triggers.sql
-- Purpose:
--   1. Fix operators_role_check mismatch in public.sync_personnel_to_operators()
--      so job titles map cleanly to ('operator', 'supervisor', 'trainer', 'relief').
--   2. Harden public.is_access_control() with (SELECT auth.uid()) InitPlan and
--      AND deleted_at IS NULL.
--   3. Restore & harden RLS policies on public.badges, public.visitors,
--      public.personnel, public.access_logs, public.access_logs_archive,
--      public.muster_events, public.card_printers, public.card_templates,
--      public.print_jobs, public.issued_cards, public.generated_reports, and
--      storage.objects ('personnel-photos', 'card-templates').
--   4. Create real public.perimeter_gates telemetry table (honest NULL
--      heartbeat_at until controller/C66 ping) with RLS.
--   5. Harden public.access_logs default alcohol_tested -> 'Not Tested',
--      reconcile access_logs_archive columns & SECURITY DEFINER archival RPC,
--      and add gate_location / muster session indexes.
--   6. Reconcile badges FKs, partial unique RFID index, visitors.name,
--      metrics RPC, 24h SAST hourly RPC, and report summary RPC.
--   7. Register Access Control tables in supabase_realtime and clean up
--      unreferenced synthetic CT-01..CT-03 fleet rows & stale department.
-- ============================================================================

-- ============================================================================
-- 1. Reconcile sync_personnel_to_operators() role mapping (GAP-P0-01)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_personnel_to_operators()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalized_title TEXT;
  v_operator_role TEXT;
BEGIN
  IF NEW.emp_code IS NOT NULL AND trim(NEW.emp_code) != '' THEN
    v_normalized_title := LOWER(COALESCE(NEW.job_title, ''));
    v_operator_role := CASE
      WHEN v_normalized_title LIKE '%supervisor%'
        OR v_normalized_title LIKE '%manager%'
        OR v_normalized_title LIKE '%superintendent%'
        OR v_normalized_title LIKE '%admin%' THEN 'supervisor'
      WHEN v_normalized_title LIKE '%trainer%' THEN 'trainer'
      WHEN v_normalized_title LIKE '%relief%' THEN 'relief'
      ELSE 'operator'
    END;

    INSERT INTO public.operators (
      full_name,
      employee_code,
      role,
      active,
      updated_at
    )
    VALUES (
      trim(NEW.first_name || ' ' || NEW.surname),
      trim(NEW.emp_code),
      v_operator_role,
      (LOWER(COALESCE(NEW.status, 'active')) = 'active'),
      NOW()
    )
    ON CONFLICT (employee_code) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      active = EXCLUDED.active,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Harden public.is_access_control() (GAP-P0-01 / GAP-P0-02)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_access_control()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_id = (SELECT auth.uid())
      AND role = 'access_control'
      AND deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_access_control() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_access_control() TO authenticated, service_role;

-- ============================================================================
-- 3. Restore & Harden Access Control RLS Policies (GAP-P0-01)
-- ============================================================================

-- 3a. public.personnel
DROP POLICY IF EXISTS "Allow access control read personnel" ON public.personnel;
DROP POLICY IF EXISTS "Allow admin read personnel" ON public.personnel;
DROP POLICY IF EXISTS "personnel_select_access_control" ON public.personnel;
CREATE POLICY "personnel_select_access_control" ON public.personnel
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "Allow access control insert personnel" ON public.personnel;
CREATE POLICY "Allow access control insert personnel" ON public.personnel
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control update personnel" ON public.personnel;
DROP POLICY IF EXISTS "personnel_update_admin" ON public.personnel;
CREATE POLICY "Allow access control update personnel" ON public.personnel
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

DROP POLICY IF EXISTS "personnel_delete_admin" ON public.personnel;
CREATE POLICY "personnel_delete_admin" ON public.personnel
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 3b. public.visitors
DROP POLICY IF EXISTS "Allow access control read visitors" ON public.visitors;
CREATE POLICY "Allow access control read visitors" ON public.visitors
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "Allow access control insert visitors" ON public.visitors;
CREATE POLICY "Allow access control insert visitors" ON public.visitors
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control update visitors" ON public.visitors;
DROP POLICY IF EXISTS "visitors_update_admin" ON public.visitors;
CREATE POLICY "Allow access control update visitors" ON public.visitors
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

DROP POLICY IF EXISTS "Allow access control delete visitors" ON public.visitors;
DROP POLICY IF EXISTS "visitors_delete_admin" ON public.visitors;
CREATE POLICY "visitors_delete_admin" ON public.visitors
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 3c. public.badges
DROP POLICY IF EXISTS "badges_select" ON public.badges;
CREATE POLICY "badges_select" ON public.badges
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
    OR (
      personnel_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.personnel p
        WHERE p.id = badges.personnel_id
          AND p.department_id IS NOT NULL
          AND public.has_department_access(p.department_id)
      )
    )
  );

DROP POLICY IF EXISTS "Allow access control insert badges" ON public.badges;
CREATE POLICY "Allow access control insert badges" ON public.badges
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow access control update badges" ON public.badges;
DROP POLICY IF EXISTS "badges_update_admin" ON public.badges;
CREATE POLICY "Allow access control update badges" ON public.badges
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

DROP POLICY IF EXISTS "Allow access control delete badges" ON public.badges;
DROP POLICY IF EXISTS "badges_delete_admin" ON public.badges;
CREATE POLICY "badges_delete_admin" ON public.badges
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 3d. public.access_logs & public.access_logs_archive
DROP POLICY IF EXISTS "Allow access control read access_logs" ON public.access_logs;
CREATE POLICY "Allow access control read access_logs" ON public.access_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "Allow access control insert logs" ON public.access_logs;
CREATE POLICY "Allow access control insert logs" ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "Allow admin delete access_logs" ON public.access_logs;
CREATE POLICY "Allow admin delete access_logs" ON public.access_logs
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "access_logs_archive_select" ON public.access_logs_archive;
CREATE POLICY "access_logs_archive_select" ON public.access_logs_archive
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "Allow admin delete access_logs_archive" ON public.access_logs_archive;
CREATE POLICY "Allow admin delete access_logs_archive" ON public.access_logs_archive
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 3e. public.muster_events schema + RLS (GAP-P0-04)
ALTER TABLE public.muster_events
  ADD COLUMN IF NOT EXISTS visitor_id UUID,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS department_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'muster_events_visitor_id_fkey'
      AND conrelid = 'public.muster_events'::regclass
  ) THEN
    ALTER TABLE public.muster_events
      ADD CONSTRAINT muster_events_visitor_id_fkey
      FOREIGN KEY (visitor_id) REFERENCES public.visitors(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'muster_events_department_id_fkey'
      AND conrelid = 'public.muster_events'::regclass
  ) THEN
    ALTER TABLE public.muster_events
      ADD CONSTRAINT muster_events_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

ALTER TABLE public.muster_events
  -- squawk-ignore ban-drop-constraint
  DROP CONSTRAINT IF EXISTS muster_events_status_check;

ALTER TABLE public.muster_events
  ADD CONSTRAINT muster_events_status_check
  CHECK (status IN ('accounted', 'unaccounted', 'missing', 'evacuated', 'medical')) NOT VALID;

DROP POLICY IF EXISTS "muster_events_select" ON public.muster_events;
CREATE POLICY "muster_events_select" ON public.muster_events
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "muster_events_insert" ON public.muster_events;
CREATE POLICY "muster_events_insert" ON public.muster_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "muster_events_update" ON public.muster_events;
CREATE POLICY "muster_events_update" ON public.muster_events
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

-- 3f. Card printing & storage RLS (soft-delete + InitPlan)
DROP POLICY IF EXISTS "Allow access control read card_printers" ON public.card_printers;
CREATE POLICY "Allow access control read card_printers" ON public.card_printers
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow access control insert card_printers" ON public.card_printers;
CREATE POLICY "Allow access control insert card_printers" ON public.card_printers
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow access control update card_printers" ON public.card_printers;
CREATE POLICY "Allow access control update card_printers" ON public.card_printers
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()))
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow admin delete card_printers" ON public.card_printers;
CREATE POLICY "Allow admin delete card_printers" ON public.card_printers
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Allow access control read card_templates" ON public.card_templates;
CREATE POLICY "Allow access control read card_templates" ON public.card_templates
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow admin insert card_templates" ON public.card_templates;
CREATE POLICY "Allow admin insert card_templates" ON public.card_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Allow admin update card_templates" ON public.card_templates;
CREATE POLICY "Allow admin update card_templates" ON public.card_templates
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Allow admin delete card_templates" ON public.card_templates;
CREATE POLICY "Allow admin delete card_templates" ON public.card_templates
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Allow access control read print_jobs" ON public.print_jobs;
CREATE POLICY "Allow access control read print_jobs" ON public.print_jobs
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow access control insert print_jobs" ON public.print_jobs;
CREATE POLICY "Allow access control insert print_jobs" ON public.print_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow access control update print_jobs" ON public.print_jobs;
CREATE POLICY "Allow access control update print_jobs" ON public.print_jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()))
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow admin delete print_jobs" ON public.print_jobs;
CREATE POLICY "Allow admin delete print_jobs" ON public.print_jobs
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Allow access control read issued_cards" ON public.issued_cards;
CREATE POLICY "Allow access control read issued_cards" ON public.issued_cards
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow access control insert issued_cards" ON public.issued_cards;
CREATE POLICY "Allow access control insert issued_cards" ON public.issued_cards
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow access control update issued_cards" ON public.issued_cards;
CREATE POLICY "Allow access control update issued_cards" ON public.issued_cards
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT public.is_access_control()))
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.is_access_control()));

DROP POLICY IF EXISTS "Allow admin delete issued_cards" ON public.issued_cards;
CREATE POLICY "Allow admin delete issued_cards" ON public.issued_cards
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 3g. Storage buckets RLS
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "personnel_photos_select" ON storage.objects;
    CREATE POLICY "personnel_photos_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'personnel-photos'
        AND ((SELECT public.is_admin()) OR (SELECT public.is_access_control()))
      );

    DROP POLICY IF EXISTS "personnel_photos_insert" ON storage.objects;
    CREATE POLICY "personnel_photos_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'personnel-photos'
        AND ((SELECT public.is_admin()) OR (SELECT public.is_access_control()))
      );

    DROP POLICY IF EXISTS "personnel_photos_update" ON storage.objects;
    CREATE POLICY "personnel_photos_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'personnel-photos' AND (SELECT public.is_admin()))
      WITH CHECK (bucket_id = 'personnel-photos' AND (SELECT public.is_admin()));

    DROP POLICY IF EXISTS "personnel_photos_delete" ON storage.objects;
    CREATE POLICY "personnel_photos_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'personnel-photos' AND (SELECT public.is_admin()));

    DROP POLICY IF EXISTS "Allow admin insert card-templates" ON storage.objects;
    CREATE POLICY "Allow admin insert card-templates" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'card-templates' AND (SELECT public.is_admin()));
  END IF;
END $$;

-- 3h. public.generated_reports INSERT policy (GAP-P0-01)
DROP POLICY IF EXISTS "generated_reports_insert_department" ON public.generated_reports;
CREATE POLICY "generated_reports_insert_department" ON public.generated_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

-- ============================================================================
-- 4. Real Perimeter Gates Telemetry Registry (GAP-P0-07)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.perimeter_gates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gate_location TEXT NOT NULL UNIQUE,
  zone TEXT NOT NULL,
  gate_type TEXT NOT NULL DEFAULT 'BOOM_BARRIER'
    CHECK (gate_type IN ('BOOM_BARRIER', 'TURNSTILE_ARRAY', 'WEIGHBRIDGE_BOOM', 'HIGH_SEC_PORTAL')),
  interlock_active BOOLEAN NOT NULL DEFAULT false,
  is_maintenance BOOLEAN NOT NULL DEFAULT false,
  last_heartbeat_at TIMESTAMPTZ,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perimeter_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perimeter_gates_select" ON public.perimeter_gates;
CREATE POLICY "perimeter_gates_select" ON public.perimeter_gates
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "perimeter_gates_insert" ON public.perimeter_gates;
CREATE POLICY "perimeter_gates_insert" ON public.perimeter_gates
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_access_control())
    OR (department_id IS NOT NULL AND public.can_access_department(department_id, 'operate'))
  );

DROP POLICY IF EXISTS "perimeter_gates_update" ON public.perimeter_gates;
CREATE POLICY "perimeter_gates_update" ON public.perimeter_gates
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

REVOKE ALL ON public.perimeter_gates FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.perimeter_gates TO authenticated, service_role;

INSERT INTO public.perimeter_gates (id, name, gate_location, zone, gate_type, interlock_active, last_heartbeat_at, department_id)
SELECT
  g.id,
  g.name,
  g.gate_location,
  g.zone,
  g.gate_type,
  false,
  NULL,
  (SELECT id FROM public.departments WHERE name = 'access-control' LIMIT 1)
FROM (
  VALUES
    ('GATE-01-NORTH', 'Main North Inbound Boom Barrier', 'Main Gate', 'ZONE-01 (Primary Perimeter)', 'BOOM_BARRIER'),
    ('GATE-02-SOUTH', 'South Hauling Road Gate', 'South Gate', 'ZONE-02 (Haul Road)', 'BOOM_BARRIER'),
    ('TURN-01-04-PIT', 'Turnstile Array (Pit Entry)', 'North Entrance', 'ZONE-03 (Underground / Pit Access)', 'TURNSTILE_ARRAY'),
    ('WEIGH-03-ROM', 'Weighbridge 03 Heavy Access', 'Weighbridge Gate', 'ZONE-04 (Processing & ROM)', 'WEIGHBRIDGE_BOOM'),
    ('VAULT-05-MAG', 'Explosive Magazine & High-Sec Vault', 'Magazine Gate', 'ZONE-05 (Restricted Security)', 'HIGH_SEC_PORTAL')
) AS g(id, name, gate_location, zone, gate_type)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Fix access_logs default, archive columns & archival RPC (GAP-P0-05 / GAP-P1-01)
-- ============================================================================
ALTER TABLE public.access_logs
  ALTER COLUMN alcohol_tested SET DEFAULT 'Not Tested';

ALTER TABLE public.access_logs_archive
  ADD COLUMN IF NOT EXISTS operator TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE OR REPLACE FUNCTION public.archive_weekly_access_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_week_boundary TIMESTAMPTZ;
  v_week_start DATE;
BEGIN
  v_week_boundary := date_trunc('week', CURRENT_DATE - interval '7 days');
  v_week_start := v_week_boundary::date;

  WITH moved_rows AS (
    DELETE FROM public.access_logs
    WHERE scanned_at < v_week_boundary
    RETURNING
      id,
      badge_id,
      access_type,
      direction,
      gate_location,
      access_granted,
      denial_reason,
      scanned_at,
      department_id,
      alcohol_tested,
      operator,
      device_id
  )
  INSERT INTO public.access_logs_archive (
    id,
    badge_id,
    access_type,
    direction,
    gate_location,
    access_granted,
    denial_reason,
    scanned_at,
    department_id,
    alcohol_tested,
    operator,
    device_id,
    archived_week_start
  )
  SELECT
    id,
    badge_id,
    access_type,
    direction,
    gate_location,
    access_granted,
    denial_reason,
    scanned_at,
    department_id,
    alcohol_tested,
    operator,
    device_id,
    v_week_start
  FROM moved_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_weekly_access_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_weekly_access_logs() TO service_role;

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_access_logs_gate_location ON public.access_logs(gate_location);
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_muster_events_session_recorded ON public.muster_events(session_id, recorded_at DESC);

-- ============================================================================
-- 6. Reconcile Badges FKs, RFID Uniqueness & SQL Analytics RPCs (GAP-P1-02/03/04)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'badges_fleet_id_fkey'
      AND conrelid = 'public.badges'::regclass
  ) THEN
    ALTER TABLE public.badges
      ADD CONSTRAINT badges_fleet_id_fkey
      FOREIGN KEY (fleet_id) REFERENCES public.fleet(id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'badges_equipment_id_fkey'
      AND conrelid = 'public.badges'::regclass
  ) THEN
    ALTER TABLE public.badges
      ADD CONSTRAINT badges_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) NOT VALID;
  END IF;
END $$;

WITH ranked_rfid AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY rfid_code ORDER BY issued_at DESC NULLS LAST, id DESC) AS rn
  FROM public.badges
  WHERE rfid_code IS NOT NULL
)
UPDATE public.badges b
SET rfid_code = NULL
FROM ranked_rfid r
WHERE b.id = r.id
  AND r.rn > 1;

-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_rfid_code_unique
  ON public.badges(rfid_code)
  WHERE rfid_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_access_control_metrics_jsonb(p_department_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg' AS day_start,
      CURRENT_TIMESTAMP AS now_utc,
      CURRENT_TIMESTAMP + interval '7 days' AS in_7_days
  ),
  badge_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE is_active = true AND entity_type != 'visitor') AS total_active_non_visitor,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'visitor') AS active_visitor_passes,
      COUNT(*) FILTER (WHERE is_active = true AND (expires_at IS NULL OR expires_at > p.in_7_days)) AS active,
      COUNT(*) FILTER (WHERE is_active = true AND expires_at <= p.in_7_days AND expires_at > p.now_utc) AS expiring_soon,
      COUNT(*) FILTER (WHERE is_active = true AND expires_at < p.now_utc) AS expired,
      COUNT(*) FILTER (WHERE is_active = false) AS revoked,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'personnel') AS active_personnel,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'personnel' AND expires_at <= p.in_7_days AND expires_at > p.now_utc) AS expiring_personnel,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'personnel' AND expires_at < p.now_utc) AS expired_personnel,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type IN ('vehicle', 'fleet')) AS active_fleet,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type IN ('vehicle', 'fleet') AND expires_at <= p.in_7_days AND expires_at > p.now_utc) AS expiring_fleet,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type IN ('vehicle', 'fleet') AND expires_at < p.now_utc) AS expired_fleet,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'equipment') AS active_equipment,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'equipment' AND expires_at <= p.in_7_days AND expires_at > p.now_utc) AS expiring_equipment,
      COUNT(*) FILTER (WHERE is_active = true AND entity_type = 'equipment' AND expires_at < p.now_utc) AS expired_equipment
    FROM public.badges, params p
    WHERE badges.department_id = p_department_id
  ),
  access_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE access_granted = false) AS denied_today,
      COUNT(*) AS access_events_today
    FROM public.access_logs, params p
    WHERE access_logs.department_id = p_department_id
      AND access_logs.scanned_at >= p.day_start
  ),
  entity_counts AS (
    SELECT
      (SELECT COUNT(*) FROM public.personnel WHERE department_id = p_department_id) AS total_personnel,
      (SELECT COUNT(*) FROM public.fleet WHERE department_id = p_department_id) AS total_fleet,
      (SELECT COUNT(*) FROM public.equipment WHERE department_id = p_department_id) AS total_equipment
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'active_qr_codes', bc.total_active_non_visitor,
      'active_visitor_passes', bc.active_visitor_passes,
      'expiring_soon', bc.expiring_soon,
      'denied_today', ac.denied_today,
      'access_events_today', ac.access_events_today,
      'expired_assigned', bc.expired,
      'total_entities', (ec.total_personnel + ec.total_fleet + ec.total_equipment)
    ),
    'entity_badge_status', jsonb_build_object(
      'employees', jsonb_build_object(
        'total', ec.total_personnel,
        'active', bc.active_personnel,
        'expiring', bc.expiring_personnel,
        'expired', bc.expired_personnel
      ),
      'vehicles', jsonb_build_object(
        'total', ec.total_fleet,
        'active', bc.active_fleet,
        'expiring', bc.expiring_fleet,
        'expired', bc.expired_fleet
      ),
      'equipment', jsonb_build_object(
        'total', ec.total_equipment,
        'active', bc.active_equipment,
        'expiring', bc.expiring_equipment,
        'expired', bc.expired_equipment
      )
    ),
    'badge_status_distribution', jsonb_build_object(
      'active', bc.active,
      'expiring_soon', bc.expiring_soon,
      'expired', bc.expired,
      'revoked', bc.revoked
    )
  )
  FROM badge_counts bc, access_counts ac, entity_counts ec;
$$;

REVOKE ALL ON FUNCTION public.get_access_control_metrics_jsonb(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_access_control_metrics_jsonb(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_hourly_access_stats(
  p_department_id uuid,
  p_days int DEFAULT 1
)
RETURNS TABLE (
  hour_bucket int,
  entries bigint,
  exits bigint,
  denials bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      date_trunc('day', (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg') - make_interval(days => GREATEST(0, p_days - 1)))
        AT TIME ZONE 'Africa/Johannesburg' AS start_utc
  ),
  hours AS (
    SELECT generate_series(0, 23) AS h
  ),
  agg AS (
    SELECT
      EXTRACT(HOUR FROM (al.scanned_at AT TIME ZONE 'Africa/Johannesburg'))::int AS h,
      COUNT(*) FILTER (WHERE al.access_granted = true AND UPPER(al.direction) = 'IN') AS entries,
      COUNT(*) FILTER (WHERE al.access_granted = true AND UPPER(al.direction) = 'OUT') AS exits,
      COUNT(*) FILTER (WHERE al.access_granted = false) AS denials
    FROM public.access_logs al, bounds b
    WHERE al.department_id = p_department_id
      AND al.scanned_at >= b.start_utc
    GROUP BY 1
  )
  SELECT
    hrs.h AS hour_bucket,
    COALESCE(a.entries, 0)::bigint AS entries,
    COALESCE(a.exits, 0)::bigint AS exits,
    COALESCE(a.denials, 0)::bigint AS denials
  FROM hours hrs
  LEFT JOIN agg a ON a.h = hrs.h
  ORDER BY hrs.h ASC;
$$;

REVOKE ALL ON FUNCTION public.get_hourly_access_stats(uuid, int) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hourly_access_stats(uuid, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_access_control_report_summary(
  p_department_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped_logs AS (
    SELECT
      id,
      badge_id,
      direction,
      gate_location,
      access_granted,
      denial_reason,
      scanned_at
    FROM public.access_logs
    WHERE department_id = p_department_id
      AND scanned_at >= p_start
      AND scanned_at <= p_end
  ),
  gate_agg AS (
    SELECT
      COALESCE(NULLIF(trim(gate_location), ''), 'Unassigned Gate') AS gate_location,
      COUNT(*)::bigint AS total_scans,
      COUNT(*) FILTER (WHERE UPPER(direction) = 'IN' AND access_granted = true)::bigint AS entries,
      COUNT(*) FILTER (WHERE UPPER(direction) = 'OUT' AND access_granted = true)::bigint AS exits,
      COUNT(*) FILTER (WHERE access_granted = false)::bigint AS denials
    FROM scoped_logs
    GROUP BY 1
    ORDER BY total_scans DESC
  ),
  hour_agg AS (
    SELECT
      EXTRACT(HOUR FROM (scanned_at AT TIME ZONE 'Africa/Johannesburg'))::int AS hour_bucket,
      COUNT(*)::bigint AS total_scans
    FROM scoped_logs
    GROUP BY 1
    ORDER BY total_scans DESC, hour_bucket ASC
    LIMIT 1
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS total_events,
      COUNT(*) FILTER (WHERE access_granted = true)::bigint AS granted_events,
      COUNT(*) FILTER (WHERE access_granted = false)::bigint AS denied_events,
      COUNT(*) FILTER (WHERE UPPER(direction) = 'IN' AND access_granted = true)::bigint AS entries,
      COUNT(*) FILTER (WHERE UPPER(direction) = 'OUT' AND access_granted = true)::bigint AS exits
    FROM scoped_logs
  )
  SELECT jsonb_build_object(
    'total_events', t.total_events,
    'granted_events', t.granted_events,
    'denied_events', t.denied_events,
    'entries', t.entries,
    'exits', t.exits,
    'peak_hour', (SELECT hour_bucket FROM hour_agg),
    'peak_hour_count', COALESCE((SELECT total_scans FROM hour_agg), 0),
    'gate_traffic', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM gate_agg g), '[]'::jsonb)
  )
  FROM totals t;
$$;

REVOKE ALL ON FUNCTION public.get_access_control_report_summary(uuid, timestamptz, timestamptz) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_access_control_report_summary(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================================
-- 7. Realtime Publication & Synthetic Data Cleanup (GAP-P1-05 / GAP-P2-02)
-- ============================================================================
DO $$
DECLARE
  v_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['access_logs', 'badges', 'visitors', 'muster_events', 'perimeter_gates']
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN
    NULL;
END $$;

DELETE FROM public.fleet f
WHERE f.fleet_code IN ('CT-01', 'CT-02', 'CT-03')
  AND NOT EXISTS (SELECT 1 FROM public.badges b WHERE b.fleet_id = f.id);

DELETE FROM public.departments d
WHERE d.name = 'access-card-actions'
  AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.department_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.department_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM public.badges b WHERE b.department_id = d.id);
