-- ============================================
-- Migration Integrity Checks: 069_migrate_operational_delays_to_delay_entries
-- Description: Validation queries to ensure data migration integrity
--              Run these after migration to verify data correctness
-- ============================================

-- ============================================
-- 1. Check total delay hours migration integrity
-- ============================================

-- Calculate total delay hours in old operational_delays table (before migration)
SELECT 
  COUNT(*) as old_delay_count,
  COALESCE(SUM(CASE 
    WHEN delay_minutes IS NOT NULL THEN delay_minutes / 60.0 
    ELSE 0 
  END), 0) as old_total_delay_hours
FROM operational_delays_deprecated_20250115;

-- Calculate total delay hours in new delay_entries table (after migration)
SELECT 
  COUNT(*) as new_delay_count,
  COALESCE(SUM(duration_hours), 0) as new_total_delay_hours
FROM delay_entries
WHERE deleted_at IS NULL;

-- Compare totals - should match within acceptable tolerance
SELECT 
  old.total_hours as old_system_hours,
  new.total_hours as new_system_hours,
  ABS(old.total_hours - new.total_hours) as difference,
  CASE 
    WHEN ABS(old.total_hours - new.total_hours) < 0.1 THEN 'PASS'
    ELSE 'FAIL - Significant difference detected'
  END as integrity_check
FROM (
  SELECT COALESCE(SUM(CASE 
    WHEN delay_minutes IS NOT NULL THEN delay_minutes / 60.0 
    ELSE 0 
  END), 0) as total_hours
  FROM operational_delays_deprecated_20250115
) old,
(
  SELECT COALESCE(SUM(duration_hours), 0) as total_hours
  FROM delay_entries
  WHERE deleted_at IS NULL
) new;

-- ============================================
-- 2. Check category mapping integrity
-- ============================================

-- Verify category mapping was applied correctly
SELECT 
  CASE 
    WHEN old.delays IS NULL THEN 'No old data to compare'
    WHEN new.delays IS NULL THEN 'No new data - migration may have failed'
    WHEN old.delays = new.delays THEN 'PASS'
    ELSE 'FAIL - Category count mismatch'
  END as category_mapping_check
FROM (SELECT COUNT(*) as delays FROM operational_delays_deprecated_20250115 WHERE delay_category_id IS NOT NULL) old,
     (SELECT COUNT(*) as delays FROM delay_entries WHERE delay_category_id IS NOT NULL) new;

-- Category distribution comparison
SELECT 'OLD' as system, 
  CASE 
    WHEN description LIKE '%External%' OR description LIKE '%Weather%' OR description LIKE '%Supplier%' THEN 'External'
    WHEN description LIKE '%Production%' OR description LIKE '%Material%' OR description LIKE '%Process%' THEN 'Production'
    WHEN description LIKE '%Equipment%' OR description LIKE '%Maintenance%' OR description LIKE '%Engineering%' THEN 'Engineering'
    ELSE 'Other'
  END as mapped_category,
  COUNT(*) as count,
  COALESCE(SUM(delay_minutes) / 60.0, 0) as total_hours
FROM operational_delays_deprecated_20250115
GROUP BY 
  CASE 
    WHEN description LIKE '%External%' OR description LIKE '%Weather%' OR description LIKE '%Supplier%' THEN 'External'
    WHEN description LIKE '%Production%' OR description LIKE '%Material%' OR description LIKE '%Process%' THEN 'Production'
    WHEN description LIKE '%Equipment%' OR description LIKE '%Maintenance%' OR description LIKE '%Engineering%' THEN 'Engineering'
    ELSE 'Other'
  END

UNION ALL

SELECT 'NEW' as system,
  dc.name as mapped_category,
  COUNT(*) as count,
  COALESCE(SUM(de.duration_hours), 0) as total_hours
FROM delay_entries de
JOIN delay_categories dc ON de.delay_category_id = dc.id
WHERE de.deleted_at IS NULL
GROUP BY dc.name
ORDER BY system, mapped_category;

-- ============================================
-- 3. Check per-operation delay totals consistency
-- ============================================

-- Compare delay totals per machine operation
SELECT 
  mo.id as operation_id,
  mo.shift_date,
  old.total_hours as old_delay_hours,
  new.total_hours as new_delay_hours,
  ABS(old.total_hours - new.total_hours) as difference,
  CASE 
    WHEN ABS(old.total_hours - new.total_hours) < 0.1 THEN 'PASS'
    ELSE 'FAIL - Per-operation mismatch'
  END as integrity_check
