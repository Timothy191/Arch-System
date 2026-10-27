-- ============================================
-- Migration: 209_fix_pg_stat_statements_and_cron_health_rpc.sql
-- Description: Schema-qualify extensions.pg_stat_statements and
--              public.materialized_view_refresh_log inside SECURITY DEFINER
--              functions that set search_path = '', and expose
--              public.get_pg_cron_jobs_health() for the /database dashboard.
-- ============================================

-- 1. Fix public.get_slow_queries to reference extensions.pg_stat_statements
CREATE OR REPLACE FUNCTION public.get_slow_queries(p_limit INT DEFAULT 20)
RETURNS TABLE (
  query TEXT,
  calls BIGINT,
  total_exec_time FLOAT,
  mean_exec_time FLOAT,
  max_exec_time FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pss.query::TEXT,
    pss.calls::BIGINT,
    pss.total_exec_time::FLOAT,
    pss.mean_exec_time::FLOAT,
    pss.max_exec_time::FLOAT
  FROM extensions.pg_stat_statements AS pss
  ORDER BY pss.total_exec_time DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_slow_queries(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_slow_queries(INT) TO authenticated, service_role;

-- 2. Fix materialized view refresh helpers to qualify public.materialized_view_refresh_log
CREATE OR REPLACE FUNCTION public.log_mv_refresh_start(
  p_view_name TEXT,
  p_is_concurrent BOOLEAN DEFAULT TRUE,
  p_triggered_by TEXT DEFAULT 'cron'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.materialized_view_refresh_log (
    view_name, status, is_concurrent, triggered_by
  ) VALUES (
    p_view_name, 'started', p_is_concurrent, p_triggered_by
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_mv_refresh_end(
  p_log_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_rows_affected INT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.materialized_view_refresh_log
  SET
    refresh_end = pg_catalog.now(),
    status = p_status,
    error_message = p_error_message,
    rows_affected = p_rows_affected,
    refresh_duration_ms = EXTRACT(EPOCH FROM (pg_catalog.now() - refresh_start))::INT * 1000
  WHERE id = p_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_mv_freshness(
  p_view_name TEXT,
  p_max_age_minutes INT DEFAULT 30
)
RETURNS TABLE(
  view_name TEXT,
  is_fresh BOOLEAN,
  last_refresh TIMESTAMPTZ,
  age_minutes INT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last_refresh TIMESTAMPTZ;
  v_age_mins INT;
  v_fresh BOOLEAN;
  v_view_status TEXT;
BEGIN
  SELECT MAX(l.refresh_end) INTO v_last_refresh
  FROM public.materialized_view_refresh_log AS l
  WHERE l.view_name = p_view_name
    AND l.status = 'completed';

  IF v_last_refresh IS NULL THEN
    v_fresh := FALSE;
    v_view_status := 'never_refreshed';
  ELSE
    v_age_mins := EXTRACT(EPOCH FROM (pg_catalog.now() - v_last_refresh))::INT / 60;
    v_fresh := v_age_mins <= p_max_age_minutes;

    IF v_fresh THEN
      v_view_status := 'fresh';
    ELSE
      v_view_status := 'stale';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p_view_name::TEXT AS view_name,
    v_fresh AS is_fresh,
    v_last_refresh AS last_refresh,
    COALESCE(v_age_mins, 0)::INT AS age_minutes,
    v_view_status AS status;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mv_refresh_stats(
  p_view_name TEXT DEFAULT NULL,
  p_days INT DEFAULT 7
)
RETURNS TABLE(
  view_name TEXT,
  total_refreshes INT,
  successful_refreshes INT,
  failed_refreshes INT,
  skipped_refreshes INT,
  avg_duration_ms FLOAT,
  max_duration_ms INT,
  last_refresh TIMESTAMPTZ,
  last_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.view_name AS view_name,
    COUNT(*)::INT AS total_refreshes,
    COUNT(*) FILTER (WHERE l.status = 'completed')::INT AS successful_refreshes,
    COUNT(*) FILTER (WHERE l.status = 'failed')::INT AS failed_refreshes,
    COUNT(*) FILTER (WHERE l.status = 'skipped')::INT AS skipped_refreshes,
    AVG(l.refresh_duration_ms) FILTER (WHERE l.refresh_duration_ms IS NOT NULL)::FLOAT AS avg_duration_ms,
    MAX(l.refresh_duration_ms) FILTER (WHERE l.refresh_duration_ms IS NOT NULL)::INT AS max_duration_ms,
    MAX(l.refresh_end) FILTER (WHERE l.status = 'completed') AS last_refresh,
    (
      SELECT latest.status
      FROM public.materialized_view_refresh_log AS latest
      WHERE latest.view_name = l.view_name
      ORDER BY latest.refresh_start DESC
      LIMIT 1
    ) AS last_status
  FROM public.materialized_view_refresh_log AS l
  WHERE (p_view_name IS NULL OR l.view_name = p_view_name)
    AND l.refresh_start > pg_catalog.now() - (INTERVAL '1 day' * COALESCE(p_days, 7))
  GROUP BY l.view_name;
END;
$$;

REVOKE ALL ON FUNCTION public.check_mv_freshness(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_mv_freshness(TEXT, INT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_mv_refresh_stats(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mv_refresh_stats(TEXT, INT) TO authenticated, service_role;

-- 3. Expose pg_cron schedule & execution health for /database observability
CREATE OR REPLACE FUNCTION public.get_pg_cron_jobs_health()
RETURNS TABLE(
  jobid BIGINT,
  jobname TEXT,
  schedule TEXT,
  command TEXT,
  active BOOLEAN,
  last_run_status TEXT,
  last_run_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobid::BIGINT,
    COALESCE(j.jobname, 'job_' || j.jobid::TEXT)::TEXT AS jobname,
    j.schedule::TEXT,
    j.command::TEXT,
    j.active::BOOLEAN,
    COALESCE(r.status, 'scheduled')::TEXT AS last_run_status,
    r.end_time AS last_run_time
  FROM cron.job AS j
  LEFT JOIN LATERAL (
    SELECT d.status, d.end_time
    FROM cron.job_run_details AS d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC
    LIMIT 1
  ) AS r ON TRUE
  ORDER BY j.jobid ASC;
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pg_cron_jobs_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pg_cron_jobs_health() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_pg_cron_jobs_health() IS
  'Returns scheduled pg_cron jobs and their latest execution status for /database telemetry.';
