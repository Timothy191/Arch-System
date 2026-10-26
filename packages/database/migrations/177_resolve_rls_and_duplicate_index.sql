-- ============================================
-- Migration: 177_resolve_rls_and_duplicate_index
-- Description: Optimizes RLS initplans, resolves multiple permissive policies, and drops duplicate indexes.
-- ============================================

-- ============================================================================
-- 0. Core Security Definer Helper Functions with InitPlan optimization
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_department_access(dept_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE auth_id = (SELECT auth.uid())
      AND (
        role = 'admin'
        OR department_id = dept_id
        OR dept_id = ANY(accessible_departments)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_employee_department()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM employees WHERE auth_id = (SELECT auth.uid()) LIMIT 1;
$$;

-- Resolve duplicate index on delay_categories
-- squawk-ignore require-concurrent-index-deletion
DROP INDEX IF EXISTS public.delay_categories_name_unique;

-- Resolve auth_rls_initplan warnings by wrapping auth functions in (SELECT ...)
DROP POLICY IF EXISTS "employees_update_self_or_admin" ON public.employees;
CREATE POLICY "employees_update_self_or_admin" ON public.employees
  FOR UPDATE TO authenticated
  USING ( auth_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) )
  WITH CHECK ( auth_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "employees_insert_admin_only" ON public.employees;
CREATE POLICY "employees_insert_admin_only" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machines_insert_admin_supervisor" ON public.machines;
CREATE POLICY "machines_insert_admin_supervisor" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) OR public.has_department_access(department_id) );

DROP POLICY IF EXISTS "tires_write_engineering_admin" ON public.tires;
CREATE POLICY "tires_write_engineering_admin"
  ON tires FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  );

DROP POLICY IF EXISTS "machines_update_admin_supervisor" ON public.machines;
CREATE POLICY "machines_update_admin_supervisor" ON public.machines
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) OR public.has_department_access(department_id) )
  WITH CHECK ( (SELECT public.is_admin()) OR public.has_department_access(department_id) );

DROP POLICY IF EXISTS "daily_logs_select_department" ON public.daily_logs;
CREATE POLICY "daily_logs_select_department" ON public.daily_logs
  FOR SELECT TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "daily_logs_insert_department" ON public.daily_logs;
CREATE POLICY "daily_logs_insert_department" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machine_hours_select_department" ON public.machine_hours;
CREATE POLICY "machine_hours_select_department" ON public.machine_hours
  FOR SELECT TO authenticated
  USING ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machine_hours_insert_department" ON public.machine_hours;
CREATE POLICY "machine_hours_insert_department" ON public.machine_hours
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "fuel_logs_select_department" ON public.fuel_logs;
CREATE POLICY "fuel_logs_select_department" ON public.fuel_logs
  FOR SELECT TO authenticated
  USING ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "fuel_logs_insert_department" ON public.fuel_logs;
CREATE POLICY "fuel_logs_insert_department" ON public.fuel_logs
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "production_logs_select_department" ON public.production_logs;
CREATE POLICY "production_logs_select_department" ON public.production_logs
  FOR SELECT TO authenticated
  USING ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "production_logs_insert_department" ON public.production_logs;
CREATE POLICY "production_logs_insert_department" ON public.production_logs
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operators_insert_admin_supervisor" ON public.operators;
CREATE POLICY "operators_insert_admin_supervisor"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "operators_update_admin_supervisor" ON public.operators;
CREATE POLICY "operators_update_admin_supervisor"
  ON operators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "sites_insert_admin_supervisor" ON public.sites;
CREATE POLICY "sites_insert_admin_supervisor" ON public.sites
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "sites_update_admin_supervisor" ON public.sites;
CREATE POLICY "sites_update_admin_supervisor" ON public.sites
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "tire_inspections_write_engineering_admin" ON public.tire_inspections;
CREATE POLICY "tire_inspections_write_engineering_admin"
  ON tire_inspections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  );

DROP POLICY IF EXISTS "machine_operations_insert_department" ON public.machine_operations;
CREATE POLICY "machine_operations_insert_department" ON public.machine_operations
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machine_operations_update_creator_or_supervisor" ON public.machine_operations;
CREATE POLICY "machine_operations_update_creator_or_supervisor" ON public.machine_operations
  FOR UPDATE TO authenticated
  USING ( created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR public.has_department_access(department_id) )
  WITH CHECK ( created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR public.has_department_access(department_id) );

