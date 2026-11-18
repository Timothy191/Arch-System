-- Migration 224: Control Room Security Hardening
-- Purpose:
--   1. Reconcile 'control_room_operator' (along with 'access_control' and 'maintenance') in employees_role_check.
--   2. Include 'control_room_operator' in atomic_shift_closeout and atomic_machine_operator_dispatch role allowlists.
--   3. Enforce security_invoker = true on breakdowns_control_room_view and revoke anon access.
--   4. Tighten production_monthly_targets write policy to admin or authorized department supervisors/control-room operators.
--   5. Tighten control_room_outbox insert policy to authenticated control-room operational employees.
--   6. Restrict shift_status INSERT policy to operational roles with department access.
--   7. Scope delay_entries supervisor policies (soft_delete, commit_supervisor, uncommit_supervisor) to department_id.

-- ============================================================================
-- 1. Reconcile employees_role_check constraint
-- ============================================================================
ALTER TABLE public.employees
  -- squawk-ignore ban-drop-constraint
  DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN (
    'operator',
    'supervisor',
    'admin',
    'viewer',
    'control_room_operator',
    'access_control',
    'maintenance'
  )) NOT VALID;

-- ============================================================================
-- 2. Update atomic_shift_closeout to allow control_room_operator
-- ============================================================================
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
     OR v_employee_role NOT IN ('admin', 'operator', 'supervisor', 'control_room_operator') THEN
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

