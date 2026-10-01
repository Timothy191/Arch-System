-- Integration Platform (plugins / MCP connectors / actions)
-- One registry, three plugin kinds:
--   mcp    — remote streamable-HTTP MCP servers (third-party connectors)
--   native — first-party in-process ArchPlugin modules (apps/portal/plugins/*)
--   action — authenticated HTTP action endpoints (reserved; wired in a later phase)
--
-- Secrets are NOT stored in plaintext: integration_credentials.ciphertext holds
-- AES-256-GCM output produced application-side (apps/portal/lib/integrations/crypto.ts)
-- with a key sourced from INTEGRATION_ENCRYPTION_KEY. The database never sees the
-- plaintext key material.

-- Integration Catalog Table (admin-curated listing of installable connectors)
CREATE TABLE IF NOT EXISTS integration_catalog (
  id TEXT PRIMARY KEY, -- slug, e.g. 'sixtyfour-intelligence'
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  icon_url TEXT,
  kind TEXT NOT NULL DEFAULT 'mcp' CHECK (kind IN ('mcp', 'native', 'action')),
  server_url TEXT, -- MCP streamable-HTTP endpoint (kind = 'mcp')
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'bearer', 'custom_header', 'oauth2')),
  verified BOOLEAN NOT NULL DEFAULT false,
  docs_url TEXT,
  capabilities JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Integration Installations Table (a catalog entry installed for global or department scope)
CREATE TABLE IF NOT EXISTS integration_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id TEXT NOT NULL REFERENCES integration_catalog(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'department')),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
  config JSONB NOT NULL DEFAULT '{}', -- non-secret settings (risk class, timeouts, header names)
  tool_allowlist JSONB NOT NULL DEFAULT '[]', -- empty array = all discovered tools allowed
  tool_cache JSONB, -- last successful MCP tools/list result
  tools_synced_at TIMESTAMPTZ,
  last_error TEXT,
  installed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT integration_installations_department_required
    CHECK (scope <> 'department' OR department_id IS NOT NULL)
);

-- Integration Credentials Table (encrypted per-installation secrets)
CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES integration_installations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'api_key' CHECK (kind IN ('api_key', 'bearer', 'custom_header')),
  ciphertext TEXT NOT NULL, -- app-layer AES-256-GCM (iv | tag | payload), base64
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE (installation_id, kind)
);

-- Integration Audit Logs Table (tool invocations; arguments stored as digest only)
CREATE TABLE IF NOT EXISTS integration_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES integration_installations(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  invoked_by UUID,
  args_digest TEXT, -- sha256 hex of the argument JSON; raw args are never persisted
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'denied')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_catalog_kind ON integration_catalog(kind);
CREATE INDEX IF NOT EXISTS idx_integration_installations_catalog_id ON integration_installations(catalog_id);
CREATE INDEX IF NOT EXISTS idx_integration_installations_department_id ON integration_installations(department_id);
CREATE INDEX IF NOT EXISTS idx_integration_installations_status ON integration_installations(status);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_installation_id ON integration_credentials(installation_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_installation_id ON integration_audit_logs(installation_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_created_at ON integration_audit_logs(created_at DESC);

-- Row Level Security
ALTER TABLE integration_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_audit_logs ENABLE ROW LEVEL SECURITY;

-- Catalog: everyone signed in may read; only admins write
CREATE POLICY "employees_read_integration_catalog"
  ON integration_catalog
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "admins_manage_integration_catalog"
  ON integration_catalog
  FOR ALL
  USING (auth.uid() IN (
    SELECT e.auth_id FROM employees e WHERE e.role = 'admin'
  ));

-- Installations: admins manage all; supervisors/staff read global + their departments
CREATE POLICY "admins_manage_integration_installations"
  ON integration_installations
  FOR ALL
  USING (auth.uid() IN (
    SELECT e.auth_id FROM employees e WHERE e.role = 'admin'
  ));

CREATE POLICY "employees_view_scoped_installations"
  ON integration_installations
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT e.auth_id
      FROM employees e
      WHERE (
        integration_installations.department_id IS NULL
        OR e.department_id = integration_installations.department_id
        OR integration_installations.department_id = ANY(e.accessible_departments)
      )
    )
  );

-- Credentials: never exposed through user-scoped sessions; server code uses the
-- service-role client which bypasses RLS.
CREATE POLICY "no_user_access_integration_credentials"
  ON integration_credentials
  FOR SELECT
  USING (false);

-- Audit logs: admins read; inserts allowed from server runtime paths
CREATE POLICY "admins_view_integration_audit_logs"
  ON integration_audit_logs
  FOR SELECT
  USING (auth.uid() IN (
    SELECT e.auth_id FROM employees e WHERE e.role = 'admin'
  ));

CREATE POLICY "runtime_insert_integration_audit_logs"
  ON integration_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Audit logging for the registry tables (matches webhook_endpoints pattern)
CREATE TRIGGER integration_catalog_audit
  AFTER INSERT OR UPDATE OR DELETE ON integration_catalog
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER integration_installations_audit
  AFTER INSERT OR UPDATE OR DELETE ON integration_installations
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER integration_credentials_audit
  AFTER INSERT OR UPDATE OR DELETE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- updated_at maintenance
CREATE TRIGGER integration_catalog_updated_at
  BEFORE UPDATE ON integration_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER integration_installations_updated_at
  BEFORE UPDATE ON integration_installations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE integration_catalog IS 'Admin-curated catalog of installable integrations (MCP connectors, native plugins, actions)';
COMMENT ON TABLE integration_installations IS 'Installed integrations scoped globally or per department, with MCP tool discovery cache';
COMMENT ON TABLE integration_credentials IS 'App-layer encrypted secrets for installed integrations; plaintext never enters the database';
COMMENT ON TABLE integration_audit_logs IS 'Audit trail of integration tool invocations; arguments recorded as SHA-256 digests only';
COMMENT ON COLUMN integration_installations.tool_allowlist IS 'JSON array of permitted MCP tool names; empty array permits every discovered tool';
