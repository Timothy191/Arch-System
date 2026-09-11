-- =======================================================================
-- Control Room Database Setup Verification Queries (TODO Action Category 2)
-- Execute this script to verify the required setup.
-- =======================================================================

-- TASK-2.1: Verify control_room_operator role exists in database
SELECT name, created_at 
FROM roles 
WHERE name = 'control_room_operator';

-- TASK-2.2: Verify supervisor PINs are set
-- Check if all supervisors/admins have a PIN set
SELECT count(*) as total_supervisors_admins,
       sum(CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END) as with_pin_set
FROM employees 
WHERE role IN ('supervisor', 'admin');

-- TASK-2.3: Verify control room machine registration
-- Expected: DT-101, DT-102 with bin_factor ~40.5
SELECT m.name, m.machine_type, m.active, m.bin_factor, d.name as department_name
FROM machines m
JOIN departments d ON m.department_id = d.id
WHERE d.name = 'control-room' 
  AND m.name IN ('DT-101', 'DT-102');

-- TASK-2.4: Verify department configuration
-- Ensure control-room exists and has expected attributes
SELECT name, display_name, icon, personality
FROM departments
WHERE name = 'control-room';
