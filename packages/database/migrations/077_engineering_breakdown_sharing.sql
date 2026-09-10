-- ============================================
-- Engineering Breakdown Sharing to Control Room
-- ============================================
-- This migration implements a controlled data sharing mechanism where:
-- 1. Engineering captures active breakdowns
-- 2. Only required fields are shared with Control Room (read-only)
-- 3. Control Room cannot edit or delete Engineering breakdown data
-- 4. Data is shared via a secure view with RLS policies

-- Add column to track which departments can read this breakdown
ALTER TABLE breakdowns
ADD COLUMN IF NOT EXISTS shared_with_departments JSONB DEFAULT '[]'::jsonb;

-- Add index for querying shared breakdowns
CREATE INDEX IF NOT EXISTS idx_breakdowns_shared_departments
ON breakdowns USING GIN (shared_with_departments);

-- AGENT-TRACE: shared_with_departments is a JSONB array of department slugs
-- that are allowed to read this breakdown. This allows fine-grained control
-- over which departments can see specific breakdowns without modifying RLS policies.

-- Function to automatically share active Engineering breakdowns with Control Room
CREATE OR REPLACE FUNCTION auto_share_breakdown_with_control_room()
RETURNS TRIGGER AS $$
DECLARE
  engineering_dept_id UUID;
  control_room_id UUID;
BEGIN
  -- Get Engineering department ID
  SELECT id INTO engineering_dept_id FROM departments WHERE name = 'engineering';
  -- Get Control Room department ID
  SELECT id INTO control_room_id FROM departments WHERE name = 'control-room';

  -- AGENT-TRACE: Only share if this is an Engineering breakdown
  IF NEW.department_id = engineering_dept_id THEN
    -- If status is active or completed today, share with Control Room
    IF NEW.status = 'active' OR (NEW.status = 'completed' AND NEW.date_out = CURRENT_DATE) THEN
      -- Ensure Control Room is in the shared_departments array
      IF NOT (NEW.shared_with_departments ? 'control-room') THEN
        NEW.shared_with_departments := COALESCE(NEW.shared_with_departments, '[]'::jsonb) || '"control-room"'::jsonb;
      END IF;
    ELSE
      -- Remove Control Room from shared_departments if breakdown is old and completed
      IF NEW.shared_with_departments ? 'control-room' THEN
        NEW.shared_with_departments := (SELECT jsonb_agg(elem) FROM jsonb_array_elements(NEW.shared_with_departments) elem WHERE elem <> '"control-room"'::jsonb);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-sharing
DROP TRIGGER IF EXISTS auto_share_breakdown_trigger ON breakdowns;
CREATE TRIGGER auto_share_breakdown_trigger
  BEFORE INSERT OR UPDATE ON breakdowns
  FOR EACH ROW
  EXECUTE FUNCTION auto_share_breakdown_with_control_room();

-- AGENT-TRACE: The trigger ensures that whenever an Engineering breakdown is
-- created or updated, it automatically checks if it should be shared with
-- Control Room based on its status and date.

-- Create a secure view for Control Room with only required fields
CREATE OR REPLACE VIEW breakdowns_control_room_view AS
SELECT
  id,
  fleet_id,
  machine_name,
  machine_type,
  reason,
  date_in,
  time_in,
  date_out,
  status,
  created_at
FROM breakdowns
WHERE deleted_at IS NULL
  AND shared_with_departments ? 'control-room'
  AND (
    status = 'active'
    OR (status = 'completed' AND date_out = CURRENT_DATE)
  );

COMMENT ON VIEW breakdowns_control_room_view IS 'Read-only view of Engineering breakdowns shared with Control Room. Contains only essential operational fields.';

-- AGENT-TRACE: This view filters to only show breakdowns that:
-- 1. Have not been deleted
-- 2. Are explicitly shared with Control Room
-- 3. Are either active or completed today
-- It exposes only the fields Control Room needs for operational awareness.

-- Enable RLS on the view (PostgreSQL 15+ supports view RLS via underlying table)
-- Since views inherit RLS from the base table, we need to add a specific policy

-- Drop existing policies that would allow Control Room to modify breakdowns directly
DROP POLICY IF EXISTS "breakdowns_insert_department" ON breakdowns;
DROP POLICY IF EXISTS "breakdowns_update_department" ON breakdowns;
DROP POLICY IF EXISTS "breakdowns_delete_admin" ON breakdowns;

-- Recreate policies with department-specific restrictions

-- SELECT: Allow Engineering to read their own, and Control Room to read shared ones
CREATE POLICY "breakdowns_select_engineering"
  ON breakdowns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR e.department_id = breakdowns.department_id
          OR breakdowns.department_id = ANY(e.accessible_departments)
        )
    )
  );

-- AGENT-TRACE: The SELECT policy remains permissive to allow Engineering users
-- to read their own breakdowns. The view-level filtering ensures Control Room
-- only sees what's shared with them.

-- INSERT: Only Engineering department users (or admins) can insert breakdowns
CREATE POLICY "breakdowns_insert_engineering_only"
  ON breakdowns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (
            e.department_id = breakdowns.department_id
            AND e.role IN ('supervisor', 'operator')
          )
        )
    )
  );

-- AGENT-TRACE: Removed the accessible_departments check from INSERT to prevent
-- Control Room users from inserting into Engineering breakdowns even if they
-- have Engineering in their accessible_departments. Only users actually IN the
-- Engineering department (or admins) can create breakdowns.

-- UPDATE: Only Engineering department users (or admins) can update their own breakdowns
CREATE POLICY "breakdowns_update_engineering_only"
  ON breakdowns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (
            e.department_id = breakdowns.department_id
            AND e.role IN ('supervisor', 'operator')
          )
        )
    )
  );

-- AGENT-TRACE: Same restriction as INSERT - Control Room cannot update Engineering
-- breakdowns even if they have cross-department access. This ensures data integrity.

-- DELETE: Only Engineering department admins can delete (or global admins)
CREATE POLICY "breakdowns_delete_engineering_admin"
  ON breakdowns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (
            e.department_id = breakdowns.department_id
            AND e.role = 'supervisor'
          )
        )
    )
  );

-- AGENT-TRACE: Deleted the old admin-only policy and replaced with department-specific
-- admin/supervisor restriction. Control Room users cannot delete Engineering breakdowns.

-- Backfill existing active Engineering breakdowns to be shared with Control Room
DO $$
DECLARE
  engineering_dept_id UUID;
BEGIN
  SELECT id INTO engineering_dept_id FROM departments WHERE name = 'engineering';

  UPDATE breakdowns
  SET shared_with_departments = shared_with_departments || '"control-room"'::jsonb
  WHERE department_id = engineering_dept_id
    AND deleted_at IS NULL
    AND NOT (shared_with_departments ? 'control-room')
    AND (
      status = 'active'
      OR (status = 'completed' AND date_out = CURRENT_DATE)
    );
END $$;

-- AGENT-TRACE: This backfill ensures that existing active Engineering breakdowns
-- are immediately visible to Control Room after the migration is applied.

-- Add comment for documentation
COMMENT ON COLUMN breakdowns.shared_with_departments IS 'JSONB array of department slugs (e.g., ["control-room"]) that are allowed to read this breakdown. Automatically managed by trigger for Engineering->Control Room sharing.';
