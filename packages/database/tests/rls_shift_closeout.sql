BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.control_room_shift_reports TO authenticated;

-- Temporarily disable user-update trigger to allow test harness to provision test roles and departments
ALTER TABLE public.employees DISABLE TRIGGER enforce_employee_update_constraints_trigger;

DO $$
DECLARE
  v_dept_id UUID;
  v_other_dept UUID;

  -- Create test users
  v_admin_auth UUID := gen_random_uuid();
  v_admin_emp UUID;

  v_operator_auth UUID := gen_random_uuid();
  v_operator_emp UUID;

  v_viewer_auth UUID := gen_random_uuid();
  v_viewer_emp UUID;

BEGIN
  -- Get existing departments
  SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
  SELECT id INTO v_other_dept FROM public.departments WHERE id != v_dept_id LIMIT 1;

  -- Setup users properly for Supabase auth schema
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
    (v_admin_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test', '123456', now(), '{}', '{}', now(), now()),
    (v_operator_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op@test', '123456', now(), '{}', '{}', now(), now()),
    (v_viewer_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@test', '123456', now(), '{}', '{}', now(), now());

  -- Update the auto-created employee rows for test harness
  UPDATE public.employees
  SET role = 'admin', department_id = v_dept_id, first_name = 'Test', last_name = 'Admin', full_name = 'Test Admin'
  WHERE auth_id = v_admin_auth
  RETURNING id INTO v_admin_emp;

  UPDATE public.employees
  SET role = 'operator', department_id = v_dept_id, first_name = 'Test', last_name = 'Op', full_name = 'Test Op'
  WHERE auth_id = v_operator_auth
  RETURNING id INTO v_operator_emp;

  UPDATE public.employees
  SET role = 'viewer', department_id = v_dept_id, first_name = 'Test', last_name = 'View', full_name = 'Test View'
  WHERE auth_id = v_viewer_auth
  RETURNING id INTO v_viewer_emp;

  -- Test 1: Idempotency Keys Server-Only RLS
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub": "' || v_admin_auth || '"}', true);

  BEGIN
    INSERT INTO public.idempotency_keys (key, user_id, route, request_hash, response_json, status_code)
    VALUES ('test-key', v_admin_auth, '/test', 'hash', '{}', 200);
    RAISE EXCEPTION 'FAIL: Idempotency keys should block inserts from authenticated clients';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: idempotency_keys blocked authenticated client';
  END;

  -- Test 2: Shift Reports RLS (Viewer Blocked)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub": "' || v_viewer_auth || '"}', true);

  BEGIN
    INSERT INTO public.control_room_shift_reports (department_id, report_date, shift_type, operator_name, idempotency_key, created_by)
    VALUES (v_dept_id, CURRENT_DATE, 'day', 'Viewer', 'idem1', v_viewer_emp);
    RAISE EXCEPTION 'FAIL: Viewer was able to insert a shift report directly';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Viewer blocked from inserting shift report';
  END;

  -- Test 3: Shift Reports RLS (Operator Allowed)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub": "' || v_operator_auth || '"}', true);

  BEGIN
    INSERT INTO public.control_room_shift_reports (department_id, report_date, shift_type, operator_name, idempotency_key, created_by)
    VALUES (v_dept_id, CURRENT_DATE, 'day', 'Operator', 'idem2', v_operator_emp);
    RAISE NOTICE 'PASS: Operator successfully inserted a shift report directly';
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL: Operator failed to insert shift report: %', SQLERRM;
  END;

  -- Test 4: Shift Reports RLS (Cross-Dept Blocked)
  BEGIN
    INSERT INTO public.control_room_shift_reports (department_id, report_date, shift_type, operator_name, idempotency_key, created_by)
    VALUES (v_other_dept, CURRENT_DATE, 'night', 'Operator', 'idem3', v_operator_emp);
    RAISE EXCEPTION 'FAIL: Operator inserted shift report for different department';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Operator blocked from cross-dept shift insert';
  END;

END
$$;

ROLLBACK;
