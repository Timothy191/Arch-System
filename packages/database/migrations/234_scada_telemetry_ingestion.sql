-- ============================================
-- SCADA Telemetry Ingestion Substrate
-- Real storage for industrial SCADA/PLC tag registry and live readings,
-- replacing illustrative (simulated) values previously hardcoded in the
-- portal overview. Tags are registered per department; readings are
-- appended by the SCADA ingestion endpoint (FUXA/OPC-UA/Modbus bridge).
-- ============================================

-- Tag registry: one row per SCADA/PLC tag exposed by a gateway
CREATE TABLE IF NOT EXISTS public.scada_telemetry_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id TEXT NOT NULL,
  name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  equipment TEXT,
  source_protocol TEXT NOT NULL CHECK (source_protocol IN ('OPC-UA', 'Modbus-TCP', 'Modbus-RTU', 'MQTT', 'REST')),
  node_id TEXT,
  register_address TEXT,
  data_type TEXT NOT NULL DEFAULT 'FLOAT32',
  unit TEXT,
  base_value NUMERIC,
  variance NUMERIC DEFAULT 0,
  polling_rate_hz NUMERIC(10,2) DEFAULT 1,
  quality TEXT DEFAULT 'GOOD (0x00)',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scada_telemetry_tags_unique_tag UNIQUE (tag_id)
);

CREATE INDEX IF NOT EXISTS idx_scada_tags_department ON public.scada_telemetry_tags(department_id);
CREATE INDEX IF NOT EXISTS idx_scada_tags_protocol ON public.scada_telemetry_tags(source_protocol);
CREATE INDEX IF NOT EXISTS idx_scada_tags_active ON public.scada_telemetry_tags(active) WHERE active = TRUE;

-- Live readings: append-only time series per tag
CREATE TABLE IF NOT EXISTS public.scada_telemetry_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id TEXT NOT NULL REFERENCES public.scada_telemetry_tags(tag_id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  quality TEXT DEFAULT 'GOOD (0x00)',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scada_readings_tag_time
  ON public.scada_telemetry_readings(tag_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_scada_readings_time
  ON public.scada_telemetry_readings(recorded_at DESC);

-- Enable RLS
ALTER TABLE public.scada_telemetry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scada_telemetry_readings ENABLE ROW LEVEL SECURITY;

-- Tags: readable by authenticated users with department access; writable by admins/operators
CREATE POLICY "scada_tags_select"
  ON public.scada_telemetry_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR department_id IS NULL
          OR e.department_id = scada_telemetry_tags.department_id
          OR scada_telemetry_tags.department_id = ANY(e.accessible_departments)
        )
    )
  );

CREATE POLICY "scada_tags_write"
  ON public.scada_telemetry_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor')
    )
  );

-- Readings: readable by authenticated users with department access; insertable by service role / operators
CREATE POLICY "scada_readings_select"
  ON public.scada_telemetry_readings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.scada_telemetry_tags t ON t.tag_id = scada_telemetry_readings.tag_id
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR t.department_id IS NULL
          OR e.department_id = t.department_id
          OR t.department_id = ANY(e.accessible_departments)
        )
    )
  );

CREATE POLICY "scada_readings_insert"
  ON public.scada_telemetry_readings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.scada_telemetry_tags t ON t.tag_id = scada_telemetry_readings.tag_id
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.role IN ('admin', 'supervisor')
          OR e.department_id = t.department_id
          OR t.department_id = ANY(e.accessible_departments)
        )
    )
  );

-- Upsert a batch of readings (called by the SCADA ingestion bridge)
CREATE OR REPLACE FUNCTION public.ingest_scada_readings(
  p_readings JSONB
) RETURNS INTEGER
SET search_path = ''
AS $$
DECLARE
  r JSONB;
  inserted INTEGER := 0;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Latest reading per tag (convenience view for the overview dashboard)
CREATE OR REPLACE VIEW public.scada_telemetry_latest AS
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

-- Realtime publication for live tag updates
DO $$
BEGIN
  IF to_regclass('public.scada_telemetry_readings') IS NOT NULL THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scada_telemetry_readings;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
