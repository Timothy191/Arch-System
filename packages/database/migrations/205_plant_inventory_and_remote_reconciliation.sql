-- Migration: 205_plant_inventory_and_remote_reconciliation.sql
-- Description: Create Plant Inventory tables with automated stock status flags and drawdown triggers,
--              Plant & Processing hourly/delay tables, Access Control muster_events table,
--              and reconcile missing remote objects (machine_telemetry, documents, get_access_control_metrics_jsonb).
--
-- Rollback:
-- DROP TRIGGER IF EXISTS trg_plant_inventory_usage_deduct ON public.plant_inventory_usage;
-- DROP FUNCTION IF EXISTS public.apply_plant_inventory_usage_drawdown();
-- DROP TABLE IF EXISTS public.plant_inventory_usage;
-- DROP TABLE IF EXISTS public.plant_inventory_items;
-- DROP TABLE IF EXISTS public.plant_hourly_logs;
-- DROP TABLE IF EXISTS public.plant_delays;
-- DROP TABLE IF EXISTS public.muster_events;

-- ============================================================================
-- 1. PLANT INVENTORY ITEMS (WITH AUTOMATED GENERATED FLAGS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plant_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  stock text NOT NULL,
  code text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('Dense Medium', 'Reagents', 'Wear Spares', 'Screening & Crushing', 'Stockpiles')),
  description text NOT NULL,
  plant_equipment text NOT NULL,
  unit text NOT NULL DEFAULT 'units',
  amount_required numeric(12, 2) NOT NULL DEFAULT 0 CHECK (amount_required >= 0),
  amount_present numeric(12, 2) NOT NULL DEFAULT 0 CHECK (amount_present >= 0),
  shortfall_amount numeric(12, 2) GENERATED ALWAYS AS (
    GREATEST(0::numeric, amount_required - amount_present)
  ) STORED,
  surplus_amount numeric(12, 2) GENERATED ALWAYS AS (
    GREATEST(0::numeric, amount_present - amount_required)
  ) STORED,
  coverage_pct numeric(6, 1) GENERATED ALWAYS AS (
    CASE
      WHEN amount_required > 0 THEN ROUND((amount_present / amount_required) * 100.0, 1)
      ELSE 100.0
    END
  ) STORED,
  needs_replenishment boolean GENERATED ALWAYS AS (
    amount_present < amount_required
  ) STORED,
  stock_status text GENERATED ALWAYS AS (
    CASE
      WHEN amount_present <= 0 THEN 'OUT_OF_STOCK'
      WHEN amount_present < (amount_required * 0.5) THEN 'CRITICAL'
      WHEN amount_present < amount_required THEN 'REPLENISH'
      WHEN amount_required > 0 AND amount_present > (amount_required * 1.5) THEN 'SURPLUS'
      ELSE 'NOMINAL'
    END
  ) STORED,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plant_inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_inventory_items_select" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_select"
  ON public.plant_inventory_items FOR SELECT
  TO authenticated
  USING (
    department_id IS NULL
    OR public.has_department_access(department_id)
    OR (SELECT public.is_admin())
    OR (SELECT auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS "plant_inventory_items_insert" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_insert"
  ON public.plant_inventory_items FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_inventory_items_update" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_update"
  ON public.plant_inventory_items FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_inventory_items_delete" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_delete"
  ON public.plant_inventory_items FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON public.plant_inventory_items FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_inventory_items TO authenticated, service_role;

-- Seed canonical Plant Inventory items idempotently
INSERT INTO public.plant_inventory_items (
  stock, code, category, description, amount_required, amount_present, unit, plant_equipment
) VALUES
  (
    'Magnetite Superfine Medium (96% Fe3O4)',
    'DM-MAG-45UM',
    'Dense Medium',
    '45μm PSD dense medium separation magnetite for Primary & Secondary DMC circuits',
    180,
    148.5,
    't',
    'Primary DMC Module CR-101'
  ),
  (
    'Anionic Flocculant SNF AN-934SH',
    'RG-FLOC-934',
    'Reagents',
    'High-molecular-weight polymer powder for tailings thickener clarification',
    40,
    44,
    'bags (25kg)',
    'Tailings Thickener TH-501'
  ),
  (
    'MIBC Frother Reagent (IBC Bulk)',
    'RG-MIBC-1000',
    'Reagents',
    'Methyl Isobutyl Carbinol flotation frother for fines beneficiation cells',
    6000,
    4200,
    'L',
    'Fines Flotation Bank SC-201'
  ),
  (
    'Dense Medium Cyclone Vortex Finders',
    'DMC-850-VF-NI',
    'Wear Spares',
    'Ni-Hard 4 high-chrome liner vortex finders for 850mm Primary DMC module',
    4,
    2,
    'units',
    'Primary DMC Module CR-101'
  ),
  (
    'Banana Screen Polyurethane Panels (32mm)',
    'SC-PU-305x610-32',
    'Screening & Crushing',
    'Modular pin-and-sleeve polyurethane deck panels for desliming & sizing screens',
    48,
    48,
    'panels',
    'Secondary Sizing Screen SC-201'
  ),
  (
    'Primary Jaw Crusher Toggle Plates',
    'CR-JW-1104-TP',
    'Screening & Crushing',
    'Machined cast-steel overload protection toggle plates for primary ROM sizer',
    3,
    4,
    'sets',
    'Primary Jaw Crusher CR-101'
  ),
  (
    'Warman 10/8 Slurry Pump Impellers',
    'WP-10/8-AH-A05',
    'Wear Spares',
    '5-vane high-chrome A05 alloy impellers for correct medium & underflow pumps',
    4,
    3,
    'units',
    'Correct Medium Pump DM-301'
  ),
  (
    'Coarse Coal Centrifuge Wedge-Wire Baskets',
    'CF-WW-1400-05',
    'Wear Spares',
    '0.5mm aperture stainless wedge-wire dewatering baskets for product centrifuges',
    2,
    2,
    'baskets',
    'Product Centrifuge DM-301'
  )
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. PLANT INVENTORY USAGE LEDGER & AUTOMATED DRAWDOWN TRIGGER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plant_inventory_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.plant_inventory_items(id) ON DELETE CASCADE,
  stock_code text NOT NULL,
  stock_name text NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  shift text NOT NULL CHECK (shift IN ('Day', 'Night')),
  amount_used numeric(12, 2) NOT NULL CHECK (amount_used > 0),
  unit text NOT NULL DEFAULT 'units',
  circuit_area text NOT NULL,
  plant_equipment text NOT NULL,
  description text NOT NULL DEFAULT '',
  logged_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plant_inventory_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_inventory_usage_select" ON public.plant_inventory_usage;
CREATE POLICY "plant_inventory_usage_select"
  ON public.plant_inventory_usage FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_inventory_usage_insert" ON public.plant_inventory_usage;
CREATE POLICY "plant_inventory_usage_insert"
  ON public.plant_inventory_usage FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON public.plant_inventory_usage FROM anon, PUBLIC;
GRANT SELECT, INSERT ON public.plant_inventory_usage TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_plant_inventory_usage_drawdown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.item_id IS NOT NULL THEN
    UPDATE public.plant_inventory_items
    SET
      amount_present = GREATEST(0::numeric, ROUND(amount_present - NEW.amount_used, 2)),
      updated_at = now()
    WHERE id = NEW.item_id;
  ELSIF NEW.stock_code IS NOT NULL THEN
    UPDATE public.plant_inventory_items
    SET
      amount_present = GREATEST(0::numeric, ROUND(amount_present - NEW.amount_used, 2)),
      updated_at = now()
    WHERE code = NEW.stock_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plant_inventory_usage_deduct ON public.plant_inventory_usage;
CREATE TRIGGER trg_plant_inventory_usage_deduct
  AFTER INSERT ON public.plant_inventory_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_plant_inventory_usage_drawdown();

-- ============================================================================
-- 3. PLANT & PROCESSING HOURLY LOGS & DELAYS TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plant_hourly_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  operation_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('day', 'night')),
  module_id text NOT NULL DEFAULT 'DMS-MOD-1',
  operator_name text NOT NULL DEFAULT 'Plant Control Operator',
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_rom_tonnes numeric(12, 2) NOT NULL DEFAULT 0,
  total_clean_coal_tonnes numeric(12, 2) NOT NULL DEFAULT 0,
  total_discard_tonnes numeric(12, 2) NOT NULL DEFAULT 0,
  avg_yield_pct numeric(6, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_date, shift, module_id)
);

