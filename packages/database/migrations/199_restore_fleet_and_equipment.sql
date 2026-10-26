-- 199_restore_fleet_and_equipment.sql
-- Restore public.fleet and public.equipment.
--
-- 035 was recorded as applied on this project but its objects never landed.
-- Access-control pages and the C66 badge API query both tables directly
-- (qr-codes/actions.ts, api/c66/route.ts, departments/[id]/fleet/route.ts),
-- so the schema is functionally incomplete without them.
--
-- 035's badges FK additions are intentionally not repeated: the deployed badges
-- table has no fleet_id/equipment_id columns, so those constraints cannot exist.
-- Policy names match 035 so environments that already ran it are unaffected.

CREATE TABLE IF NOT EXISTS public.fleet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_code text UNIQUE NOT NULL,
  vehicle_type text NOT NULL,
  registration_number text,
  make text,
  model text,
  year bigint,
  department_id uuid REFERENCES public.departments(id),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'In Service', 'Decommissioned')),
  last_service_date date,
  next_service_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equip_code text UNIQUE NOT NULL,
  equipment_type text NOT NULL,
  serial_number text,
  manufacturer text,
  model text,
  department_id uuid REFERENCES public.departments(id),
  assigned_to uuid REFERENCES public.personnel(id),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'In Calibration', 'Decommissioned')),
  calibration_expiry date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_code ON public.fleet(fleet_code);
CREATE INDEX IF NOT EXISTS idx_fleet_department ON public.fleet(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_code ON public.equipment(equip_code);
CREATE INDEX IF NOT EXISTS idx_equipment_department ON public.equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assigned_to ON public.equipment(assigned_to);

ALTER TABLE public.fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access control read fleet" ON public.fleet;
CREATE POLICY "Allow access control read fleet" ON public.fleet
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.role = 'access_control' OR e.department_id = fleet.department_id)
    )
  );

DROP POLICY IF EXISTS "Allow access control insert fleet" ON public.fleet;
CREATE POLICY "Allow access control insert fleet" ON public.fleet
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
  );

DROP POLICY IF EXISTS "Allow access control update fleet" ON public.fleet;
CREATE POLICY "Allow access control update fleet" ON public.fleet
  FOR UPDATE TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
  );

DROP POLICY IF EXISTS "Allow access control delete fleet" ON public.fleet;
CREATE POLICY "Allow access control delete fleet" ON public.fleet
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
  );

DROP POLICY IF EXISTS "Allow access control read equipment" ON public.equipment;
CREATE POLICY "Allow access control read equipment" ON public.equipment
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.role = 'access_control' OR e.department_id = equipment.department_id)
    )
  );

DROP POLICY IF EXISTS "Allow access control insert equipment" ON public.equipment;
CREATE POLICY "Allow access control insert equipment" ON public.equipment
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
  );

DROP POLICY IF EXISTS "Allow access control update equipment" ON public.equipment;
CREATE POLICY "Allow access control update equipment" ON public.equipment
  FOR UPDATE TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
  );

DROP POLICY IF EXISTS "Allow access control delete equipment" ON public.equipment;
CREATE POLICY "Allow access control delete equipment" ON public.equipment
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
  );
