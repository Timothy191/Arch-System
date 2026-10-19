-- 186_integration_sentry_seed.sql
-- Official MCP & Native Integration Catalog Seed
-- Populates integration_catalog with curated official Streamable-HTTP MCP servers
-- and first-party native plugins so Admin -> Integrations has ready-to-install
-- connectors out of the box.

INSERT INTO public.integration_catalog (
  id,
  name,
  description,
  author,
  kind,
  server_url,
  auth_type,
  verified,
  docs_url,
  capabilities
)
VALUES
  (
    'sentry',
    'Sentry',
    'Official Sentry MCP connector for real-time issue triage, release health, and stacktrace analysis across portal and edge telemetry.',
    'Sentry.io',
    'mcp',
    'https://mcp.sentry.dev/mcp',
    'bearer',
    true,
    'https://docs.sentry.io/product/sentry-mcp/',
    '{"domains": ["errors", "releases", "performance"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'cloudflare-observability',
    'Cloudflare Observability',
    'Official Cloudflare remote MCP server for Workers logs, edge analytics, DNS, and WAF security telemetry.',
    'Cloudflare',
    'mcp',
    'https://observability.mcp.cloudflare.com/mcp',
    'bearer',
    true,
    'https://developers.cloudflare.com/agents/model-context-protocol/',
    '{"domains": ["edge", "waf", "logs", "dns"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'upstash-redis',
    'Upstash Serverless Redis & QStash',
    'Official Upstash MCP server for serverless Redis key inspection, rate-limit diagnostics, and QStash queue monitoring.',
    'Upstash',
    'mcp',
    'https://mcp.upstash.com/mcp',
    'bearer',
    true,
    'https://upstash.com/docs/oss/sdks/ts/mcp',
    '{"domains": ["redis", "queues", "ratelimit"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'linear',
    'Linear Issue & Dispatch Tracker',
    'Official Linear Streamable-HTTP MCP endpoint for engineering issue tracking, incident triage, and sprint velocity.',
    'Linear',
    'mcp',
    'https://mcp.linear.app/mcp',
    'bearer',
    true,
    'https://linear.app/docs/mcp',
    '{"domains": ["issues", "projects", "incidents"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'github-mcp',
    'GitHub Copilot MCP Server',
    'Official GitHub remote MCP server for repository pull requests, workflow runs, code scanning alerts, and commit history.',
    'GitHub',
    'mcp',
    'https://api.githubcopilot.com/mcp/',
    'bearer',
    true,
    'https://docs.github.com/en/copilot/customizing-copilot/using-model-context-protocol',
    '{"domains": ["repos", "pull_requests", "actions", "security"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'sixtyfour-intelligence',
    'SixtyFour Intelligence',
    'Data enrichment and operational intelligence MCP connector for supplier verification and entity research.',
    'SixtyFour',
    'mcp',
    'https://api.sixtyfour.ai/mcp',
    'api_key',
    true,
    'https://docs.sixtyfour.ai',
    '{"domains": ["enrichment", "intelligence"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'windsor-ai',
    'Windsor.ai Telemetry & Analytics',
    'Multi-source analytics and operational data connector for executive reporting and KPI aggregation.',
    'Windsor.ai',
    'mcp',
    'https://mcp.windsor.ai/mcp',
    'api_key',
    true,
    'https://windsor.ai/documentation/',
    '{"domains": ["analytics", "attribution", "reporting"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'rust-telemetry-engine',
    'Rust High-Frequency Telemetry Engine',
    'First-party native ArchPlugin for sub-millisecond haul-truck and drill rig telemetry ingestion.',
    'Plantcor Mining Engineering',
    'native',
    NULL,
    'none',
    true,
    '/docs/api',
    '{"hooks": ["onLogCreated", "onBreakdownAdded"], "widgets": true}'::jsonb
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
