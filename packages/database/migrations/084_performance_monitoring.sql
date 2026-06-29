-- ============================================
-- Performance Monitoring: Slow Query Logging Configuration
-- ============================================

-- Enable query performance monitoring
-- Log queries exceeding 100ms (tunable via log_min_duration_statement)

-- Set log min duration to 100ms (queries taking longer will be logged)
ALTER SYSTEM SET log_min_duration_statement = 100;

-- Log slow checkpoint operations
ALTER SYSTEM SET log_checkpoints = on;

-- Log temporary file usage (helps identify memory issues)
ALTER SYSTEM SET log_temp_files = 0;

-- Log connections/disconnections for audit
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;

-- Log duration for statements (separate from slow query log)
ALTER SYSTEM SET log_duration = off;
ALTER SYSTEM SET log_statement = 'ddl';

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