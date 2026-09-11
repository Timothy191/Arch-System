CREATE TABLE public.ultragoal_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT NOT NULL,
    goal_title TEXT NOT NULL,
    maker_agent_id TEXT,
    verifier_agent_id TEXT,
    status TEXT CHECK (status IN ('IN_PROGRESS', 'RE_LOOP', 'FAILED', 'COMPLETED')),
    exit_code INT,
    peak_memory_mb NUMERIC,
    failure_reason TEXT,
    evidence_log TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ
);

ALTER TABLE public.ultragoal_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for supervisors and admins" ON public.ultragoal_runs
    FOR SELECT TO authenticated USING (
        (auth.jwt() ->> 'role') IN ('supervisor', 'control_room_operator', 'admin')
    );

CREATE POLICY "Allow insert/update for service_role only" ON public.ultragoal_runs
    FOR ALL TO service_role USING (true);
