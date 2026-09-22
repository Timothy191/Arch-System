-- 095_optimize_rls_initplan_and_indexes.sql
-- Optimizes RLS policies by wrapping auth/helper functions in (SELECT ...) InitPlans
-- and drops duplicate index on delay_categories.

-- AGENT-TRACE: Resolves auth_rls_initplan performance warnings and duplicate_index warning.

-- ============================================================================
-- 1. Drop Duplicate Index on delay_categories
-- ============================================================================
ALTER TABLE public.delay_categories DROP CONSTRAINT IF EXISTS delay_categories_name_unique;

-- ============================================================================
-- 2. employees RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "employees_select_active" ON public.employees;
DROP POLICY IF EXISTS "employees_select_self_or_admin" ON public.employees;
CREATE POLICY "employees_select_active" ON public.employees
  FOR SELECT TO authenticated
  USING (
    auth_id = (SELECT auth.uid()) 
    OR (SELECT public.is_admin()) 
    OR (SELECT public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "employees_update_self_or_admin" ON public.employees;
CREATE POLICY "employees_update_self_or_admin" ON public.employees
  FOR UPDATE TO authenticated
  USING ( auth_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) )
  WITH CHECK ( auth_id = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "employees_insert_admin_only" ON public.employees;
CREATE POLICY "employees_insert_admin_only" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

-- ============================================================================
-- 3. machines RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "machines_insert_admin_supervisor" ON public.machines;
CREATE POLICY "machines_insert_admin_supervisor" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) );

DROP POLICY IF EXISTS "machines_update_admin_supervisor" ON public.machines;
CREATE POLICY "machines_update_admin_supervisor" ON public.machines
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) )
  WITH CHECK ( (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) );

-- ============================================================================
-- 4. operators & sites RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "operators_insert_admin_supervisor" ON public.operators;
CREATE POLICY "operators_insert_admin_supervisor" ON public.operators
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operators_update_admin_supervisor" ON public.operators;
CREATE POLICY "operators_update_admin_supervisor" ON public.operators
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "sites_insert_admin_supervisor" ON public.sites;
CREATE POLICY "sites_insert_admin_supervisor" ON public.sites
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "sites_update_admin_supervisor" ON public.sites;
CREATE POLICY "sites_update_admin_supervisor" ON public.sites
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

-- ============================================================================
-- 5. daily_logs RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "daily_logs_select_department" ON public.daily_logs;
CREATE POLICY "daily_logs_select_department" ON public.daily_logs
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "daily_logs_insert_department" ON public.daily_logs;
CREATE POLICY "daily_logs_insert_department" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "daily_logs_update_creator_or_admin" ON public.daily_logs;
CREATE POLICY "daily_logs_update_creator_or_admin" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING ( updated_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) )
  WITH CHECK ( updated_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) );

-- ============================================================================
-- 6. machine_hours, fuel_logs, production_logs RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "machine_hours_select_department" ON public.machine_hours;
CREATE POLICY "machine_hours_select_department" ON public.machine_hours
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machine_hours_insert_department" ON public.machine_hours;
CREATE POLICY "machine_hours_insert_department" ON public.machine_hours
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machine_hours_update_department" ON public.machine_hours;
CREATE POLICY "machine_hours_update_department" ON public.machine_hours
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "fuel_logs_select_department" ON public.fuel_logs;
CREATE POLICY "fuel_logs_select_department" ON public.fuel_logs
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "fuel_logs_insert_department" ON public.fuel_logs;
CREATE POLICY "fuel_logs_insert_department" ON public.fuel_logs
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "fuel_logs_update_department" ON public.fuel_logs;
CREATE POLICY "fuel_logs_update_department" ON public.fuel_logs
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "production_logs_select_department" ON public.production_logs;
CREATE POLICY "production_logs_select_department" ON public.production_logs
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "production_logs_insert_department" ON public.production_logs;
CREATE POLICY "production_logs_insert_department" ON public.production_logs
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "production_logs_update_department" ON public.production_logs;
CREATE POLICY "production_logs_update_department" ON public.production_logs
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access((SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id))) OR (SELECT public.is_admin()) );


-- ============================================================================
-- 7. machine_operations RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "machine_operations_insert_department" ON public.machine_operations;
CREATE POLICY "machine_operations_insert_department" ON public.machine_operations
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "machine_operations_update_creator_or_supervisor" ON public.machine_operations;
CREATE POLICY "machine_operations_update_creator_or_supervisor" ON public.machine_operations
  FOR UPDATE TO authenticated
  USING ( created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) )
  WITH CHECK ( created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) );

-- ============================================================================
-- 8. delay_categories & report_templates RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "delay_categories_insert_admin" ON public.delay_categories;
CREATE POLICY "delay_categories_insert_admin" ON public.delay_categories
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "report_templates_insert_admin" ON public.report_templates;
CREATE POLICY "report_templates_insert_admin" ON public.report_templates
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "generated_reports_select_department" ON public.generated_reports;
CREATE POLICY "generated_reports_select_department" ON public.generated_reports
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

