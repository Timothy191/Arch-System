-- ============================================
-- Migration 078: InSAR GeoTIFF Satellite Deformations Table & RLS Policies
-- ============================================

CREATE TABLE IF NOT EXISTS satellite_deformations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  satellite_name TEXT NOT NULL CHECK (satellite_name IN ('Sentinel-1', 'TerraSAR-X', 'Capella', 'PAZ')),
  acquisition_date DATE NOT NULL,
  reference_date DATE NOT NULL,
  location_name TEXT NOT NULL,
  latitude NUMERIC(10,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(10,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  displacement_mm NUMERIC(8,2) NOT NULL,
  coherence_index NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (coherence_index BETWEEN 0 AND 1),
  risk_level TEXT NOT NULL DEFAULT 'none' CHECK (risk_level IN ('none', 'minor', 'moderate', 'critical')),
  cog_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for spatial location, risk queries, and date filtering
CREATE INDEX IF NOT EXISTS idx_satellite_deformations_dept_date ON satellite_deformations(department_id, acquisition_date);
CREATE INDEX IF NOT EXISTS idx_satellite_deformations_location_risk ON satellite_deformations(location_name, risk_level);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_satellite_deformations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS satellite_deformations_updated_at ON satellite_deformations;
CREATE TRIGGER satellite_deformations_updated_at
  BEFORE UPDATE ON satellite_deformations
  FOR EACH ROW
  EXECUTE FUNCTION update_satellite_deformations_updated_at();

-- Enable Row-Level Security (RLS)
ALTER TABLE satellite_deformations ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users with access to department or global admins
CREATE POLICY "satellite_deformations_select_all"
  ON satellite_deformations FOR SELECT
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );

-- INSERT policy: Department staff or admins
CREATE POLICY "satellite_deformations_insert_department"
  ON satellite_deformations FOR INSERT
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );

-- UPDATE policy: Department staff or admins
CREATE POLICY "satellite_deformations_update_department"
  ON satellite_deformations FOR UPDATE
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );

-- DELETE policy: Department supervisors/admins
CREATE POLICY "satellite_deformations_delete_department"
  ON satellite_deformations FOR DELETE
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );
