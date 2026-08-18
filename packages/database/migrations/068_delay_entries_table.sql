-- ============================================
-- Migration: 068_delay_entries_table
-- Description: Create delay_entries table for granular delay tracking
--              with one-to-many relationship to machine_operations.
--              Includes draft/committed workflow, audit trail, and
--              category mapping (External, Production, Engineering).
-- ============================================

-- ============================================
-- 1. Create delay_categories table for category management
-- ============================================
CREATE TABLE IF NOT EXISTS delay_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table already existed
ALTER TABLE delay_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE delay_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE delay_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Seed initial delay categories
INSERT INTO delay_categories (name, description) VALUES
  ('External', 'Delays caused by external factors beyond operational control'),
  ('Production', 'Delays related to production processes and operations'),
  ('Engineering', 'Delays caused by equipment breakdowns, maintenance, or engineering issues')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE delay_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delay_categories_select_all"
  ON delay_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "delay_categories_insert_admin"
  ON delay_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND e.role = 'admin'
    )
  );

-- ============================================
-- 2. Create delay_entries table
-- ============================================
CREATE TABLE IF NOT EXISTS delay_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_operation_id UUID NOT NULL REFERENCES machine_operations(id) ON DELETE CASCADE,
  delay_category_id UUID NOT NULL REFERENCES delay_categories(id) ON DELETE RESTRICT,
  delay_start_time TIMESTAMPTZ NOT NULL,
  delay_end_time TIMESTAMPTZ, -- AGENT-TRACE: Nullable for manual override cases
  duration_hours NUMERIC NOT NULL GENERATED ALWAYS AS (
    CASE 
      WHEN delay_end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (delay_end_time - delay_start_time)) / 3600.0
      ELSE 0 -- Will be updated by trigger for manual override
    END
  ) STORED,
  is_manual_override BOOLEAN NOT NULL DEFAULT false,
  manual_duration_hours NUMERIC, -- NULL unless is_manual_override = true
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed')),
  committed_at TIMESTAMPTZ,
  committed_by UUID REFERENCES employees(id),
  uncommitted_at TIMESTAMPTZ,
  uncommitted_by UUID REFERENCES employees(id),
  uncommit_reason TEXT,
  -- AGENT-TRACE: Soft delete support for audit trail and recovery
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES employees(id),
  deleted_reason TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure delay times are within the operation's time window (when end time is provided)
  CONSTRAINT delay_operation_time_alignment CHECK (
    delay_end_time IS NULL OR (
      delay_start_time >= (
        SELECT mo.shift_date::date + mo.start_time
        FROM machine_operations mo
        WHERE mo.id = machine_operation_id
      )
      AND delay_end_time <= COALESCE(
        (SELECT mo.shift_date::date + mo.end_time
         FROM machine_operations mo
         WHERE mo.id = machine_operation_id),
        (SELECT mo.shift_date::date + mo.start_time + INTERVAL '12 hours'
         FROM machine_operations mo
         WHERE mo.id = machine_operation_id)
      )
    )
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_delay_entries_machine_operation_id ON delay_entries(machine_operation_id);
CREATE INDEX IF NOT EXISTS idx_delay_entries_delay_category_id ON delay_entries(delay_category_id);
CREATE INDEX IF NOT EXISTS idx_delay_entries_status ON delay_entries(status);
CREATE INDEX IF NOT EXISTS idx_delay_entries_delay_start_time ON delay_entries(delay_start_time);
CREATE INDEX IF NOT EXISTS idx_delay_entries_delay_end_time ON delay_entries(delay_end_time);
-- AGENT-TRACE: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_delay_entries_deleted_at ON delay_entries(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 3. Add check constraint for 12-hour max per operation
-- ============================================
-- This is implemented as a trigger function since CHECK constraints
-- cannot reference aggregated data from other rows
CREATE OR REPLACE FUNCTION check_delay_hours_max_12_hours()
RETURNS TRIGGER AS $$
DECLARE
  total_hours NUMERIC;
BEGIN
  -- AGENT-TRACE: Only enforce 12-hour limit for non-manual-override entries
  -- Manual override allows exceptions with audit trail
  IF NEW.is_manual_override = true THEN
    RETURN NEW;
  END IF;

  -- Calculate total delay hours for this operation (excluding current row if updating)
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(SUM(duration_hours), 0) INTO total_hours
    FROM delay_entries
    WHERE machine_operation_id = NEW.machine_operation_id
      AND (is_manual_override = false OR is_manual_override IS NULL);
  ELSE -- UPDATE or DELETE
    SELECT COALESCE(SUM(duration_hours), 0) INTO total_hours
    FROM delay_entries
    WHERE machine_operation_id = NEW.machine_operation_id
      AND id != NEW.id
      AND (is_manual_override = false OR is_manual_override IS NULL);
  END IF;

  -- Add current row's duration
  total_hours := total_hours + NEW.duration_hours;

  -- Enforce 12-hour maximum
  IF total_hours > 12 THEN
    RAISE EXCEPTION 'Total delay hours for this operation cannot exceed 12 hours. Current total: %.2f hours. Use manual override for exceptions with supervisor approval.', total_hours;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_delay_hours_max_12_hours
  BEFORE INSERT OR UPDATE ON delay_entries
  FOR EACH ROW EXECUTE FUNCTION check_delay_hours_max_12_hours();

-- ============================================
-- 4. Row Level Security for delay_entries
-- ============================================
ALTER TABLE delay_entries ENABLE ROW LEVEL SECURITY;

-- Draft entries: operators in same department can view/edit
-- Committed entries: read-only for operators, supervisors can uncommit
-- AGENT-TRACE: Exclude soft-deleted records from SELECT
CREATE POLICY "delay_entries_select_department"
  ON delay_entries FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM machine_operations mo
      JOIN departments d ON mo.department_id = d.id
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.department_id = mo.department_id
          OR mo.department_id = ANY(e.accessible_departments)
        )
    )
  );

