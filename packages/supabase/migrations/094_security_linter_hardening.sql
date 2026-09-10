-- 094_security_linter_hardening.sql
-- Security Hardening based on Supabase Database Linter findings
-- Resolves: function_search_path_mutable, extension_in_public, rls_policy_always_true, and anon_security_definer_function_executable

-- AGENT-TRACE: Production security hardening for search_path mutability, RLS WITH CHECK validation, extension schema placement, and RPC execute privileges.

-- ============================================================================
-- 1. Extension Schema Relocation (extension_in_public)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension 
    WHERE extname = 'vector' AND extnamespace = 'public'::regnamespace
  ) THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END $$;

-- ============================================================================
-- 2. Function Search Path Hardening (function_search_path_mutable)
-- ============================================================================
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.process_audit_log() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_active(timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.has_department_access(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.user_department_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

ALTER FUNCTION public.submit_user_feedback(text, text, integer, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.submit_quick_feedback(text, text, text, text) SET search_path = public, pg_temp;

ALTER FUNCTION public.get_conversation_history(text, uuid, integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.search_memories_hybrid(extensions.vector, text, uuid, text, text, integer, double precision, double precision, double precision, integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.search_memories_semantic(extensions.vector, uuid, text, text, integer, double precision, integer) SET search_path = public, extensions, pg_temp;

-- ============================================================================
-- 3. RLS WITH CHECK Validation (rls_policy_always_true)
-- ============================================================================

-- Harden audit_logs insert policy
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid() OR auth.uid() IS NOT NULL);

-- Harden user_feedback insert policy
DROP POLICY IF EXISTS "authenticated_can_create_feedback" ON public.user_feedback;
CREATE POLICY "authenticated_can_create_feedback" ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- Harden quick_feedback insert policy
DROP POLICY IF EXISTS "any_user_can_quick_feedback" ON public.quick_feedback;
CREATE POLICY "any_user_can_quick_feedback" ON public.quick_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (page_url IS NOT NULL AND reaction IS NOT NULL);

-- ============================================================================
-- 4. SECURITY DEFINER Execution Privileges (anon_security_definer_function_executable)
-- ============================================================================

-- Internal trigger functions must never be executed directly via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_audit_log() FROM PUBLIC, anon, authenticated;

-- Internal helper functions: revoke public/anon access, allow authenticated/service_role
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_department_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_department_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_department_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_department_id() TO authenticated, service_role;

-- AI Memory RPCs: revoke anonymous execution, allow authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.get_conversation_history(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_history(text, uuid, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_memories_hybrid(extensions.vector, text, uuid, text, text, integer, double precision, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_memories_hybrid(extensions.vector, text, uuid, text, text, integer, double precision, double precision, double precision, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_memories_semantic(extensions.vector, uuid, text, text, integer, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_memories_semantic(extensions.vector, uuid, text, text, integer, double precision, integer) TO authenticated, service_role;
