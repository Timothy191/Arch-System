-- ============================================
-- Migration: 217_composite_operational_shift_indexes
-- Description: Add composite B-tree indexes on high-traffic operational shift
--              tables (machine_operations, hourly_loads, dozer_rolls,
--              excavator_activity, daily_logs, engineering_notes) to eliminate
--              sequential/single-column index scans during department shift
--              dashboards and 30-day report aggregations.
-- ============================================

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_machine_operations_dept_date_shift
  ON public.machine_operations (department_id, shift_date DESC, shift_type);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_hourly_loads_dept_date_shift
  ON public.hourly_loads (department_id, load_date DESC, shift_type);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_dozer_rolls_dept_date_shift
  ON public.dozer_rolls (department_id, roll_date DESC, shift_type);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_excavator_activity_dept_date_shift
  ON public.excavator_activity (department_id, activity_date DESC, shift_type);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_daily_logs_dept_date_shift
  ON public.daily_logs (department_id, log_date DESC, shift);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_engineering_notes_dept_date_shift
  ON public.engineering_notes (department_id, note_date DESC, shift_type);
