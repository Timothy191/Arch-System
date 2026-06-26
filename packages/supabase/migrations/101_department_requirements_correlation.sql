-- ============================================
-- Migration 095: Department Requirements Correlation
-- Aligns Supabase `departments` rows and lookup data with
-- apps/portal/lib/departments.ts + packages/utils/src/routes.ts
-- ============================================

-- 1. Upsert all hub-routed departments (9) plus admin
INSERT INTO departments (name, display_name, icon, description, color) VALUES
  ('drilling', 'Drilling', 'Drill', 'Drill rig operations & bit depth telemetry', 'blue'),
  ('production', 'Production', 'Factory', 'Coal yield, tonnage & extraction tracking', 'emerald'),
  ('access-control', 'Access Control', 'ShieldCheck', 'Site access, badging & security', 'blue'),
  ('access-card-actions', 'Access Card Actions', 'CreditCard', 'Manage printed badges, print cards & QR generation', 'blue'),
  ('engineering', 'Engineering', 'Wrench', 'Equipment specs, maintenance & CAD', 'violet'),
  ('control-room', 'Control Room', 'Monitor', 'SCADA systems & real-time monitoring', 'red'),
  ('safety', 'Safety', 'HardHat', 'Incident logs, compliance & inspections', 'blue'),
  ('training', 'Training', 'GraduationCap', 'LMS, certifications & competency tracking', 'cyan'),
  ('satellite-monitoring', 'Satellite Monitoring', 'Satellite', 'SAR/InSAR, hyperspectral & high-resolution imagery', 'indigo'),
  ('admin', 'Admin', 'ShieldCheck', 'Personnel management, shift oversight & quotas', 'violet')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  deleted_at = NULL;

-- 2. AI personalities (038 omitted access-card-actions and admin)
UPDATE departments SET personality =
'You are an Access Card Actions AI Assistant. Your domain is badge printing, QR code generation, card templates, and print queue management. Prioritize accurate personnel identification and secure card issuance. Be precise and procedure-focused.'
WHERE name = 'access-card-actions' AND (personality IS NULL OR personality = '');

UPDATE departments SET personality =
'You are a System Administration AI Assistant. Your domain is personnel management, fleet administration, department configuration, audit logs, and system-wide access control. Be authoritative, security-conscious, and thorough.'
WHERE name = 'admin' AND (personality IS NULL OR personality = '');

-- 3. Control-room delay_entries categories (External / Production / Engineering)
INSERT INTO delay_categories (name, color, icon, sort_order) VALUES
  ('External', '#6b7280', 'CloudRain', 10),
  ('Production', '#3b82f6', 'Factory', 11),
  ('Engineering', '#8b5cf6', 'Wrench', 12)
ON CONFLICT (name) DO UPDATE SET
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- 4. Safety lookup data (required by safety daily-log and SafetyDashboard)
INSERT INTO safety_severities (level, weight, color, sort_order) VALUES
  ('low', 1, '#3ecf8e', 1),
  ('medium', 2, '#007aff', 2),
  ('high', 3, '#ef4444', 3),
  ('critical', 4, '#dc2626', 4)
ON CONFLICT (level) DO UPDATE SET
  weight = EXCLUDED.weight,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

INSERT INTO safety_incident_categories (name, description, color, icon, sort_order) VALUES
  ('Slip, Trip, or Fall', 'Worker slip, trip, or fall events', '#007aff', 'AlertTriangle', 1),
  ('Equipment Contact', 'Contact with machinery or equipment', '#ef4444', 'Wrench', 2),
  ('Vehicle Incident', 'Vehicle-related safety events', '#007aff', 'Truck', 3),
  ('Hazardous Material', 'Chemical or material exposure', '#8b5cf6', 'FlaskConical', 4),
  ('Environmental', 'Environmental-related safety issues', '#10b981', 'TreePine', 5),
  ('Near Miss', 'Close-call event with no injury', '#3b82f6', 'Eye', 6),
  ('Other', 'Other safety incidents', '#898989', 'FileText', 99)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- 5. Grant access-card-actions to admin and access_control employees
DO $$
DECLARE
  card_actions_id UUID;
BEGIN
  SELECT id INTO card_actions_id FROM departments WHERE name = 'access-card-actions';
  IF card_actions_id IS NOT NULL THEN
    UPDATE employees
    SET accessible_departments = (
      SELECT array_agg(DISTINCT x)
      FROM unnest(COALESCE(accessible_departments, '{}'::uuid[]) || card_actions_id) AS x
    )
    WHERE role IN ('admin', 'access_control')
      AND NOT (COALESCE(accessible_departments, '{}'::uuid[]) @> ARRAY[card_actions_id]);
  END IF;
END $$;

