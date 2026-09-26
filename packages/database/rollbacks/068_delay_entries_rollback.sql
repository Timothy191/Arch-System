-- ============================================
-- Migration Rollback: 068_delay_entries_table
-- Description: Rollback delay_entries table migration
--              This script safely reverts the delay tracking changes
--              and restores the old operational_delays table.
-- ============================================

-- ============================================
-- 1. Restore operational_delays table from deprecated backup
-- ============================================
ALTER TABLE IF EXISTS operational_delays_deprecated_20250115 RENAME TO operational_delays;

-- ============================================
-- 2. Drop new delay tracking tables and policies
-- ============================================
DROP TRIGGER IF EXISTS trigger_check_delay_hours_max_12_hours ON delay_entries;
DROP FUNCTION IF EXISTS check_delay_hours_max_12_hours();

DROP TABLE IF EXISTS delay_entries_archive;
DROP TABLE IF EXISTS delay_entries;

DROP TABLE IF EXISTS delay_categories;

-- ============================================
-- 3. Restore operational_delays_archive table
-- ============================================
-- If we had an archive table, we could restore it here
-- DROP TABLE IF EXISTS operational_delays_archive_deprecated_20250115;
-- ALTER TABLE IF EXISTS operational_delays_archive_deprecated_20250115 RENAME TO operational_delays_archive;

-- ============================================
-- 4. Update RLS policies on operational_delays (if they were changed)
-- ============================================
-- Re-enable RLS if it was disabled
ALTER TABLE operational_delays ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Clean up
-- ============================================
-- Remove any functions or triggers created for the new system
DROP FUNCTION IF EXISTS calculate_duration_hours() CASCADE;

-- ============================================
-- Verification Queries
-- ============================================

-- Verify operational_delays table is restored
SELECT COUNT(*) as operational_delays_count FROM operational_delays;

-- Verify delay tracking tables are removed
SELECT COUNT(*) as delay_entries_should_be_0 FROM information_schema.tables WHERE table_name = 'delay_entries';
SELECT COUNT(*) as delay_categories_should_be_0 FROM information_schema.tables WHERE table_name = 'delay_categories';

-- Verify data integrity
SELECT COUNT(*) as data_restored FROM operational_delays WHERE deleted_at IS NULL;
