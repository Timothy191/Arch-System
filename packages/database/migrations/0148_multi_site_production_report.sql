-- ============================================================================
-- Migration: 0148_multi_site_production_report.sql
-- Description: Multi-site shift compilation for Brakfontein (BKF), Extension (EXT),
--              Coal Processing Plant (PLANT), and Bredell Off-Site Workshop.
-- ============================================================================

-- 1. Status enum for machine operating hours & availability
DO $$ BEGIN
    CREATE TYPE machine_operational_status AS ENUM (
        'ACTIVE',
        'STANDBY',
        'BREAKDOWN',
        'BREDELL',
        'NO_OPERATOR',
        'NO_SPACE',
        'OFFSITE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Enhance machine_operations table with operational status and operator metadata
ALTER TABLE machine_operations
  ADD COLUMN IF NOT EXISTS operational_status machine_operational_status DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS operator_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS start_smu NUMERIC(10, 1),
  ADD COLUMN IF NOT EXISTS end_smu NUMERIC(10, 1),
  ADD COLUMN IF NOT EXISTS site_code VARCHAR(20) DEFAULT 'BKF'; -- 'BKF', 'EXT', 'PLANT', 'BREDELL'

CREATE INDEX IF NOT EXISTS idx_machine_operations_site ON machine_operations(shift_date, site_code);

-- 3. Excavator-Truck Hauling & Face Performance Table
CREATE TABLE IF NOT EXISTS excavator_haul_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(10) NOT NULL CHECK (shift_type IN ('day', 'night')),
    site_code VARCHAR(20) NOT NULL DEFAULT 'BKF',
    excavator_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    operator_name VARCHAR(100) NOT NULL,
    material_type VARCHAR(50) NOT NULL, -- 'TOPSOIL', '4#LOWER', '2#LOWER', '4#UPPER', 'OVERBURDEN'
    block_id VARCHAR(50) NOT NULL,       -- 'SS07-08', 'EX11-05', etc.
    operating_hours NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    delays_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_excavator_shift UNIQUE (excavator_id, shift_date, shift_type, block_id)
);

CREATE TABLE IF NOT EXISTS excavator_truck_tallies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    haul_log_id UUID NOT NULL REFERENCES excavator_haul_logs(id) ON DELETE CASCADE,
    truck_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    truck_name VARCHAR(50) NOT NULL,
    load_count INT NOT NULL DEFAULT 0,
    bcm_per_load NUMERIC(6, 2) DEFAULT 14.00,
    tonnes_per_load NUMERIC(6, 2) DEFAULT 40.60,
    CONSTRAINT uq_haul_truck UNIQUE (haul_log_id, truck_id)
);

-- 4. Dozer Rollover Volume Tracking
CREATE TABLE IF NOT EXISTS dozer_rollover_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(10) NOT NULL CHECK (shift_type IN ('day', 'night')),
    site_code VARCHAR(20) NOT NULL DEFAULT 'EXT',
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    operator_name VARCHAR(100),
    start_smu NUMERIC(10, 1) NOT NULL,
    end_smu NUMERIC(10, 1) NOT NULL,
    push_factor_bcm_per_hour NUMERIC(6, 1) NOT NULL DEFAULT 250.0,
    calculated_hours NUMERIC(4, 1) GENERATED ALWAYS AS (end_smu - start_smu) STORED,
    total_bcm NUMERIC(10, 1) GENERATED ALWAYS AS ((end_smu - start_smu) * push_factor_bcm_per_hour) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Ancillary & Service Equipment Runs
CREATE TABLE IF NOT EXISTS ancillary_shift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(10) NOT NULL CHECK (shift_type IN ('day', 'night')),
    site_code VARCHAR(20) NOT NULL,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'DUST_SUPPRESSION', 'DIESEL_DELIVERY', 'ROAD_MAINTENANCE', 'RAMP_CREATION', 'BERM_CONSTRUCTION'
    trip_loads INT DEFAULT 0,
    fuel_liters NUMERIC(10, 1),
    activity_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enhance Breakdowns with Location & Impact Flags
ALTER TABLE breakdowns
  ADD COLUMN IF NOT EXISTS site_code VARCHAR(20) DEFAULT 'BKF',
  ADD COLUMN IF NOT EXISTS is_operational_defect BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 0;

-- 7. Enable Row Level Security (RLS) on all newly created tables
ALTER TABLE excavator_haul_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE excavator_truck_tallies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dozer_rollover_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ancillary_shift_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users and service role
DO $$ BEGIN
  CREATE POLICY "Authenticated users can read excavator haul logs"
    ON excavator_haul_logs FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert/update excavator haul logs"
    ON excavator_haul_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read excavator truck tallies"
    ON excavator_truck_tallies FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert/update excavator truck tallies"
    ON excavator_truck_tallies FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read dozer rollover logs"
    ON dozer_rollover_logs FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert/update dozer rollover logs"
    ON dozer_rollover_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read ancillary shift logs"
    ON ancillary_shift_logs FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert/update ancillary shift logs"
    ON ancillary_shift_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. Shift Aggregation RPC: get_multi_site_shift_compilation
