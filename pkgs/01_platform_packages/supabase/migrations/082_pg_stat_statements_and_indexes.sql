-- Enable pg_stat_statements extension for slow query profiling
CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions;

-- Create missing indexes for top slow queries (specifically predictive maintenance and dashboard aggregations)
CREATE INDEX IF NOT EXISTS idx_breakdowns_machine_date ON public.breakdowns(machine_id, date_in) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_machines_active_deleted ON public.machines(active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_safety_incidents_status ON public.safety_incidents(status);
