-- Migration: 170_hourly_loads_split_segments.sql
-- Description: Adds start_hour, end_hour, and is_locked to hourly_loads to support mid-shift machine splits / lineup changes
-- and drops the unique constraint on (machine_id, load_date, shift_type) so multiple segments can be stored per machine per shift.

ALTER TABLE hourly_loads 
ADD COLUMN IF NOT EXISTS start_hour INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS end_hour INTEGER NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Drop only locally-defined unique constraints. Partition constraints inherit
-- from the parent and PostgreSQL rejects dropping them directly from a child.
DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT relation.relname AS table_name, constraint_row.conname AS constraint_name
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_row.conrelid
      JOIN pg_catalog.pg_namespace AS relation_schema ON relation_schema.oid = relation.relnamespace
     WHERE relation_schema.nspname = 'public'
       AND (relation.relname = 'hourly_loads' OR relation.relname LIKE 'hourly_loads_%')
       AND constraint_row.contype = 'u'
       AND constraint_row.conparentid = 0
       AND constraint_row.conname LIKE '%machine_id_load_date_shift_type_key%'
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      'public',
      v_constraint.table_name,
      v_constraint.constraint_name
    );
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_hourly_loads_machine_shift_date ON hourly_loads(machine_id, load_date, shift_type);

COMMENT ON COLUMN hourly_loads.start_hour IS '1-based starting hour index (1-12) for this shift segment';
COMMENT ON COLUMN hourly_loads.end_hour IS '1-based ending hour index (1-12) for this shift segment';
COMMENT ON COLUMN hourly_loads.is_locked IS 'Whether this segment is locked against further edits';
