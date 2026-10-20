-- 188_expand_integration_catalog.sql
-- Expands public.integration_catalog with 12 additional curated connectors across:
--   1. Official Streamable-HTTP & LAN MCP Servers (kind = 'mcp')
--   2. Federated Workspace Action Bridges (kind = 'action')
--   3. First-Party Native ArchPlugins & Hardware Bridges (kind = 'native')
-- Brings total curated catalog to 20 verified integrations for /admin?tab=integrations.

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
    'supabase-mcp',
    'Supabase Database, RLS & Edge Inspector',
    'Official Supabase MCP server for live schema introspection, RLS policy auditing across all 8 departments, PostgREST diagnostics, and migration drift verification.',
    'Supabase',
    'mcp',
    'https://mcp.supabase.com/mcp',
    'bearer',
    true,
    'https://supabase.com/docs/guides/getting-started/mcp',
    '{"domains": ["database", "rls-audit", "migrations", "postgrest-logs"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'vercel-mcp',
    'Vercel Deployment, Edge Logs & Speed Insights',
    'Official Vercel MCP connector for production deployment inspection, serverless runtime logs, Core Web Vitals telemetry, and edge cache invalidation.',
    'Vercel',
    'mcp',
    'https://mcp.vercel.com',
    'bearer',
    true,
    'https://vercel.com/docs/mcp',
    '{"domains": ["deployments", "runtime-logs", "web-vitals", "edge-cache"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'grafana-mcp',
    'Grafana & Prometheus Fleet Telemetry',
    'Time-series observability MCP server for haul truck SMR utilization curves, compressor temperatures, Loki log streams, and Prometheus alert rules.',
    'Grafana Labs',
    'mcp',
    'https://mcp.grafana.com/mcp',
    'bearer',
    true,
    'https://grafana.com/docs/grafana/latest/administration/mcp/',
    '{"domains": ["prometheus", "loki-logs", "alert-rules", "dashboards"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'slack-incident-mcp',
    'Slack & Opsgenie Control Room Pager',
    'Automated control-room incident paging and P1 breakdown notifications to engineering and shift superintendent channels.',
    'Slack',
    'mcp',
    'https://mcp.slack.com/mcp',
    'bearer',
    true,
    'https://api.slack.com/automation',
    '{"domains": ["incident-paging", "shift-handover", "channel-alerts"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'postgres-analytics-mcp',
    'Read-Replica SQL & Production Analytics',
    'Read-only analytical PostgreSQL MCP connector for month-to-date tonnage rollups, BCM bank volume audits, and query-plan inspection.',
    'PostgreSQL / Neon',
    'mcp',
    'https://mcp.neon.tech/mcp',
    'bearer',
    true,
    'https://neon.tech/docs/ai/neon-mcp-server',
    '{"domains": ["read-only-sql", "query-plan", "production-rollups"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'firecrawl-lan-mcp',
    'Firecrawl LAN OEM & DMRE Regulatory Scraper',
    'High-speed unauthenticated LAN Firecrawl MCP bridge for Epiroc Pit Viper 351 / Caterpillar parts manuals and DMRE Mine Health & Safety regulatory extraction.',
    'Plantcor LAN Infrastructure',
    'mcp',
    'http://192.168.0.215:3002/mcp',
    'none',
    true,
    'https://docs.firecrawl.dev/mcp',
    '{"domains": ["oem-manuals", "dmre-compliance", "web-extraction"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'nestjs-scada-proxy',
    'NestJS Modbus TCP & SCADA Telemetry Proxy',
    'Federated action bridge to arch-system-nest-proxy for polling live Pit Viper 351 drill rig and excavator PLC registers (RPM, pull-down pressure, air pressure, penetration rate).',
    'Plantcor Mining Engineering',
    'action',
    'https://arch-system-nest-proxy.vercel.app/api/mcp',
    'bearer',
    true,
    '/drilling/machine-telemetry',
    '{"domains": ["modbus-tcp", "pit-viper-351", "plc-registers", "scada-ingest"], "federated_service": "arch-system-nest-proxy"}'::jsonb
  ),
  (
    'n8n-workflow-engine',
    'n8n Autonomous Shift & Escalation Workflows',
    'Federated action bridge to n8n-vercel for automated shift-closeout PDF distribution, overdue breakdown escalation webhooks, and threshold alerts.',
    'Plantcor Automation',
    'action',
    'https://n8n-vercel-arch.vercel.app/mcp',
    'api_key',
    true,
    '/admin/workflows',
    '{"domains": ["workflow-triggers", "shift-pdf-dispatch", "breakdown-escalation"], "federated_service": "n8n-vercel"}'::jsonb
  ),
  (
    'whatsapp-shift-dispatch',
    'WhatsApp Operations & Muster Dispatch Bridge',
    'Action bridge connecting the Portal WhatsApp Split-Screen workspace to broadcast shift compilation summaries, emergency muster roll-calls, and breakdown job cards.',
    'Plantcor Control Room',
    'action',
    'https://arch-system-kappa.vercel.app/api/webhooks',
    'bearer',
    true,
    '/control-room/shift-compilation',
    '{"domains": ["whatsapp-dispatch", "muster-alerts", "shift-handover"], "transport": "webhook-action"}'::jsonb
  ),
  (
    'langfuse-openrouter-ai',
    'Langfuse & OpenRouter AI FinOps Telemetry',
    'First-party @repo/agents native integration for LLM trace observability, prompt cache hit-rate tracking, and ZAR cost attribution with multi-model fallback routing.',
    'Plantcor AI Platform',
    'native',
    NULL,
    'api_key',
    true,
    '/admin/ai-metrics',
    '{"domains": ["llm-tracing", "zar-cost-attribution", "prompt-cache", "model-routing"], "widgets": true}'::jsonb
  ),
  (
    'c66-cr80-hardware-bridge',
    'C66 Key Cabinet & CR80 Badge Printer Bridge',
    'First-party Access Control hardware bridge for 2-step QR + RFID C66 key-cabinet interlock release and dual-sided 300 DPI CR80 PVC badge printing.',
    'Plantcor Access Control',
    'native',
    NULL,
    'none',
    true,
    '/access-control/print-cards',
    '{"domains": ["c66-key-interlock", "cr80-300dpi-print", "rfid-qr-verify"], "hardware": true}'::jsonb
  ),
  (
    'fleet-smr-reconciler',
    'Automated SMR Meter & Bin-Factor Reconciler',
    'Native reconciliation plugin validating closing vs. opening SMR machine hours across shift rollovers and auditing haul-truck bin factors against weighbridge tonnages.',
    'Plantcor Production & Control Room',
    'native',
    NULL,
    'none',
    true,
    '/control-room/reports',
    '{"domains": ["smr-meter-sync", "bin-factor-audit", "shift-rollover"], "hooks": ["onShiftCloseout", "onHourlyLoadLogged"]}'::jsonb
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
