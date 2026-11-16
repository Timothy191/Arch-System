-- ============================================================================
-- Migration: 219_harden_security_definer_rpc_permissions.sql
-- Description: Remediates unauthenticated SECURITY DEFINER RPC exposure across
--              public-schema RPCs:
--                1. Eliminates the `auth.uid() IS NOT NULL AND NOT EXISTS`
--                   anonymous bypass in shift compilation RPCs.
--                2. Enforces caller authentication, role/department RBAC, and
--                   user-identity isolation (`42501`) across all operational
--                   SECURITY DEFINER functions with pinned `SET search_path = ''`.
--                3. Guards legacy dropped relations (`safety_incidents`,
--                   `safety_incident_monthly`) with `to_regclass(...)`.
--                4. Revokes `PUBLIC` and `anon` EXECUTE across all 25 previously
--                   anon-callable SECURITY DEFINER RPCs plus 4 maintenance/SLO
--                   RPCs, restricting maintenance RPCs to `service_role`.
--                5. Revokes default `EXECUTE` on future `postgres` functions
--                   from `PUBLIC` and `anon`.
-- ============================================================================

-- 1. public.get_unified_shift_compilation
CREATE OR REPLACE FUNCTION public.get_unified_shift_compilation(
  p_department_id uuid,
  p_shift_date date,
  p_shift_type character varying
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
  v_result jsonb;
  v_shift_status jsonb;
  v_production_summary jsonb;
  v_machine_kpis jsonb;
  v_breakdowns jsonb;
  v_tire_events jsonb;
  v_is_control_room boolean;
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

    IF NOT EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR e.department_id = p_department_id
          OR p_department_id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
          OR EXISTS (
            SELECT 1
            FROM public.employee_department_access eda
            WHERE eda.employee_id = e.id
              AND eda.department_id = p_department_id
              AND (eda.expires_at IS NULL OR eda.expires_at > pg_catalog.now())
          )
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized to access department' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.departments d WHERE d.id = p_department_id AND d.name = 'control-room'
  ) INTO v_is_control_room;

  -- A. Shift Status & Sign-off Metadata
  SELECT pg_catalog.to_jsonb(s) INTO v_shift_status
  FROM (
    SELECT
      id, department_id, shift_date, shift_type::text AS shift_type, status::text AS status,
      closed_at, closed_by, approved_by, notes
    FROM public.shift_status
    WHERE department_id = p_department_id
      AND shift_date = p_shift_date
      AND shift_type::text = p_shift_type::text
    LIMIT 1
  ) s;

  -- B. Hourly Loads & Excavator Output Summary (12-hour shift columns hour_01..hour_12)
  SELECT pg_catalog.jsonb_build_object(
    'total_loads', COALESCE(SUM(hl.total_loads), 0)::int,
    'machines', COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'machine_id', m.id,
      'machine_name', m.name,
      'machine_type', m.machine_type,
      'total_loads', COALESCE(hl.total_loads, 0)::int,
      'hourly_distribution', pg_catalog.jsonb_build_object(
        'h06', COALESCE(hl.hour_01, 0), 'h07', COALESCE(hl.hour_02, 0),
        'h08', COALESCE(hl.hour_03, 0), 'h09', COALESCE(hl.hour_04, 0),
        'h10', COALESCE(hl.hour_05, 0), 'h11', COALESCE(hl.hour_06, 0),
        'h12', COALESCE(hl.hour_07, 0), 'h13', COALESCE(hl.hour_08, 0),
        'h14', COALESCE(hl.hour_09, 0), 'h15', COALESCE(hl.hour_10, 0),
        'h16', COALESCE(hl.hour_11, 0), 'h17', COALESCE(hl.hour_12, 0),
        'h18', COALESCE(hl.hour_01, 0), 'h19', COALESCE(hl.hour_02, 0),
        'h20', COALESCE(hl.hour_03, 0), 'h21', COALESCE(hl.hour_04, 0),
        'h22', COALESCE(hl.hour_05, 0), 'h23', COALESCE(hl.hour_06, 0),
        'h00', COALESCE(hl.hour_07, 0), 'h01', COALESCE(hl.hour_08, 0),
        'h02', COALESCE(hl.hour_09, 0), 'h03', COALESCE(hl.hour_10, 0),
        'h04', COALESCE(hl.hour_11, 0), 'h05', COALESCE(hl.hour_12, 0)
      )
    )), '[]'::jsonb)
  ) INTO v_production_summary
  FROM public.hourly_loads hl
  JOIN public.machines m ON hl.machine_id = m.id
  WHERE (hl.department_id = p_department_id OR v_is_control_room)
    AND hl.load_date = p_shift_date
    AND hl.shift_type::text = p_shift_type::text;

  -- C. Machine Operating Hours, Delays & Availability Calculation with Close-to-Start SMR Rollover
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'machine_id', m.id,
    'machine_name', m.name,
    'machine_type', m.machine_type,
    'hours_worked', COALESCE(mo.hours_worked, 0),
    'start_smu', COALESCE(mo.start_smu, public.get_machine_latest_closing_smr(m.id)),
    'end_smu', mo.end_smu,
    'start_time', mo.start_time::text,
    'end_time', mo.end_time::text,
    'breakdown_hours', COALESCE(bd.downtime_hours, 0),
    'delay_hours', COALESCE(de.total_delay_hours, 0),
    'mechanical_availability_pct', ROUND(
      CASE
        WHEN (COALESCE(mo.hours_worked, 0) + COALESCE(bd.downtime_hours, 0)) = 0 THEN 100.0
        ELSE (COALESCE(mo.hours_worked, 0) / (COALESCE(mo.hours_worked, 0) + COALESCE(bd.downtime_hours, 0))) * 100.0
      END, 1
    )
  ) ORDER BY m.name), '[]'::jsonb) INTO v_machine_kpis
  FROM public.machines m
  LEFT JOIN LATERAL (
    SELECT mo_inner.*
    FROM public.machine_operations mo_inner
    WHERE mo_inner.machine_id = m.id
      AND mo_inner.shift_date = p_shift_date
      AND mo_inner.shift_type::text = p_shift_type::text
    ORDER BY mo_inner.end_smu DESC NULLS LAST, mo_inner.created_at DESC
    LIMIT 1
  ) mo ON true
  LEFT JOIN (
    SELECT
      machine_operation_id,
      SUM(COALESCE(manual_duration_hours, duration_hours)) AS total_delay_hours
    FROM public.delay_entries
    WHERE status = 'committed'
    GROUP BY machine_operation_id
  ) de ON mo.id = de.machine_operation_id
  LEFT JOIN (
    SELECT
      fleet_id,
      SUM(EXTRACT(EPOCH FROM (COALESCE(time_out, pg_catalog.now()::time) - time_in)) / 3600.0) AS downtime_hours
    FROM public.breakdowns
    WHERE date_in = p_shift_date
    GROUP BY fleet_id
  ) bd ON bd.fleet_id = m.id::text OR bd.fleet_id = m.serial_number
  WHERE m.active = true
    AND (m.department_id = p_department_id OR v_is_control_room OR mo.id IS NOT NULL);

  -- D. Engineering Breakdowns during Shift
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', b.id,
    'machine_id', m.id,
    'machine_name', COALESCE(m.name, b.machine_name, b.fleet_id),
    'time_in', COALESCE(b.time_in::text, '06:00'),
    'time_out', b.time_out::text,
    'reason', b.reason,
    'repair_notes', b.repair_notes,
    'status', b.status
  )), '[]'::jsonb) INTO v_breakdowns
  FROM public.breakdowns b
  LEFT JOIN public.machines m ON b.fleet_id = m.id::text OR b.fleet_id = m.serial_number
  WHERE b.date_in = p_shift_date
    AND (b.department_id = p_department_id OR v_is_control_room OR b.shared_with_departments ? p_department_id::text);

  -- E. Tire Inspections & Swaps during Shift
  v_tire_events := '[]'::jsonb;

  v_result := pg_catalog.jsonb_build_object(
    'meta', pg_catalog.jsonb_build_object(
      'department_id', p_department_id,
      'shift_date', p_shift_date,
      'shift_type', p_shift_type,
      'compiled_at', pg_catalog.now()
    ),
    'shift_status', COALESCE(v_shift_status, '{"status": "open"}'::jsonb),
    'production', COALESCE(v_production_summary, '{"total_loads": 0, "machines": []}'::jsonb),
    'fleet_performance', COALESCE(v_machine_kpis, '[]'::jsonb),
    'breakdowns', COALESCE(v_breakdowns, '[]'::jsonb),
    'tire_management', v_tire_events
  );

  RETURN v_result;
