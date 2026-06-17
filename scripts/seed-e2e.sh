#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Arch-Systems — E2E Seed Data Script
# Inserts test-friendly data into local Supabase.
# Idempotent — safe to run multiple times.
# ──────────────────────────────────────────────────────────
set -euo pipefail

DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo "  → Seeding E2E test data into local Supabase..."
echo "  → DB: $DB_URL"

pnpx supabase db execute --db-url "$DB_URL" <<'SQLEOF'
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

  -- Guard: bail if departments/machines not seeded yet
  IF control_room_id IS NULL THEN
    RAISE EXCEPTION 'Control-room department not found — run migrations + seed first';
  END IF;

  -- 1. Open shift for control-room, today's day shift
  INSERT INTO shift_status (department_id, shift_date, shift_type, status, notes)
  VALUES (control_room_id, CURRENT_DATE, 'day', 'open', 'E2E test shift — open for testing')
  ON CONFLICT (department_id, shift_date, shift_type) DO NOTHING;

  -- 2. Ensure admin employee has PIN hash set
  IF admin_employee_id IS NOT NULL THEN
    UPDATE employees
    SET
      employee_code = COALESCE(employee_code, 'ADMIN-E2E-001'),
      pin_hash = COALESCE(pin_hash, '$2b$10$2gnUS1ysKN0ClmCH2xf1Vuz4aWOYromWScRKDKhN.7yrEK58TZ0b.')
    WHERE id = admin_employee_id;
  END IF;

  -- 3. Sample hourly_loads for control room machines today's day shift
  IF gen_a_id IS NOT NULL THEN
    INSERT INTO hourly_loads (department_id, machine_id, load_date, shift_type, material_type,
      hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
      hour_07, hour_08, hour_09, hour_10, hour_11, hour_12)
    VALUES (control_room_id, gen_a_id, CURRENT_DATE, 'day', 'Coal',
      120, 135, 110, 145, 130, 125,
      140, 150, 115, 130, 120, 105)
    ON CONFLICT (machine_id, load_date, shift_type) DO NOTHING;
  END IF;

  IF gen_b_id IS NOT NULL THEN
    INSERT INTO hourly_loads (department_id, machine_id, load_date, shift_type, material_type,
      hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
      hour_07, hour_08, hour_09, hour_10, hour_11, hour_12)
    VALUES (control_room_id, gen_b_id, CURRENT_DATE, 'day', 'Waste',
      90, 85, 105, 95, 110, 100,
      95, 80, 115, 90, 85, 75)
    ON CONFLICT (machine_id, load_date, shift_type) DO NOTHING;
  END IF;

END $$;
SQLEOF

echo "  ✓ E2E seed data inserted successfully"
