import {
  buildIntegrationToolName,
  type IntegrationToolDescriptor,
} from '@repo/contract/schemas/integration.schema';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { APIError, DatabaseError, NotFoundError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { encryptSecret } from './crypto';
import { type ManagedInstallation, mcpClientManager } from './mcp-client-manager';

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
}

const INSTALLATION_SELECT = `
  id, catalog_id, scope, department_id, status, config, tool_allowlist,
  tool_cache, tools_synced_at, last_error, created_at, updated_at
`;

const CATALOG_SELECT = `
  id, name, description, author, icon_url, kind, server_url, auth_type, verified, docs_url
`;

function parseAllowlist(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export async function listCatalog(): Promise<CatalogRecord[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('integration_catalog').select(CATALOG_SELECT);
  if (error) {
    throw new DatabaseError('Failed to load integration catalog', {
      context: { error: error.message },
    });
  }
  return (data ?? []) as unknown as CatalogRecord[];
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
  const supabase = createServiceRoleClient();

  const { data: catalogEntry } = await supabase
    .from('integration_catalog')
    .select('id, kind, server_url, auth_type')
    .eq('id', input.catalog_id)
    .single();

  if (!catalogEntry) {
    if (!input.catalog_entry) {
      throw new NotFoundError(`Catalog entry "${input.catalog_id}" not found`, {
        resource: 'integration_catalog',
      });
    }
    const { error: insertError } = await supabase.from('integration_catalog').insert({
      id: input.catalog_id,
      name: input.catalog_entry.name,
      description: input.catalog_entry.description ?? null,
      author: input.catalog_entry.author ?? null,
      icon_url: input.catalog_entry.icon_url ?? null,
      kind: input.catalog_entry.kind,
      server_url: input.catalog_entry.server_url ?? null,
      auth_type: input.catalog_entry.auth_type,
      docs_url: input.catalog_entry.docs_url ?? null,
      verified: input.catalog_entry.verified ?? false,
    });
    if (insertError) {
      throw new DatabaseError('Failed to create catalog entry', {
        context: { error: insertError.message },
      });
    }
  }

  const effective = catalogEntry ?? {
    kind: input.catalog_entry!.kind,
    server_url: input.catalog_entry!.server_url ?? null,
    auth_type: input.catalog_entry!.auth_type,
  };

  const { data: installation, error } = await supabase
    .from('integration_installations')
    .insert({
      catalog_id: input.catalog_id,
      scope: input.scope,
      department_id: input.scope === 'department' ? (input.department_id ?? null) : null,
      status: 'pending',
      config: input.config ?? {},
      tool_allowlist: input.tool_allowlist ?? [],
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
    const { error: credentialError } = await supabase.from('integration_credentials').insert({
      installation_id: installation.id,
      kind: input.secret_kind ?? 'bearer',
      ciphertext: encryptSecret(input.secret),
    });
    if (credentialError) {
      await supabase.from('integration_installations').delete().eq('id', installation.id);
      throw new DatabaseError('Failed to store credential', {
        context: { error: credentialError.message },
      });
    }
  }

  // Probe immediately so admins see real status instead of a hopeful 'pending'.
  if (effective.kind === 'mcp') {
    try {
      await refreshTools(installation.id);
    } catch (error) {
      logError(error, { context: 'integration_install_probe', installationId: installation.id });
    }
  } else {
    await supabase
      .from('integration_installations')
      .update({ status: 'active' })
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
  }
): Promise<InstallationRecord> {
  const supabase = createServiceRoleClient();

  if (patch.server_url) {
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

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('integration_installations').update(update).eq('id', id);
    if (error) {
      throw new DatabaseError('Failed to update installation', {
        context: { error: error.message },
      });
    }
  }

  if (patch.secret) {
    const { error } = await supabase.from('integration_credentials').upsert({
      installation_id: id,
      kind: patch.secret_kind ?? 'bearer',
      ciphertext: encryptSecret(patch.secret),
    });
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

/** Runs MCP tools/list and persists the result into tool_cache. */
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
  try {
    const tools = await mcpClientManager.listTools(managed);
    const { error } = await supabase
      .from('integration_installations')
      .update({
        tool_cache: { tools },
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

/** Builds the managed shape (with decrypted credential) for the MCP client manager. */
export async function toManagedInstallation(
  installation: InstallationRecord
): Promise<ManagedInstallation> {
  const supabase = createServiceRoleClient();
  const { data: catalog } = await supabase
    .from('integration_catalog')
    .select('kind, server_url, auth_type')
    .eq('id', installation.catalog_id)
    .single();

  if (catalog?.kind !== 'mcp' || !catalog.server_url) {
    throw new APIError(`Installation ${installation.id} is not an MCP connector`, {
      statusCode: 400,
      context: { installationId: installation.id },
    });
  }

  let credentialCiphertext: string | null = null;
  if (catalog.auth_type !== 'none') {
    const { data: credential } = await supabase
      .from('integration_credentials')
      .select('ciphertext')
      .eq('installation_id', installation.id)
      .single();
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
    serverUrl: catalog.server_url,
    authType: catalog.auth_type as ManagedInstallation['authType'],
    credentialCiphertext,
    config: installation.config,
  };
}

export interface ActiveIntegration {
  installation: InstallationRecord;
  slug: string;
  catalog: CatalogRecord;
  managed: ManagedInstallation;
}

/** Active MCP installations eligible for tool invocation. */
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
    if (catalog?.kind !== 'mcp') continue;
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

export interface IntegrationToolIndexEntry {
  installationId: string;
  toolName: string;
  qualifiedName: string;
  descriptor: IntegrationToolDescriptor;
}

/** Flattens cached tools into Aria-addressable namespaced entries. */
export function buildToolIndex(active: ActiveIntegration[]): IntegrationToolIndexEntry[] {
  const index: IntegrationToolIndexEntry[] = [];
  for (const entry of active) {
    const tools = entry.installation.tool_cache?.tools ?? [];
    for (const descriptor of tools) {
      index.push({
        installationId: entry.installation.id,
        toolName: descriptor.name,
        qualifiedName: buildIntegrationToolName(entry.slug, descriptor.name),
        descriptor,
      });
    }
  }
  return index;
}

export interface AuditEntry {
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
