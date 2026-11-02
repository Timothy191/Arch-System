-- Migration 214: Enforce Excavator Activity Material Mode Check Constraint
-- Purpose: Align public.excavator_activity and public.excavator_activity_archive material_type
-- with @repo/contract excavatorMaterialSchema ('Waste' | 'Coal' | 'Plant' | 'Other' plus formatted subcategories)
-- using zero-lock NOT VALID check constraints.
-- rls-exempt: alters check constraint on existing RLS-protected tables public.excavator_activity and public.excavator_activity_archive

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_excavator_activity_material_type'
  ) THEN
    ALTER TABLE public.excavator_activity
      ADD CONSTRAINT chk_excavator_activity_material_type
      CHECK (
        material_type IS NULL
        OR (
          length(btrim(material_type)) > 0
          AND length(material_type) <= 120
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_excavator_activity_archive_material_type'
  ) THEN
    ALTER TABLE public.excavator_activity_archive
      ADD CONSTRAINT chk_excavator_activity_archive_material_type
      CHECK (
        material_type IS NULL
        OR (
          length(btrim(material_type)) > 0
          AND length(material_type) <= 120
        )
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.excavator_activity.material_type IS
  'Excavator activity material/mode: Waste, Coal, Plant (logged as regular machine), Other (logged as regular machine), or formatted category/sub-category.';
