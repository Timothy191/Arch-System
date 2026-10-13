-- Migration: 180_machine_types_and_capabilities.sql
-- Description: Replace hardcoded machine checks with database-driven machine_types and capabilities

-- 1. Create machine_types table
CREATE TABLE IF NOT EXISTS public.machine_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  requires_hourly_loads BOOLEAN NOT NULL DEFAULT false,
  tracks_tonnage BOOLEAN NOT NULL DEFAULT false,
  tracks_cycle_time BOOLEAN NOT NULL DEFAULT false,
  tracks_fuel BOOLEAN NOT NULL DEFAULT true,
  tracks_bench_clearance BOOLEAN NOT NULL DEFAULT false,
  tracks_drill_depth BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS and grant read access to authenticated users
ALTER TABLE public.machine_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'machine_types' AND policyname = 'machine_types_select_all'
  ) THEN
    CREATE POLICY "machine_types_select_all"
      ON public.machine_types FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 3. Seed canonical mining equipment capabilities
INSERT INTO public.machine_types (name, code, requires_hourly_loads, tracks_tonnage, tracks_cycle_time, tracks_fuel, tracks_bench_clearance, tracks_drill_depth)
VALUES
  ('Articulated Dump Truck', 'ADT', true, true, true, true, false, false),
  ('Track Dozer', 'DZ', false, false, false, true, true, false),
  ('Hydraulic Excavator', 'EX', false, true, true, true, false, false),
  ('Blast Hole Drill', 'DR', false, false, false, true, false, true),
  ('Support Equipment', 'OTHER', false, false, false, true, false, false)
ON CONFLICT (code) DO UPDATE SET
  requires_hourly_loads = EXCLUDED.requires_hourly_loads,
  tracks_tonnage = EXCLUDED.tracks_tonnage,
  tracks_cycle_time = EXCLUDED.tracks_cycle_time,
  tracks_fuel = EXCLUDED.tracks_fuel,
  tracks_bench_clearance = EXCLUDED.tracks_bench_clearance,
  tracks_drill_depth = EXCLUDED.tracks_drill_depth;

-- 4. Add machine_type_id foreign key to machines table
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS machine_type_id UUID REFERENCES public.machine_types(id);

-- 5. Backfill existing machines based on legacy machine_type column
UPDATE public.machines
SET machine_type_id = (SELECT id FROM public.machine_types WHERE code = 'ADT')
WHERE machine_type IN ('Dump Truck', 'ADT') AND (machine_type_id IS NULL OR machine_type_id != (SELECT id FROM public.machine_types WHERE code = 'ADT'));

UPDATE public.machines
SET machine_type_id = (SELECT id FROM public.machine_types WHERE code = 'DZ')
WHERE machine_type IN ('Dozer', 'Track Dozer') AND (machine_type_id IS NULL OR machine_type_id != (SELECT id FROM public.machine_types WHERE code = 'DZ'));

UPDATE public.machines
SET machine_type_id = (SELECT id FROM public.machine_types WHERE code = 'EX')
WHERE machine_type IN ('Excavator', 'Hydraulic Excavator') AND (machine_type_id IS NULL OR machine_type_id != (SELECT id FROM public.machine_types WHERE code = 'EX'));

UPDATE public.machines
SET machine_type_id = (SELECT id FROM public.machine_types WHERE code = 'DR')
WHERE machine_type IN ('Drill Rig', 'Blast Hole Drill') AND (machine_type_id IS NULL OR machine_type_id != (SELECT id FROM public.machine_types WHERE code = 'DR'));

UPDATE public.machines
SET machine_type_id = (SELECT id FROM public.machine_types WHERE code = 'OTHER')
WHERE machine_type_id IS NULL;

-- 6. Add performance index on machine_type_id
CREATE INDEX IF NOT EXISTS idx_machines_machine_type_id
ON public.machines(machine_type_id);
