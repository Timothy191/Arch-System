-- Migration: 170_hourly_loads_split_segments.sql
-- Description: Adds start_hour, end_hour, and is_locked to hourly_loads to support mid-shift machine splits / lineup changes
-- and drops the unique constraint on (machine_id, load_date, shift_type) so multiple segments can be stored per machine per shift.

ALTER TABLE hourly_loads 
ADD COLUMN IF NOT EXISTS start_hour INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS end_hour INTEGER NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Drop unique constraint that prevented multiple segments per machine on same shift date
ALTER TABLE hourly_loads DROP CONSTRAINT IF EXISTS hourly_loads_machine_id_load_date_shift_type_key;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN 
    SELECT c.relname 
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname LIKE 'hourly_loads_%' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', p.relname, p.relname || '_machine_id_load_date_shift_type_key');
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_hourly_loads_machine_shift_date ON hourly_loads(machine_id, load_date, shift_type);

COMMENT ON COLUMN hourly_loads.start_hour IS '1-based starting hour index (1-12) for this shift segment';
COMMENT ON COLUMN hourly_loads.end_hour IS '1-based ending hour index (1-12) for this shift segment';
COMMENT ON COLUMN hourly_loads.is_locked IS 'Whether this segment is locked against further edits';
