-- ============================================
-- Seed Data: Dev Environment
-- Idempotent — safe to run on db reset or restart
-- Uses relative dates so data stays fresh
-- ============================================

DO $$
DECLARE
  control_room_id UUID;
  gen_a_id UUID;
  gen_b_id UUID;
  admin_employee_id UUID;
  daily_log_uuid UUID;
BEGIN
  -- Resolve UUIDs from existing seed data
  SELECT id INTO control_room_id FROM departments WHERE name = 'control-room';
  
  -- Look up active fleet dump trucks/machines
  SELECT id INTO gen_a_id FROM machines WHERE name IN ('DT12', 'GEN-A') LIMIT 1;
  IF gen_a_id IS NULL THEN
    SELECT id INTO gen_a_id FROM machines LIMIT 1;
  END IF;

  SELECT id INTO gen_b_id FROM machines WHERE name IN ('DT13', 'GEN-B') LIMIT 1;
  IF gen_b_id IS NULL THEN
    SELECT id INTO gen_b_id FROM machines WHERE id != gen_a_id LIMIT 1;
  END IF;

  SELECT id INTO admin_employee_id FROM employees WHERE full_name = 'System Administrator' LIMIT 1;

  -- ==========================================
  -- 1. Open shift for control-room, today's day shift
  -- ==========================================
  IF control_room_id IS NOT NULL THEN
    INSERT INTO shift_status (department_id, shift_date, shift_type, status, notes)
    VALUES (control_room_id, CURRENT_DATE, 'day', 'open', 'Auto-seeded dev shift — open for testing')
    ON CONFLICT (department_id, shift_date, shift_type) DO NOTHING;
  END IF;

  -- Ensure daily log exists for today
  IF control_room_id IS NOT NULL THEN
    INSERT INTO daily_logs (department_id, log_date, shift)
    VALUES (control_room_id, CURRENT_DATE, 'day')
    ON CONFLICT (department_id, log_date, shift) DO NOTHING;

    SELECT id INTO daily_log_uuid FROM daily_logs 
    WHERE department_id = control_room_id AND log_date = CURRENT_DATE AND shift = 'day';
  END IF;

  -- ==========================================
  -- 2. Sample hourly_loads for control room machines (day shift)
  -- ==========================================
  IF control_room_id IS NOT NULL AND gen_a_id IS NOT NULL AND daily_log_uuid IS NOT NULL THEN
    INSERT INTO hourly_loads (department_id, machine_id, load_date, shift_type, material_type,
      daily_log_id, daily_log_date,
      hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
      hour_07, hour_08, hour_09, hour_10, hour_11, hour_12)
    VALUES (control_room_id, gen_a_id, CURRENT_DATE, 'day', 'Coal',
      daily_log_uuid, CURRENT_DATE,
      120, 135, 110, 145, 130, 125,
      140, 150, 115, 130, 120, 105)
    ON CONFLICT (machine_id, load_date, shift_type) DO NOTHING;
  END IF;

  IF control_room_id IS NOT NULL AND gen_b_id IS NOT NULL AND daily_log_uuid IS NOT NULL THEN
    INSERT INTO hourly_loads (department_id, machine_id, load_date, shift_type, material_type,
      daily_log_id, daily_log_date,
      hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
      hour_07, hour_08, hour_09, hour_10, hour_11, hour_12)
    VALUES (control_room_id, gen_b_id, CURRENT_DATE, 'day', 'Waste',
      daily_log_uuid, CURRENT_DATE,
      90, 85, 105, 95, 110, 100,
      95, 80, 115, 90, 85, 75)
    ON CONFLICT (machine_id, load_date, shift_type) DO NOTHING;
  END IF;
  -- ==========================================
  -- 3. Ensure admin employee has PIN hash and employee_code
  -- ==========================================
  IF admin_employee_id IS NOT NULL THEN
    UPDATE employees
    SET
      employee_code = COALESCE(employee_code, 'ADMIN-001'),
      pin_hash = COALESCE(pin_hash, '$2b$10$2gnUS1ysKN0ClmCH2xf1Vuz4aWOYromWScRKDKhN.7yrEK58TZ0b.')
    WHERE id = admin_employee_id;
  END IF;

END $$;

