-- ============================================
-- Migration: 149_machine_operations_smr_and_drilling
-- Description: Add drill-specific fields to machine_operations,
--              transition to SMR values (hours), and synchronize to drill_operations.
-- ============================================

-- Drop the dependent view first to avoid SQLSTATE 2BP01 dependency block
DROP VIEW IF EXISTS machine_operations_with_delays CASCADE;

-- 2. Drop hours_worked dependent column and constraints on machine_operations
ALTER TABLE machine_operations
  DROP COLUMN IF EXISTS hours_worked;

-- 3. Modify columns in machine_operations
ALTER TABLE machine_operations
  ADD COLUMN IF NOT EXISTS holes_drilled INTEGER,
  ADD COLUMN IF NOT EXISTS meters_drilled NUMERIC(10,2);

-- 4. Re-add hours_worked computed column based on SMR values
ALTER TABLE machine_operations
  ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN end_smu IS NOT NULL THEN end_smu - start_smu
      ELSE NULL
    END
  ) STORED;

-- 5. Keep legacy time columns for historical reporting and make new SMR values
-- optional for legacy rows while application validation requires them for new work.
-- AGENT-TRACE: Retaining time columns prevents irreversible loss for pre-SMU history.
CREATE UNIQUE INDEX IF NOT EXISTS machine_operations_machine_shift_start_smu_key
  ON machine_operations (machine_id, shift_date, shift_type, start_smu)
  WHERE start_smu IS NOT NULL;

COMMENT ON COLUMN machine_operations.holes_drilled IS 'Number of holes drilled (if Drill Rig)';
COMMENT ON COLUMN machine_operations.meters_drilled IS 'Meters drilled (if Drill Rig)';

-- Preserve delay-window validation while legacy operation times remain available.
CREATE OR REPLACE FUNCTION validate_delay_entry_time()
RETURNS TRIGGER AS $$
DECLARE
  mo_start TIMESTAMPTZ;
  mo_end TIMESTAMPTZ;
BEGIN
  IF NEW.delay_end_time IS NOT NULL THEN
    SELECT mo.shift_date::date + mo.start_time,
           COALESCE(
             mo.shift_date::date + mo.end_time,
             mo.shift_date::date + mo.start_time + INTERVAL '12 hours'
           )
    INTO mo_start, mo_end
    FROM machine_operations mo
    WHERE mo.id = NEW.machine_operation_id;

    IF mo_start IS NOT NULL
       AND (NEW.delay_start_time < mo_start OR NEW.delay_end_time > mo_end) THEN
      RAISE EXCEPTION 'Delay times must be within the operation''s time window';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_delay_entry_time ON delay_entries;
CREATE TRIGGER trigger_validate_delay_entry_time
  BEFORE INSERT OR UPDATE ON delay_entries
  FOR EACH ROW EXECUTE FUNCTION validate_delay_entry_time();

-- Recreate the dependent view
CREATE OR REPLACE VIEW machine_operations_with_delays AS
SELECT
  mo.*,
  (
    SELECT COALESCE(SUM(de.duration_hours), 0)
    FROM delay_entries de
    WHERE de.machine_operation_id = mo.id
      AND de.status = 'committed'
  ) AS total_delay_hours,
  (
    SELECT COUNT(*)
    FROM delay_entries de
    WHERE de.machine_operation_id = mo.id
      AND de.status = 'committed'
  ) AS delay_entry_count,
  (
    SELECT json_agg(
      json_build_object(
        'category', dc.name,
        'hours', de.duration_hours,
        'start_time', de.delay_start_time,
        'end_time', de.delay_end_time
      )
    )
    FROM delay_entries de
    JOIN delay_categories dc ON de.delay_category_id = dc.id
    WHERE de.machine_operation_id = mo.id
      AND de.status = 'committed'
  ) AS delay_breakdown
FROM machine_operations mo;

COMMENT ON VIEW machine_operations_with_delays IS 'Machine operations with delay summary for reporting and OEE calculations';

-- 6. Create function to sync to drill_operations
CREATE OR REPLACE FUNCTION sync_to_drill_operations()
RETURNS TRIGGER AS $$
DECLARE
  v_machine_type TEXT;
  v_drilling_dept_id UUID;
  v_operator_name TEXT;
  v_site_name TEXT;
  v_status TEXT;

  v_ext_delays NUMERIC := 0;
  v_prod_delays NUMERIC := 0;
  v_eng_delays NUMERIC := 0;
