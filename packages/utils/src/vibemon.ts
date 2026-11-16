/**
 * Resilient, Optional VibeMon Telemetry & MCP Integration Client.
 *
 * All VibeMon operations are strictly optional and isomorphic (safe across
 * Node.js, Edge, and browser runtimes). When VibeMon is unconfigured,
 * running in local-only mode, or unreachable, helpers return structured
 * fallback results without interrupting portal workflows.
 */

export const DEFAULT_VIBEMON_MCP_URL = 'https://vibemon.dev/api/mcp';
export const DEFAULT_VIBEMON_HOOK_URL =
  'https://sirpdtcwawcidhgtltps.supabase.co/functions/v1/hook';
export const DEFAULT_VIBEMON_TIMEOUT_MS = 3000;
export const DEFAULT_VIBEMON_VERSION = '32';
export const LOCAL_VIBEMON_API_KEY = 'vbm_local_arch_system';
export const VIBEMON_KEY_PREFIX = 'vbm_';
export const VIBEMON_ENVELOPE_VERSION = 2;

const JSON_RPC_VERSION = '2.0';
const JSON_RPC_REQUEST_ID = 1;
const SSE_DATA_PREFIX = 'data: ';
const HTTP_STATUS_OK = 200;

export type VibemonKeyMode = 'remote' | 'local-only' | 'unconfigured';
export type VibemonHealthStatus = 'healthy' | 'degraded' | 'unavailable';
export type VibemonEventName = 'test' | 'session_start' | 'activity' | 'stop';
export type VibemonAgentName =
  | 'antigravity'
  | 'claude_code'
  | 'gemini_cli'
  | 'cursor'
  | 'codex_cli'
  | 'cline'
  | 'qoder';

export interface VibemonMcpCallOptions {
  readonly toolName: string;
  readonly toolArguments?: Readonly<Record<string, unknown>>;
  readonly apiKey?: string;
  readonly mcpUrl?: string;
  readonly timeoutMs?: number;
}

export interface VibemonMcpCallResult<TResult> {
  readonly isSuccess: boolean;
  readonly httpStatus: number | null;
  readonly structuredResult?: TResult;
  readonly error?: string;
}

export interface VibemonHealthCheckOptions {
  readonly apiKey?: string;
  readonly teamId?: string;
  readonly mcpUrl?: string;
  readonly hookUrl?: string;
  readonly version?: string;
  readonly localLedgerEvents?: number;
  readonly timeoutMs?: number;
}

export interface VibemonHealthCheckResult {
  readonly status: VibemonHealthStatus;
  readonly optional: true;
  readonly isConfigured: boolean;
  readonly keyMode: VibemonKeyMode;
  readonly latencyMs: number;
  readonly mcpUrl: string;
  readonly hookUrl: string;
  readonly version: string;
  readonly httpStatus: number | null;
  readonly localLedgerEvents: number;
  readonly activeTeamId: string | null;
  readonly openTodosCount: number | null;
  readonly activeSessionsCount: number | null;
  readonly error: string | null;
}

export interface EmitVibemonHookOptions {
  readonly event: VibemonEventName;
  readonly agent: VibemonAgentName;
  readonly cwd: string;
  readonly apiKey?: string;
  readonly hookUrl?: string;
  readonly version?: string;
  readonly repoIdentifier?: string;
  readonly branch?: string;
  readonly headSha?: string;
  readonly sessionId?: string;
  readonly signals?: Readonly<Record<string, unknown>>;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
}

export interface EmitVibemonHookResult {
  readonly isSuccess: boolean;
  readonly isSkipped: boolean;
  readonly keyMode: VibemonKeyMode;
  readonly httpStatus: number | null;
  readonly error: string | null;
}

interface VibemonTeamSummary {
  readonly team_id: string;
  readonly name: string;
}

interface VibemonTeamListPayload {
  readonly teams?: readonly VibemonTeamSummary[];
}

interface VibemonTodoListPayload {
  readonly count?: number;
}

interface VibemonSessionEntry {
  readonly state?: string;
}

interface VibemonSessionListPayload {
  readonly sessions?: readonly VibemonSessionEntry[];
}

export function resolveVibemonApiKey(overrideKey?: string): string | undefined {
  const candidate = overrideKey?.trim() || process.env.VIBEMON_API_KEY?.trim();
  if (!candidate?.startsWith(VIBEMON_KEY_PREFIX)) {
    return undefined;
  }
  return candidate;
}

