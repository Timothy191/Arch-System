-- Migration 071: Operational Immutability
-- Objective: Enforce database-level lockdown for operational data linked to approved shifts.
-- This migration fixes orphaned foreign keys and establishes a unified lockdown trigger.

BEGIN;

-- ============================================
-- PHASE 1: Strengthen Data Relationships
-- ============================================

-- 1.1 Fix broken/legacy FKs on production_logs, machine_hours, fuel_logs
-- These currently point to daily_logs_legacy or are logically broken by partitioning.

-- Add log_date to child tables (required for FK to partitioned parent PK)
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS daily_log_date DATE;
ALTER TABLE machine_hours   ADD COLUMN IF NOT EXISTS daily_log_date DATE;
ALTER TABLE fuel_logs      ADD COLUMN IF NOT EXISTS daily_log_date DATE;

-- Backfill daily_log_date from partitioned daily_logs
UPDATE production_logs pl SET daily_log_date = dl.log_date FROM daily_logs dl WHERE pl.daily_log_id = dl.id;
UPDATE machine_hours mh   SET daily_log_date = dl.log_date FROM daily_logs dl WHERE mh.daily_log_id = dl.id;
UPDATE fuel_logs fl       SET daily_log_date = dl.log_date FROM daily_logs dl WHERE fl.daily_log_id = dl.id;

-- Drop old FKs (which followed daily_logs_legacy) and add new ones to partitioned parent
-- NOTE: We must first find the constraint names. We'll use a DO block for safety if names vary, 
-- but usually they follow standard naming.
DO $$
BEGIN
    -- production_logs
    ALTER TABLE production_logs DROP CONSTRAINT IF EXISTS production_logs_daily_log_id_fkey;
    ALTER TABLE production_logs DROP CONSTRAINT IF EXISTS fk_production_daily_log;
    ALTER TABLE production_logs ADD CONSTRAINT fk_production_daily_log 
        FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;
    
    -- machine_hours
    ALTER TABLE machine_hours DROP CONSTRAINT IF EXISTS machine_hours_daily_log_id_fkey;
    ALTER TABLE machine_hours DROP CONSTRAINT IF EXISTS fk_machine_hours_daily_log;
    ALTER TABLE machine_hours ADD CONSTRAINT fk_machine_hours_daily_log 
        FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;

    -- fuel_logs
    ALTER TABLE fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_daily_log_id_fkey;
    ALTER TABLE fuel_logs DROP CONSTRAINT IF EXISTS fk_fuel_logs_daily_log;
    ALTER TABLE fuel_logs ADD CONSTRAINT fk_fuel_logs_daily_log 
        FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;
END $$;

-- 1.2 Add daily_log_id and daily_log_date to remaining tables
ALTER TABLE excavator_activity  ADD COLUMN IF NOT EXISTS daily_log_id UUID;
ALTER TABLE excavator_activity  ADD COLUMN IF NOT EXISTS daily_log_date DATE;
ALTER TABLE dozer_rolls         ADD COLUMN IF NOT EXISTS daily_log_id UUID;
ALTER TABLE dozer_rolls         ADD COLUMN IF NOT EXISTS daily_log_date DATE;
ALTER TABLE hourly_loads        ADD COLUMN IF NOT EXISTS daily_log_id UUID;
ALTER TABLE hourly_loads        ADD COLUMN IF NOT EXISTS daily_log_date DATE;
ALTER TABLE machine_operations  ADD COLUMN IF NOT EXISTS daily_log_id UUID;
ALTER TABLE machine_operations  ADD COLUMN IF NOT EXISTS daily_log_date DATE;

-- Backfill new columns using logical keys
UPDATE excavator_activity ea SET daily_log_id = dl.id, daily_log_date = dl.log_date 
  FROM daily_logs dl WHERE ea.department_id = dl.department_id AND ea.activity_date = dl.log_date AND ea.shift_type::text = dl.shift::text;

UPDATE dozer_rolls dr SET daily_log_id = dl.id, daily_log_date = dl.log_date 
  FROM daily_logs dl WHERE dr.department_id = dl.department_id AND dr.roll_date = dl.log_date AND dr.shift_type::text = dl.shift::text;

UPDATE hourly_loads hl SET daily_log_id = dl.id, daily_log_date = dl.log_date 
  FROM daily_logs dl WHERE hl.department_id = dl.department_id AND hl.load_date = dl.log_date AND hl.shift_type::text = dl.shift::text;