-- ============================================================================
-- 3. Update atomic_machine_operator_dispatch to allow control_room_operator
-- ============================================================================
CREATE OR REPLACE FUNCTION public.atomic_machine_operator_dispatch(
  p_machine_id uuid,
  p_operator_id uuid,
  p_site_id uuid,
  p_department_id uuid,
  p_shift_date date,
  p_shift_type text,
  p_start_time time without time zone,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
  v_caller_emp_id uuid;
  v_caller_role text;
  v_caller_dept_id uuid;
  v_caller_accessible_depts uuid[];
  v_machine public.machines%ROWTYPE;
  v_operator public.operators%ROWTYPE;
  v_personnel public.personnel%ROWTYPE;
  v_existing_op public.machine_operations%ROWTYPE;
  v_operation_id uuid;
  v_capabilities jsonb;
  v_opening_smr numeric(10, 1);
BEGIN
  v_raw_claims := NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '');
  v_jwt_role := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    CASE WHEN v_raw_claims IS NOT NULL THEN v_raw_claims::jsonb ->> 'role' ELSE NULL END
  );
  v_has_jwt_context := v_jwt_role IS NOT NULL
    OR v_raw_claims IS NOT NULL
    OR NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '') IS NOT NULL;
  v_is_service := COALESCE(v_jwt_role, '') IN ('service_role', 'supabase_admin')
    OR (NOT v_has_jwt_context AND session_user IN ('postgres', 'supabase_admin'));

  IF NOT v_is_service THEN
    IF COALESCE(v_jwt_role, '') = 'anon' OR auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT e.id, e.role, e.department_id, e.accessible_departments
      INTO v_caller_emp_id, v_caller_role, v_caller_dept_id, v_caller_accessible_depts
      FROM public.employees AS e
     WHERE e.auth_id = auth.uid()
       AND e.deleted_at IS NULL
     FOR SHARE;

    IF NOT FOUND OR v_caller_role NOT IN ('admin', 'operator', 'supervisor', 'control_room_operator') THEN
      RAISE EXCEPTION 'Employee is not authorized for machine operator dispatch' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role <> 'admin'
       AND p_department_id IS DISTINCT FROM v_caller_dept_id
       AND NOT (p_department_id = ANY(COALESCE(v_caller_accessible_depts, ARRAY[]::uuid[])))
       AND NOT EXISTS (
         SELECT 1
         FROM public.employee_department_access eda
         WHERE eda.employee_id = v_caller_emp_id
           AND eda.department_id = p_department_id
           AND (eda.expires_at IS NULL OR eda.expires_at > pg_catalog.now())
       ) THEN
      RAISE EXCEPTION 'Not authorized to dispatch for department' USING ERRCODE = '42501';
    END IF;

    IF p_created_by IS DISTINCT FROM v_caller_emp_id AND v_caller_role <> 'admin' THEN
      RAISE EXCEPTION 'Creator identity mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_machine FROM public.machines WHERE id = p_machine_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'MACHINE_NOT_FOUND',
      'reason', 'Machine not found'
    );
  END IF;

  IF NOT v_machine.active THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'MACHINE_INACTIVE',
      'reason', 'Machine is inactive or under maintenance'
    );
  END IF;

  SELECT * INTO v_operator FROM public.operators WHERE id = p_operator_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'OPERATOR_NOT_FOUND',
      'reason', 'Operator not found'
    );
  END IF;

  IF NOT v_operator.active THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'OPERATOR_INACTIVE',
      'reason', 'Operator status is inactive'
    );
  END IF;

  SELECT * INTO v_personnel FROM public.personnel WHERE emp_code = v_operator.employee_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'PERSONNEL_RECORD_MISSING',
      'reason', 'Personnel compliance record missing'
    );
  END IF;

  IF v_personnel.status ILIKE 'inactive' THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'OPERATOR_INACTIVE',
      'reason', 'Personnel status is inactive'
    );
  END IF;

  IF v_personnel.medical_expiry IS NULL OR v_personnel.medical_expiry < CURRENT_DATE THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'CLEARANCE_EXPIRED',
      'reason', 'Medical clearance expired or missing'
    );
  END IF;

  IF v_personnel.induction_expiry IS NULL OR v_personnel.induction_expiry < CURRENT_DATE THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'CLEARANCE_EXPIRED',
      'reason', 'Safety induction clearance expired or missing'
    );
  END IF;

  SELECT * INTO v_existing_op
  FROM public.machine_operations
  WHERE machine_id = p_machine_id
    AND shift_date = p_shift_date
    AND shift_type::text = p_shift_type::text
    AND end_time IS NULL
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_op.operator_id = p_operator_id THEN
      SELECT pg_catalog.jsonb_build_object(
        'requiresHourlyLoads', mt.requires_hourly_loads,
        'tracksTonnage', mt.tracks_tonnage,
        'tracksCycleTime', mt.tracks_cycle_time,
        'tracksFuel', mt.tracks_fuel,
        'tracksBenchClearance', mt.tracks_bench_clearance,
        'tracksDrillDepth', mt.tracks_drill_depth
      ) INTO v_capabilities
      FROM public.machine_types mt
      WHERE mt.id = v_machine.machine_type_id;

      RETURN pg_catalog.jsonb_build_object(
        'allowed', true,
        'alreadyAssigned', true,
        'operationId', v_existing_op.id,
        'startSmu', COALESCE(v_existing_op.start_smu, public.get_machine_latest_closing_smr(p_machine_id)),
        'machineCapabilities', COALESCE(v_capabilities, '{}'::jsonb)
      );
    ELSE
      RETURN pg_catalog.jsonb_build_object(
        'allowed', false,
        'code', 'MACHINE_OCCUPIED',
        'reason', 'Machine is already assigned to another active operator'
      );
    END IF;
  END IF;

  v_opening_smr := public.get_machine_latest_closing_smr(p_machine_id);

  INSERT INTO public.machine_operations (
    department_id,
    machine_id,
    operator_id,
    site_id,
    shift_date,
    shift_type,
    start_time,
    start_smu,
    created_by
  ) VALUES (
    p_department_id,
    p_machine_id,
    p_operator_id,
    p_site_id,
    p_shift_date,
    p_shift_type,
    p_start_time,
    v_opening_smr,
    p_created_by
  ) RETURNING id INTO v_operation_id;

  SELECT pg_catalog.jsonb_build_object(
    'requiresHourlyLoads', mt.requires_hourly_loads,
    'tracksTonnage', mt.tracks_tonnage,
    'tracksCycleTime', mt.tracks_cycle_time,
    'tracksFuel', mt.tracks_fuel,
    'tracksBenchClearance', mt.tracks_bench_clearance,
    'tracksDrillDepth', mt.tracks_drill_depth
  ) INTO v_capabilities
  FROM public.machine_types mt
  WHERE mt.id = v_machine.machine_type_id;

  RETURN pg_catalog.jsonb_build_object(
    'allowed', true,
    'alreadyAssigned', false,
    'operationId', v_operation_id,
    'startSmu', v_opening_smr,
    'machineCapabilities', COALESCE(v_capabilities, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_machine_operator_dispatch(uuid, uuid, uuid, uuid, date, text, time without time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atomic_machine_operator_dispatch(uuid, uuid, uuid, uuid, date, text, time without time zone, uuid) TO authenticated, service_role;

-- ============================================================================
-- 4. Set security_invoker = true on breakdowns_control_room_view
-- ============================================================================
ALTER VIEW public.breakdowns_control_room_view
  SET (security_invoker = true);

REVOKE ALL ON public.breakdowns_control_room_view FROM anon;
GRANT SELECT ON public.breakdowns_control_room_view TO authenticated;

-- ============================================================================
-- 5. Tighten production_monthly_targets write policy
-- ============================================================================
DROP POLICY IF EXISTS "production_monthly_targets_write_authorized" ON public.production_monthly_targets;
CREATE POLICY "production_monthly_targets_write_authorized"
  ON public.production_monthly_targets
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.departments d ON (
        d.id = e.department_id
        OR d.id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
      )
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor', 'control_room_operator')
        AND d.slug IN ('production', 'control-room', 'drilling')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.departments d ON (
        d.id = e.department_id
        OR d.id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
      )
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor', 'control_room_operator')
        AND d.slug IN ('production', 'control-room', 'drilling')
    )
  );

-- ============================================================================
-- 6. Tighten control_room_outbox insert policy
-- ============================================================================
DROP POLICY IF EXISTS "outbox_insert_authenticated" ON public.control_room_outbox;
CREATE POLICY "outbox_insert_authenticated"
  ON public.control_room_outbox
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.departments d ON d.slug = 'control-room'
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor', 'operator', 'control_room_operator')
        AND (
          e.department_id = d.id
          OR d.id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
        )
    )
  );

