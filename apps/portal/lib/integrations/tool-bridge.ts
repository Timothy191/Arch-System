import { createHash } from 'node:crypto';
import {
  type IntegrationRole,
  type IntegrationRules,
  type IntegrationShiftWindow,
  type IntegrationTriggerOperator,
  type ToolRiskClass,
} from '@repo/contract/schemas/integration.schema';
import { APIError, ForbiddenError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { mcpClientManager } from './mcp-client-manager';
import {
  type ActiveIntegration,
  listActiveMcpIntegrations,
  listInstallations,
  writeAuditLog,
} from './service';

/**
 * Tool bridge: the guarded path for invoking integration tools.
 *
 * Every invocation passes, in order:
 *  1. name resolution against the cached tool index of ACTIVE installations
 *  2. department scoping (department-scoped installs only serve that department)
 *  3. per-installation tool allowlist
 *  4. 4-Pillar Policy & Governance Rules:
 *     - Access & Governance (role restrictions, shift-window schedule, human approval gate, custom rate limit)
 *     - Event & Threshold Trigger Rules (`evaluateIntegrationTriggerRules`)
 *     - Tool & Payload Policy (write-tool overrides, max payload bytes, blocked arg keys, field redaction)
 *     - Network & Egress Rules (egress domain allowlist, circuit-breaker auto-trip on consecutive failures)
 * …then executes against the MCP server and writes an audit row (args digested).
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 30;
const DAY_SHIFT_START_HOUR = 6;
const DAY_SHIFT_END_HOUR = 18;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const REDACTED_PLACEHOLDER = '[REDACTED]';

export interface ToolIndexEntry {
  installationId: string;
  slug: string;
  toolName: string;
  qualifiedName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  riskClass: ToolRiskClass;
}

function resolveRiskClass(config: Record<string, unknown>): ToolRiskClass {
  return config.risk_class === 'write' ? 'write' : 'read';
}

export function extractIntegrationRules(config: Record<string, unknown>): IntegrationRules {
  if (typeof config.rules === 'object' && config.rules !== null && !Array.isArray(config.rules)) {
    return config.rules as IntegrationRules;
  }
  return {};
}

/**
 * Build the Aria-visible tool index for an employee's department.
 * Tools are addressed as `integration__<slug>__<tool>` (contract helper).
 */
export async function listEmployeeTools(departmentId: string): Promise<ToolIndexEntry[]> {
  const active = await listActiveMcpIntegrations(departmentId);
  const index: ToolIndexEntry[] = [];
  for (const entry of active) {
    const baseRiskClass = resolveRiskClass(entry.installation.config);
    const rules = extractIntegrationRules(entry.installation.config);
    const writeOverrides = new Set(rules.write_tool_overrides ?? []);
    const tools = entry.installation.tool_cache?.tools ?? [];
    for (const descriptor of tools) {
      const effectiveRiskClass: ToolRiskClass =
        baseRiskClass === 'write' ||
        rules.require_human_approval === true ||
        writeOverrides.has(descriptor.name)
          ? 'write'
          : 'read';
      index.push({
        installationId: entry.installation.id,
        slug: entry.slug,
        toolName: descriptor.name,
        qualifiedName: `integration__${entry.slug}__${descriptor.name}`,
        description: descriptor.description,
        inputSchema: descriptor.inputSchema,
        riskClass: effectiveRiskClass,
      });
    }
  }
  return index;
}

const rateWindow = new Map<string, { count: number; resetAt: number }>();
const consecutiveFailureCounts = new Map<string, number>();

export function resetIntegrationCircuitBreaker(installationId?: string): void {
  if (installationId) {
    consecutiveFailureCounts.delete(installationId);
    return;
  }
  consecutiveFailureCounts.clear();
}

export function getIntegrationCircuitBreakerFailures(installationId: string): number {
  return consecutiveFailureCounts.get(installationId) ?? 0;
}

interface RateLimitCheckOptions {
  readonly employeeId: string;
  readonly installationId: string;
  readonly maxCallsPerMin?: number;
}

async function assertRateLimit(options: RateLimitCheckOptions): Promise<void> {
  const { employeeId, installationId, maxCallsPerMin = RATE_LIMIT_MAX_CALLS } = options;
  const key = `${employeeId}:${installationId}`;
  const now = Date.now();
  const entry = rateWindow.get(key);
  if (!entry || now > entry.resetAt) {
    rateWindow.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > maxCallsPerMin) {
    throw new APIError('Integration tool rate limit exceeded', {
      statusCode: HTTP_STATUS_TOO_MANY_REQUESTS,
      context: { installationId, maxCallsPerMin },
    });
  }
}

export interface InvokeOptions {
  /** Namespaced tool name (`integration__<slug>__<tool>`) or raw MCP tool name within one installation. */
  tool: string;
  args?: Record<string, unknown>;
  employeeId: string;
  departmentId: string;
  /** Optional caller role evaluated against `rules.allowed_roles`. */
  employeeRole?: IntegrationRole;
  /** Optional hour of day (0-23) evaluated against `rules.active_shift`. */
  currentHour?: number;
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

export interface EvaluateTriggerRuleOptions {
  readonly rules: IntegrationRules;
  readonly eventName?: string;
  readonly metrics?: Readonly<Record<string, number>>;
}

const THRESHOLD_COMPARATORS: Readonly<
  Record<IntegrationTriggerOperator, (metricVal: number, targetVal: number) => boolean>
> = {
  gt: (metricVal, targetVal) => metricVal > targetVal,
  gte: (metricVal, targetVal) => metricVal >= targetVal,
  lt: (metricVal, targetVal) => metricVal < targetVal,
  lte: (metricVal, targetVal) => metricVal <= targetVal,
  eq: (metricVal, targetVal) => metricVal === targetVal,
};

/**
 * Evaluates whether an incoming platform/SCADA event or metric snapshot matches
 * the Event & Threshold Trigger Rules configured on an integration.
 */
export function evaluateIntegrationTriggerRules(options: EvaluateTriggerRuleOptions): boolean {
  const { rules, eventName, metrics } = options;
  const configuredEvents = rules.trigger_events ?? [];
  const hasEventRule = configuredEvents.length > 0;
  const hasThresholdRule =
    typeof rules.threshold_metric === 'string' &&
    typeof rules.threshold_operator === 'string' &&
    typeof rules.threshold_value === 'number';

  if (!hasEventRule && !hasThresholdRule) {
    return false;
  }

  const eventMatched = hasEventRule && Boolean(eventName && configuredEvents.includes(eventName));

  let thresholdMatched = false;
  if (
    hasThresholdRule &&
    metrics &&
    rules.threshold_metric &&
    rules.threshold_operator &&
    typeof rules.threshold_value === 'number'
  ) {
    const candidateMetric = metrics[rules.threshold_metric];
    if (typeof candidateMetric === 'number') {
      const comparator = THRESHOLD_COMPARATORS[rules.threshold_operator];
      thresholdMatched = comparator(candidateMetric, rules.threshold_value);
    }
  }

  return eventMatched || thresholdMatched;
}

export interface DispatchTriggerOptions {
  readonly eventName?: string;
  readonly metrics?: Readonly<Record<string, number>>;
}

/**
 * Evaluates all active installations against an incoming platform/SCADA/Vercel
 * event or metric snapshot and logs an audit entry for each triggered connector.
 */
export async function dispatchIntegrationEventTriggers(
  options: DispatchTriggerOptions
): Promise<string[]> {
  try {
    const installations = await listInstallations();
    const matchedSlugs: string[] = [];
    for (const inst of installations) {
      if (inst.status !== 'active') continue;
      const rules = extractIntegrationRules(inst.config);
      const didTrigger = evaluateIntegrationTriggerRules({
        rules,
        eventName: options.eventName,
        metrics: options.metrics,
      });
      if (didTrigger) {
        matchedSlugs.push(inst.catalog_id);
        await writeAuditLog({
          installationId: inst.id,
          toolName: `trigger:${options.eventName ?? rules.threshold_metric ?? 'metric'}`,
          argsDigest: argsDigest({
            eventName: options.eventName ?? null,
            metrics: options.metrics ?? null,
          }),
          durationMs: 1,
          status: 'success',
        });
      }
    }
    return matchedSlugs;
  } catch {
    return [];
  }
}

function isHourWithinShiftWindow(hour: number, shiftWindow: IntegrationShiftWindow): boolean {
  if (shiftWindow === 'all') return true;
  const isDayHour = hour >= DAY_SHIFT_START_HOUR && hour < DAY_SHIFT_END_HOUR;
  return shiftWindow === 'day' ? isDayHour : !isDayHour;
}

function assertAccessAndEgressRules(
  match: ActiveIntegration,
  toolName: string,
  options: InvokeOptions
): IntegrationRules {
  const rules = extractIntegrationRules(match.installation.config);
  const slug = match.slug;

  // 1. Circuit breaker check
  if (typeof rules.circuit_breaker_threshold === 'number') {
    const failures = consecutiveFailureCounts.get(match.installation.id) ?? 0;
    if (failures >= rules.circuit_breaker_threshold) {
      throw new APIError('Integration circuit breaker is open due to repeated upstream errors', {
        statusCode: HTTP_STATUS_SERVICE_UNAVAILABLE,
        context: { installationId: match.installation.id, failures },
      });
    }
  }

  // 2. Role restriction check
  if (
    rules.allowed_roles &&
    rules.allowed_roles.length > 0 &&
    options.employeeRole &&
    !rules.allowed_roles.includes(options.employeeRole)
  ) {
    throw new ForbiddenError(
      `Role "${options.employeeRole}" is not permitted to invoke this integration`,
      { resource: 'integration_tool', context: { slug, toolName } }
    );
  }

  // 3. Shift window schedule check
  if (rules.active_shift && rules.active_shift !== 'all') {
    const activeHour = options.currentHour ?? new Date().getHours();
    if (!isHourWithinShiftWindow(activeHour, rules.active_shift)) {
      throw new ForbiddenError(
        `Integration is restricted to the ${rules.active_shift} shift window`,
        { resource: 'integration_tool', context: { slug, toolName, activeHour } }
      );
    }
  }

  // 4. Risk-class, human approval, and write-tool override check
  const baseRiskClass = resolveRiskClass(match.installation.config);
  const isWriteOverride = rules.write_tool_overrides?.includes(toolName) === true;
  const requiresWriteConfirmation =
    baseRiskClass === 'write' || rules.require_human_approval === true || isWriteOverride;

  if (requiresWriteConfirmation && options.kind !== 'write') {
    throw new ForbiddenError(
      'This tool is write-classified and requires human confirmation before execution',
      { resource: 'integration_tool', context: { slug, toolName } }
    );
  }

  // 5. Egress domain allowlist check
  if (rules.egress_domain_allowlist && rules.egress_domain_allowlist.length > 0) {
    const serverUrl = match.managed.serverUrl;
    if (serverUrl) {
      const hostname = new URL(serverUrl).hostname.toLowerCase();
      const allowedDomains = rules.egress_domain_allowlist.map((d) => d.toLowerCase().trim());
      if (!allowedDomains.includes(hostname)) {
        throw new ForbiddenError(
          `Target domain "${hostname}" is not permitted by the integration egress allowlist`,
          { resource: 'integration_tool', context: { slug, toolName, hostname } }
        );
      }
    }
  }

  return rules;
}

function applyPayloadPolicyRules(
  rawArgs: Record<string, unknown>,
  rules: IntegrationRules
): { sanitizedArgs: Record<string, unknown>; policyError: string | null } {
  if (typeof rules.max_payload_bytes === 'number') {
    const byteLength = Buffer.byteLength(JSON.stringify(rawArgs), 'utf8');
    if (byteLength > rules.max_payload_bytes) {
      return {
        sanitizedArgs: rawArgs,
        policyError: `Payload size (${byteLength} bytes) exceeds policy limit of ${rules.max_payload_bytes} bytes`,
      };
    }
  }

  if (rules.blocked_arg_keys && rules.blocked_arg_keys.length > 0) {
    const blockedSet = new Set(rules.blocked_arg_keys);
    for (const argKey of Object.keys(rawArgs)) {
      if (blockedSet.has(argKey)) {
        return {
          sanitizedArgs: rawArgs,
          policyError: `Argument "${argKey}" is blocked by integration payload policy rules`,
        };
      }
    }
  }

  if (!rules.redact_fields || rules.redact_fields.length === 0) {
    return { sanitizedArgs: rawArgs, policyError: null };
  }

  const redactSet = new Set(rules.redact_fields);
  const redactedArgs: Record<string, unknown> = {};
  for (const [argKey, argVal] of Object.entries(rawArgs)) {
    redactedArgs[argKey] = redactSet.has(argKey) ? REDACTED_PLACEHOLDER : argVal;
  }

  return { sanitizedArgs: redactedArgs, policyError: null };
}

function argsDigest(args: Record<string, unknown> | undefined): string {
  return createHash('sha256')
    .update(JSON.stringify(args ?? {}))
    .digest('hex');
}

function matchesAllowlist(allowlist: string[], toolName: string): boolean {
  if (allowlist.length === 0) return false; // empty allowlist = no tools permitted (secure default)
  return allowlist.includes(toolName);
}

/**
 * Shallow structural validation of tool arguments against an MCP `inputSchema`
 * (JSON Schema). Checks `required` and top-level property types. Returns null on
 * success or an error message describing the first violation.
 */
function validateToolArgs(
  inputSchema: Record<string, unknown> | undefined,
  args: Record<string, unknown>
): string | null {
  if (!inputSchema || typeof inputSchema !== 'object') return null;
  const schema = inputSchema as {
    properties?: Record<string, { type?: string | string[] }>;
    required?: string[];
  };
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!(key in args)) {
      return `Missing required argument "${key}"`;
    }
  }
  const properties = schema.properties ?? {};
  for (const [key, candidateVal] of Object.entries(args)) {
    const propSchema = properties[key];
    if (!propSchema || typeof propSchema !== 'object') continue;
    const expected = (propSchema as { type?: string | string[] }).type;
    if (!expected) continue;
    const expectedTypes = Array.isArray(expected) ? expected : [expected];
    const actualType = Array.isArray(candidateVal) ? 'array' : typeof candidateVal;
    const normalized =
      actualType === 'number' && Number.isInteger(candidateVal) ? 'integer' : actualType;
    const ok = expectedTypes.some(
      (t) => t === actualType || t === normalized || (t === 'number' && actualType === 'number')
    );
    if (!ok) {
      return `Argument "${key}" must be of type ${expectedTypes.join(' | ')}`;
    }
  }
  return null;
}

