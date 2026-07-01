-- ============================================
-- Secrets Rotation Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS secrets_rotation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name TEXT NOT NULL,
  rotated_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_by TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for audit access
ALTER TABLE secrets_rotation_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (automated rotations)
CREATE POLICY "service_can_insert_secrets_log"
  ON secrets_rotation_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "authenticated_can_read_secrets_log"
  ON secrets_rotation_log FOR SELECT
  TO authenticated
  USING (true);

-- Index for querying rotation history
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_log_name 
  ON secrets_rotation_log(secret_name);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_log_status 
  ON secrets_rotation_log(status);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_log_date 
  ON secrets_rotation_log(rotated_at DESC);