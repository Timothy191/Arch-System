-- 097_enable_pg_graphql.sql
-- Enables pg_graphql extension within the dedicated extensions schema
-- AGENT-TRACE: Safe pg_graphql extension enablement with schema isolation and RLS compatibility

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_graphql'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_graphql SCHEMA extensions;
  END IF;
END $$;

-- Harden function search path for GraphQL resolver functions if created in public
DO $$
DECLARE
  func_rec RECORD;
BEGIN
  FOR func_rec IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname LIKE 'graphql%'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, extensions, pg_temp;', func_rec.proname, func_rec.args);
  END LOOP;
END $$;
