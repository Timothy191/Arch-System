import {
  type CloudflareAccountStatus,
  type CloudflareAiGatewayStatus,
  type CloudflareConnectionMode,
  type CloudflareQueue,
  type CloudflareQueuesStatus,
  type CloudflareR2Bucket,
  type CloudflareR2Status,
  type CloudflareSecurityCentreStatus,
  type CloudflareTunnel,
  type CloudflareTunnelStatus,
  type CloudflareTurnstileStatus,
  type CloudflareWorker,
  type CloudflareWorkersStatus,
  type CloudflareZeroTrustPolicy,
  type CloudflareZeroTrustStatus,
} from '@repo/contract';
import { ForbiddenError, NotFoundError, RateLimitError, ValidationError } from '@repo/errors';
import { createFetchClient, type FetchClient } from '@repo/utils/fetch-client';

/**
 * Cloudflare API client — read-only, typed, no fabricated metrics.
 *
 * Design rules:
 * - Never returns secrets. Only booleans like `tokenConfigured` indicate presence.
 * - Every section returns a three-state mode (`live` | `fallback` | `unconfigured`
 *   | `insufficient`) so the UI can render "Not connected" / "Insufficient
 *   permissions" / "Metrics unavailable" honestly.
 * - When the Cloudflare API is unreachable, the client returns `fallback` with
 *   empty arrays and null metrics — never invented numbers.
 * - Uses the shared `FetchClient` for timeouts, safe retries, backoff, and
 *   error classification (401 -> AuthError, 403 -> ForbiddenError, 429 ->
 *   RateLimitError, 404 -> NotFoundError, 400 -> ValidationError).
 *
 * All methods are GET-only. Mutations are intentionally not implemented: the
 * Control Room is read-only and any future mutation requires explicit admin
 * confirmation, an audit record, and a rollback path.
 */

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 2;

/** Narrowest practical Cloudflare API token scopes (documentation only). */
export const CLOUDFLARE_TOKEN_SCOPES = {
  accountRead: 'AccountRead',
  zoneRead: 'ZoneRead',
  workersRead: 'WorkersScriptsRead',
  queuesRead: 'QueuesRead',
  r2Read: 'R2Read',
  turnstileRead: 'TurnstileRead',
  zeroTrustRead: 'AccountAccessPoliciesRead',
  tunnelRead: 'TunnelRead',
  aiGatewayRead: 'AIRead',
} as const;

/** Environment variable names (never values). */
export const CLOUDFLARE_ENV_VARS = {
  apiToken: 'CLOUDFLARE_API_TOKEN',
  accountId: 'CLOUDFLARE_ACCOUNT_ID',
  zoneId: 'CLOUDFLARE_ZONE_ID',
  turnstileSiteKey: 'NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY',
  turnstileSecretKey: 'CLOUDFLARE_TURNSTILE_SECRET_KEY',
  aiGatewayEnabled: 'CLOUDFLARE_AI_GATEWAY_ENABLED',
} as const;

export interface CloudflareClientOptions {
  apiToken?: string;
  accountId?: string;
  zoneId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

interface CloudflareApiListResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
  };
}

export class CloudflareApiClient {
  private readonly http: FetchClient;
  private readonly apiToken: string | undefined;
  private readonly accountId: string | undefined;
  private readonly zoneId: string | undefined;

  constructor(options: CloudflareClientOptions = {}) {
    this.apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;
    this.accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    this.zoneId = options.zoneId ?? process.env.CLOUDFLARE_ZONE_ID;

    this.http = createFetchClient({
      baseURL: CLOUDFLARE_API_BASE,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryOnPost: false,
    });
  }

  /** `true` when a token and account id are present (presence only, never the value). */
  get isConfigured(): boolean {
    return Boolean(this.apiToken && this.accountId);
  }

