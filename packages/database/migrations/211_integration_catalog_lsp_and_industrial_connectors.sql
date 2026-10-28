-- ============================================
-- Migration: 211_integration_catalog_lsp_and_industrial_connectors
-- Description: Expand integration_catalog kind CHECK constraint to include 'lsp'
--              (Language Server Protocol) and seed curated LSP + Industrial
--              SCADA/ERP connectors into integration_catalog.
-- ============================================

-- 1. Replace integration_catalog_kind_check to allow ('mcp', 'native', 'action', 'lsp')
ALTER TABLE integration_catalog
  DROP CONSTRAINT IF EXISTS integration_catalog_kind_check;

ALTER TABLE integration_catalog
  ADD CONSTRAINT integration_catalog_kind_check
  CHECK (kind IN ('mcp', 'native', 'action', 'lsp')) NOT VALID;

ALTER TABLE integration_catalog
  VALIDATE CONSTRAINT integration_catalog_kind_check;

-- 2. Seed LSP & Industrial Mining/SCADA/ERP Connectors into integration_catalog
INSERT INTO integration_catalog (
  id, name, description, author, kind, server_url, auth_type, verified, docs_url, capabilities
)
VALUES
  (
    'ts-ast-lsp',
    'TypeScript, Biome & AST-Grep Language Server',
    'In-workspace Language Server Protocol (LSP) connector providing go-to-definition, symbol references, type diagnostics, and policy-compiler boundary checks.',
    'Arch Systems DevTools',
    'lsp',
    'https://lsp.arch-system.internal/ts-ast',
    'none',
    true,
    '/overview',
    '{"domains": ["lsp", "typescript", "ast-grep", "policy-boundaries"], "transport": "jsonrpc-lsp"}'::jsonb
  ),
  (
    'postgres-sqls-lsp',
    'PostgreSQL, Kysely & RLS InitPlan LSP',
    'Database Language Server validating SQL queries against the 102-table @repo/database schema, linting RLS InitPlan policies, and providing Kysely type completions.',
    'Plantcor Database Engineering',
    'lsp',
    'https://lsp.arch-system.internal/postgres-sqls',
    'none',
    true,
    '/admin',
    '{"domains": ["lsp", "postgresql", "rls-initplan", "kysely-schema"], "transport": "jsonrpc-lsp"}'::jsonb
  ),
  (
    'plc-iec61131-lsp',
    'IEC 61131-3 Structured Text & PLC Register LSP',
    'Industrial automation Language Server for Siemens S7, Allen-Bradley, and Pit Viper 351 PLC Structured Text syntax checking and Modbus register tag verification.',
    'Plantcor Automation & SCADA',
    'lsp',
    'https://lsp.arch-system.internal/iec61131',
    'none',
    true,
    '/drilling/machine-telemetry',
    '{"domains": ["lsp", "iec-61131-3", "modbus-registers", "plc-ladder"], "transport": "jsonrpc-lsp"}'::jsonb
  ),
  (
    'promql-lsp',
    'PromQL & LogQL Telemetry Query LSP',
    'Observability query Language Server providing metric autocomplete, label-matcher validation, and alert-expression linting for Control Room dashboards.',
    'Grafana / Prometheus',
    'lsp',
    'https://lsp.arch-system.internal/promql',
    'none',
    true,
    '/control-room',
    '{"domains": ["lsp", "promql", "logql", "alert-expressions"], "transport": "jsonrpc-lsp"}'::jsonb
  ),
  (
    'opcua-pi-historian',
    'OPC-UA & AVEVA PI System Historian Bridge',
    'Industrial process historian MCP connector streaming wash-plant dense medium cyclone SG (cycloneRd), magnetite recovery, and primary crusher power draw.',
    'Plantcor Process Engineering',
    'mcp',
    'https://pi-bridge.plantcor.internal/mcp',
    'bearer',
    true,
    '/plant-processing/hourly-sheet',
    '{"domains": ["opc-ua", "pi-historian", "cyclone-density", "wash-plant"], "transport": "streamable-http"}'::jsonb
  ),
  (
    'sap-pm-erp',
    'SAP S/4HANA Plant Maintenance & Spares ERP',
    'Enterprise ERP action bridge for automated engineering breakdown work-order creation, artisan job-card dispatch, and critical spares reservation.',
    'SAP / Plantcor ERP',
    'action',
    'https://sap-gateway.plantcor.internal/api/pm',
    'api_key',
    true,
    '/engineering',
    '{"domains": ["sap-pm", "work-orders", "spares-inventory", "cost-centers"], "federated_service": "sap-s4hana-pm"}'::jsonb
  ),
  (
    'weighbridge-tcp',
    'Avery Berkel & Loadrite Weighbridge Bridge',
    'Native plant & logistics connector capturing real-time ROM and washed-coal haul-truck gross/tare weighbridge tickets and reconciling bin factors.',
    'Plantcor Logistics & Dispatch',
    'native',
    NULL,
    'none',
    true,
    '/production',
    '{"domains": ["weighbridge", "rom-tonnage", "product-coal", "bin-factor"], "hooks": ["onWeighbridgeTicketLogged"]}'::jsonb
  ),
  (
    'leica-jigsaw-fms',
    'Leica Jigsaw & MineSight Fleet Management',
    'High-precision GNSS fleet management MCP server for shovel-truck cycle times, bench elevation coordinates, and drill blast-pattern hole collar sync.',
    'Hexagon Mining / Leica',
    'mcp',
    'https://fms.plantcor.internal/mcp',
    'bearer',
    true,
    '/production',
    '{"domains": ["fleet-dispatch", "gps-bench", "cycle-times", "blast-collars"], "transport": "streamable-http"}'::jsonb
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
