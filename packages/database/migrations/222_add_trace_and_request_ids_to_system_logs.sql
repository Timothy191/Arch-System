-- ==========================================================
-- Migration: 222_add_trace_and_request_ids_to_system_logs
-- Description: Add trace_id and request_id columns to
--              public.system_logs for request-level tracing
--              and operational RCA. Also add indexes for
--              fast lookup.
-- ==========================================================

-- Add trace_id column for correlating logs across a request
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- Add request_id column for correlating logs within a request lifecycle
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Index for fast trace_id lookups (partial index on populated rows; Supabase runs migrations in a transaction)
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_trace_id ON public.system_logs(trace_id) WHERE trace_id IS NOT NULL;

-- Index for fast request_id lookups
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON public.system_logs(request_id) WHERE request_id IS NOT NULL;

-- Comment explaining the columns
COMMENT ON COLUMN public.system_logs.trace_id IS 'W3C 32-hex trace ID or UUID for correlating log entries across a request lifecycle';
COMMENT ON COLUMN public.system_logs.request_id IS 'Identifier for correlating logs within a request processing context';
