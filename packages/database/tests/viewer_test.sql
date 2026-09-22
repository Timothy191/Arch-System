BEGIN;

DO $$
DECLARE
  v_viewer_auth UUID := gen_random_uuid();
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
  
  INSERT INTO auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at) 
  VALUES (v_viewer_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '123456', now(), now());

  INSERT INTO public.employees (auth_id, role, department_id, first_name, last_name, full_name, employee_code)
  VALUES (v_viewer_auth, 'viewer', v_dept_id, 'Test', 'View', 'Test View', 'V009');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub": "' || v_viewer_auth || '"}', true);
  
  RAISE NOTICE 'Before insert. uid: %, is_admin: %', auth.uid(), public.is_admin();

  INSERT INTO public.control_room_shift_reports (department_id, report_date, shift_type, operator_name)
  VALUES (v_dept_id, CURRENT_DATE, 'day', 'Viewer');
  
  RAISE EXCEPTION 'Viewer inserted successfully (BAD)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Viewer blocked successfully (GOOD)';
END
$$;
ROLLBACK;
