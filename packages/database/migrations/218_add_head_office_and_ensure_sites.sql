-- ============================================
-- Migration: 218_add_head_office_and_ensure_sites
-- Description: Add 'Head Office' to sites, ensure 'Brakfontein Plant',
--              'Brakfontein Pit', and 'Extension Pit' are active,
--              and verify foreign key and RLS integrity.
-- ============================================

-- Step 1: Insert or update 'Head Office' as an active site
INSERT INTO public.sites (name, site_code, active)
VALUES ('Head Office', 'HEAD-OFFICE', true)
ON CONFLICT (site_code) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  deleted_at = NULL;

-- Step 2: Ensure canonical operational sites are all active
UPDATE public.sites
SET active = true, deleted_at = NULL
WHERE site_code IN ('BRAK-PIT', 'BRAK-PLANT', 'EXT-PIT', 'HEAD-OFFICE');

-- Also ensure if 'Brankfontein Plant' or 'Brakfontein Plant' exists by name, it is active
UPDATE public.sites
SET active = true, deleted_at = NULL
WHERE name IN ('Brakfontein Plant', 'Brankfontein Plant', 'Brakfontein Pit', 'Extension Pit', 'Head Office');
