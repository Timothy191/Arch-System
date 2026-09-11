CREATE TABLE public.agent_governance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT CHECK (event_type IN ('PreToolUse', 'PostToolUse', 'PreInvocation', 'Stop')),
    tool_name TEXT NOT NULL,
    target_path TEXT,
    exit_code INT NOT NULL,
    blocked_reason TEXT,
    tokens_saved INT DEFAULT 0,
    execution_duration_ms INT,
    gemini_audit_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_governance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for supervisors and admins" ON public.agent_governance_events
    FOR SELECT TO authenticated USING (
        (auth.jwt() ->> 'role') IN ('supervisor', 'admin')
    );

CREATE POLICY "Allow insert/update for service_role only" ON public.agent_governance_events
    FOR ALL TO service_role USING (true);

CREATE INDEX ON public.agent_governance_events (event_type, created_at DESC);
CREATE INDEX ON public.agent_governance_events (tool_name, exit_code);
