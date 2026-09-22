-- 160_idempotency_and_outbox.sql
-- Creates idempotency_keys table and control_room_outbox for strict Top-Tier requirements

-- ==========================================
-- PR-1: Idempotency Keys Table
-- ==========================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  status_code INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '24 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_keys_user_route_key
ON idempotency_keys(user_id, route, key);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
-- No client access allowed, server-only table
CREATE POLICY "idempotency_keys_server_only"
  ON idempotency_keys FOR ALL TO authenticated USING (false);

-- ==========================================
-- PR-3: SCADA Resilience Outbox
-- ==========================================
CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'dlq');

CREATE TABLE IF NOT EXISTS control_room_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payload JSONB NOT NULL,
  target TEXT NOT NULL,
  status outbox_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE control_room_outbox ENABLE ROW LEVEL SECURITY;
-- Employees can write to outbox, but only admins or server can read/update all
CREATE POLICY "outbox_insert_authenticated"
  ON control_room_outbox FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "outbox_select_server_only"
  ON control_room_outbox FOR SELECT TO authenticated USING (false);

CREATE TRIGGER control_room_outbox_updated_at
  BEFORE UPDATE ON control_room_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