END;
$$;

-- 2. public.get_multi_site_shift_compilation
CREATE OR REPLACE FUNCTION public.get_multi_site_shift_compilation(
  p_department_id uuid,
  p_shift_date date,
  p_shift_type character varying
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
  v_result jsonb;
  v_shift_meta jsonb;
  v_production jsonb;
  v_rollover jsonb;
  v_fleet_smu jsonb;
  v_ancillary jsonb;
  v_breakdowns jsonb;
  v_bredell jsonb;
  v_is_control_room boolean;
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

    IF NOT EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR e.department_id = p_department_id
          OR p_department_id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
          OR EXISTS (
            SELECT 1
            FROM public.employee_department_access eda
            WHERE eda.employee_id = e.id
              AND eda.department_id = p_department_id
              AND (eda.expires_at IS NULL OR eda.expires_at > pg_catalog.now())
          )
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized to access department' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.departments d WHERE d.id = p_department_id AND d.name = 'control-room'
  ) INTO v_is_control_room;

  -- 1. Meta / Shift State
  SELECT pg_catalog.jsonb_build_object(
    'department_id', p_department_id,
    'shift_date', p_shift_date,
    'shift_type', p_shift_type,
    'status', COALESCE(s.status::text, 'open'),
    'closed_at', s.closed_at,
    'closed_by', s.closed_by,
    'notes', s.notes
  ) INTO v_shift_meta
  FROM public.shift_status s
  WHERE s.department_id = p_department_id
    AND s.shift_date = p_shift_date
    AND s.shift_type::text = p_shift_type::text;

  IF v_shift_meta IS NULL THEN
    v_shift_meta := pg_catalog.jsonb_build_object(
      'department_id', p_department_id,
      'shift_date', p_shift_date,
      'shift_type', p_shift_type,
      'status', 'open'
    );
  END IF;

  -- 2. Excavator Hauling & Production by Site
  SELECT pg_catalog.jsonb_object_agg(site_code, site_payload) INTO v_production
  FROM (
    SELECT
      ehl.site_code,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'excavator_id', ehl.excavator_id,
        'excavator_name', m.name,
        'operator_name', ehl.operator_name,
        'material_type', ehl.material_type,
        'block_id', ehl.block_id,
        'operating_hours', ehl.operating_hours,
        'delays', ehl.delays_text,
        'total_loads', COALESCE(tally.total_loads, 0),
        'total_bcm', COALESCE(tally.total_bcm, 0),
        'total_tonnes', COALESCE(tally.total_tonnes, 0),
        'rate_per_hour', CASE
          WHEN ehl.operating_hours > 0 THEN
            ROUND(COALESCE(CASE WHEN ehl.material_type = 'TOPSOIL' THEN tally.total_bcm ELSE tally.total_tonnes END, 0) / ehl.operating_hours, 1)
          ELSE 0.0
        END,
        'trucks', COALESCE(tally.truck_list, '[]'::jsonb)
      )) AS site_payload
    FROM public.excavator_haul_logs ehl
    JOIN public.machines m ON ehl.excavator_id = m.id
    LEFT JOIN (
      SELECT
        haul_log_id,
        SUM(load_count) AS total_loads,
        SUM(load_count * bcm_per_load) AS total_bcm,
        SUM(load_count * tonnes_per_load) AS total_tonnes,
        pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'truck_id', truck_id,
          'truck_name', truck_name,
          'loads', load_count
        )) AS truck_list
      FROM public.excavator_truck_tallies
      GROUP BY haul_log_id
    ) tally ON ehl.id = tally.haul_log_id
    WHERE (ehl.department_id = p_department_id OR v_is_control_room)
      AND ehl.shift_date = p_shift_date
      AND ehl.shift_type::text = p_shift_type::text
    GROUP BY ehl.site_code
  ) site_summary;

  -- 3. Dozer Rollover Summary
  SELECT pg_catalog.jsonb_build_object(
    'total_bcm', COALESCE(SUM(total_bcm), 0),
    'entries', COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'machine_id', drl.machine_id,
      'machine_name', m.name,
      'operator_name', drl.operator_name,
      'start_smu', drl.start_smu,
      'end_smu', drl.end_smu,
      'hours', drl.calculated_hours,
      'push_factor', drl.push_factor_bcm_per_hour,
      'total_bcm', drl.total_bcm
    )), '[]'::jsonb)
  ) INTO v_rollover
  FROM public.dozer_rollover_logs drl
  JOIN public.machines m ON drl.machine_id = m.id
  WHERE (drl.department_id = p_department_id OR v_is_control_room)
    AND drl.shift_date = p_shift_date
    AND drl.shift_type::text = p_shift_type::text;

  -- 4. Machine SMU & Availability Registry with Close-to-Start SMR Rollover
  SELECT pg_catalog.jsonb_object_agg(site_group, machine_list) INTO v_fleet_smu
  FROM (
    SELECT
      COALESCE(mo.site_code, s.site_code, 'BKF') AS site_group,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'machine_id', m.id,
        'machine_name', m.name,
        'machine_type', m.machine_type,
        'start_smu', COALESCE(mo.start_smu, public.get_machine_latest_closing_smr(m.id)),
        'end_smu', mo.end_smu,
        'hours_worked', COALESCE(mo.hours_worked, 0),
        'operator_name', mo.operator_name,
        'operational_status', COALESCE(mo.operational_status, 'ACTIVE'),
        'notes', NULL
      ) ORDER BY m.machine_type, m.name) AS machine_list
    FROM public.machines m
    LEFT JOIN public.sites s ON m.site_id = s.id
    LEFT JOIN LATERAL (
      SELECT mo_inner.*
      FROM public.machine_operations mo_inner
      WHERE mo_inner.machine_id = m.id
        AND mo_inner.shift_date = p_shift_date
        AND mo_inner.shift_type::text = p_shift_type::text
      ORDER BY mo_inner.end_smu DESC NULLS LAST, mo_inner.created_at DESC
      LIMIT 1
    ) mo ON true
    WHERE m.active = true
      AND (m.department_id = p_department_id OR v_is_control_room OR mo.id IS NOT NULL)
    GROUP BY COALESCE(mo.site_code, s.site_code, 'BKF')
  ) fleet_data;

  -- 5. Ancillary Summary
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'machine_name', m.name,
    'site_code', asl.site_code,
    'activity_type', asl.activity_type,
    'trip_loads', asl.trip_loads,
    'fuel_liters', asl.fuel_liters,
    'notes', asl.activity_notes
  )), '[]'::jsonb) INTO v_ancillary
  FROM public.ancillary_shift_logs asl
  JOIN public.machines m ON asl.machine_id = m.id
  WHERE (asl.department_id = p_department_id OR v_is_control_room)
    AND asl.shift_date = p_shift_date
    AND asl.shift_type::text = p_shift_type::text;

  -- 6. Engineering Breakdowns
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', b.id,
    'machine_id', m.id,
    'machine_name', COALESCE(m.name, b.machine_name, b.fleet_id),
    'site_code', COALESCE(b.site_code, 'BKF'),
    'duration_hours', ROUND(COALESCE(b.duration_minutes, 0) / 60.0, 2),
    'reason', b.reason,
    'repair_notes', b.repair_notes,
    'is_operational_defect', COALESCE(b.is_operational_defect, false),
    'status', b.status
  )), '[]'::jsonb) INTO v_breakdowns
  FROM public.breakdowns b
  LEFT JOIN public.machines m ON b.fleet_id = m.id::text OR b.fleet_id = m.serial_number
  WHERE b.date_in = p_shift_date
    AND (b.department_id = p_department_id OR v_is_control_room OR b.shared_with_departments ? p_department_id::text)
    AND COALESCE(b.site_code, 'BKF') <> 'BREDELL';

  -- 7. Machines at Bredell Workshop
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'machine_name', COALESCE(m.name, b.machine_name, b.fleet_id),
    'reason', b.reason,
    'date_in', b.date_in
  )), '[]'::jsonb) INTO v_bredell
  FROM public.breakdowns b
  LEFT JOIN public.machines m ON b.fleet_id = m.id::text OR b.fleet_id = m.serial_number
  WHERE b.status = 'active'
    AND b.site_code = 'BREDELL'
    AND (b.department_id = p_department_id OR v_is_control_room OR b.shared_with_departments ? p_department_id::text);

  v_result := pg_catalog.jsonb_build_object(
    'meta', v_shift_meta,
    'production', COALESCE(v_production, '{}'::jsonb),
    'rollover', v_rollover,
    'fleet_smu', COALESCE(v_fleet_smu, '{}'::jsonb),
    'ancillary', v_ancillary,
    'breakdowns', v_breakdowns,
    'bredell_workshop', v_bredell
  );

  RETURN v_result;
