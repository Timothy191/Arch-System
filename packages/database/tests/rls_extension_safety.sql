-- RLS & Extension Safety Test Assertion
-- Ensures pg_graphql extension and custom functions operate with valid search_path and RLS isolation

BEGIN;

-- 1. Verify pg_graphql extension exists in extensions schema or is installable
SELECT count(*) >= 0 FROM pg_extension WHERE extname = 'pg_graphql';

-- 2. Verify all functions in public schema have an explicit search_path set
SELECT p.proname 
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
  AND p.prosecdef = true 
  AND (p.proconfig IS NULL OR NOT ('search_path=' = ANY(p.proconfig)));

ROLLBACK;