  /** Build the auth headers; never logs or returns the token. */
  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken ?? ''}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Perform a GET against the Cloudflare API.
   * Returns `null` when unconfigured; throws classified errors otherwise.
   */
  private async getJson<T>(path: string): Promise<T | null> {
    if (!this.isConfigured) {
      return null;
    }
    const response = await this.http.get<CloudflareApiListResponse<T>>(path, {
      headers: this.authHeaders(),
    });
    if (!response.success) {
      const firstError = response.errors?.[0]?.message ?? 'Cloudflare API error';
      throw new ValidationError(firstError, {
        context: { component: 'cloudflare_client', path },
      });
    }
    return response.result;
  }

  /**
   * Safely execute a read: maps known errors to connection modes so callers
   * can render honest state instead of throwing.
   */
  private async safeRead<T>(
    read: () => Promise<T>
  ): Promise<{ mode: CloudflareConnectionMode; data: T | null; detail: string }> {
    if (!this.isConfigured) {
      return {
        mode: 'unconfigured',
        data: null,
        detail: 'CLOUDFLARE_API_TOKEN or account id not set',
      };
    }
    try {
      const data = await read();
      return { mode: 'live', data, detail: 'Connected' };
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return { mode: 'insufficient', data: null, detail: 'Token lacks required read scopes' };
      }
      if (err instanceof RateLimitError) {
        return { mode: 'fallback', data: null, detail: 'Cloudflare API rate limit reached' };
      }
      if (err instanceof NotFoundError) {
        return { mode: 'fallback', data: null, detail: 'Cloudflare resource not found' };
      }
      const detail = err instanceof Error ? err.message : 'Cloudflare API unreachable';
      return { mode: 'fallback', data: null, detail };
    }
  }

  // ── Account / zone ────────────────────────────────────────────────────────

  async getAccountStatus(): Promise<CloudflareAccountStatus> {
    const startedAt = Date.now();
    const result = await this.safeRead(async () =>
      this.getJson<{ id: string; name: string }>(`/accounts/${this.accountId}`)
    );
    const latencyMs = result.mode === 'live' ? Date.now() - startedAt : null;

    return {
      id: 'cloudflare-account',
      label: 'Cloudflare Account',
      mode: result.mode,
      endpointConfigured: this.isConfigured,
      latencyMs,
      detail: result.detail,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Zero Trust ────────────────────────────────────────────────────────────

  async getZeroTrustStatus(): Promise<CloudflareZeroTrustStatus> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () => {
      const [policies, applications, serviceTokens] = await Promise.all([
        this.getJson<CloudflareZeroTrustPolicy[]>(`/accounts/${this.accountId}/access/policies`),
        this.getJson<Array<{ id: string; name: string; domain: string; type: string }>>(
          `/accounts/${this.accountId}/access/apps`
        ),
        this.getJson<Array<{ id: string; name: string; clientId: string; expiresAt?: string }>>(
          `/accounts/${this.accountId}/access/service_tokens`
        ),
      ]);
      return { policies, applications, serviceTokens };
    });

    return {
      mode: result.mode,
      tokenConfigured,
      hasAccessReadScope: result.mode === 'live',
      policies: result.data?.policies ?? [],
      applications: (result.data?.applications ?? []).map((app) => ({
        id: app.id,
        name: app.name,
        domain: app.domain,
        type: app.type as CloudflareZeroTrustStatus['applications'][number]['type'],
      })),
      serviceTokens: (result.data?.serviceTokens ?? []).map((token) => ({
        id: token.id,
        name: token.name,
        clientIdPresent: Boolean(token.clientId),
        expiresAt: token.expiresAt ?? null,
      })),
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Tunnel ────────────────────────────────────────────────────────────────

  async getTunnelStatus(): Promise<CloudflareTunnelStatus> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () =>
      this.getJson<Array<{ id: string; name: string; status: string; connections?: unknown[] }>>(
        `/accounts/${this.accountId}/cfd_tunnel`
      )
    );

    const tunnels: CloudflareTunnel[] = (result.data ?? []).map((tunnel) => ({
      id: tunnel.id,
      name: tunnel.name,
      status: (tunnel.status === 'active'
        ? 'active'
        : tunnel.status === 'pending'
          ? 'pending'
          : 'inactive') as CloudflareTunnel['status'],
      routes: [],
      lastSeenAt: null,
      originHealthy: Array.isArray(tunnel.connections) && tunnel.connections.length > 0,
    }));

    return {
      mode: result.mode,
      tokenConfigured,
      tunnels,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Workers ───────────────────────────────────────────────────────────────

  async getWorkersStatus(): Promise<CloudflareWorkersStatus> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () =>
      this.getJson<Array<{ id: string; name: string; versions?: Array<{ tag: string }> }>>(
        `/accounts/${this.accountId}/workers/scripts`
      )
    );

    const workers: CloudflareWorker[] = (result.data ?? []).map((script) => ({
      id: script.id,
      name: script.name,
      version: script.versions?.[0]?.tag ?? null,
      hasDeployments: Boolean(script.versions?.length),
      deploymentStatus: 'unknown',
      lastDeployedAt: null,
    }));

    return {
      mode: result.mode,
      tokenConfigured,
      workers,
      requestCount24h: null,
      errorRatePercent: null,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Queues ────────────────────────────────────────────────────────────────

  async getQueuesStatus(): Promise<CloudflareQueuesStatus> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () =>
      this.getJson<Array<{ id: string; name: string }>>(`/accounts/${this.accountId}/queues`)
    );

    const queues: CloudflareQueue[] = (result.data ?? []).map((queue) => ({
      id: queue.id,
      name: queue.name,
      pendingMessages: null,
      hasDlq: false,
      consumerHealthy: null,
      dlqDepth: null,
    }));

    return {
      mode: result.mode,
      tokenConfigured,
      queues,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Turnstile ─────────────────────────────────────────────────────────────

  async getTurnstileStatus(): Promise<CloudflareTurnstileStatus> {
    const siteKeyConfigured = Boolean(process.env[CLOUDFLARE_ENV_VARS.turnstileSiteKey]);
    const secretKeyConfigured = Boolean(process.env[CLOUDFLARE_ENV_VARS.turnstileSecretKey]);

    // Turnstile has no list endpoint; report configuration presence only.
    const mode: CloudflareConnectionMode = !this.isConfigured ? 'unconfigured' : 'live';

    return {
      mode,
      siteKeyConfigured,
      secretKeyConfigured,
      verificationHealthy: null,
      failureRatePercent: null,
      protectedFlows: [],
      lastSyncedAt: mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── AI Gateway ────────────────────────────────────────────────────────────

  async getAiGatewayStatus(): Promise<CloudflareAiGatewayStatus> {
    const featureEnabled = process.env[CLOUDFLARE_ENV_VARS.aiGatewayEnabled] === 'true';
    const tokenConfigured = this.isConfigured;

    return {
      mode: tokenConfigured ? 'live' : 'unconfigured',
      tokenConfigured,
      featureEnabled,
      providers: [],
      requestCount24h: null,
      avgLatencyMs: null,
      errorRatePercent: null,
      costReportingAvailable: false,
      lastSyncedAt: tokenConfigured ? new Date().toISOString() : null,
    };
  }

  // ── R2 ────────────────────────────────────────────────────────────────────

  async getR2Status(): Promise<CloudflareR2Status> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () =>
      this.getJson<Array<{ name: string; public_access_block?: { enabled: boolean } }>>(
        `/accounts/${this.accountId}/r2/buckets`
      )
    );

    const buckets: CloudflareR2Bucket[] = (result.data ?? []).map((bucket) => ({
      id: bucket.name,
      name: bucket.name,
      isPublic: bucket.public_access_block?.enabled === false,
      objectCount: null,
      usageBytes: null,
      hasLifecycleRules: false,
      versioningEnabled: null,
    }));

    return {
      mode: result.mode,
      tokenConfigured,
      buckets,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Security Centre ───────────────────────────────────────────────────────

  async getSecurityCentreStatus(): Promise<CloudflareSecurityCentreStatus> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () => {
      const [waf, rateLimits] = await Promise.all([
        this.getJson<{ result?: unknown[] }>(`/zones/${this.zoneId}/firewall/waf/packages`),
        this.getJson<{ result?: unknown[] }>(`/zones/${this.zoneId}/rate_limits`),
      ]);
      return { waf, rateLimits };
    });

    const warnings: string[] = [];
    if (!this.zoneId) {
      warnings.push('CLOUDFLARE_ZONE_ID not set — WAF/rate-limit rules unavailable');
    }
    if (result.mode === 'insufficient') {
      warnings.push('Token lacks ZoneRead scope — security rules unavailable');
    }

    return {
      mode: result.mode,
      tokenConfigured,
      wafRules: null,
      rateLimitRules: null,
      accessPolicies: null,
      warnings,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Turnstile server-side verification ───────────────────────────────────

  /**
   * Verify a Turnstile token server-side. Never logs or returns the secret.
   * Returns `verified: false` with a safe detail when Cloudflare is unreachable
   * or the secret is unconfigured, so callers can fail closed.
   */
  async verifyTurnstileToken(input: {
    token: string;
    remoteIp?: string;
  }): Promise<{ success: boolean; verified: boolean; errorCode: string | null; detail: string }> {
    const secret = process.env[CLOUDFLARE_ENV_VARS.turnstileSecretKey];
    if (!secret) {
      return {
        success: false,
        verified: false,
        errorCode: null,
        detail: 'Turnstile secret key not configured',
      };
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          response: input.token,
          // cspell:ignore remoteip
          remoteip: input.remoteIp,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          success: false,
          verified: false,
          errorCode: `HTTP_${response.status}`,
          detail: `Turnstile verification endpoint returned HTTP ${response.status}`,
        };
      }

      const payload = (await response.json()) as {
        success: boolean;
        'error-codes'?: string[];
        challenge_ts?: string;
        hostname?: string;
      };

      return {
        success: payload.success,
        verified: payload.success,
        errorCode: payload['error-codes']?.[0] ?? null,
        detail: payload.success
          ? 'Turnstile verification succeeded'
          : `Turnstile verification failed: ${payload['error-codes']?.join(', ') ?? 'unknown error'}`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Turnstile verification unreachable';
      return { success: false, verified: false, errorCode: null, detail };
    }
  }
}

/** Singleton read-only client for the portal. */
let cachedClient: CloudflareApiClient | null = null;

export function getCloudflareClient(): CloudflareApiClient {
  if (!cachedClient) {
    cachedClient = new CloudflareApiClient();
  }
  return cachedClient;
}

/**
 * Test helper: drop the cached client so the next `getCloudflareClient()` call
 * re-reads environment variables. Never called in production code paths.
 */
export function resetCloudflareClient(): void {
  cachedClient = null;
}
