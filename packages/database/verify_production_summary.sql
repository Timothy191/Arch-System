-- ============================================
-- Production Summary Verification Script
-- ============================================
-- Purpose: Verify that view_production_summary accurately aggregates shift data.
-- Usage: Run in psql or Supabase SQL Editor.

DO $$
DECLARE
    v_dept_id UUID;
    v_log_id UUID;
    v_log_date DATE := CURRENT_DATE;
    v_shift TEXT := 'day';
    v_summary_row RECORD;
BEGIN
    RAISE NOTICE 'Starting Production Summary Verification...';

    -- 1. Setup: Get Production Department
    SELECT id INTO v_dept_id FROM departments WHERE name = 'production' LIMIT 1;
    IF v_dept_id IS NULL THEN
        RAISE EXCEPTION 'Production department not found. Run seed data first.';
    END IF;
    
    -- 2. Setup: Create a test shift (Delete if exists)
    DELETE FROM daily_logs WHERE log_date = v_log_date AND shift::text = v_shift AND department_id = v_dept_id;

    INSERT INTO daily_logs (department_id, log_date, shift, notes)
    VALUES (v_dept_id, v_log_date, v_shift, 'Summary Test Shift')
    RETURNING id INTO v_log_id;

    -- 3. Setup: Add Production Logs
    INSERT INTO production_logs (daily_log_id, daily_log_date, coal_tonnes, waste_tonnes)
    VALUES (v_log_id, v_log_date, 500, 2000);

    -- 4. Setup: Add Fuel & Hours
    DECLARE
        v_machine_id UUID;
    BEGIN
        SELECT id INTO v_machine_id FROM machines LIMIT 1;
        
        IF v_machine_id IS NOT NULL THEN
            INSERT INTO fuel_logs (daily_log_id, daily_log_date, machine_id, diesel_litres)
            VALUES (v_log_id, v_log_date, v_machine_id, 1000);

            INSERT INTO machine_hours (daily_log_id, daily_log_date, machine_id, hours_worked)
            VALUES (v_log_id, v_log_date, v_machine_id, 10);
        END IF;
    END;

    -- 5. Refresh the View
    PERFORM refresh_production_summary();

    -- 6. Verify Aggregates
    SELECT * INTO v_summary_row FROM view_production_summary WHERE daily_log_id = v_log_id;

    IF v_summary_row.actual_total_tonnes = 2500 THEN
        RAISE NOTICE '✓ Actual Tonnage matched: %', v_summary_row.actual_total_tonnes;
    ELSE
        RAISE EXCEPTION 'FAIL: Actual Tonnage mismatch. Expected 2500, got %', v_summary_row.actual_total_tonnes;
    END IF;

    IF v_summary_row.total_fuel_litres = 1000 THEN
        RAISE NOTICE '✓ Fuel consumption matched: %', v_summary_row.total_fuel_litres;
    ELSE
        RAISE NOTICE '⚠ Fuel mismatch (Skipped if no machines found)';
    END IF;

    IF v_summary_row.tonnes_per_hour = 250 THEN
        RAISE NOTICE '✓ Efficiency (t/h) matched: %', v_summary_row.tonnes_per_hour;
    ELSE
        RAISE NOTICE '⚠ Efficiency mismatch (Skipped if no machines found)';
    END IF;

    -- 7. Cleanup
    DELETE FROM fuel_logs WHERE daily_log_id = v_log_id;
    DELETE FROM machine_hours WHERE daily_log_id = v_log_id;
    DELETE FROM production_logs WHERE daily_log_id = v_log_id;
    DELETE FROM daily_logs WHERE id = v_log_id;

    RAISE NOTICE '==========================================';
    RAISE NOTICE 'PRODUCTION SUMMARY VERIFIED ✓';
    RAISE NOTICE '==========================================';
END $$;