ALTER TABLE public.plant_hourly_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_hourly_logs_select" ON public.plant_hourly_logs;
CREATE POLICY "plant_hourly_logs_select"
  ON public.plant_hourly_logs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_hourly_logs_insert" ON public.plant_hourly_logs;
CREATE POLICY "plant_hourly_logs_insert"
  ON public.plant_hourly_logs FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_hourly_logs_update" ON public.plant_hourly_logs;
CREATE POLICY "plant_hourly_logs_update"
  ON public.plant_hourly_logs FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON public.plant_hourly_logs FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.plant_hourly_logs TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.plant_delays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  delay_date date NOT NULL DEFAULT CURRENT_DATE,
  shift text NOT NULL CHECK (shift IN ('day', 'night')),
  circuit text NOT NULL,
  category text NOT NULL,
  impact_type text NOT NULL DEFAULT 'Reduced Throughput',
  start_time text NOT NULL,
  end_time text,
  duration_minutes bigint NOT NULL DEFAULT 0,
  reason text NOT NULL,
  corrective_action text NOT NULL DEFAULT '',
  logged_by text NOT NULL DEFAULT 'Plant Control Operator',
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plant_delays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_delays_select" ON public.plant_delays;
CREATE POLICY "plant_delays_select"
  ON public.plant_delays FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_delays_insert" ON public.plant_delays;
