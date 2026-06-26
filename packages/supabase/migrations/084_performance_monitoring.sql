-- ============================================
-- Performance Monitoring: Slow Query Logging Configuration
-- ============================================

-- Enable query performance monitoring
-- Log queries exceeding 100ms (tunable via log_min_duration_statement)

-- Server-level settings (log_min_duration_statement, etc.) must be configured
-- outside migrations — use Supabase dashboard or postgresql.conf for local dev.

-- Create index on pg_stat_statements for analysis (extension must be enabled)
-- This is managed via Supabase dashboard or migration:
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Function to get slow queries from pg_stat_statements
CREATE OR REPLACE FUNCTION public.get_slow_queries(p_limit INT DEFAULT 20)
RETURNS TABLE (
  query TEXT,
  calls BIGINT,
  total_exec_time FLOAT,
  mean_exec_time FLOAT,
  max_exec_time FLOAT
) SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_stat_statements.query,
    pg_stat_statements.calls,
    pg_stat_statements.total_exec_time,
    pg_stat_statements.mean_exec_time,
    pg_stat_statements.max_exec_time
  FROM pg_stat_statements
  ORDER BY pg_stat_statements.total_exec_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to analysts/operators role
GRANT EXECUTE ON FUNCTION public.get_slow_queries TO authenticated;