-- ============================================================================
-- Migration: 151_operational_compliance_checks.sql
-- Description: Operational compliance audit records and metrics tracking with RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_audit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'passed',
    score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE compliance_audit_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can view compliance audit runs
CREATE POLICY compliance_audit_runs_select_policy ON compliance_audit_runs
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policy: Admin/Superadmin can insert compliance audit runs
CREATE POLICY compliance_audit_runs_insert_policy ON compliance_audit_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.auth_id = auth.uid()
            AND e.role IN ('admin', 'superadmin', 'manager')
        )
    );

-- Performance index on created_at
CREATE INDEX IF NOT EXISTS idx_compliance_audit_runs_created_at
    ON compliance_audit_runs(created_at DESC);

-- Performance index on audit_type
CREATE INDEX IF NOT EXISTS idx_compliance_audit_runs_type
    ON compliance_audit_runs(audit_type);