CREATE POLICY "delay_entries_insert_operator"
  ON delay_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM machine_operations mo
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
          OR (
            e.department_id = mo.department_id
            AND e.role IN ('operator', 'supervisor')
          )
        )
    )
    AND NEW.status = 'draft'
    AND NEW.deleted_at IS NULL
  );

CREATE POLICY "delay_entries_update_draft"
  ON delay_entries FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM machine_operations mo
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
          OR (
            e.department_id = mo.department_id
            AND e.role = 'operator'
          )
        )
    )
    AND OLD.status = 'draft'
    AND NEW.status = 'draft'
  );

CREATE POLICY "delay_entries_delete_draft"
  ON delay_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM machine_operations mo
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
          OR (
            e.department_id = mo.department_id
            AND e.role = 'operator'
          )
        )
    )
    AND OLD.status = 'draft'
  );

-- AGENT-TRACE: Policy for soft delete operations (supervisors and admins)
CREATE POLICY "delay_entries_soft_delete"
  ON delay_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.role = 'supervisor')
    )
    AND OLD.deleted_at IS NULL
  )
  WITH CHECK (
    NEW.deleted_at IS NOT NULL
    AND NEW.deleted_by IS NOT NULL
  );

-- Special policy for commit/uncommit operations (supervisors only)
CREATE POLICY "delay_entries_commit_supervisor"
  ON delay_entries FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM machine_operations mo
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
        )
    )
    AND OLD.status = 'draft'
    AND NEW.status = 'committed'
    AND NEW.committed_by = e.id
  );

CREATE POLICY "delay_entries_uncommit_supervisor"
  ON delay_entries FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM machine_operations mo
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries.machine_operation_id
        AND (
          e.role = 'admin'
          OR e.role = 'supervisor'
        )
    )
    AND OLD.status = 'committed'
    AND NEW.status = 'draft'
    AND NEW.uncommitted_by = e.id
    AND NEW.uncommit_reason IS NOT NULL
  );

-- ============================================
-- 5. Create delay_entries_archive table
-- ============================================
CREATE TABLE IF NOT EXISTS delay_entries_archive (
  LIKE delay_entries INCLUDING ALL
);

ALTER TABLE delay_entries_archive
  DROP CONSTRAINT IF EXISTS delay_entries_delay_operation_time_alignment;

ALTER TABLE delay_entries_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delay_entries_archive_select"
  ON delay_entries_archive FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM machine_operations_archive mo
      JOIN employees e ON e.auth_id = auth.uid()
      WHERE mo.id = delay_entries_archive.machine_operation_id
        AND public.has_department_access(mo.department_id)
    )
  );

-- ============================================
-- 6. Update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delay_entries_updated_at
  BEFORE UPDATE ON delay_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_delay_categories_updated_at
  BEFORE UPDATE ON delay_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Add helpful comments
-- ============================================
COMMENT ON TABLE delay_entries IS 'Granular delay tracking linked to machine operations with draft/committed workflow';
COMMENT ON TABLE delay_categories IS 'Categories for delay classification (External, Production, Engineering)';
COMMENT ON COLUMN delay_entries.status IS 'Workflow status: draft (editable by operators) or committed (read-only, supervisor uncommit)';
COMMENT ON COLUMN delay_entries.is_manual_override IS 'Flag indicating if duration was manually entered instead of calculated from start/end times';
COMMENT ON COLUMN delay_entries.uncommit_reason IS 'Required audit field when supervisor uncommits a delay entry';
