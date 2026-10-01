-- Idempotency registry for Edge webhooks
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  operation text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Housekeeping: Automatically clear keys older than 3 days
-- We only need idempotency for short-term network stutters
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON public.idempotency_keys (created_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role can manage idempotency"
  ON public.idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
