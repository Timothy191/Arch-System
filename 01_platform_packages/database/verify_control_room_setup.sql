-- ============================================
-- Control Room Database Verification Script
-- ============================================
-- Purpose: Verify database setup for Control Room production
-- Usage: Run this script in Supabase SQL Editor or via psql
-- Expected: All checks should return expected results
-- ============================================

-- ============================================
-- CHECK 1: Verify control_room_operator role exists
-- ============================================
DO $$
DECLARE
    role_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO role_count 
    FROM roles 
    WHERE name = 'control_room_operator';
    
    IF role_count = 0 THEN
        RAISE EXCEPTION 'CRITICAL: control_room_operator role does not exist. Please run: INSERT INTO roles (name) VALUES (''control_room_operator'');';
    ELSE
        RAISE NOTICE '✓ PASS: control_room_operator role exists (% records)', role_count;
    END IF;
END $$;

-- ============================================
-- CHECK 2: Verify employees have control_room_operator role assigned
-- ============================================
DO $$
DECLARE
    operator_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO operator_count
    FROM employees e
    WHERE e.role = 'control_room_operator' AND e.active = true;
    
    IF operator_count < 2 THEN
        RAISE EXCEPTION 'WARNING: Expected at least 2 active control room operators, found %', operator_count;
    ELSE
        RAISE NOTICE '✓ PASS: Active control room operators assigned (% operators)', operator_count;
    END IF;
END $$;

-- Show actual operator assignments
SELECT 
    e.full_name, 
    e.employee_code, 
    e.role, 
    e.active,
    CASE WHEN e.active = true THEN '✓' ELSE '✗' END as status
FROM employees e
WHERE e.role = 'control_room_operator' OR e.role = 'admin'
ORDER BY e.role, e.full_name;

-- ============================================
-- CHECK 3: Verify supervisors have PINs set
-- ============================================
DO $$
DECLARE
    supervisor_count INTEGER;
    pin_missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO supervisor_count
    FROM employees e
    WHERE e.role IN ('supervisor', 'admin') AND e.active = true;
    
    SELECT COUNT(*) INTO pin_missing_count
    FROM employees e
    WHERE e.role IN ('supervisor', 'admin') 
      AND e.active = true 
      AND (e.pin_hash IS NULL OR e.pin_hash = '');
    
    IF pin_missing_count > 0 THEN
        RAISE EXCEPTION 'CRITICAL: % supervisors/admins are missing PINs. PINs must be set for shift closeout approval.', pin_missing_count;
    ELSE
        RAISE NOTICE '✓ PASS: All active supervisors/admins have PINs set (% total)', supervisor_count;
    END IF;
END $$;

-- Show PIN status for all supervisors/admins
SELECT 
    e.full_name, 
    e.employee_code, 
    e.role,
    e.active,
    CASE 
        WHEN e.pin_hash IS NOT NULL AND e.pin_hash != '' THEN 'SET ✓'
        ELSE 'NOT SET ✗'
    END as pin_status
FROM employees e
WHERE e.role IN ('supervisor', 'admin')
ORDER BY e.role, e.full_name;

-- ============================================
-- CHECK 4: Verify control room machines are registered
-- ============================================
DO $$
DECLARE
    machine_count INTEGER;
    dumper_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO machine_count
    FROM machines m
    JOIN departments d ON m.department_id = d.id
    WHERE d.name = 'control-room' AND m.active = true;
    
    SELECT COUNT(*) INTO dumper_count
    FROM machines m
    JOIN departments d ON m.department_id = d.id
    WHERE d.name = 'control-room' 
      AND m.machine_type = 'Dump Truck' 
      AND m.active = true;
    
    IF machine_count = 0 THEN
        RAISE EXCEPTION 'CRITICAL: No active machines found for control-room department.';
    END IF;
    
    IF dumper_count < 2 THEN
        RAISE WARNING 'WARNING: Expected at least 2 dump trucks for hourly loads, found %', dumper_count;
    ELSE
        RAISE NOTICE '✓ PASS: Control room machines registered (% total, % dump trucks)', machine_count, dumper_count;
    END IF;
END $$;

-- Show machine registration details
SELECT 
    m.name, 
    m.machine_type, 
    m.active,
    m.bin_factor,
    s.name as site_name,
    m.serial_number,
    CASE 
        WHEN m.bin_factor BETWEEN 30 AND 50 THEN '✓ Reasonable'
        WHEN m.bin_factor IS NULL THEN '⚠ Missing'
        ELSE '⚠ Unusual'
    END as bin_factor_check
FROM machines m
LEFT JOIN sites s ON m.site_id = s.id
JOIN departments d ON m.department_id = d.id
WHERE d.name = 'control-room'
ORDER BY m.active DESC, m.name;

-- ============================================
-- CHECK 5: Verify department configuration
-- ============================================
DO $$
DECLARE
    dept_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dept_count
    FROM departments
    WHERE name = 'control-room';
    
    IF dept_count = 0 THEN
        RAISE EXCEPTION 'CRITICAL: control-room department does not exist.';
    ELSE
        RAISE NOTICE '✓ PASS: control-room department exists';
    END IF;
END $$;

-- Show department configuration
SELECT 
    d.id,
    d.name,
    d.type,
    d.description,
    d.active
FROM departments d
WHERE d.name = 'control-room';

-- ============================================
-- CHECK 6: Verify required tables exist
-- ============================================
DO $$
BEGIN
    -- Check machine_operations
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machine_operations') THEN
        RAISE EXCEPTION 'CRITICAL: machine_operations table does not exist';
    END IF;
    
    -- Check hourly_loads
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hourly_loads') THEN
        RAISE EXCEPTION 'CRITICAL: hourly_loads table does not exist';
    END IF;
    
    -- Check operational_delays
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operational_delays') THEN
        RAISE EXCEPTION 'CRITICAL: operational_delays table does not exist';
    END IF;
    
    -- Check shift_status
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shift_status') THEN
        RAISE EXCEPTION 'CRITICAL: shift_status table does not exist';
    END IF;
    
    -- Check dozer_rolls
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dozer_rolls') THEN
        RAISE EXCEPTION 'CRITICAL: dozer_rolls table does not exist';
    END IF;
    
    RAISE NOTICE '✓ PASS: All required control room tables exist';
END $$;

-- ============================================
-- CHECK 7: Verify archive tables exist
-- ============================================
DO $$
BEGIN
    -- Check machine_operations_archive
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machine_operations_archive') THEN
        RAISE WARNING 'WARNING: machine_operations_archive table does not exist. Run migration 046.';
    END IF;
    
    -- Check operational_delays_archive
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operational_delays_archive') THEN
        RAISE WARNING 'WARNING: operational_delays_archive table does not exist. Run migration 046.';
    END IF;
    
    RAISE NOTICE '✓ PASS: Archive tables checked';
END $$;

-- ============================================
-- CHECK 8: Verify archival function exists
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.routines 
        WHERE routine_name = 'archive_monthly_control_room_shifts'
    ) THEN
        RAISE WARNING 'WARNING: archive_monthly_control_room_shifts function does not exist. Run migration 046.';
    ELSE
        RAISE NOTICE '✓ PASS: Archival function exists';
    END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DATABASE VERIFICATION COMPLETE';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Please review all results above.';
    RAISE NOTICE 'Any CRITICAL exceptions must be resolved before production.';
    RAISE NOTICE 'WARNINGs should be reviewed and addressed if possible.';
END $$;
