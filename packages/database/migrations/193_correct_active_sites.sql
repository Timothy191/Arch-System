-- ============================================
-- Migration: 193_correct_active_sites
-- Description: Deactivate all sites except the three operational sites:
--              Brakfontein Pit, Brakfontein Plant, Extension Pit
-- ============================================

-- Deactivate all existing sites first
UPDATE sites SET active = false WHERE active = true;

-- Insert or update the three operational sites
INSERT INTO sites (name, site_code, active) VALUES
  ('Brakfontein Pit', 'BRAK-PIT', true),
  ('Brakfontein Plant', 'BRAK-PLANT', true),
  ('Extension Pit', 'EXT-PIT', true)
ON CONFLICT (site_code) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active;
