-- ============================================================================
-- Migration 226: Quality Intelligence Engine
-- Purpose:
--   1. Create append-only verification evidence table `public.quality_verification_runs`.
--   2. Create append-only agent completion/verification table `public.agent_work_reports`.
--   3. Create release certification table `public.quality_release_certifications`.
--   4. Enforce append-only immutability on evidence & agent report rows via
--      `public.prevent_quality_evidence_mutation()`.
--   5. Enable Row Level Security (RLS) with InitPlan-wrapped `(SELECT auth.uid())`
--      and `public.employees` role-based policies.
-- ============================================================================

-- ============================================================================
-- 1. Quality Verification Runs (Append-Only Immutable Evidence)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quality_verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL CHECK (commit_sha ~ '^[0-9a-fA-F]{7,40}$'),
  parent_commit_sha TEXT CHECK (
    parent_commit_sha IS NULL OR parent_commit_sha ~ '^[0-9a-fA-F]{7,40}$'
  ),
  pull_request_id TEXT,
  agent_id TEXT,
  task_id TEXT,
  executed_at TIMESTAMPTZ NOT NULL,
  environment TEXT NOT NULL,
  mode TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (
    overall_status IN ('PASSED', 'FAILED', 'SKIPPED', 'UNAVAILABLE', 'BLOCKED')
  ),
  overall_score NUMERIC(5, 2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  confidence_pct NUMERIC(5, 2) NOT NULL CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  coverage_pct NUMERIC(5, 2) NOT NULL CHECK (coverage_pct >= 0 AND coverage_pct <= 100),
  security_risk_level TEXT NOT NULL CHECK (
    security_risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')
  ),
  mandatory_failures BIGINT NOT NULL DEFAULT 0 CHECK (mandatory_failures >= 0),
  release_blocked BOOLEAN NOT NULL DEFAULT false,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  regressions JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_breakdown JSONB NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_verification_runs_commit_sha
  ON public.quality_verification_runs (commit_sha);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_verification_runs_branch
  ON public.quality_verification_runs (branch);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_verification_runs_agent_id
  ON public.quality_verification_runs (agent_id);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_verification_runs_created_at
  ON public.quality_verification_runs (created_at DESC);

-- ============================================================================
-- 2. Agent Work Reports (Append-Only Immutable Completion & Diff Verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_description TEXT NOT NULL,
  starting_commit_sha TEXT NOT NULL CHECK (starting_commit_sha ~ '^[0-9a-fA-F]{7,40}$'),
  ending_commit_sha TEXT NOT NULL CHECK (ending_commit_sha ~ '^[0-9a-fA-F]{7,40}$'),
  declared_state TEXT NOT NULL CHECK (
    declared_state IN (
      'NOT_STARTED',
      'IN_PROGRESS',
      'IMPLEMENTATION_COMPLETE',
      'VERIFICATION_PENDING',
      'VERIFICATION_PASSED',
      'VERIFICATION_FAILED',
      'BLOCKED',
      'REQUIRES_HUMAN_APPROVAL'
    )
  ),
  computed_state TEXT NOT NULL CHECK (
    computed_state IN (
      'NOT_STARTED',
      'IN_PROGRESS',
      'IMPLEMENTATION_COMPLETE',
      'VERIFICATION_PENDING',
      'VERIFICATION_PASSED',
      'VERIFICATION_FAILED',
      'BLOCKED',
      'REQUIRES_HUMAN_APPROVAL'
    )
  ),
  file_diff_matches BOOLEAN NOT NULL,
  actual_changed_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  undeclared_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_declared_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  agent_report JSONB NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_run_id UUID REFERENCES public.quality_verification_runs(run_id) ON DELETE RESTRICT,
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_agent_work_reports_ending_commit_sha
  ON public.agent_work_reports (ending_commit_sha);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_agent_work_reports_agent_id
  ON public.agent_work_reports (agent_id);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_agent_work_reports_created_at
  ON public.agent_work_reports (created_at DESC);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_agent_work_reports_evidence_run_id
  ON public.agent_work_reports (evidence_run_id);

-- ============================================================================
-- 3. Quality Release Certifications (Admin-Approved Release Gate Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quality_release_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commit_sha TEXT NOT NULL CHECK (commit_sha ~ '^[0-9a-fA-F]{7,40}$'),
  branch TEXT NOT NULL,
  release_status TEXT NOT NULL CHECK (
    release_status IN (
      'NOT_READY',
      'READY_FOR_REVIEW',
      'APPROVED',
      'BLOCKED',
      'RELEASED',
      'ROLLBACK_REQUIRED'
    )
  ),
  overall_score NUMERIC(5, 2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_run_id UUID NOT NULL REFERENCES public.quality_verification_runs(run_id) ON DELETE RESTRICT,
  certified_at TIMESTAMPTZ NOT NULL,
  approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_release_certifications_commit_sha
  ON public.quality_release_certifications (commit_sha);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_release_certifications_branch
  ON public.quality_release_certifications (branch);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_release_certifications_release_status
  ON public.quality_release_certifications (release_status);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_release_certifications_created_at
  ON public.quality_release_certifications (created_at DESC);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_quality_release_certifications_evidence_run_id
  ON public.quality_release_certifications (evidence_run_id);

-- ============================================================================
-- 4. Append-Only Protection & Updated-At Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_quality_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Quality intelligence evidence in %.% is append-only and immutable (% prohibited)',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_quality_verification_runs_immutable
  ON public.quality_verification_runs;
CREATE TRIGGER trg_quality_verification_runs_immutable
  BEFORE UPDATE OR DELETE ON public.quality_verification_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quality_evidence_mutation();

DROP TRIGGER IF EXISTS trg_agent_work_reports_immutable
  ON public.agent_work_reports;
CREATE TRIGGER trg_agent_work_reports_immutable
  BEFORE UPDATE OR DELETE ON public.agent_work_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quality_evidence_mutation();

CREATE OR REPLACE FUNCTION public.touch_quality_release_certification_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quality_release_certifications_updated_at
  ON public.quality_release_certifications;
CREATE TRIGGER trg_quality_release_certifications_updated_at
  BEFORE UPDATE ON public.quality_release_certifications
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_quality_release_certification_updated_at();

-- ============================================================================
-- 5. Row Level Security (RLS) with (SELECT auth.uid()) InitPlan
-- ============================================================================
ALTER TABLE public.quality_verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_release_certifications ENABLE ROW LEVEL SECURITY;

-- quality_verification_runs policies
DROP POLICY IF EXISTS "quality_verification_runs_select_authorized"
  ON public.quality_verification_runs;
CREATE POLICY "quality_verification_runs_select_authorized"
  ON public.quality_verification_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor', 'control_room_operator')
    )
  );

DROP POLICY IF EXISTS "quality_verification_runs_insert_authorized"
  ON public.quality_verification_runs;
CREATE POLICY "quality_verification_runs_insert_authorized"
  ON public.quality_verification_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor')
    )
  );

-- agent_work_reports policies
DROP POLICY IF EXISTS "agent_work_reports_select_authorized"
  ON public.agent_work_reports;
CREATE POLICY "agent_work_reports_select_authorized"
  ON public.agent_work_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor', 'control_room_operator')
    )
  );

DROP POLICY IF EXISTS "agent_work_reports_insert_authorized"
  ON public.agent_work_reports;
CREATE POLICY "agent_work_reports_insert_authorized"
  ON public.agent_work_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor')
    )
  );

-- quality_release_certifications policies
DROP POLICY IF EXISTS "quality_release_certifications_select_authorized"
  ON public.quality_release_certifications;
CREATE POLICY "quality_release_certifications_select_authorized"
  ON public.quality_release_certifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor', 'control_room_operator')
    )
  );

DROP POLICY IF EXISTS "quality_release_certifications_insert_authorized"
  ON public.quality_release_certifications;
CREATE POLICY "quality_release_certifications_insert_authorized"
  ON public.quality_release_certifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "quality_release_certifications_update_admin"
  ON public.quality_release_certifications;
CREATE POLICY "quality_release_certifications_update_admin"
  ON public.quality_release_certifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role = 'admin'
    )
  );
