-- ============================================
-- Feature Flags & A/B Testing
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  target_users JSONB DEFAULT '[]',
  target_groups JSONB DEFAULT '[]',
  variant_a JSONB DEFAULT '{"name": "control", "weight": 50}',
  variant_b JSONB DEFAULT '{"name": "treatment", "weight": 50}',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flag evaluation log for analytics
CREATE TABLE IF NOT EXISTS feature_flag_exposures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL,
  user_id UUID REFERENCES employees(id),
  session_id TEXT,
  variant TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- A/B test results
CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL,
  user_id UUID REFERENCES employees(id),
  variant TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(10,4),
  converted BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_exposures ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_can_manage_flags"
  ON feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_can_read_flags"
  ON feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_can_log_exposures"
  ON feature_flag_exposures FOR INSERT TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_can_log_results"
  ON ab_test_results FOR INSERT TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_can_read_analytics"
  ON ab_test_results FOR SELECT TO service_role USING (true);

-- Indexes
CREATE INDEX idx_feature_flag_exposures_user ON feature_flag_exposures(user_id);
CREATE INDEX idx_feature_flag_exposures_flag ON feature_flag_exposures(flag_key, evaluated_at);
CREATE INDEX idx_ab_test_results_flag ON ab_test_results(flag_key, recorded_at);

-- Function to evaluate feature flag
CREATE OR REPLACE FUNCTION evaluate_feature_flag(
  p_flag_key TEXT,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_flag RECORD;
  v_result JSONB;
  v_hash INTEGER;
  v_bucket INTEGER;
BEGIN
  -- Get flag config
  SELECT * INTO v_flag FROM feature_flags 
  WHERE key = p_flag_key AND enabled = true
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('enabled', false, 'variant', null);
  END IF;
  
  -- Deterministic bucketing using hash
  v_hash := hashtext(coalesce(p_user_id::text, p_session_id, 'anonymous'));
  v_bucket := (abs(v_hash) % 100) + 1;
  
  -- Check if user falls in rollout percentage
  IF v_flag.rollout_percentage < 100 AND v_bucket > v_flag.rollout_percentage THEN
    RETURN jsonb_build_object('enabled', false, 'variant', null);
  end if;
  
  -- Determine variant (A/B)
  IF (v_flag.variant_a->>'weight')::int + (v_flag.variant_b->>'weight')::int > 0 THEN
    v_bucket := (abs(hashtext(coalesce(p_user_id::text, p_session_id))) % 100) + 1;
    IF v_bucket <= (v_flag.variant_a->>'weight')::int THEN
      v_result := v_flag.variant_a;
    ELSE
      v_result := v_flag.variant_b;
    END IF;
  ELSE
    v_result := jsonb_build_object('name', 'control');
  END IF;
  
  -- Log exposure
  INSERT INTO feature_flag_exposures (flag_key, user_id, session_id, variant)
  VALUES (p_flag_key, p_user_id, p_session_id, v_result->>'name');
  
  RETURN jsonb_build_object('enabled', true, 'variant', v_result->>'name', 'config', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION evaluate_feature_flag TO authenticated;