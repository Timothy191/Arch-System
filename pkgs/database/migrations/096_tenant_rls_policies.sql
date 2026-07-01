-- Migration: 096_tenant_rls_policies
-- Description: Expand Supabase RLS policies across all tenant data boundaries.

-- Enable RLS on core tables (assuming employees and machines)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- Employees can only see their own records or records in their site
CREATE POLICY "Employees can view own site data"
ON public.employees
FOR SELECT
USING (
  site_id = (SELECT site_id FROM public.employees WHERE id = auth.uid())
);

-- Machines can only be viewed by employees of the same site
CREATE POLICY "Machines visible by site"
ON public.machines
FOR SELECT
USING (
  site_id = (SELECT site_id FROM public.employees WHERE id = auth.uid())
);

-- Admins can do everything (assumes role = 'admin')
CREATE POLICY "Admins have full access to employees"
ON public.employees
FOR ALL
USING (
  (SELECT role FROM public.employees WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins have full access to machines"
ON public.machines
FOR ALL
USING (
  (SELECT role FROM public.employees WHERE id = auth.uid()) = 'admin'
);
