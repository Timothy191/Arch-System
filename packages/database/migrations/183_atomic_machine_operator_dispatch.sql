-- Migration: 183_atomic_machine_operator_dispatch.sql
-- Description: Atomic machine operator dispatch RPC with privacy-preserving clearance checks

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
BEGIN
  -- 1. Lock and validate machine row
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

  -- 2. Lock and validate operator row
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

  -- 3. Check clearance in personnel (without leaking dates or private records)
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

  -- 4. Check machine occupancy
  SELECT * INTO v_existing_op 
  FROM public.machine_operations
  WHERE machine_id = p_machine_id 
    AND shift_date = p_shift_date 
    AND shift_type = p_shift_type
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

  -- 5. Insert new assignment
  INSERT INTO public.machine_operations (
    department_id,
    machine_id,
    operator_id,
    site_id,
    shift_date,
    shift_type,
    start_time,
    created_by
  ) VALUES (
    p_department_id,
    p_machine_id,
    p_operator_id,
    p_site_id,
    p_shift_date,
    p_shift_type,
    p_start_time,
    p_created_by
  ) RETURNING id INTO v_operation_id;

  -- 6. Resolve capabilities
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
