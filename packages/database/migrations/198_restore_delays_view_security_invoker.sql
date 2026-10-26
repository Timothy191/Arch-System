-- 198_restore_delays_view_security_invoker.sql
-- Restore security_invoker on public.machine_operations_with_delays.
--
-- 196 applied ALTER VIEW ... SET (security_invoker = true), but 151 (applied after
-- 196 on this project because its history was backfilled) recreates the view with
-- CREATE OR REPLACE VIEW, which drops reloptions. Re-applying the hardening keeps
-- the linter finding 0010_security_definer_view closed.

ALTER VIEW public.machine_operations_with_delays SET (security_invoker = true);

REVOKE ALL ON public.machine_operations_with_delays FROM anon;
GRANT SELECT ON public.machine_operations_with_delays TO authenticated, service_role;