-- ============================================================================
-- 9. excavator_activity, dozer_rolls, hourly_loads RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "excavator_activity_insert_department" ON public.excavator_activity;
CREATE POLICY "excavator_activity_insert_department" ON public.excavator_activity
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "excavator_activity_update_department" ON public.excavator_activity;
CREATE POLICY "excavator_activity_update_department" ON public.excavator_activity
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "dozer_rolls_insert_department" ON public.dozer_rolls;
CREATE POLICY "dozer_rolls_insert_department" ON public.dozer_rolls
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "dozer_rolls_update_department" ON public.dozer_rolls;
CREATE POLICY "dozer_rolls_update_department" ON public.dozer_rolls
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "hourly_loads_insert_department" ON public.hourly_loads;
CREATE POLICY "hourly_loads_insert_department" ON public.hourly_loads
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "hourly_loads_update_department" ON public.hourly_loads;
CREATE POLICY "hourly_loads_update_department" ON public.hourly_loads
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

-- ============================================================================
-- 10. engineering_notes & operational_delays RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "engineering_notes_select_department" ON public.engineering_notes;
CREATE POLICY "engineering_notes_select_department" ON public.engineering_notes
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "engineering_notes_insert_department" ON public.engineering_notes;
CREATE POLICY "engineering_notes_insert_department" ON public.engineering_notes
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "engineering_notes_update_department" ON public.engineering_notes;
CREATE POLICY "engineering_notes_update_department" ON public.engineering_notes
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operational_delays_select_department" ON public.operational_delays_deprecated_20250115;
CREATE POLICY "operational_delays_select_department" ON public.operational_delays_deprecated_20250115
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operational_delays_insert_department" ON public.operational_delays_deprecated_20250115;
CREATE POLICY "operational_delays_insert_department" ON public.operational_delays_deprecated_20250115
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "operational_delays_update_department" ON public.operational_delays_deprecated_20250115;
CREATE POLICY "operational_delays_update_department" ON public.operational_delays_deprecated_20250115
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );


-- ============================================================================
-- 11. breakdowns RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "breakdowns_select_department" ON public.breakdowns;
CREATE POLICY "breakdowns_select_department" ON public.breakdowns
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_insert_department" ON public.breakdowns;
CREATE POLICY "breakdowns_insert_department" ON public.breakdowns
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_update_department" ON public.breakdowns;
CREATE POLICY "breakdowns_update_department" ON public.breakdowns
  FOR UPDATE TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "breakdowns_delete_admin" ON public.breakdowns;
CREATE POLICY "breakdowns_delete_admin" ON public.breakdowns
  FOR DELETE TO authenticated
  USING ( (SELECT public.is_admin()) );

-- ============================================================================
-- 12. safety_incidents & safety_incident_categories RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "safety_incident_categories_insert_admin" ON public.safety_incident_categories;
CREATE POLICY "safety_incident_categories_insert_admin" ON public.safety_incident_categories
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incident_categories_update_admin" ON public.safety_incident_categories;
CREATE POLICY "safety_incident_categories_update_admin" ON public.safety_incident_categories
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incidents_select_department" ON public.safety_incidents;
CREATE POLICY "safety_incidents_select_department" ON public.safety_incidents
  FOR SELECT TO authenticated
  USING ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incidents_insert_department" ON public.safety_incidents;
CREATE POLICY "safety_incidents_insert_department" ON public.safety_incidents
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.has_department_access(department_id)) OR (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "safety_incidents_update_creator_or_supervisor" ON public.safety_incidents;
CREATE POLICY "safety_incidents_update_creator_or_supervisor" ON public.safety_incidents
  FOR UPDATE TO authenticated
  USING ( reported_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) )
  WITH CHECK ( reported_by = (SELECT auth.uid()) OR (SELECT public.is_admin()) OR (SELECT public.has_department_access(department_id)) );

-- ============================================================================
-- 13. mine_blocks & excavator_dumper_assignments RLS Policies Optimization
-- ============================================================================
DROP POLICY IF EXISTS "mine_blocks_insert_admin_supervisor" ON public.mine_blocks;
CREATE POLICY "mine_blocks_insert_admin_supervisor" ON public.mine_blocks
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "mine_blocks_update_admin_supervisor" ON public.mine_blocks;
CREATE POLICY "mine_blocks_update_admin_supervisor" ON public.mine_blocks
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "mine_blocks_delete_admin_supervisor" ON public.mine_blocks;
CREATE POLICY "mine_blocks_delete_admin_supervisor" ON public.mine_blocks
  FOR DELETE TO authenticated
  USING ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_select_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_select_department" ON public.excavator_dumper_assignments
  FOR SELECT TO authenticated
  USING ( (SELECT public.is_admin()) OR (SELECT public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id))) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_insert_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_insert_department" ON public.excavator_dumper_assignments
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) OR (SELECT public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id))) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_update_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_update_department" ON public.excavator_dumper_assignments
  FOR UPDATE TO authenticated
  USING ( (SELECT public.is_admin()) OR (SELECT public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id))) )
  WITH CHECK ( (SELECT public.is_admin()) OR (SELECT public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id))) );

DROP POLICY IF EXISTS "excavator_dumper_assignments_delete_department" ON public.excavator_dumper_assignments;
CREATE POLICY "excavator_dumper_assignments_delete_department" ON public.excavator_dumper_assignments
  FOR DELETE TO authenticated
  USING ( (SELECT public.is_admin()) OR (SELECT public.has_department_access((SELECT department_id FROM public.excavator_activity WHERE id = excavator_activity_id))) );

-- ============================================================================
-- 14. memory_embeddings RLS Policies Optimization
-- ============================================================================
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