DROP POLICY IF EXISTS "delay_categories_insert_admin" ON public.delay_categories;
CREATE POLICY "delay_categories_insert_admin" ON public.delay_categories
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incident_categories_update_admin" ON public.safety_incident_categories;
CREATE POLICY "safety_incident_categories_update_admin" ON public.safety_incident_categories
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "mine_blocks_delete_admin_supervisor" ON public.mine_blocks;
CREATE POLICY "mine_blocks_delete_admin_supervisor" ON public.mine_blocks
  FOR DELETE TO authenticated
  USING ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "daily_logs_update_creator_or_admin" ON public.daily_logs;
CREATE POLICY "daily_logs_update_creator_or_admin" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING ( updated_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) )
  WITH CHECK ( updated_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "fuel_logs_update_department" ON public.fuel_logs;
CREATE POLICY "fuel_logs_update_department" ON public.fuel_logs
  FOR UPDATE TO authenticated
  USING ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "excavator_activity_insert_department" ON public.excavator_activity;
CREATE POLICY "excavator_activity_insert_department" ON public.excavator_activity
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "excavator_activity_update_department" ON public.excavator_activity;
CREATE POLICY "excavator_activity_update_department" ON public.excavator_activity
  FOR UPDATE TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "production_logs_update_department" ON public.production_logs;
CREATE POLICY "production_logs_update_department" ON public.production_logs
  FOR UPDATE TO authenticated
  USING ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "dozer_rolls_insert_department" ON public.dozer_rolls;
CREATE POLICY "dozer_rolls_insert_department" ON public.dozer_rolls
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "dozer_rolls_update_department" ON public.dozer_rolls;
CREATE POLICY "dozer_rolls_update_department" ON public.dozer_rolls
  FOR UPDATE TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "report_templates_insert_admin" ON public.report_templates;
CREATE POLICY "report_templates_insert_admin" ON public.report_templates
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "generated_reports_select_department" ON public.generated_reports;
CREATE POLICY "generated_reports_select_department" ON public.generated_reports
  FOR SELECT TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "admins_full_access_webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "admins_full_access_webhook_endpoints"
  ON webhook_endpoints
  FOR ALL
  USING ((SELECT auth.uid()) IN (
    SELECT e.auth_id FROM employees e WHERE e.role = 'admin'
  ));

DROP POLICY IF EXISTS "hourly_loads_insert_department" ON public.hourly_loads;
CREATE POLICY "hourly_loads_insert_department" ON public.hourly_loads
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "hourly_loads_update_department" ON public.hourly_loads;
CREATE POLICY "hourly_loads_update_department" ON public.hourly_loads
  FOR UPDATE TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "engineering_notes_select_department" ON public.engineering_notes;
CREATE POLICY "engineering_notes_select_department" ON public.engineering_notes
  FOR SELECT TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "engineering_notes_insert_department" ON public.engineering_notes;
CREATE POLICY "engineering_notes_insert_department" ON public.engineering_notes
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "engineering_notes_update_department" ON public.engineering_notes;
CREATE POLICY "engineering_notes_update_department" ON public.engineering_notes
  FOR UPDATE TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operational_delays_select_department" ON public.operational_delays;
CREATE POLICY "operational_delays_select_department" ON public.operational_delays_deprecated_20250115
  FOR SELECT TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operational_delays_insert_department" ON public.operational_delays;
CREATE POLICY "operational_delays_insert_department" ON public.operational_delays_deprecated_20250115
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operational_delays_update_department" ON public.operational_delays;
CREATE POLICY "operational_delays_update_department" ON public.operational_delays_deprecated_20250115
  FOR UPDATE TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_select_department" ON public.breakdowns;
CREATE POLICY "breakdowns_select_department" ON public.breakdowns
  FOR SELECT TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_insert_department" ON public.breakdowns;
CREATE POLICY "breakdowns_insert_department" ON public.breakdowns
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_update_department" ON public.breakdowns;
CREATE POLICY "breakdowns_update_department" ON public.breakdowns
  FOR UPDATE TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_delete_admin" ON public.breakdowns;
CREATE POLICY "breakdowns_delete_admin" ON public.breakdowns
  FOR DELETE TO authenticated
  USING ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incident_categories_insert_admin" ON public.safety_incident_categories;
CREATE POLICY "safety_incident_categories_insert_admin" ON public.safety_incident_categories
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incidents_select_department" ON public.safety_incidents;
CREATE POLICY "safety_incidents_select_department" ON public.safety_incidents
  FOR SELECT TO authenticated
  USING ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incidents_insert_department" ON public.safety_incidents;
CREATE POLICY "safety_incidents_insert_department" ON public.safety_incidents
  FOR INSERT TO authenticated
  WITH CHECK ( public.has_department_access(department_id) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incidents_update_creator_or_supervisor" ON public.safety_incidents;
CREATE POLICY "safety_incidents_update_creator_or_supervisor" ON public.safety_incidents
  FOR UPDATE TO authenticated
  USING ( reported_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR public.has_department_access(department_id) )
  WITH CHECK ( reported_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR public.has_department_access(department_id) );

DROP POLICY IF EXISTS "supervisors_view_department_webhooks" ON public.webhook_endpoints;
CREATE POLICY "supervisors_view_department_webhooks"
  ON webhook_endpoints
  FOR SELECT
  USING (
    (SELECT auth.uid()) IN (
      SELECT e.auth_id 
      FROM employees e 
      WHERE e.role IN ('supervisor', 'admin')
      AND (
        e.department_id = webhook_endpoints.department_id
        OR webhook_endpoints.department_id = ANY(e.accessible_departments)
      )
    )
  );

DROP POLICY IF EXISTS "mine_blocks_insert_admin_supervisor" ON public.mine_blocks;
CREATE POLICY "mine_blocks_insert_admin_supervisor" ON public.mine_blocks
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "mine_blocks_update_admin_supervisor" ON public.mine_blocks;
CREATE POLICY "mine_blocks_update_admin_supervisor" ON public.mine_blocks
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_select_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_select_department" ON public.excavator_dumper_assignments
  FOR SELECT TO authenticated
  USING ( (SELECT public.is_admin()) OR public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id)) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_insert_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_insert_department" ON public.excavator_dumper_assignments
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) OR public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id)) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_update_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_update_department" ON public.excavator_dumper_assignments
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) OR public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id)) )
  WITH CHECK ( (SELECT public.is_admin()) OR public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id)) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_delete_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_delete_department" ON public.excavator_dumper_assignments
  FOR DELETE TO authenticated
  USING ( (SELECT public.is_admin()) OR public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id)) );

