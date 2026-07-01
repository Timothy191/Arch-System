-- Migration 074: Hourly Production Trend View
-- Objective: Provide granular 24-hour production telemetry by unpivoting hourly_loads.
-- This enables a real "trend" chart instead of a per-shift aggregate.

BEGIN;

-- 1. Materialized View for Hourly Production
-- Unpivots the 12-hour buckets from hourly_loads and maps them to actual timestamps.
DROP MATERIALIZED VIEW IF EXISTS view_hourly_production;
CREATE MATERIALIZED VIEW view_hourly_production AS
WITH unpivoted_loads AS (
  -- Day Shift: 06:00 - 18:00
  SELECT 
    department_id,
    machine_id,
    load_date,
    shift_type,
    material_type,
    (load_date + (h.idx + 5 || ' hours')::interval) as hour_timestamp,
    CASE h.idx
      WHEN 1 THEN hour_01 WHEN 2 THEN hour_02 WHEN 3 THEN hour_03 WHEN 4 THEN hour_04
      WHEN 5 THEN hour_05 WHEN 6 THEN hour_06 WHEN 7 THEN hour_07 WHEN 8 THEN hour_08
      WHEN 9 THEN hour_09 WHEN 10 THEN hour_10 WHEN 11 THEN hour_11 WHEN 12 THEN hour_12
    END as load_count
  FROM hourly_loads, generate_series(1,12) h(idx)
  WHERE shift_type = 'day'
  
  UNION ALL
  
  -- Night Shift: 18:00 - 06:00 (next day)
  SELECT 
    department_id,
    machine_id,
    load_date,
    shift_type,
    material_type,
    (load_date + (h.idx + 17 || ' hours')::interval) as hour_timestamp,
    CASE h.idx
      WHEN 1 THEN hour_01 WHEN 2 THEN hour_02 WHEN 3 THEN hour_03 WHEN 4 THEN hour_04
      WHEN 5 THEN hour_05 WHEN 6 THEN hour_06 WHEN 7 THEN hour_07 WHEN 8 THEN hour_08
      WHEN 9 THEN hour_09 WHEN 10 THEN hour_10 WHEN 11 THEN hour_11 WHEN 12 THEN hour_12
    END as load_count
  FROM hourly_loads, generate_series(1,12) h(idx)
  WHERE shift_type = 'night'
)
SELECT
  ul.hour_timestamp,
  ul.department_id,
  d.name as department_name,
  ul.material_type,
  SUM(ul.load_count) as total_loads,
  SUM(ul.load_count * COALESCE(m.bin_factor, 1)) as total_tonnes
FROM unpivoted_loads ul
JOIN departments d ON d.id = ul.department_id
JOIN machines m ON m.id = ul.machine_id
GROUP BY ul.hour_timestamp, ul.department_id, d.name, ul.material_type;

-- 2. Unique Index for CONCURRENT REFRESH
CREATE UNIQUE INDEX uidx_hourly_production ON view_hourly_production(hour_timestamp, department_id, material_type);
CREATE INDEX idx_hourly_production_timestamp ON view_hourly_production(hour_timestamp DESC);

-- 3. Refresh Function
CREATE OR REPLACE FUNCTION refresh_hourly_production()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_hourly_production;
END;
$$ LANGUAGE plpgsql;

-- 4. Security Wrapper RPC
-- This will be used by the Hub Page trend chart.
CREATE OR REPLACE FUNCTION public.get_production_trend(p_hours_back INT DEFAULT 24)
RETURNS TABLE (
  hour_label TEXT,
  department_name TEXT,
  tonnes NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    to_char(hour_timestamp, 'HH24:00') as hour_label,
    department_name,
    SUM(total_tonnes)::NUMERIC as tonnes
  FROM view_hourly_production
  WHERE hour_timestamp >= NOW() - (p_hours_back || ' hours')::interval
    AND (public.has_department_access(department_id) OR public.is_admin())
  GROUP BY hour_timestamp, department_name
  ORDER BY hour_timestamp ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_production_trend(INT) TO authenticated;

-- 5. Schedule refresh every 5 minutes (for "Live" feel)
SELECT cron.schedule(
  'refresh-view-hourly-production',
  '*/5 * * * *',
  'SELECT refresh_hourly_production()'
);

COMMIT;
