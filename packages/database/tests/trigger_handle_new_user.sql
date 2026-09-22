-- Test that the handle_new_user trigger correctly defaults to 'operator' and creates an employee record

BEGIN;

DO $$
DECLARE
  v_test_auth UUID := gen_random_uuid();
  v_role text;
BEGIN
  -- Insert into auth.users WITH email so trigger succeeds and creates employee
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) 
  VALUES (v_test_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'triggertest@test', '123456', now(), now());

  -- Verify employee was created automatically with role 'operator'
  SELECT role INTO v_role FROM public.employees WHERE auth_id = v_test_auth;
  
  IF v_role = 'operator' THEN
    RAISE NOTICE 'PASS: Trigger correctly defaulted new user to operator role';
  ELSE
    RAISE EXCEPTION 'FAIL: Expected role operator, got %', v_role;
  END IF;

END
$$;

ROLLBACK;