CREATE POLICY "plant_delays_insert"
  ON public.plant_delays FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "plant_delays_update" ON public.plant_delays;
CREATE POLICY "plant_delays_update"
  ON public.plant_delays FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON public.plant_delays FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.plant_delays TO authenticated, service_role;

-- ============================================================================
-- 4. ACCESS CONTROL EMERGENCY MUSTER EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.muster_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  badge_code text,
  full_name text NOT NULL,
  muster_point text NOT NULL DEFAULT 'Primary Assembly Point A',
  status text NOT NULL DEFAULT 'accounted' CHECK (status IN ('accounted', 'missing', 'evacuated', 'medical')),
  notes text,
  recorded_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.muster_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "muster_events_select" ON public.muster_events;
CREATE POLICY "muster_events_select"
  ON public.muster_events FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "muster_events_insert" ON public.muster_events;
CREATE POLICY "muster_events_insert"
  ON public.muster_events FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "muster_events_update" ON public.muster_events;
CREATE POLICY "muster_events_update"
  ON public.muster_events FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON public.muster_events FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.muster_events TO authenticated, service_role;

-- ============================================================================
-- 5. RECONCILE REMOTE MACHINE TELEMETRY, DOCUMENTS, AND ACCESS METRICS RPC
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.machine_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  year_month text NOT NULL GENERATED ALWAYS AS (
    CAST(EXTRACT(YEAR FROM recorded_at AT TIME ZONE 'UTC') AS text) || '-' ||
    CASE WHEN EXTRACT(MONTH FROM recorded_at AT TIME ZONE 'UTC') < 10 THEN '0' ELSE '' END ||
    CAST(EXTRACT(MONTH FROM recorded_at AT TIME ZONE 'UTC') AS text)
  ) STORED,
  engine_rpm numeric(10, 2),
  engine_temp numeric(10, 2),
  hydraulic_pressure numeric(10, 2),
  hydraulic_temp numeric(10, 2),
  bit_depth numeric(10, 2),
  hole_depth numeric(10, 2),
  weight_on_bit numeric(10, 2),
  rotation_torque numeric(10, 2),
  penetration_rate numeric(10, 2),
  standpipe_pressure numeric(10, 2),
  mud_flow_rate numeric(10, 2),
  ambient_temp numeric(10, 2),
  vibration_level numeric(10, 2),
  operating_hours numeric(10, 2),
  fuel_level numeric(5, 2),
  alert_count bigint DEFAULT 0,
  alert_codes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idx_unique_machine_timestamp UNIQUE (machine_id, recorded_at)
);

