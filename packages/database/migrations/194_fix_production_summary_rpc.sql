-- Migration 194: Repair production summary functions for existing databases.
-- 073 declared both bodies with SET search_path = '' but referenced the
-- materialized view unqualified, so creation fails when check_function_bodies
-- is on and calls fail where creation was forced off. 073 is fixed for fresh
-- installs; this migration repairs databases that already applied it.

CREATE OR REPLACE FUNCTION refresh_production_summary()
RETURNS void SET search_path = '' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.view_production_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_production_summary(p_start_date DATE, p_end_date DATE)
RETURNS SETOF public.view_production_summary
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = '' AS $$
  SELECT s.*
  FROM public.view_production_summary s
  WHERE (public.has_department_access(s.department_id) OR public.is_admin())
    AND s.log_date >= p_start_date
    AND s.log_date <= p_end_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_production_summary(DATE, DATE) TO authenticated;
