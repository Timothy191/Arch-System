-- ============================================================================
-- Migration: 0147_unified_shift_compilation.sql
-- Description: Unify Control Room, Machine Hours, Engineering Breakdowns, 
--              and Tire Management into a consolidated Shift Compilation Engine.
-- ============================================================================

-- 1. Link breakdowns directly to machines table
ALTER TABLE breakdowns 
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

-- Backfill machine_id from existing machine_name / fleet_id matches
UPDATE breakdowns b
SET machine_id = m.id
FROM machines m
WHERE b.machine_id IS NULL 
  AND (m.name = b.machine_name OR m.name = b.fleet_id);

CREATE INDEX IF NOT EXISTS idx_breakdowns_machine_id ON breakdowns(machine_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_date_status ON breakdowns(date_in, status);

-- 2. Enrich tire inspections with shift and operating context
ALTER TABLE tire_inspections
  ADD COLUMN IF NOT EXISTS machine_operation_id UUID REFERENCES machine_operations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_smu NUMERIC(10, 1),
  ADD COLUMN IF NOT EXISTS shift_date DATE,
  ADD COLUMN IF NOT EXISTS shift_type VARCHAR(10) CHECK (shift_type IN ('day', 'night'));

CREATE INDEX IF NOT EXISTS idx_tire_inspections_shift ON tire_inspections(shift_date, shift_type);

-- 3. Unified Shift Compilation RPC Engine
CREATE OR REPLACE FUNCTION get_unified_shift_compilation(
    p_department_id UUID,
    p_shift_date DATE,
    p_shift_type VARCHAR(10)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_shift_status JSONB;
    v_production_summary JSONB;
    v_machine_kpis JSONB;
    v_breakdowns JSONB;
    v_tire_events JSONB;
BEGIN
    -- A. Shift Status & Sign-off Metadata
    SELECT to_jsonb(s) INTO v_shift_status
    FROM (
        SELECT 
            id, department_id, shift_date, shift_type, status,
            closed_at, closed_by, approved_by, notes
        FROM shift_status
        WHERE department_id = p_department_id 
          AND shift_date = p_shift_date 
          AND shift_type = p_shift_type
        LIMIT 1
    ) s;

    -- B. Hourly Loads & Excavator Output Summary
    SELECT jsonb_build_object(
        'total_loads', COALESCE(SUM(hl.total_loads), 0),
        'machines', COALESCE(jsonb_agg(jsonb_build_object(
            'machine_id', m.id,
            'machine_name', m.name,
            'machine_type', m.machine_type,
            'total_loads', hl.total_loads,
            'hourly_distribution', jsonb_build_object(
                'h00', hl.hour_00, 'h01', hl.hour_01, 'h02', hl.hour_02, 'h03', hl.hour_03,
                'h04', hl.hour_04, 'h05', hl.hour_05, 'h06', hl.hour_06, 'h07', hl.hour_07,
                'h08', hl.hour_08, 'h09', hl.hour_09, 'h10', hl.hour_10, 'h11', hl.hour_11,
                'h12', hl.hour_12, 'h13', hl.hour_13, 'h14', hl.hour_14, 'h15', hl.hour_15,
                'h16', hl.hour_16, 'h17', hl.hour_17, 'h18', hl.hour_18, 'h19', hl.hour_19,
                'h20', hl.hour_20, 'h21', hl.hour_21, 'h22', hl.hour_22, 'h23', hl.hour_23
            )
        )), '[]'::jsonb)
    ) INTO v_production_summary
    FROM hourly_loads hl
    JOIN machines m ON hl.machine_id = m.id
    WHERE hl.department_id = p_department_id 
      AND hl.load_date = p_shift_date;

    -- C. Machine Operating Hours, Delays & Availability Calculation
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'machine_id', m.id,
        'machine_name', m.name,
        'machine_type', m.machine_type,
        'hours_worked', COALESCE(mo.hours_worked, 0),
        'start_time', mo.start_time,
        'end_time', mo.end_time,
        'breakdown_hours', COALESCE(bd.downtime_hours, 0),
        'delay_hours', COALESCE(de.total_delay_hours, 0),
        'mechanical_availability_pct', ROUND(
            CASE 
                WHEN (COALESCE(mo.hours_worked, 0) + COALESCE(bd.downtime_hours, 0)) = 0 THEN 100.0
                ELSE (COALESCE(mo.hours_worked, 0) / (COALESCE(mo.hours_worked, 0) + COALESCE(bd.downtime_hours, 0))) * 100.0
            END, 1
        )
    )), '[]'::jsonb) INTO v_machine_kpis
    FROM machines m
    LEFT JOIN machine_operations mo ON m.id = mo.machine_id 
        AND mo.shift_date = p_shift_date 
        AND mo.shift_type = p_shift_type
    LEFT JOIN (
        SELECT 
            machine_operation_id,
            SUM(COALESCE(manual_duration_hours, duration_hours)) as total_delay_hours
        FROM delay_entries
        WHERE status = 'committed'
        GROUP BY machine_operation_id
    ) de ON mo.id = de.machine_operation_id
    LEFT JOIN (
        SELECT 
            machine_id,
            SUM(EXTRACT(EPOCH FROM (COALESCE(time_out, NOW()::time) - time_in))/3600.0) as downtime_hours
        FROM breakdowns
        WHERE date_in = p_shift_date
        GROUP BY machine_id
    ) bd ON m.id = bd.machine_id
    WHERE m.department_id = p_department_id AND m.active = true;

    -- D. Engineering Breakdowns during Shift
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'machine_id', b.machine_id,
        'machine_name', COALESCE(m.name, b.machine_name),
        'time_in', b.time_in,
        'time_out', b.time_out,
        'reason', b.reason,
        'repair_notes', b.repair_notes,
        'status', b.status
    )), '[]'::jsonb) INTO v_breakdowns
    FROM breakdowns b
    LEFT JOIN machines m ON b.machine_id = m.id
    WHERE b.date_in = p_shift_date 
      AND (b.department_id = p_department_id OR b.shared_with_departments ? p_department_id::text);

    -- E. Tire Inspections & Swaps during Shift
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', ti.id,
        'tire_id', t.id,
        'serial_number', t.serial_number,
        'machine_name', m.name,
        'position', t.position,
        'pressure_psi', ti.pressure_psi,
        'tread_depth_mm', ti.tread_depth_mm,
        'condition_status', ti.condition_status,
        'notes', ti.notes
    )), '[]'::jsonb) INTO v_tire_events
    FROM tire_inspections ti
    JOIN tires t ON ti.tire_id = t.id
    LEFT JOIN machines m ON t.machine_id = m.id
    WHERE ti.shift_date = p_shift_date 
      AND (ti.shift_type = p_shift_type OR ti.shift_type IS NULL);

    -- Construct Final Aggregated Response
    v_result := jsonb_build_object(
        'meta', jsonb_build_object(
            'department_id', p_department_id,
            'shift_date', p_shift_date,
            'shift_type', p_shift_type,
            'compiled_at', NOW()
        ),
        'shift_status', COALESCE(v_shift_status, '{"status": "open"}'::jsonb),
        'production', v_production_summary,
        'fleet_performance', v_machine_kpis,
        'breakdowns', v_breakdowns,
        'tire_management', v_tire_events
    );

    RETURN v_result;
END;
$$;

-- Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION get_unified_shift_compilation(UUID, DATE, VARCHAR) TO authenticated;

