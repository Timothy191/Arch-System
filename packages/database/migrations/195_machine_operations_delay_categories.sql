-- ============================================
-- Migration: 195_machine_operations_delay_categories
-- Description: Seed the machine-operations shift-sheet delay buckets so the
--              Control Room sheet can report them as stable columns.
--
-- Why categories instead of new numeric columns:
--   delay_entries + delay_categories is already the granular delay mechanism
--   for machine_operations (068_delay_entries_table.sql). The drill domain got
--   hard-coded columns (026_drill_delays_refinement.sql), but adding seven
--   NUMERIC columns per department sheet would duplicate that mechanism and
--   force a contract/Zod change for every future bucket. Seeding the bucket
--   names keeps one mechanism, and the form already lets a supervisor pick a
--   category and enter a duration.
--
-- Idempotent: ON CONFLICT (name) DO NOTHING, so re-runs and environments that
-- already carry a same-named category are untouched.
-- ============================================

INSERT INTO delay_categories (name, color, icon, sort_order, description, is_active)
VALUES
  ('Blasting',                '#f59e0b', 'Bomb',      20, 'Blasting / explosive clearance hold',                    true),
  ('Natural',                 '#3b82f6', 'CloudRain', 21, 'Natural delays: weather, ground conditions, visibility',  true),
  ('No Operator',             '#007aff', 'UserX',     22, 'No operator available for the machine',                   true),
  ('Other Production Delay',  '#6366f1', 'Clock',     23, 'Other production delay not covered by a named bucket',     true),
  ('Greasing & Startup',      '#10b981', 'Droplets',  24, 'Greasing, pre-start checks and machine startup',           true),
  ('Maintenance & GET',       '#8b5cf6', 'Wrench',    25, 'Scheduled maintenance and ground engaging tools (GET)',    true),
  ('Breakdown',               '#ef4444', 'AlertTriangle', 26, 'Unplanned mechanical or electrical breakdown',          true)
ON CONFLICT (name) DO NOTHING;
