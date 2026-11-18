-- ============================================
-- Migration: 225_integration_databricks_open_sharing
-- Description: Seed Databricks Unity Catalog & Delta Open Sharing connector
--              into integration_catalog (AWS us-east-2 workspace metadata).
-- ============================================

INSERT INTO integration_catalog (
  id, name, description, author, kind, server_url, auth_type, verified, docs_url, capabilities
)
VALUES (
  'databricks-unity-catalog',
  'Databricks Unity Catalog & Delta Open Sharing',
  'Databricks Lakehouse and Unity Catalog Open Sharing connector (AWS us-east-2) for federated mining telemetry, Delta tables, and cross-organization Delta Sharing.',
  'Databricks / Plantcor Data Engineering',
  'native',
  'https://dbc-6e364c3e-be48.cloud.databricks.com',
  'bearer',
  true,
  '/database',
  '{"domains": ["databricks", "unity-catalog", "delta-sharing", "open-sharing"], "workspace_id": "7474659968586218", "cloud": "aws", "region": "us-east-2", "global_metastore_id": "aws:us-east-2:6d04c3c2-8cd2-441a-8dbc-557da864afc1"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  author = EXCLUDED.author,
  kind = EXCLUDED.kind,
  server_url = EXCLUDED.server_url,
  auth_type = EXCLUDED.auth_type,
  verified = EXCLUDED.verified,
  docs_url = EXCLUDED.docs_url,
  capabilities = EXCLUDED.capabilities,
  updated_at = NOW();
