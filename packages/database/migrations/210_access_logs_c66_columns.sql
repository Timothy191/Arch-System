-- ============================================
-- Migration: 210_access_logs_c66_columns
-- Description: Ensure alcohol_tested, operator, and device_id columns exist
--              on access_logs for Chainway C66 scanner telemetry.
-- ============================================

ALTER TABLE access_logs
  ADD COLUMN IF NOT EXISTS alcohol_tested text NOT NULL DEFAULT 'Approved'
  CHECK (alcohol_tested IN ('Approved', 'Failed', 'Not Tested'));

ALTER TABLE access_logs
  ADD COLUMN IF NOT EXISTS operator text,
  ADD COLUMN IF NOT EXISTS device_id text;

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_access_logs_device_id ON access_logs(device_id);