FROM machine_operations mo
LEFT JOIN (
  SELECT mo.id as machine_operation_id, COALESCE(SUM(CASE 
    WHEN od.delay_minutes IS NOT NULL THEN od.delay_minutes / 60.0 
    ELSE 0 
  END), 0) as total_hours
  FROM operational_delays_deprecated_20250115 od
  JOIN machine_operations mo ON mo.machine_id = od.affected_machine_id
    AND mo.shift_date = od.delay_date
    AND mo.shift_type = od.shift_type
  GROUP BY mo.id
) old ON mo.id = old.machine_operation_id
LEFT JOIN (
  SELECT machine_operation_id, COALESCE(SUM(duration_hours), 0) as total_hours
  FROM delay_entries
  WHERE deleted_at IS NULL
  GROUP BY machine_operation_id
) new ON mo.id = new.machine_operation_id
WHERE old.total_hours IS NOT NULL OR new.total_hours IS NOT NULL
ORDER BY difference DESC;

-- ============================================
-- 4. Check for unmigrated records
-- ============================================

-- Records in old table that have no corresponding record in new table
SELECT 
  COUNT(*) as unmigrated_count,
  COALESCE(SUM(delay_minutes) / 60.0, 0) as unmigrated_hours
FROM operational_delays_deprecated_20250115 od
LEFT JOIN machine_operations mo ON mo.machine_id = od.affected_machine_id
  AND mo.shift_date = od.delay_date
  AND mo.shift_type = od.shift_type
LEFT JOIN delay_entries de ON de.machine_operation_id = mo.id AND de.description = od.description
WHERE de.id IS NULL;

-- ============================================
-- 5. Check for data type and constraint violations
-- ============================================

-- Check for any NULL required fields in new table
SELECT 
  'delay_entries' as table_name,
  COUNT(*) as null_machine_operations
FROM delay_entries
WHERE machine_operation_id IS NULL;

SELECT 
  'delay_entries' as table_name,
  COUNT(*) as null_categories
FROM delay_entries
WHERE delay_category_id IS NULL;

SELECT 
  'delay_entries' as table_name,
  COUNT(*) as null_start_times
FROM delay_entries
WHERE delay_start_time IS NULL;

SELECT 
  'delay_entries' as table_name,
  COUNT(*) as null_durations
FROM delay_entries
WHERE duration_hours IS NULL;

SELECT 
  'delay_entries' as table_name,
  COUNT(*) as negative_durations
FROM delay_entries
WHERE duration_hours < 0;

-- ============================================
-- 6. Audit trail verification
-- ============================================

-- Verify audit fields are populated for migrated data
SELECT 
  'created_by' as field,
  COUNT(*) as populated_count,
  COUNT(*) - COUNT(*) as null_count
FROM delay_entries
WHERE deleted_at IS NULL
UNION ALL
SELECT 
  'created_at' as field,
  COUNT(*) as populated_count,
  COUNT(*) - COUNT(*) as null_count
FROM delay_entries
WHERE deleted_at IS NULL
UNION ALL
SELECT 
  'status' as field,
  COUNT(*) as populated_count,
  COUNT(*) - COUNT(*) as null_count
FROM delay_entries
WHERE deleted_at IS NULL;

-- ============================================
-- 7. Final migration summary
-- ============================================

SELECT 
  'MIGRATION INTEGRITY SUMMARY' as report_type,
  (SELECT COUNT(*) FROM operational_delays_deprecated_20250115) as old_record_count,
  (SELECT COUNT(*) FROM delay_entries WHERE deleted_at IS NULL) as new_record_count,
  (SELECT COALESCE(SUM(CASE WHEN delay_minutes IS NOT NULL THEN delay_minutes / 60.0 ELSE 0 END), 0) FROM operational_delays_deprecated_20250115) as old_total_hours,
  (SELECT COALESCE(SUM(duration_hours), 0) FROM delay_entries WHERE deleted_at IS NULL) as new_total_hours,
  CASE 
    WHEN (SELECT COUNT(*) FROM operational_delays_deprecated_20250115) = 
         (SELECT COUNT(*) FROM delay_entries WHERE deleted_at IS NULL) 
    AND ABS((SELECT COALESCE(SUM(CASE WHEN delay_minutes IS NOT NULL THEN delay_minutes / 60.0 ELSE 0 END), 0) FROM operational_delays_deprecated_20250115) - 
            (SELECT COALESCE(SUM(duration_hours), 0) FROM delay_entries WHERE deleted_at IS NULL)) < 0.1
    THEN 'MIGRATION SUCCESSFUL'
    ELSE 'MIGRATION REQUIRES INVESTIGATION'
  END as overall_status;