BEGIN
  -- Get machine type
  SELECT machine_type INTO v_machine_type FROM machines WHERE id = NEW.machine_id;

  -- Only sync if it's a Drill Rig
  IF v_machine_type = 'Drill Rig' THEN
    -- Get drilling department ID
    SELECT id INTO v_drilling_dept_id FROM departments WHERE name = 'drilling';

    IF v_drilling_dept_id IS NULL THEN
      RETURN NEW; -- Safety check
    END IF;

    -- Lookups for operator and site
    IF NEW.operator_id IS NOT NULL THEN
      SELECT full_name INTO v_operator_name FROM operators WHERE id = NEW.operator_id;
    END IF;

    IF NEW.site_id IS NOT NULL THEN
      SELECT name INTO v_site_name FROM sites WHERE id = NEW.site_id;
    END IF;

    -- Determine status
    IF NEW.end_smu IS NULL THEN
      v_status := 'active';
    ELSE
      v_status := 'completed';
    END IF;

    -- Calculate delays from delay_entries for this operation
    SELECT
      COALESCE(SUM(CASE WHEN dc.name = 'External' THEN de.duration_hours * 60 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN dc.name = 'Production' THEN de.duration_hours * 60 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN dc.name = 'Engineering' THEN de.duration_hours * 60 ELSE 0 END), 0)
    INTO v_ext_delays, v_prod_delays, v_eng_delays
    FROM delay_entries de
    JOIN delay_categories dc ON de.delay_category_id = dc.id
    WHERE de.machine_operation_id = NEW.id
      AND de.deleted_at IS NULL;

    -- Upsert into drill_operations
    INSERT INTO drill_operations (
      department_id,
      machine_id,
      shift_type,
      operation_date,
      open_hours,
      close_hours,
      holes,
      meters_drilled,
      operator_name,
      site,
      status,
      non_productional_delays,
      production_delays,
      engineering_delays,
      notes
    ) VALUES (
      v_drilling_dept_id,
      NEW.machine_id,
      NEW.shift_type,
      NEW.shift_date,
      NEW.start_smu,
      NEW.end_smu,
      COALESCE(NEW.holes_drilled, 0),
      COALESCE(NEW.meters_drilled, 0),
      v_operator_name,
      v_site_name,
      v_status,
      v_ext_delays,
      v_prod_delays,
      v_eng_delays,
      'Auto-synced from Control Room'
    )
    ON CONFLICT (machine_id, operation_date)
    DO UPDATE SET
      shift_type = EXCLUDED.shift_type,
      open_hours = EXCLUDED.open_hours,
      close_hours = EXCLUDED.close_hours,
      holes = EXCLUDED.holes,
      meters_drilled = EXCLUDED.meters_drilled,
      operator_name = EXCLUDED.operator_name,
      site = EXCLUDED.site,
      status = EXCLUDED.status,
      non_productional_delays = EXCLUDED.non_productional_delays,
      production_delays = EXCLUDED.production_delays,
      engineering_delays = EXCLUDED.engineering_delays,
      notes = 'Auto-synced from Control Room';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_to_drill_operations ON machine_operations;
CREATE TRIGGER trigger_sync_to_drill_operations
  AFTER INSERT OR UPDATE ON machine_operations
  FOR EACH ROW EXECUTE FUNCTION sync_to_drill_operations();

-- 7. Create function to trigger sync when delay_entries change
CREATE OR REPLACE FUNCTION sync_delays_to_drill_operations()
RETURNS TRIGGER AS $$
DECLARE
  v_mo_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_mo_id := OLD.machine_operation_id;
  ELSE
    v_mo_id := NEW.machine_operation_id;
  END IF;

  UPDATE machine_operations
  SET updated_at = NOW()
  WHERE id = v_mo_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_delays_to_drill_operations ON delay_entries;
CREATE TRIGGER trigger_sync_delays_to_drill_operations
  AFTER INSERT OR UPDATE OR DELETE ON delay_entries
  FOR EACH ROW EXECUTE FUNCTION sync_delays_to_drill_operations();