-- 6. Ensure admin users can reach every active department
DO $$
DECLARE
  all_dept_ids UUID[];
BEGIN
  SELECT array_agg(id ORDER BY name) INTO all_dept_ids
  FROM departments
  WHERE deleted_at IS NULL;

  ALTER TABLE employees DISABLE TRIGGER enforce_employee_update_constraints_trigger;

  UPDATE employees
  SET accessible_departments = all_dept_ids
  WHERE role = 'admin';

  ALTER TABLE employees ENABLE TRIGGER enforce_employee_update_constraints_trigger;
END $$;

-- 7. Registry view: department → required tables (documentation + runtime checks)
CREATE OR REPLACE VIEW department_schema_requirements AS
SELECT * FROM (VALUES
  ('drilling',             ARRAY['departments','machines','drill_operations','machine_telemetry','daily_logs']),
  ('production',           ARRAY['departments','daily_logs','machine_hours','fuel_logs','production_logs','machines']),
  ('access-control',       ARRAY['departments','personnel','visitors','badges','access_logs','employees']),
  ('access-card-actions',  ARRAY['departments','personnel','badges','card_printers','card_templates','print_jobs','issued_cards']),
  ('engineering',          ARRAY['departments','breakdowns','machines','daily_logs']),
  ('control-room',         ARRAY['departments','machines','machine_operations','delay_entries','delay_categories','hourly_loads','excavator_activity','dozer_rolls','engineering_notes','shift_status','operators','sites']),
  ('safety',               ARRAY['departments','safety_incidents','safety_incident_categories','safety_severities','employees']),
  ('training',             ARRAY['departments']),
  ('satellite-monitoring', ARRAY['departments']),
  ('admin',                ARRAY['departments','employees','machines','sites','audit_logs'])
) AS t(department_slug, required_tables);

COMMENT ON VIEW department_schema_requirements IS
  'Maps each department slug to Supabase tables required by the portal UI. Used by verify_department_requirements.sql.';

-- 8. Validation function for CI / SQL editor
CREATE OR REPLACE FUNCTION check_department_requirements()
RETURNS TABLE(
  check_name TEXT,
  passed BOOLEAN,
  detail TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
  missing_slug TEXT;
  missing_table TEXT;
  dept_count INTEGER;
  cat_count INTEGER;
  sev_count INTEGER;
BEGIN
  -- All hub slugs present
  FOREACH missing_slug IN ARRAY ARRAY[
    'drilling','production','access-control','access-card-actions','engineering',
    'control-room','safety','training','satellite-monitoring','admin'
  ] LOOP
    SELECT COUNT(*) INTO dept_count FROM departments d WHERE d.name = missing_slug AND d.deleted_at IS NULL;
    check_name := 'department:' || missing_slug;
    passed := dept_count = 1;
    detail := CASE WHEN passed THEN 'exists' ELSE 'MISSING department row' END;
    RETURN NEXT;
  END LOOP;

  -- Required tables per department
  FOR req IN SELECT * FROM department_schema_requirements LOOP
    FOREACH missing_table IN ARRAY req.required_tables LOOP
      SELECT COUNT(*) INTO dept_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = missing_table;

      check_name := req.department_slug || ':table:' || missing_table;
      passed := dept_count = 1;
      detail := CASE WHEN passed THEN 'ok' ELSE 'MISSING table ' || missing_table END;
      RETURN NEXT;
    END LOOP;
  END LOOP;

  -- delay_entries workflow categories
  SELECT COUNT(*) INTO cat_count FROM delay_categories
  WHERE name IN ('External', 'Production', 'Engineering');
  check_name := 'delay_categories:control_room';
  passed := cat_count = 3;
  detail := cat_count || '/3 categories (External, Production, Engineering)';
  RETURN NEXT;

  -- safety lookups
  SELECT COUNT(*) INTO sev_count FROM safety_severities;
  check_name := 'safety_severities:seeded';
  passed := sev_count >= 4;
  detail := sev_count || ' severity levels';
  RETURN NEXT;

  SELECT COUNT(*) INTO sev_count FROM safety_incident_categories;
  check_name := 'safety_incident_categories:seeded';
  passed := sev_count >= 6;
  detail := sev_count || ' categories';
  RETURN NEXT;

  -- Admin accessible_departments covers all departments
  SELECT COUNT(*) INTO dept_count
  FROM employees e
  WHERE e.role = 'admin'
    AND e.accessible_departments @> (SELECT array_agg(id) FROM departments WHERE deleted_at IS NULL);

  check_name := 'admin:accessible_departments';
  passed := dept_count >= 1;
  detail := CASE WHEN passed THEN 'admin has all department UUIDs' ELSE 'admin missing department access' END;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION check_department_requirements IS
  'Returns pass/fail rows for department seed data and required table presence.';
