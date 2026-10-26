-- ============================================
-- Migration: 208_engineering_notes_overview_delay_categories.sql
-- Description: Seed the additional 5 shift-overview delay categories so the
--              Control Room -> Engineering Notes "Overview" table maps all 12
--              delay columns to canonical public.delay_categories rows.
-- ============================================

INSERT INTO public.delay_categories (name, color, icon, sort_order, description, is_active)
VALUES
  ('Lunches',        '#14b8a6', 'Utensils',    27, 'Scheduled operator meal / lunch break (standard 0.5h)',           true),
  ('Safety Talks',   '#0ea5e9', 'ShieldCheck', 28, 'Shift start safety briefing / toolbox talk (standard 0.5h)',      true),
  ('Refueling',      '#eab308', 'Fuel',        29, 'Equipment refueling allowance (standard 0.2h)',                   true),
  ('Standby',        '#64748b', 'PauseCircle', 30, 'Machine available on standby awaiting dispatch',                  true),
  ('Tyres & Tracks', '#a855f7', 'Disc',        31, 'Tyre, track, and tramming inspection allowance (standard 0.2h)',  true)
ON CONFLICT (name) DO NOTHING;
