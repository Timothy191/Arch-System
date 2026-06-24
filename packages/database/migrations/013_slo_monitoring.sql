-- ============================================
-- SLO Monitoring & Compliance Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS slo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_name TEXT NOT NULL,
  measurement_time TIMESTAMPTZ DEFAULT NOW(),
  target_value DECIMAL(5,2) NOT NULL,
  actual_value DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('success', 'warning', 'breached')),
  error_budget_remaining DECIMAL(5,2),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE slo_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role to write metrics
CREATE POLICY "service_can_insert_slo_metrics"
  ON slo_metrics FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_can_update_slo_metrics"
  ON slo_metrics FOR UPDATE TO service_role USING (true);

-- Allow read access to authenticated users
CREATE POLICY "authenticated_can_read_slo_metrics"
  ON slo_metrics FOR SELECT TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slo_metrics_name_time 
  ON slo_metrics(slo_name, measurement_time DESC);
CREATE INDEX IF NOT EXISTS idx_slo_metrics_status 
  ON slo_metrics(status) WHERE status = 'breached';

-- View for current SLO status
CREATE OR REPLACE VIEW current_slo_status AS
SELECT 
  slo_name,
  MAX(measurement_time) as last_measurement,
  MAX(actual_value) FILTER (WHERE measurement_time > NOW() - INTERVAL '1 hour') as current_value,
  MAX(target_value) as target,
  MAX(status) FILTER (WHERE measurement_time > NOW() - INTERVAL '1 hour') as current_status,
  MAX(error_budget_remaining) as error_budget_remaining
FROM slo_metrics
GROUP BY slo_name;

-- Function to record SLO measurement
CREATE OR REPLACE FUNCTION record_slo_measurement(
  p_slo_name TEXT,
  p_target_value DECIMAL(5,2),
  p_actual_value DECIMAL(5,2),
  p_error_budget DECIMAL(5,2),
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_id UUID;
BEGIN
  -- Determine status
  IF p_actual_value >= p_target_value THEN
    v_status := 'success';
  ELSIF p_actual_value >= p_target_value * 0.95 THEN
    v_status := 'warning';
  ELSE
    v_status := 'breached';
  END IF;
  
  INSERT INTO slo_metrics (
    slo_name, target_value, actual_value, status,
    error_budget_remaining, period_start, period_end, metadata
  ) VALUES (
    p_slo_name, p_target_value, p_actual_value, v_status,
    p_error_budget, p_period_start, p_period_end, p_metadata
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_slo_measurement TO service_role;