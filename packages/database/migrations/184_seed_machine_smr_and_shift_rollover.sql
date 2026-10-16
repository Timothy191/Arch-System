-- Migration: 184_seed_machine_smr_and_shift_rollover.sql
-- Description: Populate seeded machines with continuous SMR readings and enforce
--              close-SMR-to-start-SMR rollover when a new shift starts.

-- 1. Resolve latest closing SMR per machine across machine_operations and smr_readings
CREATE OR REPLACE FUNCTION public.get_machine_latest_closing_smr(p_machine_id UUID)
RETURNS NUMERIC(10, 1)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  )::numeric(10, 1);
$$;

REVOKE ALL ON FUNCTION public.get_machine_latest_closing_smr(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_machine_latest_closing_smr(UUID) TO authenticated, service_role;

-- 2. Automatically populate start_smu from the machine's previous close SMR when a shift starts
CREATE OR REPLACE FUNCTION public.autofill_machine_operation_start_smu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_close_smr NUMERIC(10, 1);
BEGIN
  IF NEW.start_smu IS NULL THEN
    v_prev_close_smr := public.get_machine_latest_closing_smr(NEW.machine_id);
    IF v_prev_close_smr IS NOT NULL THEN
      NEW.start_smu := v_prev_close_smr;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_machine_operation_start_smu ON public.machine_operations;
CREATE TRIGGER trg_autofill_machine_operation_start_smu
  BEFORE INSERT ON public.machine_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.autofill_machine_operation_start_smu();

-- 3. Sync smr_readings (written by Shift Closeout) back to machine_operations.end_smu
--    so the next shift always starts from the closed shift's closing SMR.
CREATE OR REPLACE FUNCTION public.sync_smr_reading_to_machine_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine_id UUID;
  v_target_op_id UUID;
  v_prev_smr NUMERIC(10, 1);
  v_reading NUMERIC(10, 1);
  v_shift_date DATE;
BEGIN
  BEGIN
    v_machine_id := NEW.meter_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.machines WHERE id = v_machine_id) THEN
    RETURN NEW;
  END IF;

  v_reading := ROUND(NEW.reading::numeric, 1);
  v_shift_date := (NEW.reading_at AT TIME ZONE 'UTC')::date;

  SELECT mo.id
    INTO v_target_op_id
    FROM public.machine_operations mo
   WHERE mo.machine_id = v_machine_id
     AND mo.shift_date = v_shift_date
     AND (mo.start_smu IS NULL OR mo.start_smu <= v_reading)
   ORDER BY mo.created_at DESC
   LIMIT 1;

  IF v_target_op_id IS NOT NULL THEN
    UPDATE public.machine_operations
       SET start_smu = COALESCE(start_smu, v_reading),
           end_smu = GREATEST(COALESCE(end_smu, v_reading), v_reading),
           updated_at = now()
     WHERE id = v_target_op_id;
  ELSE
    v_prev_smr := COALESCE(public.get_machine_latest_closing_smr(v_machine_id), v_reading);
    IF v_prev_smr > v_reading THEN
      v_prev_smr := v_reading;
    END IF;

    INSERT INTO public.machine_operations (
      department_id,
      machine_id,
      shift_date,
      shift_type,
      start_time,
      end_time,
      start_smu,
      end_smu
    ) VALUES (
      NEW.tenant_id,
      v_machine_id,
      v_shift_date,
      'day',
      '06:00:00',
      '18:00:00',
      v_prev_smr,
      v_reading
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_smr_reading_to_machine_operations ON public.smr_readings;
CREATE TRIGGER trg_sync_smr_reading_to_machine_operations
  AFTER INSERT ON public.smr_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_smr_reading_to_machine_operations();

-- 4. Qualify schema references in sync_to_drill_operations and validate_delay_entry_time
CREATE OR REPLACE FUNCTION public.validate_delay_entry_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  mo_start TIMESTAMPTZ;
  mo_end TIMESTAMPTZ;
BEGIN
  IF NEW.delay_end_time IS NOT NULL THEN
    SELECT mo.shift_date::date + mo.start_time,
           COALESCE(
             mo.shift_date::date + mo.end_time,
             mo.shift_date::date + mo.start_time + INTERVAL '12 hours'
           )
    INTO mo_start, mo_end
    FROM public.machine_operations mo
    WHERE mo.id = NEW.machine_operation_id;

    IF mo_start IS NOT NULL
       AND (NEW.delay_start_time < mo_start OR NEW.delay_end_time > mo_end) THEN
      RAISE EXCEPTION 'Delay times must be within the operation''s time window';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_to_drill_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine_type TEXT;
  v_drilling_dept_id UUID;
  v_operator_name TEXT;
  v_site_name TEXT;
  v_status TEXT;
  v_ext_delays NUMERIC := 0;
  v_prod_delays NUMERIC := 0;
  v_eng_delays NUMERIC := 0;
BEGIN
  SELECT machine_type INTO v_machine_type FROM public.machines WHERE id = NEW.machine_id;

  IF v_machine_type = 'Drill Rig' THEN
    SELECT id INTO v_drilling_dept_id FROM public.departments WHERE name = 'drilling';

    IF v_drilling_dept_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.operator_id IS NOT NULL THEN
      SELECT full_name INTO v_operator_name FROM public.operators WHERE id = NEW.operator_id;
    END IF;

    IF NEW.site_id IS NOT NULL THEN
      SELECT name INTO v_site_name FROM public.sites WHERE id = NEW.site_id;
    END IF;

    IF NEW.end_smu IS NULL THEN
      v_status := 'active';
    ELSE
      v_status := 'completed';
    END IF;

    SELECT
      COALESCE(SUM(CASE WHEN dc.name = 'External' THEN de.duration_hours * 60 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN dc.name = 'Production' THEN de.duration_hours * 60 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN dc.name = 'Engineering' THEN de.duration_hours * 60 ELSE 0 END), 0)
    INTO v_ext_delays, v_prod_delays, v_eng_delays
    FROM public.delay_entries de
    JOIN public.delay_categories dc ON de.delay_category_id = dc.id
    WHERE de.machine_operation_id = NEW.id
      AND de.deleted_at IS NULL;

    INSERT INTO public.drill_operations (
      department_id,
      machine_id,
      shift_type,
      operation_date,
      open_hours,
      close_hours,
      holes,
      meters_drilled,
      block_drilled,
      operator_name,
      site,
      status,
      non_productional_delays,
      production_delays,
      engineering_delays,
      notes
    ) VALUES (
      v_drilling_dept_id,
      NEW.machine_id,
      NEW.shift_type,
      NEW.shift_date,
      NEW.start_smu,
      NEW.end_smu,
      COALESCE(NEW.holes_drilled, 0),
      COALESCE(NEW.meters_drilled, 0),
      NEW.block_drilled,
      v_operator_name,
      v_site_name,
      v_status,
      v_ext_delays,
      v_prod_delays,
      v_eng_delays,
      'Auto-synced from Control Room'
    )
    ON CONFLICT (machine_id, operation_date)
    DO UPDATE SET
      shift_type = EXCLUDED.shift_type,
      open_hours = EXCLUDED.open_hours,
      close_hours = EXCLUDED.close_hours,
      holes = EXCLUDED.holes,
      meters_drilled = EXCLUDED.meters_drilled,
      block_drilled = EXCLUDED.block_drilled,
      operator_name = EXCLUDED.operator_name,
      site = EXCLUDED.site,
      status = EXCLUDED.status,
      non_productional_delays = EXCLUDED.non_productional_delays,
      production_delays = EXCLUDED.production_delays,
      engineering_delays = EXCLUDED.engineering_delays,
      notes = 'Auto-synced from Control Room';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Update atomic_machine_operator_dispatch so shift start dispatch carries forward close SMR
CREATE OR REPLACE FUNCTION public.atomic_machine_operator_dispatch(
  p_machine_id UUID,
  p_operator_id UUID,
  p_site_id UUID,
  p_department_id UUID,
  p_shift_date DATE,
  p_shift_type TEXT,
  p_start_time TIME,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine public.machines%ROWTYPE;
  v_operator public.operators%ROWTYPE;
  v_personnel public.personnel%ROWTYPE;
  v_existing_op public.machine_operations%ROWTYPE;
  v_operation_id UUID;
  v_capabilities JSONB;
  v_opening_smr NUMERIC(10, 1);
BEGIN
  SELECT * INTO v_machine FROM public.machines WHERE id = p_machine_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'MACHINE_NOT_FOUND',
      'reason', 'Machine not found'
    );
  END IF;

  IF NOT v_machine.active THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'MACHINE_INACTIVE',
      'reason', 'Machine is inactive or under maintenance'
    );
  END IF;

  SELECT * INTO v_operator FROM public.operators WHERE id = p_operator_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'OPERATOR_NOT_FOUND',
      'reason', 'Operator not found'
    );
  END IF;

  IF NOT v_operator.active THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'OPERATOR_INACTIVE',
      'reason', 'Operator status is inactive'
    );
  END IF;

  SELECT * INTO v_personnel FROM public.personnel WHERE emp_code = v_operator.employee_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'PERSONNEL_RECORD_MISSING',
      'reason', 'Personnel compliance record missing'
    );
  END IF;

  IF v_personnel.status ILIKE 'inactive' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'OPERATOR_INACTIVE',
      'reason', 'Personnel status is inactive'
    );
  END IF;

  IF v_personnel.medical_expiry IS NULL OR v_personnel.medical_expiry < CURRENT_DATE THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'CLEARANCE_EXPIRED',
      'reason', 'Medical clearance expired or missing'
    );
  END IF;

  IF v_personnel.induction_expiry IS NULL OR v_personnel.induction_expiry < CURRENT_DATE THEN
    RETURN jsonb_build_object(
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
      SELECT jsonb_build_object(
        'requiresHourlyLoads', mt.requires_hourly_loads,
        'tracksTonnage', mt.tracks_tonnage,
        'tracksCycleTime', mt.tracks_cycle_time,
        'tracksFuel', mt.tracks_fuel,
        'tracksBenchClearance', mt.tracks_bench_clearance,
        'tracksDrillDepth', mt.tracks_drill_depth
      ) INTO v_capabilities
      FROM public.machine_types mt
      WHERE mt.id = v_machine.machine_type_id;

      RETURN jsonb_build_object(
        'allowed', true,
        'alreadyAssigned', true,
        'operationId', v_existing_op.id,
        'startSmu', COALESCE(v_existing_op.start_smu, public.get_machine_latest_closing_smr(p_machine_id)),
        'machineCapabilities', COALESCE(v_capabilities, '{}'::jsonb)
      );
    ELSE
      RETURN jsonb_build_object(
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

  SELECT jsonb_build_object(
    'requiresHourlyLoads', mt.requires_hourly_loads,
    'tracksTonnage', mt.tracks_tonnage,
    'tracksCycleTime', mt.tracks_cycle_time,
    'tracksFuel', mt.tracks_fuel,
    'tracksBenchClearance', mt.tracks_bench_clearance,
    'tracksDrillDepth', mt.tracks_drill_depth
  ) INTO v_capabilities
  FROM public.machine_types mt
  WHERE mt.id = v_machine.machine_type_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'alreadyAssigned', false,
    'operationId', v_operation_id,
    'startSmu', v_opening_smr,
    'machineCapabilities', COALESCE(v_capabilities, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_machine_operator_dispatch(
  UUID, UUID, UUID, UUID, DATE, TEXT, TIME, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_machine_operator_dispatch(
  UUID, UUID, UUID, UUID, DATE, TEXT, TIME, UUID
) TO authenticated;

-- 6. Update get_unified_shift_compilation and get_multi_site_shift_compilation
--    so fleet_performance and fleet_smu resolve previous close SMR as start_smu when a shift starts
CREATE OR REPLACE FUNCTION public.get_unified_shift_compilation(
    p_department_id UUID,
    p_shift_date DATE,
    p_shift_type VARCHAR(10)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
    v_shift_status JSONB;
    v_production_summary JSONB;
    v_machine_kpis JSONB;
    v_breakdowns JSONB;
    v_tire_events JSONB;
    v_is_control_room BOOLEAN;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.auth_id = auth.uid()
          AND (
            e.role = 'admin'
            OR e.department_id = p_department_id
            OR p_department_id = ANY(e.accessible_departments)
          )
    ) THEN
        RAISE EXCEPTION 'Not authorized to access department';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.departments d WHERE d.id = p_department_id AND d.name = 'control-room'
    ) INTO v_is_control_room;

    -- A. Shift Status & Sign-off Metadata
    SELECT to_jsonb(s) INTO v_shift_status
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
    SELECT jsonb_build_object(
        'total_loads', COALESCE(SUM(hl.total_loads), 0)::int,
        'machines', COALESCE(jsonb_agg(jsonb_build_object(
            'machine_id', m.id,
            'machine_name', m.name,
            'machine_type', m.machine_type,
            'total_loads', COALESCE(hl.total_loads, 0)::int,
            'hourly_distribution', jsonb_build_object(
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
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
            SUM(COALESCE(manual_duration_hours, duration_hours)) as total_delay_hours
        FROM public.delay_entries
        WHERE status = 'committed'
        GROUP BY machine_operation_id
    ) de ON mo.id = de.machine_operation_id
    LEFT JOIN (
        SELECT
            fleet_id,
            SUM(EXTRACT(EPOCH FROM (COALESCE(time_out, NOW()::time) - time_in))/3600.0) as downtime_hours
        FROM public.breakdowns
        WHERE date_in = p_shift_date
        GROUP BY fleet_id
    ) bd ON bd.fleet_id = m.id::text OR bd.fleet_id = m.serial_number
    WHERE m.active = true
      AND (m.department_id = p_department_id OR v_is_control_room OR mo.id IS NOT NULL);

    -- D. Engineering Breakdowns during Shift
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
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

    v_result := jsonb_build_object(
        'meta', jsonb_build_object(
            'department_id', p_department_id,
            'shift_date', p_shift_date,
            'shift_type', p_shift_type,
            'compiled_at', NOW()
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

GRANT EXECUTE ON FUNCTION public.get_unified_shift_compilation(UUID, DATE, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_multi_site_shift_compilation(
    p_department_id UUID,
    p_shift_date DATE,
    p_shift_type VARCHAR(10)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
    v_shift_meta JSONB;
    v_production JSONB;
    v_rollover JSONB;
    v_fleet_smu JSONB;
    v_ancillary JSONB;
    v_breakdowns JSONB;
    v_bredell JSONB;
    v_is_control_room BOOLEAN;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.auth_id = auth.uid()
          AND (
            e.role = 'admin'
            OR e.department_id = p_department_id
            OR p_department_id = ANY(e.accessible_departments)
          )
    ) THEN
        RAISE EXCEPTION 'Not authorized to access department';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.departments d WHERE d.id = p_department_id AND d.name = 'control-room'
    ) INTO v_is_control_room;

    -- 1. Meta / Shift State
    SELECT jsonb_build_object(
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
        v_shift_meta := jsonb_build_object(
            'department_id', p_department_id,
            'shift_date', p_shift_date,
            'shift_type', p_shift_type,
            'status', 'open'
        );
    END IF;

    -- 2. Excavator Hauling & Production by Site
    SELECT jsonb_object_agg(site_code, site_payload) INTO v_production
    FROM (
        SELECT
            ehl.site_code,
            jsonb_agg(jsonb_build_object(
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
                jsonb_agg(jsonb_build_object(
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
    SELECT jsonb_build_object(
        'total_bcm', COALESCE(SUM(total_bcm), 0),
        'entries', COALESCE(jsonb_agg(jsonb_build_object(
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
    SELECT jsonb_object_agg(site_group, machine_list) INTO v_fleet_smu
    FROM (
        SELECT
            COALESCE(mo.site_code, s.site_code, 'BKF') as site_group,
            jsonb_agg(jsonb_build_object(
                'machine_id', m.id,
                'machine_name', m.name,
                'machine_type', m.machine_type,
                'start_smu', COALESCE(mo.start_smu, public.get_machine_latest_closing_smr(m.id)),
                'end_smu', mo.end_smu,
                'hours_worked', COALESCE(mo.hours_worked, 0),
                'operator_name', mo.operator_name,
                'operational_status', COALESCE(mo.operational_status, 'ACTIVE'),
                'notes', NULL
            ) ORDER BY m.machine_type, m.name) as machine_list
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
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
      AND COALESCE(b.site_code, 'BKF') != 'BREDELL';

    -- 7. Machines at Bredell Workshop
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'machine_name', COALESCE(m.name, b.machine_name, b.fleet_id),
        'reason', b.reason,
        'date_in', b.date_in
    )), '[]'::jsonb) INTO v_bredell
    FROM public.breakdowns b
    LEFT JOIN public.machines m ON b.fleet_id = m.id::text OR b.fleet_id = m.serial_number
    WHERE b.status = 'active'
      AND b.site_code = 'BREDELL'
      AND (b.department_id = p_department_id OR v_is_control_room OR b.shared_with_departments ? p_department_id::text);

    v_result := jsonb_build_object(
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

GRANT EXECUTE ON FUNCTION public.get_multi_site_shift_compilation(UUID, DATE, VARCHAR) TO authenticated, service_role;

-- 7. Populate all currently seeded machines with realistic, continuous SMR readings
--    (Previous shift end_smu -> Current shift start_smu -> Current shift end_smu -> Next shift start_smu)
DO $$
DECLARE
  v_control_room_id UUID;
  v_default_operator_id UUID;
  v_default_operator_name TEXT;
  v_default_site_id UUID;
  v_machine RECORD;
  v_prev_start NUMERIC(10, 1);
  v_prev_close NUMERIC(10, 1);
  v_curr_close NUMERIC(10, 1);
  v_idx INT := 0;
  v_hlc_base BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
BEGIN
  SELECT id INTO v_control_room_id FROM public.departments WHERE name = 'control-room' LIMIT 1;
  SELECT id, full_name INTO v_default_operator_id, v_default_operator_name
    FROM public.operators
   WHERE active = true
   ORDER BY full_name
   LIMIT 1;
  SELECT id INTO v_default_site_id FROM public.sites WHERE active = true ORDER BY name LIMIT 1;

  -- Backfill any legacy machine_operations rows missing start_smu / end_smu
  UPDATE public.machine_operations
     SET start_smu = 1840.0,
         end_smu = 1852.0
   WHERE start_smu IS NULL;

  FOR v_machine IN
    SELECT m.id, m.name, m.machine_type, m.department_id, m.site_id, s.site_code
      FROM public.machines m
      LEFT JOIN public.sites s ON m.site_id = s.id
     WHERE m.active = true
     ORDER BY m.name
  LOOP
    v_idx := v_idx + 1;

    -- Assign deterministic, realistic mining SMR baselines per seeded machine
    CASE v_machine.name
      WHEN 'BD-19' THEN
        v_prev_start := 4120.0;
        v_prev_close := 4129.5;
        v_curr_close := 4138.0;
      WHEN 'DR-001' THEN
        v_prev_start := 1408.5;
        v_prev_close := 1420.0;
        v_curr_close := 1431.5;
      WHEN 'DR-002' THEN
        v_prev_start := 2150.0;
        v_prev_close := 2160.5;
        v_curr_close := 2171.0;
      WHEN 'DT-101' THEN
        v_prev_start := 3240.0;
        v_prev_close := 3250.5;
        v_curr_close := 3261.0;
      WHEN 'DT-102' THEN
        v_prev_start := 2890.0;
        v_prev_close := 2900.0;
        v_curr_close := 2910.5;
      WHEN 'EX-501' THEN
        v_prev_start := 5410.0;
        v_prev_close := 5421.0;
        v_curr_close := 5432.0;
      WHEN 'GEN-A' THEN
        v_prev_start := 1852.0;
        v_prev_close := 1864.0;
        v_curr_close := 1876.0;
      WHEN 'GEN-B' THEN
        v_prev_start := 1620.0;
        v_prev_close := 1631.5;
        v_curr_close := 1643.0;
      ELSE
        v_prev_start := 1000.0 + (v_idx * 250.0);
        v_prev_close := v_prev_start + 10.5;
        v_curr_close := v_prev_close + 10.5;
    END CASE;

    -- Previous shift operation (yesterday night shift: closes at v_prev_close)
    INSERT INTO public.machine_operations (
      department_id,
      machine_id,
      operator_id,
      operator_name,
      site_id,
      site_code,
      shift_date,
      shift_type,
      start_time,
      end_time,
      start_smu,
      end_smu,
      operational_status,
      holes_drilled,
      meters_drilled,
      block_drilled
    ) VALUES (
      COALESCE(v_control_room_id, v_machine.department_id),
      v_machine.id,
      v_default_operator_id,
      COALESCE(v_default_operator_name, 'Shift Operator'),
      COALESCE(v_machine.site_id, v_default_site_id),
      COALESCE(v_machine.site_code, 'BKF'),
      CURRENT_DATE - 1,
      'night',
      '18:00:00',
      '06:00:00',
      v_prev_start,
      v_prev_close,
      'ACTIVE',
      CASE WHEN v_machine.machine_type = 'Drill Rig' THEN 16 ELSE NULL END,
      CASE WHEN v_machine.machine_type = 'Drill Rig' THEN 212.0 ELSE NULL END,
      CASE WHEN v_machine.machine_type = 'Drill Rig' THEN 'Pit-A-Bench-03' ELSE NULL END
    )
    ON CONFLICT (machine_id, shift_date, shift_type, start_smu) WHERE start_smu IS NOT NULL
    DO UPDATE SET
      end_smu = EXCLUDED.end_smu,
      operator_id = COALESCE(public.machine_operations.operator_id, EXCLUDED.operator_id),
      operator_name = COALESCE(public.machine_operations.operator_name, EXCLUDED.operator_name),
      site_id = COALESCE(public.machine_operations.site_id, EXCLUDED.site_id),
      site_code = COALESCE(public.machine_operations.site_code, EXCLUDED.site_code),
      operational_status = 'ACTIVE';

    -- Current shift operation (today day shift: starts at v_prev_close and closes at v_curr_close)
    INSERT INTO public.machine_operations (
      department_id,
      machine_id,
      operator_id,
      operator_name,
      site_id,
      site_code,
      shift_date,
      shift_type,
      start_time,
      end_time,
      start_smu,
      end_smu,
      operational_status,
      holes_drilled,
      meters_drilled,
      block_drilled
    ) VALUES (
      COALESCE(v_control_room_id, v_machine.department_id),
      v_machine.id,
      v_default_operator_id,
      COALESCE(v_default_operator_name, 'Shift Operator'),
      COALESCE(v_machine.site_id, v_default_site_id),
      COALESCE(v_machine.site_code, 'BKF'),
      CURRENT_DATE,
      'day',
      '06:00:00',
      '18:00:00',
      v_prev_close,
      v_curr_close,
      'ACTIVE',
      CASE WHEN v_machine.machine_type = 'Drill Rig' THEN 18 ELSE NULL END,
      CASE WHEN v_machine.machine_type = 'Drill Rig' THEN 234.5 ELSE NULL END,
      CASE WHEN v_machine.machine_type = 'Drill Rig' THEN 'Pit-A-Bench-04' ELSE NULL END
    )
    ON CONFLICT (machine_id, shift_date, shift_type, start_smu) WHERE start_smu IS NOT NULL
    DO UPDATE SET
      end_smu = EXCLUDED.end_smu,
      operator_id = COALESCE(public.machine_operations.operator_id, EXCLUDED.operator_id),
      operator_name = COALESCE(public.machine_operations.operator_name, EXCLUDED.operator_name),
      site_id = COALESCE(public.machine_operations.site_id, EXCLUDED.site_id),
      site_code = COALESCE(public.machine_operations.site_code, EXCLUDED.site_code),
      operational_status = 'ACTIVE';

    -- Also populate smr_readings append-only store for CRDT / shift closeout parity
    INSERT INTO public.smr_readings (
      tenant_id,
      meter_id,
      reading,
      reading_at,
      device_id,
      hlc_wall,
      hlc_counter,
      node_id,
      mutation_id
    ) VALUES (
      COALESCE(v_control_room_id, v_machine.department_id),
      v_machine.id::text,
      v_curr_close,
      NOW(),
      'seed-baseline-smr',
      v_hlc_base + v_idx,
      0,
      'seed',
      v_machine.id
    )
    ON CONFLICT (tenant_id, mutation_id) DO UPDATE SET
      reading = EXCLUDED.reading,
      reading_at = EXCLUDED.reading_at,
      hlc_wall = EXCLUDED.hlc_wall;

    -- For Dozers, also seed dozer_rollover_logs with matching SMR
    IF v_machine.machine_type IN ('Dozer', 'Track Dozer') AND NOT EXISTS (
      SELECT 1 FROM public.dozer_rollover_logs
      WHERE machine_id = v_machine.id AND shift_date = CURRENT_DATE AND shift_type = 'day'
    ) THEN
      INSERT INTO public.dozer_rollover_logs (
        department_id,
        shift_date,
        shift_type,
        site_code,
        machine_id,
        operator_name,
        start_smu,
        end_smu,
        push_factor_bcm_per_hour
      ) VALUES (
        COALESCE(v_control_room_id, v_machine.department_id),
        CURRENT_DATE,
        'day',
        COALESCE(v_machine.site_code, 'EXT'),
        v_machine.id,
        COALESCE(v_default_operator_name, 'Shift Operator'),
        v_prev_close,
        v_curr_close,
        250.0
      );
    END IF;
  END LOOP;
END $$;

REFRESH MATERIALIZED VIEW public.smr_latest;