DROP POLICY IF EXISTS "memory_select_own" ON public.memory_embeddings;
CREATE POLICY "memory_select_own" ON public.memory_embeddings
  FOR SELECT TO authenticated
  USING ( user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "memory_insert_own" ON public.memory_embeddings;
CREATE POLICY "memory_insert_own" ON public.memory_embeddings
  FOR INSERT TO authenticated
  WITH CHECK ( user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "memory_update_own" ON public.memory_embeddings;
CREATE POLICY "memory_update_own" ON public.memory_embeddings
  FOR UPDATE TO authenticated
  USING ( user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) )
  WITH CHECK ( user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "memory_delete_own" ON public.memory_embeddings;
CREATE POLICY "memory_delete_own" ON public.memory_embeddings
  FOR DELETE TO authenticated
  USING ( user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "employees_select_active" ON public.employees;
CREATE POLICY "employees_select_active" ON public.employees
  FOR SELECT TO authenticated
  USING (
    auth_id = (SELECT auth.uid()) 
    OR (SELECT public.is_admin()) 
    OR public.has_department_access(department_id)
  );

DROP POLICY IF EXISTS "machine_hours_update_department" ON public.machine_hours;
CREATE POLICY "machine_hours_update_department" ON public.machine_hours
  FOR UPDATE TO authenticated
  USING ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "supervisors_create_department_webhooks" ON public.webhook_endpoints;
CREATE POLICY "supervisors_create_department_webhooks"
  ON webhook_endpoints
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IN (
      SELECT e.auth_id 
      FROM employees e 
      WHERE e.role IN ('supervisor', 'admin')
      AND (
        e.department_id = department_id
        OR department_id = ANY(e.accessible_departments)
      )
    )
  );

DROP POLICY IF EXISTS "supervisors_update_department_webhooks" ON public.webhook_endpoints;
CREATE POLICY "supervisors_update_department_webhooks"
  ON webhook_endpoints
  FOR UPDATE
  USING (
    (SELECT auth.uid()) IN (
      SELECT e.auth_id 
      FROM employees e 
      WHERE e.role IN ('supervisor', 'admin')
      AND (
        e.department_id = webhook_endpoints.department_id
        OR webhook_endpoints.department_id = ANY(e.accessible_departments)
      )
    )
  );

DROP POLICY IF EXISTS "admins_view_all_delivery_logs" ON public.webhook_delivery_logs;
CREATE POLICY "admins_view_all_delivery_logs"
  ON webhook_delivery_logs
  FOR SELECT
  USING ((SELECT auth.uid()) IN (
    SELECT e.auth_id FROM employees e WHERE e.role = 'admin'
  ));

DROP POLICY IF EXISTS "supervisors_view_department_delivery_logs" ON public.webhook_delivery_logs;
CREATE POLICY "supervisors_view_department_delivery_logs"
  ON webhook_delivery_logs
  FOR SELECT
  USING (
    (SELECT auth.uid()) IN (
      SELECT e.auth_id 
      FROM employees e 
      WHERE e.role IN ('supervisor', 'admin')
      AND (
        e.department_id = (
          SELECT we.department_id 
          FROM webhook_endpoints we 
          WHERE we.id = webhook_delivery_logs.webhook_endpoint_id
        )
        OR (
          SELECT we.department_id 
          FROM webhook_endpoints we 
          WHERE we.id = webhook_delivery_logs.webhook_endpoint_id
        ) = ANY(e.accessible_departments)
      )
    )
  );

DROP POLICY IF EXISTS "Allow access control read personnel" ON public.personnel;
CREATE POLICY "Allow access control read personnel" ON personnel FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'access_control')
);

