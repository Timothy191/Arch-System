-- Migration: 207_control_room_closeout_submitter_and_rpc_hardening.sql
-- Description: Ensure atomic_shift_closeout populates submitter_id and enforce BEFORE INSERT/UPDATE separation-of-duties invariants on control_room_shift_reports.

-- 1. Backfill any control_room_shift_reports rows where submitter_id is NULL
UPDATE public.control_room_shift_reports
SET submitter_id = created_by
WHERE submitter_id IS NULL
  AND created_by IS NOT NULL;

-- 2. Harden lifecycle trigger to run BEFORE INSERT OR UPDATE so submitter_id always defaults to created_by
CREATE OR REPLACE FUNCTION public.trg_control_room_shift_reports_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.submitter_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.submitter_id := NEW.created_by;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Prevent mutations to approved reports (append-only compliance)
    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'Approved shift reports are append-only and cannot be altered. File an operational adjustment instead.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Require distinct approver identity when status moves to approved
  IF NEW.status = 'approved' THEN
    IF NEW.approver_id IS NULL THEN
      RAISE EXCEPTION 'An approving supervisor identity is required to approve shift closeout.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.approver_id = COALESCE(NEW.submitter_id, NEW.created_by) THEN
      RAISE EXCEPTION 'Separation of duties violation: Submitter cannot approve their own shift report.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := pg_catalog.now();
    END IF;
  END IF;

  IF NEW.status = 'rejected' AND NEW.rejected_at IS NULL THEN
    NEW.rejected_at := pg_catalog.now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_report_lifecycle ON public.control_room_shift_reports;
CREATE TRIGGER trg_shift_report_lifecycle
  BEFORE INSERT OR UPDATE ON public.control_room_shift_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_control_room_shift_reports_lifecycle();

-- 3. Update atomic_shift_closeout to explicitly persist submitter_id and status = 'submitted'
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
    supervisor_signature, created_by, submitter_id, status, idempotency_key
  ) VALUES (
    p_dept_id, p_date, p_shift, p_operator_name,
    p_alarm_response_avg, p_incident_ack_avg, p_uptime_percent,
    p_missed_count, p_summary, p_checklist,
    p_completed_count, p_total_count,
    p_supervisor_signature, v_employee_id, v_employee_id, 'submitted', p_idempotency_key
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

  v_response := pg_catalog.jsonb_build_object(
    'id', v_report_id,
    'status', 'closed',
    'submitter_id', v_employee_id
  );

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

-- 4. Harden atomic_approve_shift_report to check COALESCE(submitter_id, created_by)
CREATE OR REPLACE FUNCTION public.atomic_approve_shift_report(
  p_report_id UUID,
  p_approval_note TEXT DEFAULT NULL,
  p_approver_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_caller_emp_id UUID;
  v_caller_role TEXT;
  v_report public.control_room_shift_reports%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id, role INTO v_caller_emp_id, v_caller_role
  FROM public.employees
  WHERE auth_id = v_auth_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_caller_emp_id IS NULL OR v_caller_role NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to approve shift closeouts' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id IS NOT NULL AND p_approver_id <> v_caller_emp_id AND v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Approver identity mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_report
  FROM public.control_room_shift_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift report not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_report.status = 'approved' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'already_approved', 'id', p_report_id);
  END IF;

  IF COALESCE(v_report.submitter_id, v_report.created_by) = v_caller_emp_id THEN
    RAISE EXCEPTION 'Separation of duties violation: Approver cannot approve their own shift closeout'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.control_room_shift_reports
  SET
    status = 'approved',
    submitter_id = COALESCE(v_report.submitter_id, v_report.created_by),
    approver_id = v_caller_emp_id,
    approved_at = pg_catalog.now(),
    approval_note = p_approval_note,
    updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'approved',
    'id', p_report_id,
    'approver_id', v_caller_emp_id,
    'approved_at', pg_catalog.now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_approve_shift_report(UUID, TEXT, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_approve_shift_report(UUID, TEXT, UUID) TO authenticated;
