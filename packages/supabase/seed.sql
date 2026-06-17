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
BEGIN
  -- Resolve UUIDs from existing seed data
  SELECT id INTO control_room_id FROM departments WHERE name = 'control-room';
  SELECT id INTO gen_a_id FROM machines WHERE name = 'GEN-A' AND department_id = control_room_id;
  SELECT id INTO gen_b_id FROM machines WHERE name = 'GEN-B' AND department_id = control_room_id;
  SELECT id INTO admin_employee_id FROM employees WHERE full_name = 'System Administrator' LIMIT 1;

  -- ==========================================
  -- 1. Open shift for control-room, today's day shift
  -- ==========================================
  INSERT INTO shift_status (department_id, shift_date, shift_type, status, notes)
  VALUES (control_room_id, CURRENT_DATE, 'day', 'open', 'Auto-seeded dev shift — open for testing')
  ON CONFLICT (department_id, shift_date, shift_type) DO NOTHING;

  -- ==========================================
  -- 2. Sample hourly_loads for control room machines (day shift)
  -- ==========================================
  -- GEN-A loads for today's day shift
  INSERT INTO hourly_loads (department_id, machine_id, load_date, shift_type, material_type,
    hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
    hour_07, hour_08, hour_09, hour_10, hour_11, hour_12)
  VALUES (control_room_id, gen_a_id, CURRENT_DATE, 'day', 'Coal',
    120, 135, 110, 145, 130, 125,
    140, 150, 115, 130, 120, 105)
  ON CONFLICT (machine_id, load_date, shift_type) DO NOTHING;

  -- GEN-B loads for today's day shift
  INSERT INTO hourly_loads (department_id, machine_id, load_date, shift_type, material_type,
    hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
    hour_07, hour_08, hour_09, hour_10, hour_11, hour_12)
  VALUES (control_room_id, gen_b_id, CURRENT_DATE, 'day', 'Waste',
    90, 85, 105, 95, 110, 100,
    95, 80, 115, 90, 85, 75)
  ON CONFLICT (machine_id, load_date, shift_type) DO NOTHING;

  -- ==========================================
  -- 3. Ensure admin employee has PIN hash and employee_code
  -- ==========================================
  UPDATE employees
  SET
    employee_code = COALESCE(employee_code, 'ADMIN-001'),
    pin_hash = COALESCE(pin_hash, '$2b$10$2gnUS1ysKN0ClmCH2xf1Vuz4aWOYromWScRKDKhN.7yrEK58TZ0b.')
  WHERE id = admin_employee_id;

END $$;