DROP POLICY IF EXISTS "Allow admin read personnel" ON public.personnel;
CREATE POLICY "Allow admin read personnel" ON personnel FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Allow access control read visitors" ON public.visitors;
CREATE POLICY "Allow access control read visitors" ON visitors FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control read badges" ON public.badges;
CREATE POLICY "Allow access control read badges" ON badges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND (e.role = 'admin' OR e.role = 'access_control' OR e.department_id = badges.department_id)
    )
  );

DROP POLICY IF EXISTS "Allow access control read access_logs" ON public.access_logs;
CREATE POLICY "Allow access control read access_logs" ON access_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control insert logs" ON public.access_logs;
CREATE POLICY "Allow access control insert logs" ON access_logs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control insert visitors" ON public.visitors;
CREATE POLICY "Allow access control insert visitors" ON visitors
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
  );

DROP POLICY IF EXISTS "Allow access control read card_printers" ON public.card_printers;
CREATE POLICY "Allow access control read card_printers" ON card_printers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control insert card_printers" ON public.card_printers;
CREATE POLICY "Allow access control insert card_printers" ON card_printers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control update card_printers" ON public.card_printers;
CREATE POLICY "Allow access control update card_printers" ON card_printers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow admin delete card_printers" ON public.card_printers;
CREATE POLICY "Allow admin delete card_printers" ON card_printers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Allow access control read card_templates" ON public.card_templates;
CREATE POLICY "Allow access control read card_templates" ON card_templates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control insert card_templates" ON public.card_templates;
CREATE POLICY "Allow access control insert card_templates" ON card_templates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control update card_templates" ON public.card_templates;
CREATE POLICY "Allow access control update card_templates" ON card_templates FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow admin delete card_templates" ON public.card_templates;
CREATE POLICY "Allow admin delete card_templates" ON card_templates FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Allow access control read print_jobs" ON public.print_jobs;
CREATE POLICY "Allow access control read print_jobs" ON print_jobs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control insert print_jobs" ON public.print_jobs;
CREATE POLICY "Allow access control insert print_jobs" ON print_jobs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control update print_jobs" ON public.print_jobs;
CREATE POLICY "Allow access control update print_jobs" ON print_jobs FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow admin delete print_jobs" ON public.print_jobs;
CREATE POLICY "Allow admin delete print_jobs" ON print_jobs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Allow access control read issued_cards" ON public.issued_cards;
CREATE POLICY "Allow access control read issued_cards" ON issued_cards FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control insert issued_cards" ON public.issued_cards;
CREATE POLICY "Allow access control insert issued_cards" ON issued_cards FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow access control update issued_cards" ON public.issued_cards;
CREATE POLICY "Allow access control update issued_cards" ON issued_cards FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role IN ('access_control', 'admin'))
);

DROP POLICY IF EXISTS "Allow admin delete issued_cards" ON public.issued_cards;
CREATE POLICY "Allow admin delete issued_cards" ON issued_cards FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = (SELECT auth.uid()) AND role = 'admin')
);


-- ============================================================================
-- Tenant Isolation Policies with InitPlan scalar SELECT for current_setting
-- ============================================================================
DROP POLICY IF EXISTS mutation_log_tenant_isolation ON public.mutation_log;
CREATE POLICY mutation_log_tenant_isolation ON public.mutation_log
  USING (tenant_id = NULLIF((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = NULLIF((SELECT current_setting('app.tenant_id', true)), '')::uuid);

DROP POLICY IF EXISTS smr_readings_tenant_isolation ON public.smr_readings;
CREATE POLICY smr_readings_tenant_isolation ON public.smr_readings
  USING (tenant_id = NULLIF((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = NULLIF((SELECT current_setting('app.tenant_id', true)), '')::uuid);