UPDATE machine_operations mo SET daily_log_id = dl.id, daily_log_date = dl.log_date 
  FROM daily_logs dl WHERE mo.department_id = dl.department_id AND mo.shift_date = dl.log_date AND mo.shift_type::text = dl.shift::text;

-- Add FKs and NOT NULL constraints
ALTER TABLE excavator_activity 
  ALTER COLUMN daily_log_id SET NOT NULL,
  ALTER COLUMN daily_log_date SET NOT NULL;
ALTER TABLE excavator_activity DROP CONSTRAINT IF EXISTS fk_excavator_daily_log;
ALTER TABLE excavator_activity ADD CONSTRAINT fk_excavator_daily_log FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;

ALTER TABLE dozer_rolls 
  ALTER COLUMN daily_log_id SET NOT NULL,
  ALTER COLUMN daily_log_date SET NOT NULL;
ALTER TABLE dozer_rolls DROP CONSTRAINT IF EXISTS fk_dozer_rolls_daily_log;
ALTER TABLE dozer_rolls ADD CONSTRAINT fk_dozer_rolls_daily_log FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;

ALTER TABLE hourly_loads 
  ALTER COLUMN daily_log_id SET NOT NULL,
  ALTER COLUMN daily_log_date SET NOT NULL;
ALTER TABLE hourly_loads DROP CONSTRAINT IF EXISTS fk_hourly_loads_daily_log;
ALTER TABLE hourly_loads ADD CONSTRAINT fk_hourly_loads_daily_log FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;

ALTER TABLE machine_operations 
  ALTER COLUMN daily_log_id SET NOT NULL,
  ALTER COLUMN daily_log_date SET NOT NULL;
ALTER TABLE machine_operations DROP CONSTRAINT IF EXISTS fk_machine_ops_daily_log;
ALTER TABLE machine_operations ADD CONSTRAINT fk_machine_ops_daily_log FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE;


-- ============================================
-- PHASE 2: Create Immutability Trigger Function
-- ============================================

CREATE OR REPLACE FUNCTION check_shift_immutable()
RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
    v_approved_by UUID;
    v_log_date DATE;
    v_shift TEXT;
BEGIN
    -- Find shift status using the linked daily_log
    SELECT ss.status, ss.approved_by, dl.log_date, dl.shift
    INTO v_status, v_approved_by, v_log_date, v_shift
    FROM daily_logs dl
    LEFT JOIN shift_status ss ON (
        ss.department_id = dl.department_id
        AND ss.shift_date = dl.log_date
        AND ss.shift_type::text = dl.shift::text
    )
    WHERE dl.id = OLD.daily_log_id;

    -- Block if shift is closed and approved
    IF v_status = 'closed' AND v_approved_by IS NOT NULL THEN
        RAISE EXCEPTION 'Operation denied: Shift % (%) is closed and approved. Data is immutable.',
            v_log_date, v_shift;
    END IF;

    -- For DELETE triggers, we must return OLD to proceed if not blocked
    -- For UPDATE triggers, we return NEW or OLD (doesn't matter as much before the block)
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- PHASE 3: Attach Triggers
-- ============================================

-- production_logs
DROP TRIGGER IF EXISTS trg_immutable_production_logs ON production_logs;
CREATE TRIGGER trg_immutable_production_logs
BEFORE UPDATE OR DELETE ON production_logs
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

-- excavator_activity
DROP TRIGGER IF EXISTS trg_immutable_excavator_activity ON excavator_activity;
CREATE TRIGGER trg_immutable_excavator_activity
BEFORE UPDATE OR DELETE ON excavator_activity
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

-- hourly_loads
DROP TRIGGER IF EXISTS trg_immutable_hourly_loads ON hourly_loads;
CREATE TRIGGER trg_immutable_hourly_loads
BEFORE UPDATE OR DELETE ON hourly_loads
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

-- machine_operations
DROP TRIGGER IF EXISTS trg_immutable_machine_operations ON machine_operations;
CREATE TRIGGER trg_immutable_machine_operations
BEFORE UPDATE OR DELETE ON machine_operations
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

-- machine_hours
DROP TRIGGER IF EXISTS trg_immutable_machine_hours ON machine_hours;
CREATE TRIGGER trg_immutable_machine_hours
BEFORE UPDATE OR DELETE ON machine_hours
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

-- fuel_logs
DROP TRIGGER IF EXISTS trg_immutable_fuel_logs ON fuel_logs;
CREATE TRIGGER trg_immutable_fuel_logs
BEFORE UPDATE OR DELETE ON fuel_logs
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

COMMIT;
