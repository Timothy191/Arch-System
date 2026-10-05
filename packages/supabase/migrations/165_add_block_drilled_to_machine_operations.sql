-- ============================================
-- Migration: 165_add_block_drilled_to_machine_operations
-- Description: Add block_drilled to machine_operations for End SMR Control Room integration
-- ============================================

ALTER TABLE machine_operations
  ADD COLUMN IF NOT EXISTS block_drilled TEXT;

COMMENT ON COLUMN machine_operations.block_drilled IS 'Block/area drilled (if Drill Rig)';

-- Re-create sync_to_drill_operations to include block_drilled
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
      block_drilled,
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
      NEW.block_drilled,
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
      block_drilled = EXCLUDED.block_drilled,
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
