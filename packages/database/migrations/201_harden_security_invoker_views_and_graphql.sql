-- Migration: 201_harden_security_invoker_views_and_graphql.sql
-- Description: Harden views to security_invoker and restrict anon access on views and graphql schema:
--              1. Set security_invoker = true on current_slo_status, ai_token_usage_daily, ai_token_usage_by_department.
--              2. Revoke all privileges from anon and PUBLIC on those views.
--              3. Explicitly grant SELECT to authenticated and service_role.
--              4. Revoke USAGE on schema graphql and EXECUTE on graphql functions from anon and PUBLIC.
--
-- Rollback:
-- ALTER VIEW public.current_slo_status RESET (security_invoker);
-- ALTER VIEW public.ai_token_usage_daily RESET (security_invoker);
-- ALTER VIEW public.ai_token_usage_by_department RESET (security_invoker);
-- GRANT ALL ON public.current_slo_status TO anon;
-- GRANT ALL ON public.ai_token_usage_daily TO anon;
-- GRANT ALL ON public.ai_token_usage_by_department TO anon;
-- GRANT USAGE ON SCHEMA graphql TO anon;

-- 1. Harden views to security_invoker
ALTER VIEW public.current_slo_status SET (security_invoker = true);
ALTER VIEW public.ai_token_usage_daily SET (security_invoker = true);
ALTER VIEW public.ai_token_usage_by_department SET (security_invoker = true);

-- 2. Revoke all privileges from anon and PUBLIC on the views
REVOKE ALL ON public.current_slo_status FROM anon, PUBLIC;
REVOKE ALL ON public.ai_token_usage_daily FROM anon, PUBLIC;
REVOKE ALL ON public.ai_token_usage_by_department FROM anon, PUBLIC;

-- 3. Explicitly grant SELECT to authenticated and service_role
GRANT SELECT ON public.current_slo_status TO authenticated, service_role;
GRANT SELECT ON public.ai_token_usage_daily TO authenticated, service_role;
GRANT SELECT ON public.ai_token_usage_by_department TO authenticated, service_role;

-- 4. Harden pg_graphql schema and functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql') THEN
    REVOKE USAGE ON SCHEMA graphql FROM anon, PUBLIC;
    GRANT USAGE ON SCHEMA graphql TO authenticated, service_role;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql FROM anon, PUBLIC;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql TO authenticated, service_role;
  END IF;
END $$;

