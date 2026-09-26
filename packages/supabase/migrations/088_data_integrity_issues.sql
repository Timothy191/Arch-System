-- Data Integrity Issues Table
-- Stores data integrity issues detected by automated jobs
-- for admin review and resolution

CREATE TABLE IF NOT EXISTS data_integrity_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate issues for the same record
  CONSTRAINT unique_integrity_issue UNIQUE (table_name, record_id, issue_type, resolved)
);

-- Create index for efficient querying of unresolved issues
CREATE INDEX IF NOT EXISTS idx_data_integrity_issues_unresolved 
  ON data_integrity_issues(severity, created_at DESC) 
  WHERE resolved = false;

-- Create index for table-specific queries
CREATE INDEX IF NOT EXISTS idx_data_integrity_issues_table 
  ON data_integrity_issues(table_name, resolved);

-- Add RLS policies
ALTER TABLE data_integrity_issues ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for background jobs)
CREATE POLICY "Service role full access on data_integrity_issues"
  ON data_integrity_issues
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read and resolve all issues
CREATE POLICY "Admins can read data_integrity_issues"
  ON data_integrity_issues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
      AND e.role = 'admin'
    )
  );

CREATE POLICY "Admins can resolve data_integrity_issues"
  ON data_integrity_issues
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
      AND e.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
      AND e.role = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE data_integrity_issues IS 'Stores data integrity issues detected by automated jobs for admin review';
COMMENT ON COLUMN data_integrity_issues.severity IS 'Severity level: low, medium, high, or critical';
COMMENT ON COLUMN data_integrity_issues.resolution_notes IS 'Notes on how the issue was resolved';
