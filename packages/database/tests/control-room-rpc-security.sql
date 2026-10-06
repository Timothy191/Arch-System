-- Run against a disposable/local Supabase database after migrations 170 and 173:
-- supabase db query --local --file packages/database/tests/control-room-rpc-security.sql
BEGIN;

DO $test$
DECLARE
  v_auth_id uuid := gen_random_uuid();
  v_employee_id uuid;
  v_department_id uuid;
  v_other_department_id uuid;
  v_machine_id uuid;
  v_daily_log_id uuid;
  v_load_date date;
  v_shift text;
  v_source_load_id uuid;
  v_new_load public.hourly_loads;
  v_closeout_result jsonb;
  v_replay_result jsonb;
  v_idempotency_key text := 'test-' || gen_random_uuid()::text;
  v_request_hash text := repeat('a', 64);
BEGIN
  IF has_function_privilege(
    'anon',
    'public.atomic_shift_closeout(text,uuid,text,text,uuid,date,text,text,integer,integer,numeric,integer,text,jsonb,integer,integer,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon must not execute atomic_shift_closeout';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.atomic_shift_closeout(text,uuid,text,text,uuid,date,text,text,integer,integer,numeric,integer,text,jsonb,integer,integer,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must execute atomic_shift_closeout';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.atomic_split_hourly_load(uuid,uuid,date,text,integer,uuid,text,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.atomic_split_hourly_load(uuid,uuid,date,text,integer,uuid,text,uuid)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'service_role',
    'public.atomic_split_hourly_load(uuid,uuid,date,text,integer,uuid,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'atomic_split_hourly_load grants are not least-privilege';
  END IF;

  SELECT dl.department_id
    INTO v_department_id
    FROM public.daily_logs AS dl
    CROSS JOIN public.machines AS m
   WHERE m.active
     AND m.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.hourly_loads AS hl
        WHERE hl.department_id = dl.department_id
          AND hl.machine_id = m.id
          AND hl.load_date = dl.log_date
          AND hl.shift_type = dl.shift::text
          AND hl.start_hour >= 4
     )
   ORDER BY dl.log_date DESC, dl.department_id
   LIMIT 1;
  IF v_department_id IS NULL THEN
    RAISE EXCEPTION 'Test requires a daily log and an active machine';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_auth_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', v_auth_id::text || '@test.invalid',
    'test-only-password', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  );

  DELETE FROM public.employees WHERE auth_id = v_auth_id;
  INSERT INTO public.employees (
    auth_id, department_id, full_name, role, accessible_departments
  ) VALUES (
    v_auth_id, v_department_id, 'RPC Security Test', 'operator', ARRAY[v_department_id]
  )
  RETURNING id INTO v_employee_id;

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_auth_id::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.atomic_shift_closeout(
      p_idempotency_key => v_idempotency_key,
      p_user_id => gen_random_uuid(),
      p_route => '/api/control-room/shift-closeout',
      p_request_hash => v_request_hash,
      p_dept_id => v_department_id,
      p_date => CURRENT_DATE + 1000,
      p_shift => 'day',
      p_operator_name => 'RPC test',
      p_alarm_response_avg => 0,
      p_incident_ack_avg => 0,
      p_uptime_percent => 100,
      p_missed_count => 0,
      p_summary => NULL,
      p_checklist => '[]'::jsonb,
      p_completed_count => 0,
      p_total_count => 0,
      p_supervisor_signature => NULL,
      p_employee_id => v_employee_id
    );
    RAISE EXCEPTION 'Caller-supplied identity spoofing was accepted';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN NULL;
  END;

  SELECT d.id
    INTO v_other_department_id
    FROM public.departments AS d
   WHERE d.id <> v_department_id
   ORDER BY d.name
   LIMIT 1;

  IF v_other_department_id IS NOT NULL THEN
    BEGIN
      PERFORM public.atomic_shift_closeout(
        p_idempotency_key => v_idempotency_key,
        p_user_id => v_auth_id,
        p_route => '/api/control-room/shift-closeout',
        p_request_hash => v_request_hash,
        p_dept_id => v_other_department_id,
        p_date => CURRENT_DATE + 1000,
        p_shift => 'day',
        p_operator_name => 'RPC test',
        p_alarm_response_avg => 0,
        p_incident_ack_avg => 0,
        p_uptime_percent => 100,
        p_missed_count => 0,
        p_summary => NULL,
        p_checklist => '[]'::jsonb,
        p_completed_count => 0,
        p_total_count => 0,
        p_supervisor_signature => NULL,
        p_employee_id => v_employee_id
      );
      RAISE EXCEPTION 'Cross-department closeout was accepted';
    EXCEPTION
      WHEN SQLSTATE '42501' THEN NULL;
    END;
  END IF;

  v_closeout_result := public.atomic_shift_closeout(
    p_idempotency_key => v_idempotency_key,
    p_user_id => v_auth_id,
    p_route => '/api/control-room/shift-closeout',
    p_request_hash => v_request_hash,
    p_dept_id => v_department_id,
    p_date => CURRENT_DATE + 1000,
    p_shift => 'day',
    p_operator_name => 'RPC test',
    p_alarm_response_avg => 0,
    p_incident_ack_avg => 0,
    p_uptime_percent => 100,
    p_missed_count => 0,
    p_summary => NULL,
    p_checklist => '[]'::jsonb,
    p_completed_count => 0,
    p_total_count => 0,
    p_supervisor_signature => NULL,
    p_employee_id => v_employee_id
  );
  IF v_closeout_result->>'status' <> 'closed' THEN
    RAISE EXCEPTION 'Authorized closeout did not persist';
  END IF;

  v_replay_result := public.atomic_shift_closeout(
    p_idempotency_key => v_idempotency_key,
    p_user_id => v_auth_id,
    p_route => '/api/control-room/shift-closeout',
    p_request_hash => v_request_hash,
    p_dept_id => v_department_id,
    p_date => CURRENT_DATE + 1000,
    p_shift => 'day',
    p_operator_name => 'RPC test',
    p_alarm_response_avg => 0,
    p_incident_ack_avg => 0,
    p_uptime_percent => 100,
    p_missed_count => 0,
    p_summary => NULL,
    p_checklist => '[]'::jsonb,
    p_completed_count => 0,
    p_total_count => 0,
    p_supervisor_signature => NULL,
    p_employee_id => v_employee_id
  );
  IF v_replay_result->>'status' <> 'already_closed'
     OR v_replay_result#>>'{response,id}' IS DISTINCT FROM v_closeout_result->>'id' THEN
    RAISE EXCEPTION 'Same-hash retry did not replay the original closeout';
  END IF;

  BEGIN
    PERFORM public.atomic_shift_closeout(
      p_idempotency_key => v_idempotency_key,
      p_user_id => v_auth_id,
      p_route => '/api/control-room/shift-closeout',
      p_request_hash => repeat('b', 64),
      p_dept_id => v_department_id,
      p_date => CURRENT_DATE + 1000,
      p_shift => 'day',
      p_operator_name => 'RPC test',
      p_alarm_response_avg => 0,
      p_incident_ack_avg => 0,
      p_uptime_percent => 100,
      p_missed_count => 0,
      p_summary => NULL,
      p_checklist => '[]'::jsonb,
      p_completed_count => 0,
      p_total_count => 0,
      p_supervisor_signature => NULL,
      p_employee_id => v_employee_id
    );
    RAISE EXCEPTION 'Conflicting idempotency replay was accepted';
  EXCEPTION
    WHEN SQLSTATE '23505' THEN NULL;
  END;

  SELECT dl.id, dl.log_date, dl.shift::text, m.id
    INTO v_daily_log_id, v_load_date, v_shift, v_machine_id
    FROM public.daily_logs AS dl
    CROSS JOIN public.machines AS m
   WHERE dl.department_id = v_department_id
     AND m.active
     AND m.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.hourly_loads AS hl
        WHERE hl.department_id = dl.department_id
          AND hl.machine_id = m.id
          AND hl.load_date = dl.log_date
          AND hl.shift_type = dl.shift::text
          AND hl.start_hour >= 4
     )
   ORDER BY dl.log_date DESC, m.id
   LIMIT 1;

  IF v_daily_log_id IS NULL THEN
    RAISE EXCEPTION 'Test requires a daily log and active machine without a later split';
  END IF;

  INSERT INTO public.hourly_loads (
    department_id, machine_id, load_date, shift_type,
    daily_log_id, daily_log_date, start_hour, end_hour, is_locked, material_type
  ) VALUES (
    v_department_id, v_machine_id, v_load_date, v_shift,
    v_daily_log_id, v_load_date, 1, 12, false, 'Waste'
  )
  RETURNING id INTO v_source_load_id;

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'service_role')::text,
    true
  );

  SELECT split.*
    INTO v_new_load
    FROM public.atomic_split_hourly_load(
      v_department_id,
      v_machine_id,
      v_load_date,
      v_shift,
      4,
      NULL,
      'Coal',
      v_source_load_id
    ) AS split;

  IF v_new_load.id IS NULL
     OR v_new_load.start_hour <> 4
     OR v_new_load.daily_log_id <> v_daily_log_id THEN
    RAISE EXCEPTION 'Atomic split did not create the expected segment';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.hourly_loads
     WHERE id = v_source_load_id
       AND is_locked
       AND end_hour = 3
  ) THEN
    RAISE EXCEPTION 'Atomic split did not close the previous segment';
  END IF;

  BEGIN
    PERFORM 1
      FROM public.atomic_split_hourly_load(
        v_department_id,
        v_machine_id,
        v_load_date,
        v_shift,
        8,
        gen_random_uuid(),
        'Waste',
        v_new_load.id
      );
    RAISE EXCEPTION 'Invalid excavator unexpectedly allowed a split';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.hourly_loads
     WHERE id = v_new_load.id
       AND NOT is_locked
       AND end_hour = 12
  ) THEN
    RAISE EXCEPTION 'Failed insert left the prior segment partially locked';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{}'::text, true);
  BEGIN
    PERFORM public.atomic_shift_closeout(
      p_idempotency_key => 'test-unauthenticated',
      p_user_id => v_auth_id,
      p_route => '/api/control-room/shift-closeout',
      p_request_hash => v_request_hash,
      p_dept_id => v_department_id,
      p_date => CURRENT_DATE + 1001,
      p_shift => 'day',
      p_operator_name => 'RPC test',
      p_alarm_response_avg => 0,
      p_incident_ack_avg => 0,
      p_uptime_percent => 100,
      p_missed_count => 0,
      p_summary => NULL,
      p_checklist => '[]'::jsonb,
      p_completed_count => 0,
      p_total_count => 0,
      p_supervisor_signature => NULL,
      p_employee_id => v_employee_id
    );
    RAISE EXCEPTION 'Unauthenticated closeout was accepted';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN NULL;
  END;
END
$test$;

ROLLBACK;
