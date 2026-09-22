-- 161_shift_closeout_rpc.sql
-- RPC for atomic shift closeout

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
AS $$
DECLARE
  v_existing_hash text;
  v_response jsonb;
  v_report_id uuid;
BEGIN
  -- 1. Idempotency Check with row lock
  SELECT request_hash, response_json INTO v_existing_hash, v_response
  FROM public.idempotency_keys
  WHERE key = p_idempotency_key AND user_id = p_user_id AND route = p_route
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_hash = p_request_hash THEN
      RETURN jsonb_build_object('status', 'already_closed', 'response', v_response);
    ELSE
      RAISE EXCEPTION 'conflict';
    END IF;
  END IF;

  -- 2. Insert Control Room Shift Report
  INSERT INTO public.control_room_shift_reports (
    department_id, report_date, shift_type, operator_name,
    alarm_response_avg_seconds, incident_ack_avg_seconds, system_uptime_percent,
    missed_incidents_count, summary_notes, checklist_items,
    completed_checklist_count, total_checklist_count,
    supervisor_signature, created_by, idempotency_key
  ) VALUES (
    p_dept_id, p_date, p_shift::shift_enum, p_operator_name,
    p_alarm_response_avg, p_incident_ack_avg, p_uptime_percent,
    p_missed_count, p_summary, p_checklist,
    p_completed_count, p_total_count,
    p_supervisor_signature, p_employee_id, p_idempotency_key
  ) RETURNING id INTO v_report_id;

  -- 3. Upsert into shift_status
  INSERT INTO public.shift_status (
    department_id, shift_date, shift_type, status, closed_at, closed_by
  ) VALUES (
    p_dept_id, p_date, p_shift::shift_enum, 'closed', NOW(), p_employee_id
  ) ON CONFLICT (department_id, shift_date, shift_type)
  DO UPDATE SET status = 'closed', closed_at = NOW(), closed_by = p_employee_id;

  v_response := jsonb_build_object('id', v_report_id, 'status', 'closed');

  -- 4. Store Idempotency Key
  INSERT INTO public.idempotency_keys (
    key, user_id, route, request_hash, response_json, status_code
  ) VALUES (
    p_idempotency_key, p_user_id, p_route, p_request_hash, v_response, 200
  );

  RETURN v_response;
EXCEPTION
  WHEN unique_violation THEN
    -- If the unique constraint on (dept, date, shift) fires unexpectedly
    RAISE EXCEPTION 'unique_violation';
END;
$$;

