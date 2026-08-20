-- AI Token Usage Tracking
-- Tracks Google AI API token consumption for cost monitoring and analytics
CREATE TABLE ai_token_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Request context
  request_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  
  -- Model information
  model_name TEXT NOT NULL,
  model_provider TEXT NOT NULL DEFAULT 'google',
  
  -- Token counts
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  
  -- Cost tracking (in USD cents for precision)
  prompt_cost_usd_cents INTEGER NOT NULL DEFAULT 0,
  completion_cost_usd_cents INTEGER NOT NULL DEFAULT 0,
  total_cost_usd_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Request metadata
  endpoint_path TEXT,
  operation_type TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  
  -- Performance metrics
  latency_ms INTEGER,
  
  -- Additional context (JSON for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries
CREATE INDEX idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX idx_ai_token_usage_department_id ON ai_token_usage(department_id);
CREATE INDEX idx_ai_token_usage_created_at ON ai_token_usage(created_at DESC);
CREATE INDEX idx_ai_token_usage_model_name ON ai_token_usage(model_name);
CREATE INDEX idx_ai_token_usage_date_range ON ai_token_usage((DATE(created_at)));

-- RLS Policies
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own token usage
CREATE POLICY ai_token_usage_user_select ON ai_token_usage
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role IN ('admin', 'supervisor')
    )
  );

-- Policy: Server can insert token usage
CREATE POLICY ai_token_usage_server_insert ON ai_token_usage
  FOR INSERT
  WITH CHECK (true);

-- Policy: Admin/supervisor can view all
CREATE POLICY ai_token_usage_admin_select ON ai_token_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role IN ('admin', 'supervisor')
    )
  );

-- Policy: Admin can delete
CREATE POLICY ai_token_usage_admin_delete ON ai_token_usage
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- View for aggregated daily usage
CREATE VIEW ai_token_usage_daily AS
SELECT 
  DATE(created_at) as usage_date,
  model_name,
  model_provider,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cached_prompt_tokens) as total_cached_tokens,
  SUM(total_cost_usd_cents) as total_cost_cents,
  AVG(latency_ms) as avg_latency_ms
FROM ai_token_usage
GROUP BY DATE(created_at), model_name, model_provider
ORDER BY usage_date DESC;

-- View for department-level aggregation
CREATE VIEW ai_token_usage_by_department AS
SELECT 
  department_id,
  d.name as department_name,
  model_name,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost_usd_cents) as total_cost_cents,
  DATE_TRUNC('week', created_at) as week_start
FROM ai_token_usage
LEFT JOIN departments d ON d.id = department_id
GROUP BY department_id, d.name, model_name, DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

COMMENT ON TABLE ai_token_usage IS 'Tracks Google AI API token usage for cost monitoring';
COMMENT ON COLUMN ai_token_usage.cached_prompt_tokens IS 'Tokens saved via prompt caching (prefix reuse)';
COMMENT ON COLUMN ai_token_usage.total_cost_usd_cents IS 'Total cost in USD cents for precision';