CREATE TABLE IF NOT EXISTS public.machine_telemetry_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL,
  department_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL,
  year_month text NOT NULL,
  engine_rpm numeric(10, 2),
  engine_temp numeric(10, 2),
  hydraulic_pressure numeric(10, 2),
  hydraulic_temp numeric(10, 2),
  bit_depth numeric(10, 2),
  hole_depth numeric(10, 2),
  weight_on_bit numeric(10, 2),
  rotation_torque numeric(10, 2),
  penetration_rate numeric(10, 2),
  standpipe_pressure numeric(10, 2),
  mud_flow_rate numeric(10, 2),
  ambient_temp numeric(10, 2),
  vibration_level numeric(10, 2),
  operating_hours numeric(10, 2),
  fuel_level numeric(5, 2),
  alert_count bigint DEFAULT 0,
  alert_codes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NOT NULL DEFAULT now(),
  record_count bigint NOT NULL DEFAULT 1
);

ALTER TABLE public.machine_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_telemetry_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telemetry_select_department" ON public.machine_telemetry;
CREATE POLICY "telemetry_select_department"
  ON public.machine_telemetry FOR SELECT
  TO authenticated
  USING (public.has_department_access(department_id) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "telemetry_insert_department" ON public.machine_telemetry;
CREATE POLICY "telemetry_insert_department"
  ON public.machine_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (public.has_department_access(department_id) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "telemetry_archive_select_department" ON public.machine_telemetry_archive;
CREATE POLICY "telemetry_archive_select_department"
  ON public.machine_telemetry_archive FOR SELECT
  TO authenticated
  USING (public.has_department_access(department_id) OR (SELECT public.is_admin()));

REVOKE ALL ON public.machine_telemetry FROM anon, PUBLIC;
REVOKE ALL ON public.machine_telemetry_archive FROM anon, PUBLIC;
GRANT SELECT, INSERT ON public.machine_telemetry TO authenticated, service_role;
GRANT SELECT ON public.machine_telemetry_archive TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_telemetry_summary(
  p_department_id uuid,
  p_machine_id uuid DEFAULT NULL,
  p_granularity text DEFAULT 'day'
) RETURNS TABLE (
  period text,
  machine_id uuid,
  machine_name text,
  avg_engine_rpm numeric,
  avg_engine_temp numeric,
  avg_hydraulic_pressure numeric,
  max_bit_depth numeric,
  max_hole_depth numeric,
  avg_penetration_rate numeric,
  total_alerts integer,
  record_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_granularity = 'hour' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(t.recorded_at, 'YYYY-MM-DD HH24:00') AS period,
      t.machine_id,
      m.name AS machine_name,
      AVG(t.engine_rpm)::numeric,
      AVG(t.engine_temp)::numeric,
      AVG(t.hydraulic_pressure)::numeric,
      MAX(t.bit_depth)::numeric,
      MAX(t.hole_depth)::numeric,
      AVG(t.penetration_rate)::numeric,
      COALESCE(SUM(t.alert_count), 0)::integer,
      COUNT(*)::bigint
    FROM public.machine_telemetry t
    JOIN public.machines m ON m.id = t.machine_id
    WHERE t.department_id = p_department_id
      AND (p_machine_id IS NULL OR t.machine_id = p_machine_id)
      AND t.year_month = TO_CHAR(NOW(), 'YYYY-MM')
    GROUP BY TO_CHAR(t.recorded_at, 'YYYY-MM-DD HH24:00'), t.machine_id, m.name
    ORDER BY period DESC;
  ELSE
    RETURN QUERY
    SELECT
      TO_CHAR(t.recorded_at, 'YYYY-MM-DD') AS period,
      t.machine_id,
      m.name AS machine_name,
      AVG(t.engine_rpm)::numeric,
      AVG(t.engine_temp)::numeric,
      AVG(t.hydraulic_pressure)::numeric,
      MAX(t.bit_depth)::numeric,
      MAX(t.hole_depth)::numeric,
      AVG(t.penetration_rate)::numeric,
      COALESCE(SUM(t.alert_count), 0)::integer,
      COUNT(*)::bigint
    FROM public.machine_telemetry t
    JOIN public.machines m ON m.id = t.machine_id
    WHERE t.department_id = p_department_id
      AND (p_machine_id IS NULL OR t.machine_id = p_machine_id)
      AND t.year_month = TO_CHAR(NOW(), 'YYYY-MM')
    GROUP BY TO_CHAR(t.recorded_at, 'YYYY-MM-DD'), t.machine_id, m.name
    ORDER BY period DESC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_telemetry_summary(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_telemetry_summary(uuid, uuid, text) TO authenticated, service_role;

-- Documents table reconciliation
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id),
  title text NOT NULL DEFAULT 'Untitled Document',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_department" ON public.documents;
CREATE POLICY "documents_select_department"
  ON public.documents FOR SELECT
  TO authenticated
  USING ((public.has_department_access(department_id) OR (SELECT public.is_admin())) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "documents_insert_department" ON public.documents;
CREATE POLICY "documents_insert_department"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_department_access(department_id) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
CREATE POLICY "documents_update_own"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL AND (public.has_department_access(department_id) OR (SELECT public.is_admin())))
  WITH CHECK (public.has_department_access(department_id) OR (SELECT public.is_admin()));

REVOKE ALL ON public.documents FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated, service_role;

-- Reconcile get_access_control_metrics_jsonb RPC
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE IF EXISTS public.badges ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'personnel';
ALTER TABLE IF EXISTS public.access_logs ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE IF EXISTS public.access_logs ADD COLUMN IF NOT EXISTS access_granted boolean DEFAULT true;
ALTER TABLE IF EXISTS public.access_logs ADD COLUMN IF NOT EXISTS scanned_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.get_access_control_metrics_jsonb(p_department_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH params AS (
    SELECT
      date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day_start,
      CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS now_utc,
      (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '7 days' AS in_7_days
  ),
  badge_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true) AS total_active,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND (b.expires_at IS NULL OR b.expires_at > p.in_7_days)) AS active,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.expires_at <= p.in_7_days AND b.expires_at > p.now_utc) AS expiring_soon,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.expires_at < p.now_utc) AS expired,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = false) AS revoked,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND COALESCE(b.entity_type, 'personnel') = 'personnel') AS active_personnel,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND COALESCE(b.entity_type, 'personnel') = 'personnel' AND b.expires_at <= p.in_7_days AND b.expires_at > p.now_utc) AS expiring_personnel,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND COALESCE(b.entity_type, 'personnel') = 'personnel' AND b.expires_at < p.now_utc) AS expired_personnel,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.entity_type = 'vehicle') AS active_fleet,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.entity_type = 'vehicle' AND b.expires_at <= p.in_7_days AND b.expires_at > p.now_utc) AS expiring_fleet,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.entity_type = 'vehicle' AND b.expires_at < p.now_utc) AS expired_fleet,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.entity_type = 'equipment') AS active_equipment,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.entity_type = 'equipment' AND b.expires_at <= p.in_7_days AND b.expires_at > p.now_utc) AS expiring_equipment,
      COUNT(*) FILTER (WHERE COALESCE(b.is_active, true) = true AND b.entity_type = 'equipment' AND b.expires_at < p.now_utc) AS expired_equipment
    FROM public.badges b, params p
    WHERE b.department_id = p_department_id OR b.department_id IS NULL
  ),
  access_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(al.access_granted, true) = false) AS denied_today,
      COUNT(*) AS access_events_today
    FROM public.access_logs al, params p
    WHERE (al.department_id = p_department_id OR al.department_id IS NULL)
      AND al.scanned_at >= p.day_start
  ),
  entity_counts AS (
    SELECT
      (SELECT COUNT(*) FROM public.personnel WHERE department_id = p_department_id OR department_id IS NULL) AS total_personnel,
      (SELECT COUNT(*) FROM public.fleet WHERE department_id = p_department_id OR department_id IS NULL) AS total_fleet,
      (SELECT COUNT(*) FROM public.equipment WHERE department_id = p_department_id OR department_id IS NULL) AS total_equipment
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'active_qr_codes', bc.total_active,
      'expiring_soon', bc.expiring_soon,
      'denied_today', ac.denied_today,
      'access_events_today', ac.access_events_today,
      'expired_assigned', bc.expired,
      'total_entities', ec.total_personnel
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