interface FindActiveToolFilter {
  readonly active: ActiveIntegration[];
  readonly slug: string;
  readonly toolName: string;
  readonly departmentId: string;
  readonly installationId?: string;
}

function findActiveForTool(filter: FindActiveToolFilter): ActiveIntegration {
  const { active, slug, toolName, departmentId, installationId } = filter;
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
    const match = findActiveForTool({
      active,
      slug,
      toolName,
      departmentId: options.departmentId,
      installationId: options.installationId,
    });

    const rules = assertAccessAndEgressRules(match, toolName, options);

    const { sanitizedArgs, policyError } = applyPayloadPolicyRules(options.args ?? {}, rules);
    if (policyError) {
      await writeAuditLog({
        installationId: match.installation.id,
        toolName,
        invokedBy: options.employeeId,
        argsDigest: argsDigest(options.args),
        durationMs: Date.now() - started,
        status: 'denied',
        errorMessage: policyError,
      });
      return { ok: false, error: policyError };
    }

    const descriptor = match.installation.tool_cache?.tools?.find((t) => t.name === toolName);
    const validationError = validateToolArgs(
      (descriptor as { inputSchema?: Record<string, unknown> } | undefined)?.inputSchema,
      sanitizedArgs
    );
    if (validationError) {
      await writeAuditLog({
        installationId: match.installation.id,
        toolName,
        invokedBy: options.employeeId,
        argsDigest: argsDigest(sanitizedArgs),
        durationMs: Date.now() - started,
        status: 'denied',
        errorMessage: validationError,
      });
      return { ok: false, error: validationError };
    }

    await assertRateLimit({
      employeeId: options.employeeId,
      installationId: match.installation.id,
      maxCallsPerMin: rules.rate_limit_per_min,
    });

    const result = await mcpClientManager.callTool(match.managed, toolName, sanitizedArgs);

    await writeAuditLog({
      installationId: match.installation.id,
      toolName,
      invokedBy: options.employeeId,
      argsDigest: argsDigest(sanitizedArgs),
      durationMs: Date.now() - started,
      status: 'success',
    });

    const isError = (result as { isError?: boolean }).isError === true;
    if (isError) {
      const prevFailures = consecutiveFailureCounts.get(match.installation.id) ?? 0;
      consecutiveFailureCounts.set(match.installation.id, prevFailures + 1);
    } else {
      consecutiveFailureCounts.delete(match.installation.id);
    }

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
        if (!(error instanceof ForbiddenError)) {
          const prevFailures = consecutiveFailureCounts.get(match.installation.id) ?? 0;
          consecutiveFailureCounts.set(match.installation.id, prevFailures + 1);
        }
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