END;
$$;

-- 3. public.atomic_machine_operator_dispatch
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

    IF NOT FOUND OR v_caller_role NOT IN ('admin', 'operator', 'supervisor') THEN
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

-- 4. public.get_machine_latest_closing_smr
CREATE OR REPLACE FUNCTION public.get_machine_latest_closing_smr(p_machine_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
  v_closing_smr numeric(10, 1);
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

  IF NOT v_is_service AND (COALESCE(v_jwt_role, '') = 'anon' OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT NULLIF(
    GREATEST(
      COALESCE(
        (
          SELECT mo.end_smu
          FROM public.machine_operations mo
          WHERE mo.machine_id = p_machine_id
            AND mo.end_smu IS NOT NULL
          ORDER BY mo.shift_date DESC, mo.end_smu DESC
          LIMIT 1
        ),
        0
      ),
      COALESCE(
        (
          SELECT ROUND(sr.reading::numeric, 1)
          FROM public.smr_readings sr
          WHERE sr.meter_id = p_machine_id::text
          ORDER BY sr.reading_at DESC, sr.reading DESC
          LIMIT 1
        ),
        0
      )
    ),
    0
  )::numeric(10, 1)
  INTO v_closing_smr;

  RETURN v_closing_smr;
END;
$$;

-- 5. public.get_avg_tire_lifespan
CREATE OR REPLACE FUNCTION public.get_avg_tire_lifespan()
RETURNS TABLE(
  brand text,
  machine_type text,
  avg_lifespan_hours numeric,
  avg_lifespan_days numeric,
  scrapped_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
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

    IF NOT EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Employee authorization required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    t.brand,
    m.machine_type,
    ROUND(AVG(t.removed_hours - t.installed_hours)::numeric, 1) AS avg_lifespan_hours,
    ROUND(AVG(t.removed_at - t.installed_at)::numeric, 1) AS avg_lifespan_days,
    COUNT(t.id) AS scrapped_count
  FROM public.tires t
  JOIN public.machines m ON t.machine_id = m.id
  WHERE t.status = 'scrapped'
    AND t.removed_hours IS NOT NULL
    AND t.removed_at IS NOT NULL
  GROUP BY t.brand, m.machine_type;
END;
$$;

-- 6. public.get_monolithized_department_dashboard_payload
CREATE OR REPLACE FUNCTION public.get_monolithized_department_dashboard_payload(dept_id uuid)
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
  v_daily_logs jsonb;
  v_breakdowns jsonb;
  v_safety_incidents jsonb;
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

    IF NOT EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.deleted_at IS NULL
        AND (
          e.role = 'admin'
          OR e.department_id = dept_id
          OR dept_id = ANY(COALESCE(e.accessible_departments, ARRAY[]::uuid[]))
          OR EXISTS (
            SELECT 1
            FROM public.employee_department_access eda
            WHERE eda.employee_id = e.id
              AND eda.department_id = dept_id
              AND (eda.expires_at IS NULL OR eda.expires_at > pg_catalog.now())
          )
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized to access department' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(log_row), '[]'::jsonb)
  INTO v_daily_logs
  FROM (
    SELECT id, log_date, shift, notes, sync_status, idempotency_key, last_synced_at
    FROM public.daily_logs
    WHERE department_id = dept_id
    ORDER BY log_date DESC, shift DESC
    LIMIT 10
  ) log_row;

  SELECT COALESCE(pg_catalog.jsonb_agg(bd_row), '[]'::jsonb)
  INTO v_breakdowns
  FROM (
    SELECT id, fleet_id, machine_type, date_in, date_out, reason, status, sync_status, idempotency_key, last_synced_at
    FROM public.breakdowns
    WHERE department_id = dept_id AND deleted_at IS NULL
    ORDER BY date_in DESC
    LIMIT 10
  ) bd_row;

  IF to_regclass('public.safety_incidents') IS NOT NULL THEN
    EXECUTE '
      SELECT COALESCE(pg_catalog.jsonb_agg(inc_row), ''[]''::jsonb)
      FROM (
        SELECT id, incident_date, shift_type, incident_type, description, status, sync_status, idempotency_key, last_synced_at
        FROM public.safety_incidents
        WHERE department_id = $1
        ORDER BY incident_date DESC
        LIMIT 10
      ) inc_row
    '
    INTO v_safety_incidents
    USING dept_id;
  ELSE
    v_safety_incidents := '[]'::jsonb;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'department_id', dept_id,
    'daily_logs', COALESCE(v_daily_logs, '[]'::jsonb),
    'breakdowns', COALESCE(v_breakdowns, '[]'::jsonb),
    'safety_incidents', COALESCE(v_safety_incidents, '[]'::jsonb)
  );
END;
$$;

-- 7. public.cache_vector_search_results
CREATE OR REPLACE FUNCTION public.cache_vector_search_results(
  p_cache_key character varying,
  p_query_params jsonb,
  p_result_data jsonb,
  p_user_id uuid,
  p_memory_type text DEFAULT NULL::text,
  p_ttl_seconds integer DEFAULT 3600
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
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

    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: user_id mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.vector_search_cache
  SET
    result_data = p_result_data,
    last_accessed_at = pg_catalog.now(),
    access_count = access_count + 1,
    ttl_seconds = p_ttl_seconds
  WHERE cache_key = p_cache_key AND user_id = p_user_id;

  INSERT INTO public.vector_search_cache (
    cache_key, query_params, result_data, user_id, memory_type, ttl_seconds
  )
  SELECT
    p_cache_key, p_query_params, p_result_data, p_user_id, p_memory_type, p_ttl_seconds
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vector_search_cache
    WHERE cache_key = p_cache_key AND user_id = p_user_id
  );
END;
$$;

-- 8. public.get_cached_vector_search
CREATE OR REPLACE FUNCTION public.get_cached_vector_search(
  p_cache_key character varying,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
  v_result_data jsonb;
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

    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: user_id mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT result_data
  INTO v_result_data
  FROM public.vector_search_cache
  WHERE cache_key = p_cache_key
    AND user_id = p_user_id
    AND created_at + (ttl_seconds || ' seconds')::interval > pg_catalog.now()
  LIMIT 1;

  RETURN v_result_data;
END;
$$;

-- 9. public.record_vector_search_performance
CREATE OR REPLACE FUNCTION public.record_vector_search_performance(
  p_user_id uuid,
  p_search_type text,
  p_match_count integer,
  p_ef_search integer,
  p_result_count integer,
  p_execution_time_ms double precision,
  p_cache_hit boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
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

    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: user_id mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.vector_search_performance (
    user_id, search_type, match_count, ef_search, result_count, execution_time_ms, cache_hit
  ) VALUES (
    p_user_id, p_search_type, p_match_count, p_ef_search, p_result_count, p_execution_time_ms, p_cache_hit
  );
END;
$$;

-- 10. public.refresh_safety_incident_monthly_smart
CREATE OR REPLACE FUNCTION public.refresh_safety_incident_monthly_smart()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_claims text;
  v_jwt_role text;
  v_has_jwt_context boolean;
  v_is_service boolean;
  log_id uuid;
  refresh_status text := 'completed';
  error_msg text := NULL;
  row_count integer;
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
    RAISE EXCEPTION 'Unauthorized: service role required' USING ERRCODE = '42501';
  END IF;

  IF to_regclass('public.safety_incident_monthly') IS NULL THEN
    RETURN;
  END IF;

  log_id := public.log_mv_refresh_start('safety_incident_monthly', false, 'cron');

  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.materialized_view_refresh_log
      WHERE view_name = 'safety_incident_monthly'
        AND status = 'started'
        AND refresh_start > pg_catalog.now() - INTERVAL '10 minutes'
    ) THEN
      UPDATE public.materialized_view_refresh_log
      SET status = 'skipped',
          error_message = 'Concurrent refresh in progress',
          refresh_end = pg_catalog.now()
      WHERE id = log_id;
      RETURN;
    END IF;

    EXECUTE 'REFRESH MATERIALIZED VIEW public.safety_incident_monthly';
    EXECUTE 'SELECT COUNT(*)::integer FROM public.safety_incident_monthly' INTO row_count;
  EXCEPTION WHEN OTHERS THEN
    refresh_status := 'failed';
    error_msg := SQLERRM;
  END;

  PERFORM public.log_mv_refresh_end(log_id, refresh_status, error_msg, row_count);

  IF refresh_status = 'failed' THEN
    RAISE NOTICE 'Materialized view refresh failed: safety_incident_monthly - %', error_msg;
  END IF;
END;
$$;

-- ============================================================================
-- Explicit Least-Privilege Function ACLs (All 25 anon-exposed SECURITY DEFINER
-- RPCs + 4 maintenance/cron/SLO RPCs)
-- ============================================================================

-- Authenticated + Service Role Operational & RLS Helper RPCs (16)
REVOKE ALL ON FUNCTION public.get_unified_shift_compilation(uuid, date, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unified_shift_compilation(uuid, date, character varying) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_multi_site_shift_compilation(uuid, date, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_multi_site_shift_compilation(uuid, date, character varying) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.atomic_machine_operator_dispatch(uuid, uuid, uuid, uuid, date, text, time without time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atomic_machine_operator_dispatch(uuid, uuid, uuid, uuid, date, text, time without time zone, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_monolithized_department_dashboard_payload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monolithized_department_dashboard_payload(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_machine_latest_closing_smr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_machine_latest_closing_smr(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_avg_tire_lifespan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_avg_tire_lifespan() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cache_vector_search_results(character varying, jsonb, jsonb, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cache_vector_search_results(character varying, jsonb, jsonb, uuid, text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_cached_vector_search(character varying, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cached_vector_search(character varying, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_vector_search_performance(uuid, text, integer, integer, integer, double precision, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_vector_search_performance(uuid, text, integer, integer, integer, double precision, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_department(uuid, public.department_access_level) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_department(uuid, public.department_access_level) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_employee_department() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_department() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_access_control() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_access_control() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_production_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_production_summary(date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_production_trend(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_production_trend(integer) TO authenticated, service_role;

-- Service-Role-Only Maintenance, Partition, Cron & Telemetry RPCs (13)
REVOKE ALL ON FUNCTION public.refresh_safety_incident_monthly_smart() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_safety_incident_monthly_smart() TO service_role;

REVOKE ALL ON FUNCTION public.add_partition_check_constraints() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_partition_check_constraints() TO service_role;

REVOKE ALL ON FUNCTION public.archive_old_partitions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_partitions(integer) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_vector_search_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_vector_search_cache() TO service_role;

REVOKE ALL ON FUNCTION public.create_next_month_partitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_next_month_partitions() TO service_role;

REVOKE ALL ON FUNCTION public.log_mv_refresh_end(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_mv_refresh_end(uuid, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.log_mv_refresh_start(text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_mv_refresh_start(text, boolean, text) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_dept_production_summary_smart() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dept_production_summary_smart() TO service_role;

REVOKE ALL ON FUNCTION public.refresh_machine_utilization_weekly_smart() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_machine_utilization_weekly_smart() TO service_role;

REVOKE ALL ON FUNCTION public.archive_monthly_drill_operations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_monthly_drill_operations() TO service_role;

REVOKE ALL ON FUNCTION public.refresh_hourly_production() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_hourly_production() TO service_role;

REVOKE ALL ON FUNCTION public.refresh_production_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_production_summary() TO service_role;

REVOKE ALL ON FUNCTION public.record_slo_measurement(text, numeric, numeric, numeric, timestamp with time zone, timestamp with time zone, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_slo_measurement(text, numeric, numeric, numeric, timestamp with time zone, timestamp with time zone, jsonb) TO service_role;

-- Prevent future postgres-owned functions from inheriting PUBLIC/anon EXECUTE
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
