-- Migration: 20260912_agent_governance_telemetry.sql
-- Agent Governance Telemetry & Audit Event Logging Table

CREATE TABLE IF NOT EXISTS public.agent_governance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('PreToolUse', 'PostToolUse', 'PreInvocation', 'Stop')),
  tool_name TEXT,
  target_path TEXT,
  exit_code INT NOT NULL DEFAULT 0,
  blocked_reason TEXT,
  tokens_saved INT DEFAULT 0,
  execution_duration_ms INT DEFAULT 0,
  gemini_audit_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.agent_governance_events ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy: Authorized supervisors and admins only
DROP POLICY IF EXISTS "agent_governance_select_supervisors" ON public.agent_governance_events;
CREATE POLICY "agent_governance_select_supervisors" ON public.agent_governance_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('admin', 'supervisor')
    )
  );

-- 2. ALL policy: Service role automated logging
DROP POLICY IF EXISTS "agent_governance_service_role" ON public.agent_governance_events;
CREATE POLICY "agent_governance_service_role" ON public.agent_governance_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