CREATE OR REPLACE FUNCTION get_multi_site_shift_compilation(
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
    v_shift_meta JSONB;
    v_production JSONB;
    v_rollover JSONB;
    v_fleet_smu JSONB;
    v_ancillary JSONB;
    v_breakdowns JSONB;
    v_bredell JSONB;
BEGIN
    -- 1. Meta / Shift State
    SELECT jsonb_build_object(
        'department_id', p_department_id,
        'shift_date', p_shift_date,
        'shift_type', p_shift_type,
        'status', COALESCE(s.status, 'open'),
        'closed_at', s.closed_at,
        'closed_by', s.closed_by,
        'notes', s.notes
    ) INTO v_shift_meta
    FROM shift_status s
    WHERE s.department_id = p_department_id 
      AND s.shift_date = p_shift_date 
      AND s.shift_type = p_shift_type;

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
        FROM excavator_haul_logs ehl
        JOIN machines m ON ehl.excavator_id = m.id
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
            FROM excavator_truck_tallies
            GROUP BY haul_log_id
        ) tally ON ehl.id = tally.haul_log_id
        WHERE ehl.department_id = p_department_id 
          AND ehl.shift_date = p_shift_date 
          AND ehl.shift_type = p_shift_type
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
    FROM dozer_rollover_logs drl
    JOIN machines m ON drl.machine_id = m.id
    WHERE drl.department_id = p_department_id 
      AND drl.shift_date = p_shift_date 
      AND drl.shift_type = p_shift_type;

    -- 4. Machine SMU & Availability Registry
    SELECT jsonb_object_agg(site_group, machine_list) INTO v_fleet_smu
    FROM (
        SELECT 
            COALESCE(mo.site_code, 'UNASSIGNED') as site_group,
            jsonb_agg(jsonb_build_object(
                'machine_id', m.id,
                'machine_name', m.name,
                'machine_type', m.machine_type,
                'start_smu', mo.start_smu,
                'end_smu', mo.end_smu,
                'hours_worked', COALESCE(mo.hours_worked, 0),
                'operator_name', mo.operator_name,
                'operational_status', COALESCE(mo.operational_status, 'STANDBY'),
                'notes', mo.delay_notes
            ) ORDER BY m.machine_type, m.name) as machine_list
        FROM machines m
        LEFT JOIN machine_operations mo ON m.id = mo.machine_id 
            AND mo.shift_date = p_shift_date 
            AND mo.shift_type = p_shift_type
        WHERE m.department_id = p_department_id AND m.active = true
        GROUP BY COALESCE(mo.site_code, 'UNASSIGNED')
    ) fleet_data;

    -- 5. Ancillary Summary (Water bowsers, Fuel, Road maintenance)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'machine_name', m.name,
        'site_code', asl.site_code,
        'activity_type', asl.activity_type,
        'trip_loads', asl.trip_loads,
        'fuel_liters', asl.fuel_liters,
        'notes', asl.activity_notes
    )), '[]'::jsonb) INTO v_ancillary
    FROM ancillary_shift_logs asl
    JOIN machines m ON asl.machine_id = m.id
    WHERE asl.department_id = p_department_id 
      AND asl.shift_date = p_shift_date 
      AND asl.shift_type = p_shift_type;

    -- 6. Engineering Breakdowns
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'machine_id', b.machine_id,
        'machine_name', COALESCE(m.name, b.machine_name),
        'site_code', b.site_code,
        'duration_hours', ROUND(COALESCE(b.duration_minutes, 0) / 60.0, 2),
        'reason', b.reason,
        'repair_notes', b.repair_notes,
        'is_operational_defect', b.is_operational_defect,
        'status', b.status
    )), '[]'::jsonb) INTO v_breakdowns
    FROM breakdowns b
    LEFT JOIN machines m ON b.machine_id = m.id
    WHERE b.date_in = p_shift_date 
      AND (b.department_id = p_department_id OR b.shared_with_departments ? p_department_id::text)
      AND b.site_code != 'BREDELL';

    -- 7. Machines at Bredell Workshop
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'machine_name', COALESCE(m.name, b.machine_name),
        'reason', b.reason,
        'date_in', b.date_in
    )), '[]'::jsonb) INTO v_bredell
    FROM breakdowns b
    LEFT JOIN machines m ON b.machine_id = m.id
    WHERE b.status = 'active' AND b.site_code = 'BREDELL';

    -- Combine into unified compilation payload
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_multi_site_shift_compilation(UUID, DATE, VARCHAR) TO authenticated, service_role;
