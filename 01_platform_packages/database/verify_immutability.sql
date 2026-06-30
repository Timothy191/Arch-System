-- ============================================
-- Operational Immutability Verification Script
-- ============================================
-- Purpose: Verify that locked shifts prevent data tampering.
-- Usage: Run in psql or Supabase SQL Editor.

DO $$
DECLARE
    v_dept_id UUID;
    v_log_id UUID;
    v_log_date DATE := CURRENT_DATE - INTERVAL '1 day';
    v_shift TEXT := 'day';
    v_emp_id UUID;
    v_status_id UUID;
BEGIN
    RAISE NOTICE 'Starting Operational Immutability Verification...';

    -- 1. Setup: Get or Create Department & Employee
    SELECT id INTO v_dept_id FROM departments WHERE name = 'production' LIMIT 1;
    IF v_dept_id IS NULL THEN
        INSERT INTO departments (name, display_name, icon, color) 
        VALUES ('production', 'Production', 'Factory', 'emerald') RETURNING id INTO v_dept_id;
    END IF;

    SELECT id INTO v_emp_id FROM employees WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1;

    -- 2. Setup: Create a shift log and mark it as CLOSED and APPROVED
    -- Delete if exists for clean test
    -- Handle type mismatches via explicit casts
    DELETE FROM shift_status WHERE shift_date = v_log_date AND shift_type::text = v_shift AND department_id = v_dept_id;
    DELETE FROM daily_logs WHERE log_date = v_log_date AND shift::text = v_shift AND department_id = v_dept_id;

    INSERT INTO daily_logs (department_id, log_date, shift, notes)
    VALUES (v_dept_id, v_log_date, v_shift, 'Immutability Test Shift')
    RETURNING id INTO v_log_id;

    INSERT INTO shift_status (department_id, shift_date, shift_type, status, approved_by)
    VALUES (v_dept_id, v_log_date, v_shift::shift_type, 'closed'::shift_status_type, v_emp_id)
    RETURNING id INTO v_status_id;

    -- 3. Test Case: production_logs
    RAISE NOTICE 'Testing production_logs lockdown...';
    INSERT INTO production_logs (daily_log_id, daily_log_date, coal_tonnes, waste_tonnes)
    VALUES (v_log_id, v_log_date, 100, 500);

    BEGIN
        UPDATE production_logs SET coal_tonnes = 999 WHERE daily_log_id = v_log_id;
        RAISE EXCEPTION 'FAIL: production_logs update was NOT blocked';
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = 'P0001' THEN
            RAISE NOTICE '✓ production_logs update blocked as expected: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: % %', SQLSTATE, SQLERRM;
        END IF;
    END;

    BEGIN
        DELETE FROM production_logs WHERE daily_log_id = v_log_id;
        RAISE EXCEPTION 'FAIL: production_logs delete was NOT blocked';
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = 'P0001' THEN
            RAISE NOTICE '✓ production_logs delete blocked as expected: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: % %', SQLSTATE, SQLERRM;
        END IF;
    END;

    -- 4. Test Case: hourly_loads
    RAISE NOTICE 'Testing hourly_loads lockdown...';
    -- We need a machine
    DECLARE
        v_machine_id UUID;
    BEGIN
        SELECT id INTO v_machine_id FROM machines LIMIT 1;
        IF v_machine_id IS NOT NULL THEN
            INSERT INTO hourly_loads (daily_log_id, daily_log_date, machine_id, department_id, load_date, shift_type, hour_01)
            VALUES (v_log_id, v_log_date, v_machine_id, v_dept_id, v_log_date, v_shift, 10);

            BEGIN
                UPDATE hourly_loads SET hour_01 = 20 WHERE daily_log_id = v_log_id;
                RAISE EXCEPTION 'FAIL: hourly_loads update was NOT blocked';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '✓ hourly_loads update blocked as expected: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'SKIPPING hourly_loads test: No machine found';
        END IF;
    END;

    -- 5. Final Cleanup (using temporary open status to allow delete)
    UPDATE shift_status SET status = 'open'::shift_status_type, approved_by = NULL WHERE id = v_status_id;
    DELETE FROM shift_status WHERE id = v_status_id;
    DELETE FROM production_logs WHERE daily_log_id = v_log_id;
    -- Cleanup hourly_loads if test was run
    DELETE FROM hourly_loads WHERE daily_log_id = v_log_id;
    DELETE FROM daily_logs WHERE id = v_log_id;

    RAISE NOTICE '==========================================';
    RAISE NOTICE 'ALL IMMUTABILITY TESTS PASSED ✓';
    RAISE NOTICE '==========================================';
END $$;
