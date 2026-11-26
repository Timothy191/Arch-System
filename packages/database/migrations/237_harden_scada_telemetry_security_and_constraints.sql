-- ============================================================================
-- Migration 237: Harden SCADA Telemetry Security and Validate Constraints
-- ============================================================================
-- Forward-only hardening migration:
-- 1. Restrict public.ingest_scada_readings(JSONB) to service_role or admin
-- 2. Recreate public.scada_telemetry_latest with security_invoker = true
-- 3. Revoke anon/PUBLIC privileges on SCADA tables and grant minimal roles
-- 4. Tighten scada_readings_insert RLS policy to require admin or 'operate'
-- 5. Validate NOT VALID constraints from Migration 233
-- ============================================================================

-- 1. Harden public.ingest_scada_readings(p_readings JSONB)
CREATE OR REPLACE FUNCTION public.ingest_scada_readings(
  p_readings JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r JSONB;
  inserted INTEGER := 0;
BEGIN
  IF (SELECT auth.role()) NOT IN ('service_role') AND NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Forbidden: ingest_scada_readings requires service_role or admin'
      USING ERRCODE = '42501';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_readings) LOOP
    INSERT INTO public.scada_telemetry_readings (tag_id, value, quality, recorded_at)
    VALUES (
      r->>'tag_id',
      (r->>'value')::NUMERIC,
      COALESCE(r->>'quality', 'GOOD (0x00)'),
      COALESCE((r->>'recorded_at')::TIMESTAMPTZ, NOW())
    );
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_scada_readings(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_scada_readings(JSONB) TO service_role;

-- 2. Harden public.scada_telemetry_latest view
CREATE OR REPLACE VIEW public.scada_telemetry_latest
WITH (security_invoker = true) AS
SELECT DISTINCT ON (r.tag_id)
  r.tag_id,
  t.name,
  t.equipment,
  t.source_protocol,
  t.node_id,
  t.register_address,
  t.data_type,
  t.unit,
  t.polling_rate_hz,
  t.quality AS tag_quality,
  r.value AS last_value,
  r.quality AS last_quality,
  r.recorded_at AS last_read_at
FROM public.scada_telemetry_readings r
JOIN public.scada_telemetry_tags t ON t.tag_id = r.tag_id
WHERE t.active = TRUE
ORDER BY r.tag_id, r.recorded_at DESC;

REVOKE ALL ON public.scada_telemetry_latest FROM anon, PUBLIC;
GRANT SELECT ON public.scada_telemetry_latest TO authenticated, service_role;

-- 3. Lock down anon / PUBLIC privileges on SCADA tables
REVOKE ALL ON public.scada_telemetry_tags FROM anon, PUBLIC;
REVOKE ALL ON public.scada_telemetry_readings FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scada_telemetry_tags TO authenticated, service_role;
GRANT SELECT, INSERT ON public.scada_telemetry_readings TO authenticated, service_role;

-- 4. Restrict scada_readings_insert RLS policy
DROP POLICY IF EXISTS "scada_readings_insert" ON public.scada_telemetry_readings;
CREATE POLICY "scada_readings_insert"
  ON public.scada_telemetry_readings FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.scada_telemetry_tags t
      WHERE t.tag_id = scada_telemetry_readings.tag_id
        AND t.department_id IS NOT NULL
        AND public.can_access_department(t.department_id, 'operate')
    )
  );

-- 5. Validate NOT VALID constraints from Migration 233
ALTER TABLE public.machines VALIDATE CONSTRAINT machines_machine_type_check;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_role_check;