export function resolveVibemonKeyMode(apiKey?: string): VibemonKeyMode {
  const resolvedKey = resolveVibemonApiKey(apiKey);
  if (!resolvedKey) {
    return 'unconfigured';
  }
  if (resolvedKey === LOCAL_VIBEMON_API_KEY) {
    return 'local-only';
  }
  return 'remote';
}

function parseMcpResponseText<TResult>(rawBody: string): {
  readonly structured?: TResult;
  readonly rpcError?: string;
} {
  const sseLine = rawBody.split(/\r?\n/).find((line) => line.startsWith(SSE_DATA_PREFIX));
  const jsonText = sseLine ? sseLine.slice(SSE_DATA_PREFIX.length) : rawBody;
  const parsedJson = JSON.parse(jsonText) as {
    readonly error?: { readonly message?: string };
    readonly result?: {
      readonly isError?: boolean;
      readonly structuredContent?: TResult;
      readonly content?: readonly { readonly text?: string }[];
    };
  };

  if (parsedJson.error?.message) {
    return { rpcError: parsedJson.error.message };
  }
  if (parsedJson.result?.isError) {
    const firstMessage = parsedJson.result.content?.[0]?.text ?? 'VibeMon MCP tool returned error';
    return { rpcError: firstMessage };
  }
  if (parsedJson.result?.structuredContent !== undefined) {
    return { structured: parsedJson.result.structuredContent };
  }
  const fallbackText = parsedJson.result?.content?.[0]?.text;
  if (!fallbackText) {
    return {};
  }
  return { structured: JSON.parse(fallbackText) as TResult };
}

export async function callVibemonMcpTool<TResult>(
  options: VibemonMcpCallOptions
): Promise<VibemonMcpCallResult<TResult>> {
  const apiKey = resolveVibemonApiKey(options.apiKey);
  if (!apiKey || apiKey === LOCAL_VIBEMON_API_KEY) {
    return {
      isSuccess: false,
      httpStatus: null,
      error: 'Remote VibeMon API key is not configured',
    };
  }

  const mcpUrl = (options.mcpUrl ?? DEFAULT_VIBEMON_MCP_URL).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_VIBEMON_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        id: JSON_RPC_REQUEST_ID,
        method: 'tools/call',
        params: {
          name: options.toolName,
          arguments: options.toolArguments ?? {},
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutHandle));

    if (!response.ok) {
      return {
        isSuccess: false,
        httpStatus: response.status,
        error: `VibeMon MCP HTTP ${response.status}`,
      };
    }

    const rawBody = await response.text();
    const parsedPayload = parseMcpResponseText<TResult>(rawBody);
    if (parsedPayload.rpcError) {
      return {
        isSuccess: false,
        httpStatus: response.status,
        error: parsedPayload.rpcError,
      };
    }

    return {
      isSuccess: true,
      httpStatus: response.status,
      structuredResult: parsedPayload.structured,
    };
  } catch (caughtError: unknown) {
    const message =
      caughtError instanceof Error ? caughtError.message : 'VibeMon MCP request failed';
    return {
      isSuccess: false,
      httpStatus: null,
      error: message,
    };
  }
}

function buildLocalOrUnconfiguredHealth(
  options: VibemonHealthCheckOptions,
  keyMode: 'local-only' | 'unconfigured',
  latencyMs: number
): VibemonHealthCheckResult {
  const localEvents = options.localLedgerEvents ?? 0;
  const isLocalReady = keyMode === 'local-only' || localEvents > 0;
  return {
    status: isLocalReady ? 'healthy' : 'unavailable',
    optional: true,
    isConfigured: keyMode === 'local-only',
    keyMode,
    latencyMs,
    mcpUrl: options.mcpUrl ?? DEFAULT_VIBEMON_MCP_URL,
    hookUrl: options.hookUrl ?? DEFAULT_VIBEMON_HOOK_URL,
    version: options.version ?? DEFAULT_VIBEMON_VERSION,
    httpStatus: null,
    localLedgerEvents: localEvents,
    activeTeamId: options.teamId ?? process.env.VIBEMON_TEAM_ID ?? null,
    openTodosCount: null,
    activeSessionsCount: null,
    error: isLocalReady ? null : 'VIBEMON_API_KEY is not configured',
  };
}

