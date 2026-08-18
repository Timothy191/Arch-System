-- ============================================
-- Tire Management Schema
-- ============================================

-- Create tires table
CREATE TABLE IF NOT EXISTS tires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  size TEXT NOT NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  position TEXT NOT NULL, -- e.g. "Front Left", "Front Right", "Rear Inner Left", "Rear Outer Left", "Rear Inner Right", "Rear Outer Right"
  status TEXT NOT NULL CHECK (status IN ('installed', 'inventory', 'scrapped')),
  installed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  installed_hours INTEGER NOT NULL DEFAULT 0,
  removed_at DATE,
  removed_hours INTEGER,
  scrapped_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tire inspections table
CREATE TABLE IF NOT EXISTS tire_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id UUID NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tread_depth_mm NUMERIC(4,1) NOT NULL,
  pressure_psi NUMERIC(4,1) NOT NULL,
  condition_status TEXT NOT NULL CHECK (condition_status IN ('good', 'warning', 'critical')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE tires ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_inspections ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tires_machine_id ON tires(machine_id);
CREATE INDEX IF NOT EXISTS idx_tires_status ON tires(status);
CREATE INDEX IF NOT EXISTS idx_tire_inspections_tire_id ON tire_inspections(tire_id);

-- RLS Policies for tires
CREATE POLICY "tires_select_all"
  ON tires FOR SELECT
  TO authenticated
  USING (true); -- Anyone logged in can view tires (shared operational awareness)

CREATE POLICY "tires_write_engineering_admin"
  ON tires FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  );

-- RLS Policies for tire_inspections
CREATE POLICY "tire_inspections_select_all"
  ON tire_inspections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tire_inspections_write_engineering_admin"
  ON tire_inspections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR (e.role IN ('supervisor', 'operator') AND e.department_id = (SELECT id FROM departments WHERE name = 'engineering'))
        )
    )
  );

-- Function/RPC to calculate average tire life span per brand per machine type
CREATE OR REPLACE FUNCTION get_avg_tire_lifespan()
RETURNS TABLE (
  brand TEXT,
  machine_type TEXT,
  avg_lifespan_hours NUMERIC,
  avg_lifespan_days NUMERIC,
  scrapped_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.brand,
    m.machine_type,
    ROUND(AVG(t.removed_hours - t.installed_hours)::NUMERIC, 1) as avg_lifespan_hours,
    ROUND(AVG(t.removed_at - t.installed_at)::NUMERIC, 1) as avg_lifespan_days,
    COUNT(t.id) as scrapped_count
  FROM tires t
  JOIN machines m ON t.machine_id = m.id
  WHERE t.status = 'scrapped'
    AND t.removed_hours IS NOT NULL
    AND t.removed_at IS NOT NULL
  GROUP BY t.brand, m.machine_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
