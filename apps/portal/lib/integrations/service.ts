import { type IntegrationToolDescriptor } from '@repo/contract/schemas/integration.schema';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { APIError, DatabaseError, NotFoundError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { encryptSecret } from './crypto';
import { type ManagedInstallation, mcpClientManager } from './mcp-client-manager';
import { assertSafeUrl } from './ssrf-guard';

/**
 * Registry service for the integration platform.
 *
 * All reads/writes here use the service-role client: installation management is
 * admin-only (enforced at the route layer), tool invocation is scoped by the
 * tool bridge, and credentials must never be readable through user sessions
 * (RLS denies user access; the service client bypasses it deliberately).
 */

export interface InstallationRecord {
  id: string;
  catalog_id: string;
  scope: string;
  department_id: string | null;
  status: string;
  config: Record<string, unknown>;
  tool_allowlist: string[];
  tool_cache: { tools?: IntegrationToolDescriptor[] } | null;
  tools_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CatalogRecord {
  id: string;
  name: string;
  description: string | null;
  author: string | null;
  icon_url: string | null;
  kind: string;
  server_url: string | null;
  auth_type: string;
  verified: boolean;
  docs_url: string | null;
  capabilities?: {
    domains?: string[];
    transport?: string;
    federated_service?: string;
    adapter?: 'grafana' | 'prometheus';
    [key: string]: unknown;
  } | null;
}

export const CURATED_INTEGRATION_CATALOG: CatalogRecord[] = [
  {
    id: 'sentry',
    name: 'Sentry Error & Performance MCP',
    description:
      'Official Sentry MCP connector for real-time issue triage, release health, and stacktrace analysis across portal and edge telemetry.',
    author: 'Sentry.io',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.sentry.dev/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://docs.sentry.io/product/sentry-mcp/',
    capabilities: {
      domains: ['errors', 'releases', 'performance'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'supabase-mcp',
    name: 'Supabase Database, RLS & Edge Inspector',
    description:
      'Official Supabase MCP server for live schema introspection, RLS policy auditing across all departments, PostgREST diagnostics, and migration drift verification.',
    author: 'Supabase',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.supabase.com/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://supabase.com/docs/guides/getting-started/mcp',
    capabilities: {
      domains: ['database', 'rls-audit', 'migrations', 'postgrest-logs'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'vercel-mcp',
    name: 'Vercel Deployment, Edge Logs & Speed Insights',
    description:
      'Official Vercel MCP connector for production deployment inspection, serverless runtime logs, Core Web Vitals telemetry, and edge cache invalidation.',
    author: 'Vercel',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.vercel.com',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://vercel.com/docs/mcp',
    capabilities: {
      domains: ['deployments', 'runtime-logs', 'web-vitals', 'edge-cache'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'cloudflare-observability',
    name: 'Cloudflare Observability & Radar',
    description:
      'Official Cloudflare remote MCP server for Workers logs, edge analytics, DNS, and WAF security telemetry.',
    author: 'Cloudflare',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://observability.mcp.cloudflare.com/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://developers.cloudflare.com/agents/model-context-protocol/',
    capabilities: {
      domains: ['edge', 'waf', 'logs', 'dns'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'upstash-redis',
    name: 'Upstash Serverless Redis & QStash',
    description:
      'Official Upstash MCP server for serverless Redis key inspection, rate-limit diagnostics, and QStash queue monitoring.',
    author: 'Upstash',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.upstash.com/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://upstash.com/docs/oss/sdks/ts/mcp',
    capabilities: {
      domains: ['redis', 'queues', 'ratelimit'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'linear',
    name: 'Linear Issue & Dispatch Tracker',
    description:
      'Official Linear Streamable-HTTP MCP endpoint for engineering issue tracking, incident triage, and sprint velocity.',
    author: 'Linear',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.linear.app/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://linear.app/docs/mcp',
    capabilities: {
      domains: ['issues', 'projects', 'incidents'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'github-mcp',
    name: 'GitHub Copilot MCP Server',
    description:
      'Official GitHub remote MCP server for repository pull requests, workflow runs, code scanning alerts, and commit history.',
    author: 'GitHub',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://api.githubcopilot.com/mcp/',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://docs.github.com/en/copilot/customizing-copilot/using-model-context-protocol',
    capabilities: {
      domains: ['repos', 'pull_requests', 'actions', 'security'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'grafana-mcp',
    name: 'Grafana & Prometheus Fleet Telemetry',
    description:
      'Time-series observability MCP server for haul truck SMR utilization curves, compressor temperatures, Loki log streams, and Prometheus alert rules.',
    author: 'Grafana Labs',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.grafana.com/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://grafana.com/docs/grafana/latest/administration/mcp/',
    capabilities: {
      domains: ['prometheus', 'loki-logs', 'alert-rules', 'dashboards'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'slack-incident-mcp',
    name: 'Slack & Opsgenie Control Room Pager',
    description:
      'Automated control-room incident paging and P1 breakdown notifications to engineering and shift superintendent channels.',
    author: 'Slack',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.slack.com/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://api.slack.com/automation',
    capabilities: {
      domains: ['incident-paging', 'shift-handover', 'channel-alerts'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'postgres-analytics-mcp',
    name: 'Read-Replica SQL & Production Analytics',
    description:
      'Read-only analytical PostgreSQL MCP connector for month-to-date tonnage rollups, BCM bank volume audits, and query-plan inspection.',
    author: 'PostgreSQL / Neon',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.neon.tech/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://neon.tech/docs/ai/neon-mcp-server',
    capabilities: {
      domains: ['read-only-sql', 'query-plan', 'production-rollups'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'sixtyfour-intelligence',
    name: 'SixtyFour Intelligence',
    description:
      'Data enrichment and operational intelligence MCP connector for supplier verification and entity research.',
    author: 'SixtyFour',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://api.sixtyfour.ai/mcp',
    auth_type: 'api_key',
    verified: true,
    docs_url: 'https://docs.sixtyfour.ai',
    capabilities: {
      domains: ['enrichment', 'intelligence'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'windsor-ai',
    name: 'Windsor.ai Telemetry & Analytics',
    description:
      'Multi-source analytics and operational data connector for executive reporting and KPI aggregation.',
    author: 'Windsor.ai',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.windsor.ai/mcp',
    auth_type: 'api_key',
    verified: true,
    docs_url: 'https://windsor.ai/documentation/',
    capabilities: {
      domains: ['analytics', 'attribution', 'reporting'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'firecrawl-mcp',
    name: 'Firecrawl Cloud OEM & Regulatory Scraper',
    description:
      'Authenticated Firecrawl Streamable-HTTP MCP connector for OEM parts manuals and regulatory document extraction.',
    author: 'Firecrawl',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://mcp.firecrawl.dev/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://docs.firecrawl.dev/mcp',
    capabilities: {
      domains: ['oem-manuals', 'dmre-compliance', 'web-extraction'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'microsoft-sharepoint',
    name: 'Microsoft SharePoint Online & Graph Data',
    description:
      'Microsoft 365 SharePoint connector for document libraries, lists, and site content via Microsoft Graph.',
    author: 'Microsoft / Plantcor IT',
    icon_url: null,
    kind: 'mcp',
    server_url: 'https://graph.microsoft.com/v1.0',
    auth_type: 'bearer',
    verified: true,
    docs_url: 'https://learn.microsoft.com/graph/api/resources/sharepoint',
    capabilities: {
      domains: ['sharepoint-sites', 'document-libraries', 'lists', 'graph-search'],
      transport: 'streamable-http',
    },
  },
  {
    id: 'nestjs-scada-proxy',
    name: 'NestJS Modbus TCP & SCADA Telemetry Proxy',
    description:
      'Federated SSRF-guarded action bridge to arch-system-nest-proxy for polling Pit Viper 351 drill rig and excavator PLC registers.',
    author: 'Plantcor Mining Engineering',
    icon_url: null,
    kind: 'action',
    server_url: 'https://arch-system-nest-proxy.vercel.app/api/mcp',
    auth_type: 'bearer',
    verified: true,
    docs_url: '/drilling/drilling-operations',
    capabilities: {
      domains: ['modbus-tcp', 'pit-viper-351', 'plc-registers', 'scada-ingest'],
      federated_service: 'arch-system-nest-proxy',
      transport: 'webhook-action',
    },
  },
  {
    id: 'n8n-workflow-engine',
    name: 'n8n Autonomous Shift & Escalation Workflows',
    description:
      'Federated SSRF-guarded action bridge to n8n-vercel for automated shift-closeout PDF distribution and overdue breakdown escalation webhooks.',
    author: 'Plantcor Automation',
    icon_url: null,
    kind: 'action',
    server_url: 'https://n8n-vercel-arch.vercel.app/mcp',
    auth_type: 'api_key',
    verified: true,
    docs_url: '/admin/workflows',
    capabilities: {
      domains: ['workflow-triggers', 'shift-pdf-dispatch', 'breakdown-escalation'],
      federated_service: 'n8n-vercel',
      transport: 'webhook-action',
    },
  },
  {
    id: 'whatsapp-shift-dispatch',
    name: 'WhatsApp Operations & Muster Dispatch Bridge',
    description:
      'SSRF-guarded action bridge broadcasting shift compilation summaries, emergency muster roll-calls, and breakdown job cards.',
    author: 'Plantcor Control Room',
    icon_url: null,
    kind: 'action',
    server_url: 'https://arch-system-kappap.vercel.app/api/webhooks',
    auth_type: 'bearer',
    verified: true,
    docs_url: '/control-room/shift-compilation',
    capabilities: {
      domains: ['whatsapp-dispatch', 'muster-alerts', 'shift-handover'],
      transport: 'webhook-action',
    },
  },
];

const INSTALLATION_SELECT = `
  id, catalog_id, scope, department_id, status, config, tool_allowlist,
  tool_cache, tools_synced_at, last_error, created_at, updated_at
`;

const CATALOG_SELECT = `
  id, name, description, author, icon_url, kind, server_url, auth_type, verified, docs_url, capabilities
`;

function parseAllowlist(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function isExecutableKind(kind: string): kind is 'mcp' | 'action' {
  return kind === 'mcp' || kind === 'action';
}

export function buildActionToolsForCatalog(
  catalogId: string,
  capabilities?: Record<string, unknown> | null
): IntegrationToolDescriptor[] {
  const adapter = capabilities?.adapter;
  if (adapter === 'grafana' || catalogId === 'grafana') {
    return [
      {
        name: 'list_approved_dashboards',
        description: `List approved read-only Grafana dashboards from ${catalogId}`,
        inputSchema: {
          type: 'object',
          properties: {
            folderUid: { type: 'string' },
          },
        },
      },
      {
        name: 'dispatch_action_webhook',
        description: `Send an authenticated JSON webhook payload to ${catalogId}`,
        inputSchema: {
          type: 'object',
          properties: {
            payload: { type: 'object' },
          },
        },
      },
    ];
  }

  if (adapter === 'prometheus' || catalogId === 'prometheus') {
    return [
      {
        name: 'query_prometheus_metric',
        description: `Query an allowlisted Prometheus metric from ${catalogId}`,
        inputSchema: {
          type: 'object',
          required: ['metric'],
          properties: {
            metric: { type: 'string' },
          },
        },
      },
    ];
  }

  return [
    {
      name: 'dispatch_action_webhook',
      description: `Send an authenticated JSON webhook payload to ${catalogId}`,
      inputSchema: {
        type: 'object',
        properties: {
          payload: { type: 'object' },
        },
      },
    },
  ];
}

export async function listCatalog(): Promise<CatalogRecord[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('integration_catalog').select(CATALOG_SELECT);
  if (error) {
    throw new DatabaseError('Failed to load integration catalog', {
      context: { error: error.message },
    });
  }
  const dbRows = (data ?? []) as unknown as CatalogRecord[];
  const byId = new Map<string, CatalogRecord>();
  for (const curated of CURATED_INTEGRATION_CATALOG) {
    byId.set(curated.id, curated);
  }
  for (const row of dbRows) {
    if (isExecutableKind(row.kind)) {
      if (!row.server_url) continue;
      try {
        assertSafeUrl(row.server_url);
      } catch {
        continue;
      }
    }
    const fallback = byId.get(row.id);
    byId.set(row.id, {
      ...fallback,
      ...row,
      capabilities:
        row.capabilities && Object.keys(row.capabilities).length > 0
          ? row.capabilities
          : (fallback?.capabilities ?? null),
    });
  }
  return Array.from(byId.values());
}

export async function listInstallations(): Promise<InstallationRecord[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('integration_installations')
    .select(INSTALLATION_SELECT)
    .order('created_at', { ascending: false });
  if (error) {
    throw new DatabaseError('Failed to load integration installations', {
      context: { error: error.message },
    });
  }
  return (data ?? []).map((row) => ({
    ...(row as unknown as InstallationRecord),
    tool_allowlist: parseAllowlist((row as Record<string, unknown>).tool_allowlist),
  }));
}

/**
 * Installs a catalog entry. Creates the catalog row inline when it does not
 * exist yet (admin-curated: only admins can reach this code path).
 */
export async function installIntegration(
  input: {
    catalog_id: string;
    catalog_entry?: {
      name: string;
      description?: string;
      author?: string;
      icon_url?: string;
      kind: string;
      server_url?: string;
      auth_type: string;
      docs_url?: string;
      verified?: boolean;
    };
    scope: string;
    department_id?: string;
    config?: Record<string, unknown>;
    secret?: string;
    secret_kind?: string;
    tool_allowlist?: string[];
  },
  installedBy: string
): Promise<InstallationRecord> {
  if (input.catalog_entry?.server_url) {
    assertSafeUrl(input.catalog_entry.server_url);
  }

  const supabase = createServiceRoleClient();
  const { data: catalogEntry } = await supabase
    .from('integration_catalog')
    .select('id, kind, server_url, auth_type, capabilities')
    .eq('id', input.catalog_id)
    .single();

  const curatedEntry = CURATED_INTEGRATION_CATALOG.find((item) => item.id === input.catalog_id);
  const inlineEntry =
    input.catalog_entry ??
    (curatedEntry
      ? {
          name: curatedEntry.name,
          description: curatedEntry.description ?? undefined,
          author: curatedEntry.author ?? undefined,
          icon_url: curatedEntry.icon_url ?? undefined,
          kind: curatedEntry.kind,
          server_url: curatedEntry.server_url ?? undefined,
          auth_type: curatedEntry.auth_type,
          docs_url: curatedEntry.docs_url ?? undefined,
          verified: curatedEntry.verified,
        }
      : undefined);

  const candidateKind = catalogEntry?.kind ?? inlineEntry?.kind;
  const candidateServerUrl = catalogEntry?.server_url ?? inlineEntry?.server_url ?? null;

  if (!candidateKind && !catalogEntry && !inlineEntry) {
    throw new NotFoundError(`Catalog entry "${input.catalog_id}" not found`, {
      resource: 'integration_catalog',
    });
  }

  if (!candidateKind || !isExecutableKind(candidateKind)) {
    throw new APIError(
      `Connector kind "${candidateKind ?? 'unknown'}" is not executable; only "mcp" and "action" connectors are supported`,
      { statusCode: 400, context: { catalogId: input.catalog_id } }
    );
  }

  if (!candidateServerUrl) {
    throw new APIError(`Connector "${input.catalog_id}" requires a valid server_url`, {
      statusCode: 400,
      context: { catalogId: input.catalog_id },
    });
  }

  // Always enforce SSRF guard on both inline and curated/persisted server URLs
  assertSafeUrl(candidateServerUrl);

  if (!catalogEntry) {
    if (!inlineEntry) {
      throw new NotFoundError(`Catalog entry "${input.catalog_id}" not found`, {
        resource: 'integration_catalog',
      });
    }
    const { error: insertError } = await supabase.from('integration_catalog').insert({
      id: input.catalog_id,
      name: inlineEntry.name,
      description: inlineEntry.description ?? null,
      author: inlineEntry.author ?? null,
      icon_url: inlineEntry.icon_url ?? null,
      kind: inlineEntry.kind,
      server_url: inlineEntry.server_url ?? null,
      auth_type: inlineEntry.auth_type,
      docs_url: inlineEntry.docs_url ?? null,
      verified: inlineEntry.verified ?? false,
      capabilities: curatedEntry?.capabilities ?? {},
    });
    if (insertError) {
      throw new DatabaseError('Failed to create catalog entry', {
        context: { error: insertError.message },
      });
    }
  }

  const effectiveCapabilities =
    (catalogEntry as { capabilities?: Record<string, unknown> | null } | null)?.capabilities ??
    curatedEntry?.capabilities ??
    null;

  const explicitAllowlist =
    input.tool_allowlist && input.tool_allowlist.length > 0 ? input.tool_allowlist : null;

  const { data: installation, error } = await supabase
    .from('integration_installations')
    .insert({
      catalog_id: input.catalog_id,
      scope: input.scope,
      department_id: input.scope === 'department' ? (input.department_id ?? null) : null,
      status: 'pending',
      config: input.config ?? {},
      tool_allowlist: explicitAllowlist ?? [],
      installed_by: installedBy,
    })
    .select(INSTALLATION_SELECT)
    .single();
  if (error || !installation) {
    throw new DatabaseError('Failed to create installation', {
      context: { error: error?.message },
    });
  }

  if (input.secret) {
    const { error: credentialError } = await supabase.from('integration_credentials').upsert(
      {
        installation_id: installation.id,
        kind: input.secret_kind ?? 'bearer',
        ciphertext: encryptSecret(input.secret),
      },
      { onConflict: 'installation_id,kind' }
    );
    if (credentialError) {
      await supabase.from('integration_installations').delete().eq('id', installation.id);
      throw new DatabaseError('Failed to store credential', {
        context: { error: credentialError.message },
      });
    }
  }

  // Probe/sync immediately so admins see real status and executable tools.
  if (candidateKind === 'mcp') {
    try {
      await refreshTools(installation.id);
    } catch (probeError) {
      logError(probeError, {
        context: 'integration_install_probe',
        installationId: installation.id,
      });
    }
  } else {
    const actionTools = buildActionToolsForCatalog(input.catalog_id, effectiveCapabilities);
    await supabase
      .from('integration_installations')
      .update({
        status: 'active',
        tool_cache: { tools: actionTools },
        tool_allowlist: explicitAllowlist ?? actionTools.map((tool) => tool.name),
        tools_synced_at: new Date().toISOString(),
      })
      .eq('id', installation.id);
  }

  const { data: fresh } = await supabase
    .from('integration_installations')
    .select(INSTALLATION_SELECT)
    .eq('id', installation.id)
    .single();
  return fresh as unknown as InstallationRecord;
}

export async function getInstallation(id: string): Promise<InstallationRecord> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('integration_installations')
    .select(INSTALLATION_SELECT)
    .eq('id', id)
    .single();
  if (error || !data) {
    throw new NotFoundError('Integration installation not found', {
      resource: 'integration_installations',
      id,
    });
  }
  return {
    ...(data as unknown as InstallationRecord),
    tool_allowlist: parseAllowlist((data as Record<string, unknown>).tool_allowlist),
  };
}

export async function updateInstallation(
  id: string,
  patch: {
    status?: string;
    config?: Record<string, unknown>;
    tool_allowlist?: string[];
    secret?: string;
    secret_kind?: string;
    server_url?: string;
    last_error?: string | null;
  }
): Promise<InstallationRecord> {
  const supabase = createServiceRoleClient();

  if (patch.server_url) {
    assertSafeUrl(patch.server_url);
    const installation = await getInstallation(id);
    const { error } = await supabase
      .from('integration_catalog')
      .update({ server_url: patch.server_url })
      .eq('id', installation.catalog_id);
    if (error) {
      throw new DatabaseError('Failed to update server URL', {
        context: { error: error.message },
      });
    }
    await mcpClientManager.disconnect(id);
  }

  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.config) update.config = patch.config;
  if (patch.tool_allowlist) update.tool_allowlist = patch.tool_allowlist;
  if (patch.last_error !== undefined) update.last_error = patch.last_error;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('integration_installations').update(update).eq('id', id);
    if (error) {
      throw new DatabaseError('Failed to update installation', {
        context: { error: error.message },
      });
    }
  }

  if (patch.secret) {
    const targetKind = patch.secret_kind ?? 'bearer';
    await supabase
      .from('integration_credentials')
      .delete()
      .eq('installation_id', id)
      .neq('kind', targetKind);

    const { error } = await supabase.from('integration_credentials').upsert(
      {
        installation_id: id,
        kind: targetKind,
        ciphertext: encryptSecret(patch.secret),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'installation_id,kind' }
    );
    if (error) {
      throw new DatabaseError('Failed to update credential', {
        context: { error: error.message },
      });
    }
    await mcpClientManager.disconnect(id);
  }

  return getInstallation(id);
}

export async function deleteInstallation(id: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('integration_installations').delete().eq('id', id);
  if (error) {
    throw new DatabaseError('Failed to delete installation', {
      context: { error: error.message },
    });
  }
  await mcpClientManager.disconnect(id);
}

/** Runs tool discovery (MCP tools/list or SSRF-guarded action descriptor sync) and persists into tool_cache. */
export async function refreshTools(id: string): Promise<IntegrationToolDescriptor[]> {
  const supabase = createServiceRoleClient();
  const installation = await getInstallation(id);

  if (installation.status === 'disabled') {
    throw new APIError('Installation is disabled', {
      statusCode: 409,
      context: { installationId: id },
    });
  }

  const managed = await toManagedInstallation(installation);

  if (managed.kind === 'action') {
    assertSafeUrl(managed.serverUrl);
    const tools = buildActionToolsForCatalog(installation.catalog_id, managed.capabilities);
    const nextAllowlist =
      installation.tool_allowlist.length > 0
        ? installation.tool_allowlist
        : tools.map((tool) => tool.name);
    const { error } = await supabase
      .from('integration_installations')
      .update({
        tool_cache: { tools },
        tool_allowlist: nextAllowlist,
        tools_synced_at: new Date().toISOString(),
        status: 'active',
        last_error: null,
      })
      .eq('id', id);
    if (error) {
      throw new DatabaseError('Failed to persist action tool cache', {
        context: { error: error.message },
      });
    }
    return tools;
  }

  try {
    const tools = await mcpClientManager.listTools(managed);
    const nextAllowlist =
      installation.tool_allowlist.length > 0
        ? installation.tool_allowlist
        : tools.map((tool) => tool.name);
    const { error } = await supabase
      .from('integration_installations')
      .update({
        tool_cache: { tools },
        tool_allowlist: nextAllowlist,
        tools_synced_at: new Date().toISOString(),
        status: 'active',
        last_error: null,
      })
      .eq('id', id);
    if (error) {
      throw new DatabaseError('Failed to persist tool cache', {
        context: { error: error.message },
      });
    }
    return tools;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown discovery error';
    await supabase
      .from('integration_installations')
      .update({ status: 'error', last_error: message })
      .eq('id', id);
    throw error;
  }
}

/** Builds the managed shape (with encrypted credential) for MCP and SSRF-guarded Action connectors. */
export async function toManagedInstallation(
  installation: InstallationRecord
): Promise<ManagedInstallation> {
  const supabase = createServiceRoleClient();
  const { data: dbCatalog } = await supabase
    .from('integration_catalog')
    .select('kind, server_url, auth_type, capabilities')
    .eq('id', installation.catalog_id)
    .single();

  const curated = CURATED_INTEGRATION_CATALOG.find((item) => item.id === installation.catalog_id);
  const catalog = dbCatalog ?? curated;

  if (!catalog || !isExecutableKind(catalog.kind) || !catalog.server_url) {
    throw new APIError(`Installation ${installation.id} is not an executable HTTP/MCP connector`, {
      statusCode: 400,
      context: { installationId: installation.id },
    });
  }

  assertSafeUrl(catalog.server_url);

  let credentialCiphertext: string | null = null;
  if (catalog.auth_type !== 'none') {
    const { data: credential } = await supabase
      .from('integration_credentials')
      .select('ciphertext')
      .eq('installation_id', installation.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    credentialCiphertext = credential?.ciphertext ?? null;
    if (!credentialCiphertext) {
      throw new APIError(
        `Installation ${installation.id} requires a credential but none is stored`,
        { statusCode: 400, context: { installationId: installation.id } }
      );
    }
  }

  return {
    id: installation.id,
    kind: catalog.kind,
    serverUrl: catalog.server_url,
    authType: catalog.auth_type as ManagedInstallation['authType'],
    credentialCiphertext,
    capabilities:
      (catalog as { capabilities?: Record<string, unknown> | null }).capabilities ?? null,
    config: installation.config,
  };
}

export interface ActiveIntegration {
  installation: InstallationRecord;
  slug: string;
  catalog: CatalogRecord;
  managed: ManagedInstallation;
}

/** Active executable installations (MCP Streamable-HTTP & SSRF-guarded Action bridges). */
export async function listActiveMcpIntegrations(
  departmentId?: string
): Promise<ActiveIntegration[]> {
  const supabase = createServiceRoleClient();
  const query = supabase
    .from('integration_installations')
    .select(INSTALLATION_SELECT)
    .eq('status', 'active');
  const { data, error } = await query;
  if (error) {
    throw new DatabaseError('Failed to load active integrations', {
      context: { error: error.message },
    });
  }

  const catalogRows = await listCatalog();
  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));

  const active: ActiveIntegration[] = [];
  for (const raw of data ?? []) {
    const installation: InstallationRecord = {
      ...(raw as unknown as InstallationRecord),
      tool_allowlist: parseAllowlist((raw as Record<string, unknown>).tool_allowlist),
    };
    const catalog = catalogById.get(installation.catalog_id);
    if (!catalog || !isExecutableKind(catalog.kind)) continue;
    // Global installs apply everywhere; department installs apply to that department.
    if (
      installation.scope === 'department' &&
      departmentId &&
      installation.department_id !== departmentId
    ) {
      continue;
    }
    try {
      active.push({
        installation,
        slug: installation.catalog_id,
        catalog,
        managed: await toManagedInstallation(installation),
      });
    } catch (error) {
      logError(error, { context: 'integration_load_skipped', installationId: installation.id });
    }
  }
  return active;
}

interface AuditEntry {
  installationId: string;
  toolName: string;
  invokedBy?: string;
  argsDigest: string;
  durationMs: number;
  status: 'success' | 'error' | 'denied';
  errorMessage?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('integration_audit_logs').insert({
    installation_id: entry.installationId,
    tool_name: entry.toolName,
    invoked_by: entry.invokedBy ?? null,
    args_digest: entry.argsDigest,
    duration_ms: Math.round(entry.durationMs),
    status: entry.status,
    error_message: entry.errorMessage ?? null,
  });
  if (error) {
    logError(new Error(error.message), { context: 'integration_audit_write_failed' });
  }
}

export async function listAuditLogs(installationId: string, limit = 20) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('integration_audit_logs')
    .select(
      'id, tool_name, invoked_by, args_digest, duration_ms, status, error_message, created_at'
    )
    .eq('installation_id', installationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new DatabaseError('Failed to load audit logs', { context: { error: error.message } });
  }
  return data ?? [];
}
