-- 196_security_linter_security_definer_view.sql
-- Security hardening based on Supabase Database Linter findings (0010_security_definer_view).
--
-- public.machine_operations_with_delays was created by the migration role, so it
-- evaluated with the owner's rights and bypassed RLS on machine_operations and
-- delay_entries: any role holding SELECT on the view could read every department's
-- operations and delay breakdown. Run it with the caller's privileges instead, and
-- stop exposing it to unauthenticated PostgREST clients.
--
-- AGENT-TRACE: security_definer_view fix; authenticated callers now receive only rows
-- allowed by machine_operations_select_access and delay_entries_select_department.
--
-- Note: CREATE OR REPLACE VIEW drops reloptions, so any future redefinition of this
-- view must carry WITH (security_invoker = true).

ALTER VIEW public.machine_operations_with_delays SET (security_invoker = true);

REVOKE ALL ON public.machine_operations_with_delays FROM anon;
GRANT SELECT ON public.machine_operations_with_delays TO authenticated, service_role;
