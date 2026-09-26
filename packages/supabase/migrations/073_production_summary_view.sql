-- Migration 073: Unified Production & Reconciliation View
-- Objective: Implement a high-performance materialized view for shift-level KPIs.
-- Aggregates Tonnage, BCM, Fuel, and Hours to eliminate frontend overhead.

BEGIN;

-- 1. Material Density Reference Table
CREATE TABLE IF NOT EXISTS material_density (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_type TEXT UNIQUE NOT NULL,
  density_factor NUMERIC(4,2) NOT NULL, -- tonnes per BCM
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for reference table
ALTER TABLE material_density ENABLE ROW LEVEL SECURITY;

-- RLS Policies: read-only access for authenticated users, write access for admins
CREATE POLICY "material_density_read_all"
  ON material_density
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "material_density_write_admin"
  ON material_density
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid() AND e.role = 'admin'
    )
  );

-- Seed with industrial defaults
INSERT INTO material_density (material_type, density_factor) VALUES
  ('Coal', 1.45),
  ('Waste', 2.25),
  ('Unspecified', 2.00)
ON CONFLICT (material_type) DO UPDATE SET density_factor = EXCLUDED.density_factor;

-- 2. Materialized View for Production Summary
-- Aggregates Tonnage (Actual) and BCM (Expected) per shift.
DROP MATERIALIZED VIEW IF EXISTS view_production_summary;
CREATE MATERIALIZED VIEW view_production_summary AS
WITH production_data AS (
  -- Aggregate actual tonnes from production_logs
  SELECT 
    daily_log_id,
    SUM(coal_tonnes) as actual_coal_tonnes,
    SUM(waste_tonnes) as actual_waste_tonnes
  FROM production_logs
  GROUP BY daily_log_id
),
extraction_data AS (
  -- Aggregate BCM from excavator activity / dumper assignments
  SELECT 
    ea.daily_log_id,
    SUM(CASE WHEN eda.material_type = 'Coal' THEN eda.total_bcm ELSE 0 END) as bcm_coal,
    SUM(CASE WHEN eda.material_type = 'Waste' THEN eda.total_bcm ELSE 0 END) as bcm_waste,
    SUM(CASE WHEN eda.material_type NOT IN ('Coal', 'Waste') THEN eda.total_bcm ELSE 0 END) as bcm_other
  FROM excavator_activity ea
  JOIN excavator_dumper_assignments eda ON eda.excavator_activity_id = ea.id
  GROUP BY ea.daily_log_id
),
fuel_data AS (
  -- Aggregate fuel consumption
  SELECT 
    daily_log_id,
    SUM(diesel_litres) as total_fuel_litres
  FROM fuel_logs
  GROUP BY daily_log_id
),
hours_data AS (
  -- Aggregate hours worked
  SELECT 
    daily_log_id,
    SUM(hours_worked) as total_hours_worked
  FROM machine_hours
  GROUP BY daily_log_id
),
densities AS (
  -- Get densities into variables
  SELECT 
    MAX(CASE WHEN material_type = 'Coal' THEN density_factor END) as d_coal,
    MAX(CASE WHEN material_type = 'Waste' THEN density_factor END) as d_waste,
    MAX(CASE WHEN material_type = 'Unspecified' THEN density_factor END) as d_other
  FROM material_density
)
SELECT
  dl.id as daily_log_id,
  dl.department_id,
  dl.log_date,
  dl.shift,
  ss.status as shift_status,
  ss.approved_by,
  
  -- Actual Tonnage
  COALESCE(pd.actual_coal_tonnes, 0) as actual_coal_tonnes,
  COALESCE(pd.actual_waste_tonnes, 0) as actual_waste_tonnes,
  (COALESCE(pd.actual_coal_tonnes, 0) + COALESCE(pd.actual_waste_tonnes, 0)) as actual_total_tonnes,
  
  -- Extraction (BCM)
  COALESCE(ed.bcm_coal, 0) as bcm_coal,
  COALESCE(ed.bcm_waste, 0) as bcm_waste,
  COALESCE(ed.bcm_coal + ed.bcm_waste + ed.bcm_other, 0) as total_bcm,

  -- Expected Tonnage (BCM * Density)
  (COALESCE(ed.bcm_coal * dens.d_coal, 0) + 
   COALESCE(ed.bcm_waste * dens.d_waste, 0) + 
   COALESCE(ed.bcm_other * dens.d_other, 0)) as expected_total_tonnes,
  
  -- Resource Metrics
  COALESCE(fd.total_fuel_litres, 0) as total_fuel_litres,
  COALESCE(hd.total_hours_worked, 0) as total_hours_worked,
  
  -- Efficiencies
  CASE 
    WHEN COALESCE(hd.total_hours_worked, 0) > 0 
    THEN (COALESCE(pd.actual_coal_tonnes, 0) + COALESCE(pd.actual_waste_tonnes, 0)) / hd.total_hours_worked 
    ELSE 0 
  END as tonnes_per_hour,
  
  -- Drift Calculation (Actual vs Expected)
  CASE 
    WHEN (COALESCE(ed.bcm_coal * dens.d_coal, 0) + COALESCE(ed.bcm_waste * dens.d_waste, 0) + COALESCE(ed.bcm_other * dens.d_other, 0)) > 0 
    THEN (((COALESCE(pd.actual_coal_tonnes, 0) + COALESCE(pd.actual_waste_tonnes, 0)) - 
           (COALESCE(ed.bcm_coal * dens.d_coal, 0) + COALESCE(ed.bcm_waste * dens.d_waste, 0) + COALESCE(ed.bcm_other * dens.d_other, 0))) / 
          (COALESCE(ed.bcm_coal * dens.d_coal, 0) + COALESCE(ed.bcm_waste * dens.d_waste, 0) + COALESCE(ed.bcm_other * dens.d_other, 0)) * 100)
    ELSE 0 
  END as reconciliation_drift_pct,
  
  NOW() as last_refreshed_at
FROM daily_logs dl
LEFT JOIN production_data pd ON pd.daily_log_id = dl.id
LEFT JOIN extraction_data ed ON ed.daily_log_id = dl.id
LEFT JOIN fuel_data fd ON fd.daily_log_id = dl.id
LEFT JOIN hours_data hd ON hd.daily_log_id = dl.id
LEFT JOIN shift_status ss ON (ss.department_id = dl.department_id AND ss.shift_date = dl.log_date AND ss.shift_type::text = dl.shift::text)
CROSS JOIN densities dens;

-- 3. Unique Index for CONCURRENT REFRESH
CREATE UNIQUE INDEX uidx_production_summary_log ON view_production_summary(daily_log_id);
CREATE INDEX idx_production_summary_date ON view_production_summary(log_date DESC);
CREATE INDEX idx_production_summary_dept ON view_production_summary(department_id);

-- 4. Refresh Function
CREATE OR REPLACE FUNCTION refresh_production_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_production_summary;
END;
$$ LANGUAGE plpgsql;

-- 5. Security Wrapper
CREATE OR REPLACE FUNCTION public.get_production_summary(p_start_date DATE, p_end_date DATE)
RETURNS SETOF view_production_summary
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.*
  FROM view_production_summary s
  WHERE (public.has_department_access(s.department_id) OR public.is_admin())
    AND s.log_date >= p_start_date
    AND s.log_date <= p_end_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_production_summary(DATE, DATE) TO authenticated;

-- 6. Schedule refresh every 15 minutes
SELECT cron.schedule(
  'refresh-view-production-summary',
  '*/15 * * * *',
  'SELECT refresh_production_summary()'
);

COMMIT;