-- ============================================================================
-- 7. Restrict shift_status INSERT policy to operational roles + dept access
-- ============================================================================
DROP POLICY IF EXISTS "shift_status_insert_access" ON public.shift_status;
CREATE POLICY "shift_status_insert_access"
  ON public.shift_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_department_access(department_id)
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('operator', 'supervisor', 'admin', 'control_room_operator')
    )
  );

-- ============================================================================
-- 8. Scope delay_entries supervisor policies to department_id
-- ============================================================================
DROP POLICY IF EXISTS "delay_entries_soft_delete" ON public.delay_entries;
CREATE POLICY "delay_entries_soft_delete"
  ON public.delay_entries
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = (SELECT auth.uid())
      WHERE mo.id = delay_entries.machine_operation_id
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR (
            e.role = 'supervisor'
            AND (
              e.department_id = mo.department_id
              OR mo.department_id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
            )
          )
        )
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = (SELECT id FROM public.employees WHERE auth_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "delay_entries_commit_supervisor" ON public.delay_entries;
CREATE POLICY "delay_entries_commit_supervisor"
  ON public.delay_entries
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'draft'
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = (SELECT auth.uid())
      WHERE mo.id = delay_entries.machine_operation_id
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR (
            e.role = 'supervisor'
            AND (
              e.department_id = mo.department_id
              OR mo.department_id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
            )
          )
        )
    )
  )
  WITH CHECK (
    status = 'committed'
    AND committed_by = (SELECT id FROM public.employees WHERE auth_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "delay_entries_uncommit_supervisor" ON public.delay_entries;
CREATE POLICY "delay_entries_uncommit_supervisor"
  ON public.delay_entries
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'committed'
    AND EXISTS (
      SELECT 1
      FROM public.machine_operations mo
      JOIN public.employees e ON e.auth_id = (SELECT auth.uid())
      WHERE mo.id = delay_entries.machine_operation_id
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR (
            e.role = 'supervisor'
            AND (
              e.department_id = mo.department_id
              OR mo.department_id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
            )
          )
        )
    )
  )
  WITH CHECK (
    status = 'draft'
    AND uncommitted_by = (SELECT id FROM public.employees WHERE auth_id = (SELECT auth.uid()))
    AND uncommit_reason IS NOT NULL
  );
