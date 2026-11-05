-- ============================================
-- Migration: 215_fix_machine_operations_and_activity_sites
-- Description: Cleanse legacy/fake sites, eliminate any 'General' site,
--              and enforce alignment of machine_operations and excavator_activity
--              with active operational sites (Brakfontein Pit, Brakfontein Plant, Extension Pit).
-- ============================================

-- Step 1: Remove any legacy or mock sites referencing 'General' or 'General Pit'
DELETE FROM sites WHERE name ILIKE '%General%';

-- Step 2: Ensure the three canonical operational sites are active
UPDATE sites
SET active = true
WHERE site_code IN ('BRAK-PIT', 'BRAK-PLANT', 'EXT-PIT');

-- Step 3: Remap machine_operations with null or inactive site_id to their machine's active site_id
UPDATE machine_operations mo
SET site_id = m.site_id
FROM machines m
WHERE mo.machine_id = m.id
  AND m.site_id IS NOT NULL
  AND (mo.site_id IS NULL OR mo.site_id NOT IN (SELECT id FROM sites WHERE active = true));

-- Step 4: Remap excavator_activity with null or inactive site_id to their machine's active site_id
UPDATE excavator_activity ea
SET site_id = m.site_id
FROM machines m
WHERE ea.machine_id = m.id
  AND m.site_id IS NOT NULL
  AND (ea.site_id IS NULL OR ea.site_id NOT IN (SELECT id FROM sites WHERE active = true));
