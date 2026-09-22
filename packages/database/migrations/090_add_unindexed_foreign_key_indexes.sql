-- 095_add_unindexed_foreign_key_indexes.sql
-- Add covering indexes for foreign key constraints identified by Supabase Database Linter

-- AGENT-TRACE: Resolving unindexed_foreign_keys performance lint warnings by adding explicit B-tree indexes covering FK columns.

-- 1. breakdowns table
CREATE INDEX IF NOT EXISTS idx_breakdowns_completed_by ON public.breakdowns (completed_by);
CREATE INDEX IF NOT EXISTS idx_breakdowns_created_by ON public.breakdowns (created_by);

-- 2. employees table
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON public.employees (auth_id);

-- 3. excavator_activity table
CREATE INDEX IF NOT EXISTS idx_excavator_activity_block_mined_id ON public.excavator_activity (block_mined_id);

-- 4. fuel_logs table
CREATE INDEX IF NOT EXISTS idx_fuel_logs_daily_log_id ON public.fuel_logs (daily_log_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_machine_id ON public.fuel_logs (machine_id);

-- 5. generated_reports table
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_by ON public.generated_reports (generated_by);

-- 6. machine_hours table
CREATE INDEX IF NOT EXISTS idx_machine_hours_daily_log_id ON public.machine_hours (daily_log_id);
CREATE INDEX IF NOT EXISTS idx_machine_hours_machine_id ON public.machine_hours (machine_id);

-- 7. machine_operations table
CREATE INDEX IF NOT EXISTS idx_machine_operations_created_by ON public.machine_operations (created_by);

-- 8. production_logs table
CREATE INDEX IF NOT EXISTS idx_production_logs_daily_log_id ON public.production_logs (daily_log_id);

-- 9. safety_incidents table
CREATE INDEX IF NOT EXISTS idx_safety_incidents_reviewed_by ON public.safety_incidents (reviewed_by);

-- 10. user_feedback table
CREATE INDEX IF NOT EXISTS idx_user_feedback_assigned_to ON public.user_feedback (assigned_to);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback (user_id);
