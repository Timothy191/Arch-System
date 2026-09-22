-- 164_grant_employee_department_select.sql
-- Grants SELECT to authenticated users for employees and departments
-- RLS policies already restrict what rows they can see.
-- This just ensures the Postgres permission level is sufficient for the app.

BEGIN;

GRANT SELECT ON public.employees TO authenticated;
GRANT SELECT ON public.departments TO authenticated;

COMMIT;
