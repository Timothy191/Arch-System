import { createHash } from 'node:crypto';
import { type ToolRiskClass } from '@repo/contract/schemas/integration.schema';
import { APIError, ForbiddenError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { mcpClientManager } from './mcp-client-manager';
import {
  type ActiveIntegration,
  buildToolIndex,
  listActiveMcpIntegrations,
  writeAuditLog,
} from './service';

/**
 * Tool bridge: the guarded path for invoking integration tools.
 *
 * Every invocation passes, in order:
 *  1. name resolution against the cached tool index of ACTIVE installations
 *  2. department scoping (department-scoped installs only serve that department)
 *  3. per-installation tool allowlist
 *  4. risk-class gate (write-class calls must arrive via the confirmed 'write' path)
 *  5. per-employee rate limit
 * …then executes against the MCP server and writes an audit row (args digested).
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 30;

export interface ToolIndexEntry {
  installationId: string;
  slug: string;
  toolName: string;
  qualifiedName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  riskClass: ToolRiskClass;
}

export function resolveRiskClass(config: Record<string, unknown>): ToolRiskClass {
  return config.risk_class === 'write' ? 'write' : 'read';
}

/**
 * Build the Aria-visible tool index for an employee's department.
 * Tools are addressed as `integration__<slug>__<tool>` (contract helper).
 */
export async function listEmployeeTools(departmentId: string): Promise<ToolIndexEntry[]> {
  const active = await listActiveMcpIntegrations(departmentId);
  const index: ToolIndexEntry[] = [];
  for (const entry of active) {
    const riskClass = resolveRiskClass(entry.installation.config);
    const tools = entry.installation.tool_cache?.tools ?? [];
    for (const descriptor of tools) {
      index.push({
        installationId: entry.installation.id,
        slug: entry.slug,
        toolName: descriptor.name,
        qualifiedName: `integration__${entry.slug}__${descriptor.name}`,
        description: descriptor.description,
        inputSchema: descriptor.inputSchema,
        riskClass,
      });
    }
  }
  return index;
}

async function assertRateLimit(employeeId: string, installationId: string): Promise<void> {
  // In-memory sliding window: sufficient for the single-region portal deployment;
  // Redis-backed limiting remains available at the route layer via withRateLimit.
  const key = `${employeeId}:${installationId}`;
  const now = Date.now();
  const entry = rateWindow.get(key);
  if (!entry || now > entry.resetAt) {
    rateWindow.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_CALLS) {
    throw new APIError('Integration tool rate limit exceeded', {
      statusCode: 429,
      context: { installationId },
    });
  }
}

const rateWindow = new Map<string, { count: number; resetAt: number }>();

export interface InvokeOptions {
  /** Namespaced tool name (`integration__<slug>__<tool>`) or raw MCP tool name within one installation. */
  tool: string;
  args?: Record<string, unknown>;
  employeeId: string;
  departmentId: string;
  /** 'write' calls arrive only after human confirmation in the Aria flow. */
  kind: 'read' | 'write';
  /** Direct invocation against a known installation (admin test path). */
  installationId?: string;
}

export interface InvokeResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function argsDigest(args: Record<string, unknown> | undefined): string {
  return createHash('sha256')
    .update(JSON.stringify(args ?? {}))
    .digest('hex');
}

function matchesAllowlist(allowlist: string[], toolName: string): boolean {
  if (allowlist.length === 0) return true; // empty allowlist = all tools permitted
  return allowlist.includes(toolName);
}

function findActiveForTool(
  active: ActiveIntegration[],
  slug: string,
  toolName: string,
  departmentId: string,
  installationId?: string
): ActiveIntegration {
  const candidates = active.filter((entry) => {
    if (entry.slug !== slug) return false;
    if (installationId && entry.installation.id !== installationId) return false;
    if (
      entry.installation.scope === 'department' &&
      entry.installation.department_id !== departmentId
    ) {
      return false;
    }
    return true;
  });
  const match = candidates[0];
  if (!match) {
    throw new ForbiddenError('Integration tool is not available for this context', {
      resource: 'integration_tool',
      context: { slug, toolName },
    });
  }
  if (!matchesAllowlist(match.installation.tool_allowlist, toolName)) {
    throw new ForbiddenError(`Tool "${toolName}" is not on the installation allowlist`, {
      resource: 'integration_tool',
      context: { slug, toolName },
    });
  }
  return match;
}

/** Executes one integration tool call through the full guard chain. */
export async function invokeIntegrationTool(options: InvokeOptions): Promise<InvokeResult> {
  const started = Date.now();
  const parsed = parseQualifiedName(options.tool);
  if (!parsed) {
    return { ok: false, error: `Malformed integration tool name: ${options.tool}` };
  }
  const { slug, toolName } = parsed;

  try {
    const active = await listActiveMcpIntegrations(options.departmentId);
    const match = findActiveForTool(
      active,
      slug,
      toolName,
      options.departmentId,
      options.installationId
    );

    const riskClass = resolveRiskClass(match.installation.config);
    if (riskClass === 'write' && options.kind !== 'write') {
      throw new ForbiddenError(
        'This tool is write-classified and requires human confirmation before execution',
        { resource: 'integration_tool', context: { slug, toolName } }
      );
    }

    await assertRateLimit(options.employeeId, match.installation.id);

    const result = await mcpClientManager.callTool(match.managed, toolName, options.args ?? {});

    await writeAuditLog({
      installationId: match.installation.id,
      toolName,
      invokedBy: options.employeeId,
      argsDigest: argsDigest(options.args),
      durationMs: Date.now() - started,
      status: 'success',
    });

    const isError = (result as { isError?: boolean }).isError === true;
    return {
      ok: !isError,
      data: result.content ?? result,
      error: isError ? 'Tool reported an execution error' : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown integration error';
    logError(error, { context: 'integration_tool_invoke', slug, toolName });

    // Best-effort audit for denied/failed calls against a resolvable installation.
    try {
      const active = await listActiveMcpIntegrations(options.departmentId);
      const match = active.find((entry) => entry.slug === slug);
      if (match) {
        await writeAuditLog({
          installationId: match.installation.id,
          toolName,
          invokedBy: options.employeeId,
          argsDigest: argsDigest(options.args),
          durationMs: Date.now() - started,
          status: error instanceof ForbiddenError ? 'denied' : 'error',
          errorMessage: message,
        });
      }
    } catch (auditError) {
      logError(auditError, { context: 'integration_audit_failure_path' });
    }

    return { ok: false, error: message };
  }
}

function parseQualifiedName(name: string): { slug: string; toolName: string } | null {
  // Canonical form: integration__<slug>__<tool>. Tolerate slug-embedded underscores
  // by splitting on the LAST separator for the tool name.
  if (!name.startsWith('integration__')) return null;
  const rest = name.slice('integration__'.length);
  const separator = rest.lastIndexOf('__');
  if (separator <= 0 || separator === rest.length - 2) return null;
  return { slug: rest.slice(0, separator), toolName: rest.slice(separator + 2) };
}

/** Re-exports for route handlers that want the index without rebuilding it. */
export { buildToolIndex };
