-- Migration 072: Partition production_logs
-- Objective: Align production_logs with the time-series partitioning strategy of daily_logs.
-- This enables partition pruning for tonnage reports and improves aggregation performance.

BEGIN;

-- 1. Rename existing table to legacy
ALTER TABLE production_logs RENAME TO production_logs_legacy;

-- 2. Create new partitioned table
-- PK must include the partition key
CREATE TABLE production_logs (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  daily_log_id UUID NOT NULL,
  daily_log_date DATE NOT NULL,
  coal_tonnes NUMERIC(12,2) NOT NULL DEFAULT 0,
  waste_tonnes NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),
  PRIMARY KEY (id, daily_log_date),
  CONSTRAINT fk_production_daily_log FOREIGN KEY (daily_log_id, daily_log_date) REFERENCES daily_logs(id, log_date) ON DELETE CASCADE
) PARTITION BY RANGE (daily_log_date);

-- 3. Enable RLS
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (re-establish from initial/refinement/lockdown)
CREATE POLICY "production_logs_select_access"
  ON production_logs FOR SELECT
  TO authenticated
  USING (public.has_department_access((SELECT department_id FROM daily_logs dl WHERE dl.id = production_logs.daily_log_id)));

CREATE POLICY "production_logs_insert_access"
  ON production_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_department_access((SELECT department_id FROM daily_logs dl WHERE dl.id = production_logs.daily_log_id)));

CREATE POLICY "production_logs_update_admin"
  ON production_logs FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "production_logs_delete_admin"
  ON production_logs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5. Create monthly partitions: 2025-01 through 2027-12
DO $$
DECLARE
  yr  INT;
  mo  INT;
  partition_start DATE;
  partition_end   DATE;
  partition_name  TEXT;
BEGIN
  FOR yr IN 2025..2027 LOOP
    FOR mo IN 1..12 LOOP
      partition_start := make_date(yr, mo, 1);
      partition_end   := partition_start + INTERVAL '1 month';
      partition_name  := format('production_logs_%s_%s', yr, lpad(mo::text, 2, '0'));

      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name AND n.nspname = 'public'
      ) THEN
        EXECUTE format(
          'CREATE TABLE %I PARTITION OF production_logs FOR VALUES FROM (%L) TO (%L)',
          partition_name, partition_start, partition_end
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 6. Migrate data from legacy
INSERT INTO production_logs (
  id, daily_log_id, daily_log_date, coal_tonnes, waste_tonnes,
  created_at, updated_at, created_by, updated_by
)
SELECT
  id, daily_log_id, daily_log_date, coal_tonnes, waste_tonnes,
  created_at, COALESCE(updated_at, created_at), created_by, updated_by
FROM production_logs_legacy;

-- 7. Re-establish Immutability Trigger
CREATE TRIGGER trg_immutable_production_logs
BEFORE UPDATE OR DELETE ON production_logs
FOR EACH ROW EXECUTE FUNCTION check_shift_immutable();

-- 8. Updated_at trigger
CREATE TRIGGER update_production_logs_updated_at
  BEFORE UPDATE ON production_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Composite Index for Performance
CREATE INDEX idx_production_logs_daily_log ON production_logs(daily_log_id, daily_log_date);

COMMIT;
