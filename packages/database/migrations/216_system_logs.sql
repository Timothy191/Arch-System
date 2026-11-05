-- ============================================
-- Migration: 216_system_logs
-- Description: Persistent application system/error log store powering the
--              Administration "System Logs" console. Captures client runtime
--              errors, server/API failures, CSP violations, cron and
--              integration events with enough context for operational RCA.
--              Writes are restricted to the service role via /api/logs;
--              reads and triage (resolve) are admin-only.
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  source TEXT NOT NULL CHECK (source IN ('client', 'server', 'api', 'cron', 'csp', 'integration', 'auth')),
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  url TEXT,
  method TEXT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
  ON public.system_logs (created_at DESC);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_level
  ON public.system_logs (level);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_source
  ON public.system_logs (source);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_unresolved
  ON public.system_logs (created_at DESC)
  WHERE resolved = false;

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_system_logs_employee
  ON public.system_logs (employee_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: admins only — log context can contain operational detail that must
-- not leak to department users.
CREATE POLICY "system_logs_select_admin"
  ON public.system_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- UPDATE: admins only — used for triage (mark resolved / unresolved).
CREATE POLICY "system_logs_update_admin"
  ON public.system_logs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT: intentionally no policy for `authenticated`. All writes flow through
-- POST /api/logs which validates payloads with @repo/contract and inserts via
-- the service role (which bypasses RLS). This prevents authenticated clients
-- from bypassing validation or forging log entries.
