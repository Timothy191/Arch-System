-- Secure shift closeout and make hourly-load segment splits transactional.

CREATE OR REPLACE FUNCTION public.atomic_shift_closeout(
  p_idempotency_key text,
  p_user_id uuid,
  p_route text,
  p_request_hash text,
  p_dept_id uuid,
  p_date date,
  p_shift text,
  p_operator_name text,
  p_alarm_response_avg int,
  p_incident_ack_avg int,
  p_uptime_percent numeric,
  p_missed_count int,
  p_summary text,
  p_checklist jsonb,
  p_completed_count int,
  p_total_count int,
  p_supervisor_signature text,
  p_employee_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_employee_id uuid;
  v_employee_role text;
  v_department_id uuid;
  v_accessible_departments uuid[];
  v_existing_hash text;
  v_response jsonb;
  v_report_id uuid;
  v_actual_completed_count integer;
BEGIN
  IF v_auth_id IS NULL OR p_user_id IS DISTINCT FROM v_auth_id THEN
    RAISE EXCEPTION 'Authentication identity mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT e.id, e.role, e.department_id, e.accessible_departments
    INTO v_employee_id, v_employee_role, v_department_id, v_accessible_departments
    FROM public.employees AS e
   WHERE e.auth_id = v_auth_id
     AND e.deleted_at IS NULL
   FOR SHARE;

  IF NOT FOUND
     OR p_employee_id IS DISTINCT FROM v_employee_id
     OR v_employee_role NOT IN ('admin', 'operator', 'supervisor') THEN
    RAISE EXCEPTION 'Employee is not authorized to close shifts'
      USING ERRCODE = '42501';
  END IF;

  IF v_employee_role <> 'admin'
     AND p_dept_id IS DISTINCT FROM v_department_id
     AND NOT (p_dept_id = ANY(COALESCE(v_accessible_departments, ARRAY[]::uuid[]))) THEN
    RAISE EXCEPTION 'Employee cannot close the requested department shift'
      USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL
     OR pg_catalog.length(p_idempotency_key) < 10
     OR p_route IS DISTINCT FROM '/api/control-room/shift-closeout'
     OR p_request_hash IS NULL
     OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_dept_id IS NULL
     OR p_date IS NULL
     OR p_shift IS NULL
     OR p_shift NOT IN ('day', 'night')
     OR p_operator_name IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_operator_name)) < 2
     OR p_alarm_response_avg IS NULL
     OR p_alarm_response_avg < 0
     OR p_incident_ack_avg IS NULL
     OR p_incident_ack_avg < 0
     OR p_uptime_percent IS NULL
     OR p_uptime_percent NOT BETWEEN 0 AND 100
     OR p_missed_count IS NULL
     OR p_missed_count < 0
     OR p_completed_count IS NULL
     OR p_completed_count < 0
     OR p_total_count IS NULL
     OR p_total_count < 0
     OR p_completed_count > p_total_count
     OR (p_supervisor_signature IS NOT NULL
         AND pg_catalog.length(pg_catalog.btrim(p_supervisor_signature)) < 2) THEN
    RAISE EXCEPTION 'Invalid shift closeout input'
      USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_typeof(p_checklist) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid shift closeout checklist'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_checklist) AS item(value)
     WHERE pg_catalog.jsonb_typeof(item.value) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(item.value->'id') IS DISTINCT FROM 'string'
        OR pg_catalog.jsonb_typeof(item.value->'label') IS DISTINCT FROM 'string'
        OR item.value->>'status' NOT IN ('pending', 'completed', 'failed', 'n_a')
        OR (item.value ? 'notes'
            AND pg_catalog.jsonb_typeof(item.value->'notes') IS DISTINCT FROM 'string')
  ) THEN
    RAISE EXCEPTION 'Invalid shift closeout checklist item'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*) FILTER (WHERE item.value->>'status' = 'completed')
    INTO v_actual_completed_count
    FROM pg_catalog.jsonb_array_elements(p_checklist) AS item(value);

  IF pg_catalog.jsonb_array_length(p_checklist) <> p_total_count
     OR v_actual_completed_count <> p_completed_count THEN
    RAISE EXCEPTION 'Shift closeout checklist counts do not match'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_auth_id::text || ':' || p_route || ':' || p_idempotency_key,
      0
    )
  );

  SELECT ik.request_hash, ik.response_json
    INTO v_existing_hash, v_response
    FROM public.idempotency_keys AS ik
   WHERE ik.key = p_idempotency_key
     AND ik.user_id = v_auth_id
     AND ik.route = p_route
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing_hash = p_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('status', 'already_closed', 'response', v_response);
    END IF;
    RAISE EXCEPTION 'conflict'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.control_room_shift_reports (
    department_id, report_date, shift_type, operator_name,
    alarm_response_avg_seconds, incident_ack_avg_seconds, system_uptime_percent,
    missed_incidents_count, summary_notes, checklist_items,
    completed_checklist_count, total_checklist_count,
    supervisor_signature, created_by, idempotency_key
  ) VALUES (
    p_dept_id, p_date, p_shift, p_operator_name,
    p_alarm_response_avg, p_incident_ack_avg, p_uptime_percent,
    p_missed_count, p_summary, p_checklist,
    p_completed_count, p_total_count,
    p_supervisor_signature, v_employee_id, p_idempotency_key
  ) RETURNING id INTO v_report_id;

  INSERT INTO public.shift_status (
    department_id, shift_date, shift_type, status, closed_at, closed_by
  ) VALUES (
    p_dept_id, p_date, p_shift::public.shift_type, 'closed'::public.shift_status_type,
    pg_catalog.now(), v_employee_id
  ) ON CONFLICT (department_id, shift_date, shift_type)
  DO UPDATE SET
    status = 'closed'::public.shift_status_type,
    closed_at = pg_catalog.now(),
    closed_by = v_employee_id;

  v_response := pg_catalog.jsonb_build_object('id', v_report_id, 'status', 'closed');

  INSERT INTO public.idempotency_keys (
    key, user_id, route, request_hash, response_json, status_code
  ) VALUES (
    p_idempotency_key, v_auth_id, p_route, p_request_hash, v_response, 200
  );

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_shift_closeout(
  text, uuid, text, text, uuid, date, text, text, int, int, numeric, int,
  text, jsonb, int, int, text, uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_shift_closeout(
  text, uuid, text, text, uuid, date, text, text, int, int, numeric, int,
  text, jsonb, int, int, text, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_shift_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_approved_by uuid;
  v_log_date date;
  v_shift text;
BEGIN
  SELECT ss.status, ss.approved_by, dl.log_date, dl.shift
    INTO v_status, v_approved_by, v_log_date, v_shift
    FROM public.daily_logs AS dl
    LEFT JOIN public.shift_status AS ss
      ON ss.department_id = dl.department_id
     AND ss.shift_date = dl.log_date
     AND ss.shift_type::text = dl.shift::text
   WHERE dl.id = OLD.daily_log_id;

  IF v_status = 'closed' AND v_approved_by IS NOT NULL THEN
    RAISE EXCEPTION 'Operation denied: Shift % (%) is closed and approved. Data is immutable.',
      v_log_date, v_shift;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atomic_split_hourly_load(
  p_department_id uuid,
  p_machine_id uuid,
  p_load_date date,
  p_shift_type text,
  p_start_hour integer,
  p_excavator_id uuid,
  p_material_type text,
  p_previous_load_id uuid
) RETURNS SETOF public.hourly_loads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_daily_log_id uuid;
  v_updated_rows integer;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required'
      USING ERRCODE = '42501';
  END IF;

  IF p_department_id IS NULL
     OR p_machine_id IS NULL
     OR p_load_date IS NULL
     OR p_shift_type IS NULL
     OR p_shift_type NOT IN ('day', 'night')
     OR p_start_hour IS NULL
     OR p_start_hour NOT BETWEEN 2 AND 12
     OR p_material_type IS NULL
     OR p_material_type NOT IN ('Waste', 'Coal') THEN
    RAISE EXCEPTION 'Invalid hourly-load split input'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_department_id::text || ':' || p_machine_id::text || ':' ||
      p_load_date::text || ':' || p_shift_type,
      0
    )
  );

  IF NOT EXISTS (
    SELECT 1
      FROM public.machines AS m
     WHERE m.id = p_machine_id
       AND m.active
       AND m.deleted_at IS NULL
     FOR SHARE
  ) THEN
    RAISE EXCEPTION 'Active machine not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT dl.id
    INTO v_daily_log_id
    FROM public.daily_logs AS dl
   WHERE dl.department_id = p_department_id
     AND dl.log_date = p_load_date
     AND dl.shift::text = p_shift_type
   FOR KEY SHARE;

  IF v_daily_log_id IS NULL THEN
    RAISE EXCEPTION 'Daily log not found for the requested shift'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.hourly_loads AS hl
     WHERE hl.department_id = p_department_id
       AND hl.machine_id = p_machine_id
       AND hl.load_date = p_load_date
       AND hl.shift_type = p_shift_type
       AND hl.start_hour >= p_start_hour
  ) THEN
    RAISE EXCEPTION 'A segment already starts at the requested hour'
      USING ERRCODE = '23505';
  END IF;

  IF p_previous_load_id IS NOT NULL THEN
    UPDATE public.hourly_loads AS hl
       SET is_locked = true,
           end_hour = p_start_hour - 1
     WHERE hl.id = p_previous_load_id
       AND hl.department_id = p_department_id
       AND hl.machine_id = p_machine_id
       AND hl.load_date = p_load_date
       AND hl.shift_type = p_shift_type
       AND NOT hl.is_locked;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows <> 1 THEN
      RAISE EXCEPTION 'Previous hourly-load segment not found or already locked'
        USING ERRCODE = 'P0002';
    END IF;
  ELSE
    UPDATE public.hourly_loads AS hl
       SET is_locked = true,
           end_hour = p_start_hour - 1
     WHERE hl.department_id = p_department_id
       AND hl.machine_id = p_machine_id
       AND hl.load_date = p_load_date
       AND hl.shift_type = p_shift_type
       AND NOT hl.is_locked;
  END IF;

  RETURN QUERY
  INSERT INTO public.hourly_loads (
    department_id, machine_id, load_date, shift_type,
    daily_log_id, daily_log_date,
    start_hour, end_hour, is_locked, material_type, excavator_id,
    hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
    hour_07, hour_08, hour_09, hour_10, hour_11, hour_12
  ) VALUES (
    p_department_id, p_machine_id, p_load_date, p_shift_type,
    v_daily_log_id, p_load_date,
    p_start_hour, 12, false, p_material_type, p_excavator_id,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_split_hourly_load(
  uuid, uuid, date, text, integer, uuid, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_split_hourly_load(
  uuid, uuid, date, text, integer, uuid, text, uuid
) TO service_role;
