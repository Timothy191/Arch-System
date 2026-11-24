-- Migration 229: Enrich Fleet Machines Metadata (Production Dept, Manufacturers, Starting SMR & Machine Pictures)
-- Description:
--   1. Adds image_url column on public.machines for visual fleet thumbnails & cards.
--   2. Reassigns fleet machinery from Admin to the Production department.
--   3. Backfills manufacturer for all fleet assets (all ADT DT-* units -> Volvo, plus Cat/Komatsu/Hitachi/Atlas Copco/Sany/Toyota Hino/Metso/BOMAG).
--   4. Backfills starting_smr where NULL or <= 0 from earliest positive machine_operations SMR or type baseline.
--   5. Backfills image_url pointing to /images/fleet/*.webp reference photographs.
-- rls-exempt: alters and backfills existing RLS-protected table public.machines

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.machines.image_url IS
  'Relative or CDN path to the fleet machine reference image shown in Admin Fleet and asset cards.';

DO $$
DECLARE
  v_admin_dept_id UUID;
  v_production_dept_id UUID;
BEGIN
  SELECT id INTO v_admin_dept_id
  FROM public.departments
  WHERE name = 'admin'
  LIMIT 1;

  SELECT id INTO v_production_dept_id
  FROM public.departments
  WHERE name = 'production'
  LIMIT 1;

  -- 1. Move machinery assigned to Admin (or unassigned) into Production
  IF v_production_dept_id IS NOT NULL THEN
    UPDATE public.machines
    SET department_id = v_production_dept_id,
        updated_at = now()
    WHERE deleted_at IS NULL
      AND (department_id IS NULL OR department_id = v_admin_dept_id);
  END IF;

  -- 2. Backfill Manufacturer (ensure all ADTs are Volvo and identify all other OEMs)
  UPDATE public.machines
  SET manufacturer = CASE
      WHEN upper(name) LIKE 'DT-%'
        OR lower(COALESCE(machine_type, '')) LIKE '%articulated%'
        OR lower(COALESCE(serial_number, '')) LIKE 'volvo%'
        OR upper(name) IN ('FB-18', 'WB-004', 'WB-006') THEN 'Volvo'
      WHEN lower(COALESCE(serial_number, '')) LIKE 'caterpillar%' THEN 'Caterpillar'
      WHEN lower(COALESCE(serial_number, '')) LIKE 'komatsu%' THEN 'Komatsu'
      WHEN lower(COALESCE(serial_number, '')) LIKE 'hitachi%' THEN 'Hitachi'
      WHEN lower(COALESCE(serial_number, '')) LIKE 'atlas copco%' THEN 'Atlas Copco'
      WHEN lower(COALESCE(serial_number, '')) LIKE 'sany%' THEN 'Sany'
      WHEN lower(COALESCE(serial_number, '')) LIKE 'toyota hino%' THEN 'Toyota Hino'
      WHEN upper(name) LIKE 'CR-%' THEN 'Metso'
      WHEN upper(name) LIKE 'CKN-%' THEN 'BOMAG'
      ELSE 'Heavy Fleet'
    END,
    updated_at = now()
  WHERE deleted_at IS NULL
    AND (manufacturer IS NULL OR btrim(manufacturer) = '');

  -- 3. Backfill Starting SMR from earliest recorded machine_operations or deterministic fallback
  UPDATE public.machines AS m
  SET starting_smr = COALESCE(
      (
        SELECT ROUND(COALESCE(NULLIF(mo.start_smu, 0), mo.end_smu)::numeric, 1)
        FROM public.machine_operations AS mo
        WHERE mo.machine_id = m.id
          AND COALESCE(mo.start_smu, mo.end_smu, 0) > 0
        ORDER BY mo.shift_date ASC NULLS LAST, mo.created_at ASC NULLS LAST
        LIMIT 1
      ),
      CASE
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%dozer%' THEN 14500.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%excavator%' THEN 12800.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%dump%' THEN 11400.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%drill%' THEN 9200.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%loader%' THEN 8600.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%grader%' THEN 7900.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%crusher%' THEN 6400.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%water%' THEN 5100.0
        WHEN lower(COALESCE(m.machine_type, '')) LIKE '%compactor%' THEN 3500.0
        ELSE 4200.0
      END
    ),
    updated_at = now()
  WHERE m.deleted_at IS NULL
    AND (m.starting_smr IS NULL OR m.starting_smr <= 0);

  -- 4. Backfill machine reference images
  UPDATE public.machines
  SET image_url = CASE
      WHEN upper(name) LIKE 'DT-%' THEN '/images/fleet/volvo-adt.webp'
      WHEN upper(name) LIKE 'WB-%' OR lower(COALESCE(machine_type, '')) LIKE '%water%' THEN '/images/fleet/water-bowser.webp'
      WHEN upper(name) = 'FB-16' OR lower(COALESCE(manufacturer, '')) LIKE '%toyota%' THEN '/images/fleet/service-bowser.webp'
      WHEN upper(name) = 'FB-18' THEN '/images/fleet/volvo-adt.webp'
      WHEN upper(name) LIKE 'CR-%' OR lower(COALESCE(machine_type, '')) LIKE '%crusher%' THEN '/images/fleet/mobile-crusher.webp'
      WHEN upper(name) LIKE 'CKN-%' OR lower(COALESCE(machine_type, '')) LIKE '%compactor%' THEN '/images/fleet/roller-compactor.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%drill%' THEN '/images/fleet/atlas-copco-drill.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%dozer%' AND lower(COALESCE(manufacturer, '')) = 'komatsu' THEN '/images/fleet/komatsu-dozer.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%dozer%' THEN '/images/fleet/caterpillar-dozer.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%excavator%' AND lower(COALESCE(manufacturer, '')) = 'komatsu' THEN '/images/fleet/komatsu-excavator.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%excavator%' THEN '/images/fleet/hitachi-excavator.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%grader%' AND lower(COALESCE(manufacturer, '')) = 'sany' THEN '/images/fleet/sany-grader.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%grader%' THEN '/images/fleet/caterpillar-grader.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%loader%' AND lower(COALESCE(manufacturer, '')) = 'caterpillar' THEN '/images/fleet/caterpillar-loader.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%loader%' THEN '/images/fleet/volvo-loader.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%dump%' AND lower(COALESCE(manufacturer, '')) = 'komatsu' THEN '/images/fleet/komatsu-rdt.webp'
      WHEN lower(COALESCE(machine_type, '')) LIKE '%dump%' AND lower(COALESCE(manufacturer, '')) = 'caterpillar' THEN '/images/fleet/caterpillar-rdt.webp'
      ELSE '/images/fleet/volvo-adt.webp'
    END,
    updated_at = now()
  WHERE deleted_at IS NULL
    AND (image_url IS NULL OR btrim(image_url) = '');
END $$;
