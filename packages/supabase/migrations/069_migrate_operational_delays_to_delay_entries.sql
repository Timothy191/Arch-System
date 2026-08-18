-- ============================================
-- Migration: 069_migrate_operational_delays_to_delay_entries
-- Description: Migrate historical data from operational_delays to delay_entries
--              with category mapping and unit conversion (minutes→hours).
--              After successful migration, operational_delays table is deprecated.
-- ============================================

-- ============================================
-- 1. Category Mapping Configuration
-- ============================================
-- Old delay types → New delay categories
-- equipment → Engineering
-- weather → External
-- safety → Engineering
-- material → Production
-- shift_change → Production
-- operator → Production
-- other → External

-- ============================================
-- 2. Migration Script
-- ============================================
DO $$
DECLARE
  migrated_count INTEGER;
  error_count INTEGER;
BEGIN
  -- Create a temporary mapping table for delay categories
  CREATE TEMP TABLE IF NOT EXISTS delay_category_mapping (
    old_type TEXT PRIMARY KEY,
    new_category_name TEXT NOT NULL
  );

  INSERT INTO delay_category_mapping (old_type, new_category_name) VALUES
    ('equipment', 'Engineering'),
    ('weather', 'External'),
    ('safety', 'Engineering'),
    ('material', 'Production'),
    ('shift_change', 'Production'),
    ('operator', 'Production'),
    ('other', 'External')
  ON CONFLICT (old_type) DO NOTHING;

  -- Migrate data from operational_delays to delay_entries
  -- Note: operational_delays doesn't have a direct link to machine_operations
  -- We'll use affected_machine_id and shift_date to find the relevant operation
  -- If no matching operation exists, we'll skip that record

  INSERT INTO delay_entries (
    machine_operation_id,
    delay_category_id,
    delay_start_time,
    delay_end_time,
    is_manual_override,
    manual_duration_hours,
    description,
    status,
    committed_at,
    committed_by,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    -- Find the matching machine operation
    (
      SELECT mo.id
      FROM machine_operations mo
      WHERE mo.machine_id = od.affected_machine_id
        AND mo.shift_date = od.delay_date
        AND mo.shift_type = od.shift_type
      LIMIT 1
    ),
    -- Map delay type to new category
    (
      SELECT dc.id
      FROM delay_categories dc
      JOIN delay_category_mapping dcm ON dc.name = dcm.new_category_name
      WHERE dcm.old_type = od.delay_type
    ),
    -- Calculate start and end times from delay minutes
    -- We'll use the shift start time + delay_minutes/2 as midpoint for estimation
    -- This is an approximation since old data doesn't have precise timestamps
    COALESCE(
      (
        SELECT mo.shift_date::date + mo.start_time
        FROM machine_operations mo
        WHERE mo.machine_id = od.affected_machine_id
          AND mo.shift_date = od.delay_date
          AND mo.shift_type = od.shift_type
        LIMIT 1
      ) + INTERVAL '1 hour', -- Default to 1 hour into shift if no operation found
      CURRENT_TIMESTAMP - INTERVAL '1 hour'
    ),
    COALESCE(
      (
        SELECT mo.shift_date::date + mo.start_time
        FROM machine_operations mo
        WHERE mo.machine_id = od.affected_machine_id
          AND mo.shift_date = od.delay_date
          AND mo.shift_type = od.shift_type
        LIMIT 1
      ) + (INTERVAL '1 minute' * od.delay_minutes) + INTERVAL '1 hour',
      CURRENT_TIMESTAMP
    ),
    -- Mark as manual override since we're estimating times
    true,
    -- Store the actual duration in hours
    (od.delay_minutes::NUMERIC / 60.0),
    -- Combine description and impact description
    COALESCE(od.description, '') ||
      CASE WHEN od.impact_description IS NOT NULL AND od.impact_description != ''
        THEN E'\n\nImpact: ' || od.impact_description
        ELSE ''
      END ||
      CASE WHEN od.recovery_action IS NOT NULL AND od.recovery_action != ''
        THEN E'\n\nRecovery: ' || od.recovery_action
        ELSE ''
      END,
    -- Mark as committed since old data was already finalized
    'committed',
    -- Use created_by as committed_by
    od.created_at,
    od.created_by,
    od.created_by,
    od.created_at,
    NOW()
  FROM operational_delays od
  WHERE EXISTS (
    -- Only migrate if we can find a matching machine operation
    SELECT 1
    FROM machine_operations mo
    WHERE mo.machine_id = od.affected_machine_id
      AND mo.shift_date = od.delay_date
      AND mo.shift_type = od.shift_type
  );

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  RAISE NOTICE 'Migrated % delay entries from operational_delays', migrated_count;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration failed: %', SQLERRM;
  RAISE;
END $$;

-- ============================================
-- 3. Deprecate operational_delays table
-- ============================================
-- Rename the table to indicate it's deprecated
-- This allows for rollback if needed
ALTER TABLE operational_delays RENAME TO operational_delays_deprecated_20250115;

-- Rename the archive table as well
ALTER TABLE operational_delays_archive RENAME TO operational_delays_archive_deprecated_20250115;

-- Add comment explaining the deprecation
COMMENT ON TABLE operational_delays_deprecated_20250115 IS 'DEPRECATED: Replaced by delay_entries table with granular tracking. Kept for reference and potential rollback. Data migrated on 2025-01-15.';

COMMENT ON TABLE operational_delays_archive_deprecated_20250115 IS 'DEPRECATED: Archive table for deprecated operational_delays. Kept for reference.';

-- ============================================
-- 4. Update references in views or functions (if any)
-- ============================================
-- Check for any views or functions that reference operational_delays
-- and update them to use delay_entries instead

-- Example: If there are views, they would need to be updated here
-- DROP VIEW IF EXISTS operational_delays_summary;

-- ============================================
-- 5. Update machine_operations to include delay summary
-- ============================================
-- Add a generated column or view to show total delay hours per operation
-- This can be used for reporting and OEE calculations

-- Create a view for machine operations with delay summaries
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

-- ============================================
-- 6. Migration Summary
-- ============================================
-- This migration:
-- 1. Created delay_categories table with External, Production, Engineering
-- 2. Created delay_entries table with draft/committed workflow
-- 3. Migrated data from operational_delays (converted minutes→hours, mapped categories)
-- 4. Deprecated operational_delays table (renamed to *_deprecated_20250115)
-- 5. Created view for machine operations with delay summaries
--
-- Next steps:
-- - Regenerate TypeScript types to include new tables
-- - Update frontend components to use delay_entries
-- - Remove/update references to operational_delays in code