export async function checkVibemonHealth(
  options: VibemonHealthCheckOptions = {}
): Promise<VibemonHealthCheckResult> {
  const startedAtMs = Date.now();
  const keyMode = resolveVibemonKeyMode(options.apiKey);
  if (keyMode !== 'remote') {
    return buildLocalOrUnconfiguredHealth(options, keyMode, Date.now() - startedAtMs);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_VIBEMON_TIMEOUT_MS;
  const configuredTeamId = options.teamId ?? process.env.VIBEMON_TEAM_ID;

  const [teamsOutcome, todosOutcome, sessionsOutcome] = await Promise.all([
    callVibemonMcpTool<VibemonTeamListPayload>({
      toolName: 'team_list',
      apiKey: options.apiKey,
      mcpUrl: options.mcpUrl,
      timeoutMs,
    }),
    callVibemonMcpTool<VibemonTodoListPayload>({
      toolName: 'todo_list',
      toolArguments: configuredTeamId ? { team_id: configuredTeamId } : {},
      apiKey: options.apiKey,
      mcpUrl: options.mcpUrl,
      timeoutMs,
    }),
    callVibemonMcpTool<VibemonSessionListPayload>({
      toolName: 'session_list',
      toolArguments: { active_only: true },
      apiKey: options.apiKey,
      mcpUrl: options.mcpUrl,
      timeoutMs,
    }),
  ]);

  const latencyMs = Date.now() - startedAtMs;
  const resolvedTeamId =
    configuredTeamId ?? teamsOutcome.structuredResult?.teams?.[0]?.team_id ?? null;
  const openTodosCount = todosOutcome.structuredResult?.count ?? null;
  const activeSessionsCount = sessionsOutcome.structuredResult?.sessions?.length ?? null;

  return {
    status: teamsOutcome.isSuccess ? 'healthy' : 'degraded',
    optional: true,
    isConfigured: true,
    keyMode: 'remote',
    latencyMs,
    mcpUrl: options.mcpUrl ?? DEFAULT_VIBEMON_MCP_URL,
    hookUrl: options.hookUrl ?? DEFAULT_VIBEMON_HOOK_URL,
    version: options.version ?? DEFAULT_VIBEMON_VERSION,
    httpStatus: teamsOutcome.httpStatus,
    localLedgerEvents: options.localLedgerEvents ?? 0,
    activeTeamId: resolvedTeamId,
    openTodosCount,
    activeSessionsCount,
    error: teamsOutcome.error ?? null,
  };
}

export async function emitVibemonHookEvent(
  options: EmitVibemonHookOptions
): Promise<EmitVibemonHookResult> {
  const keyMode = resolveVibemonKeyMode(options.apiKey);
  if (keyMode !== 'remote') {
    return {
      isSuccess: keyMode === 'local-only',
      isSkipped: true,
      keyMode,
      httpStatus: null,
      error: keyMode === 'unconfigured' ? 'VIBEMON_API_KEY is not configured' : null,
    };
  }

  const apiKey = resolveVibemonApiKey(options.apiKey);
  const hookUrl = (options.hookUrl ?? DEFAULT_VIBEMON_HOOK_URL).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_VIBEMON_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const envelope = {
    v: VIBEMON_ENVELOPE_VERSION,
    event: options.event,
    agent: options.agent,
    cwd: options.cwd,
    timestamp: new Date().toISOString(),
    ...(options.repoIdentifier ? { repo_identifier: options.repoIdentifier } : {}),
    ...(options.branch ? { branch: options.branch } : {}),
    ...(options.headSha ? { head_sha: options.headSha } : {}),
    ...(options.sessionId ? { session_id: options.sessionId } : {}),
    signals: options.signals ?? {},
    payload: options.payload ?? {},
  };

  try {
    const response = await fetch(hookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Vibemon-Version': options.version ?? DEFAULT_VIBEMON_VERSION,
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutHandle));

    const didSucceed = response.status === HTTP_STATUS_OK;
    return {
      isSuccess: didSucceed,
      isSkipped: false,
      keyMode: 'remote',
      httpStatus: response.status,
      error: didSucceed ? null : `VibeMon hook HTTP ${response.status}`,
    };
  } catch (caughtError: unknown) {
    const message =
      caughtError instanceof Error ? caughtError.message : 'VibeMon hook transmission failed';
    return {
      isSuccess: false,
      isSkipped: false,
      keyMode: 'remote',
      httpStatus: null,
      error: message,
    };
  }
}
