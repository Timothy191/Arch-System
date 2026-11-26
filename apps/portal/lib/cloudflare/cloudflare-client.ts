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
const MAX_PROTECTED_FLOWS = 10;

/** Environment variable names (never values). */
export const CLOUDFLARE_ENV_VARS = {
  apiToken: 'CLOUDFLARE_API_TOKEN',
  accountId: 'CLOUDFLARE_ACCOUNT_ID',
  zoneId: 'CLOUDFLARE_ZONE_ID',
  tunnelId: 'CLOUDFLARE_TUNNEL_ID',
  turnstileSiteKey: 'NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY',
  turnstileSecretKey: 'CLOUDFLARE_TURNSTILE_SECRET_KEY',
  aiGatewayEnabled: 'CLOUDFLARE_AI_GATEWAY_ENABLED',
} as const;

export type CloudflareTokenKind = 'account' | 'user' | 'unknown';

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

interface RawZeroTrustPolicy {
  id?: string;
  name?: string;
  applicationType?: string;
  application_type?: string;
  identityProviders?: unknown;
  isActive?: boolean;
  decision?: string;
  sessionDurationMinutes?: unknown;
  updatedAt?: unknown;
  updated_at?: unknown;
}

interface RawZeroTrustApp {
  id?: string;
  name?: string;
  domain?: string;
  type?: string;
}

interface RawZeroTrustServiceToken {
  id?: string;
  name?: string;
  clientId?: unknown;
  client_id?: unknown;
  expiresAt?: unknown;
  expires_at?: unknown;
}

interface RawTunnelConnection {
  opened_at?: unknown;
}

interface RawTunnel {
  id: string;
  name: string;
  status: string;
  connections?: RawTunnelConnection[];
}

interface RawWorkerScript {
  id: string;
  name?: string;
  versions?: Array<{ tag: string }>;
  modified_on?: string;
  created_on?: string;
}

interface RawQueue {
  id?: string;
  name?: string;
  queue_id?: string;
  queue_name?: string;
  consumers_total_count?: number;
}

interface RawR2Bucket {
  name: string;
  public_access_block?: { enabled: boolean };
}

interface RawTurnstileWidget {
  name?: string;
  domains?: string[];
}

interface RawAiGateway {
  id?: string;
  name?: string;
}

interface RawZoneRuleset {
  id: string;
  phase?: string;
}

interface ZoneResolutionResult {
  mode: CloudflareConnectionMode;
  zoneId: string | null;
  discovered: boolean;
}

const ZERO_TRUST_APP_TYPE_MAP: Record<
  string,
  CloudflareZeroTrustStatus['applications'][number]['type']
> = {
  self_hosted: 'self_hosted',
  saas: 'saas',
  application: 'application',
  api: 'api',
};

const POLICY_APP_TYPE_MAP: Record<string, CloudflareZeroTrustPolicy['applicationType']> = {
  application: 'application',
  self_hosted: 'self_hosted',
  api: 'api',
};

const TUNNEL_STATUS_MAP: Record<string, CloudflareTunnel['status']> = {
  active: 'active',
  healthy: 'active',
  pending: 'pending',
  degraded: 'pending',
  inactive: 'inactive',
  down: 'inactive',
};

/** Classify token prefix (`cfat_` account token vs `cfut_` user token) without inspecting secret entropy. */
export function detectCloudflareTokenKind(token: string | undefined): CloudflareTokenKind {
  if (token?.startsWith('cfat_')) return 'account';
  if (token?.startsWith('cfut_')) return 'user';
  return 'unknown';
}

function toIsoOrNull(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string' || !rawValue.trim()) return null;
  const parsedMs = Date.parse(rawValue);
  return Number.isNaN(parsedMs) ? null : new Date(parsedMs).toISOString();
}

function isNonEmptyString(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && candidate.trim().length > 0;
}

function normalizeZeroTrustPolicy(rawPolicy: RawZeroTrustPolicy): CloudflareZeroTrustPolicy | null {
  if (!isNonEmptyString(rawPolicy.id)) return null;
  const rawAppType = rawPolicy.applicationType ?? rawPolicy.application_type ?? '';
  const applicationType = POLICY_APP_TYPE_MAP[rawAppType] ?? 'application';
  const identityProviders = Array.isArray(rawPolicy.identityProviders)
    ? rawPolicy.identityProviders.filter(isNonEmptyString)
    : [];
  const duration = rawPolicy.sessionDurationMinutes;
  const sessionDurationMinutes =
    typeof duration === 'number' && Number.isInteger(duration) && duration > 0 ? duration : null;

  return {
    id: rawPolicy.id,
    name: isNonEmptyString(rawPolicy.name) ? rawPolicy.name : rawPolicy.id,
    applicationType,
    identityProviders,
    isActive:
      typeof rawPolicy.isActive === 'boolean'
        ? rawPolicy.isActive
        : rawPolicy.decision !== 'bypass',
    sessionDurationMinutes,
    updatedAt: toIsoOrNull(rawPolicy.updatedAt ?? rawPolicy.updated_at),
  };
}

function normalizeZeroTrustApp(
  rawApp: RawZeroTrustApp
): CloudflareZeroTrustStatus['applications'][number] | null {
  if (!isNonEmptyString(rawApp.id)) return null;
  const appName = isNonEmptyString(rawApp.name) ? rawApp.name : rawApp.id;
  const appDomain = isNonEmptyString(rawApp.domain) ? rawApp.domain : appName;
  const appType = ZERO_TRUST_APP_TYPE_MAP[rawApp.type ?? ''] ?? 'application';
  return { id: rawApp.id, name: appName, domain: appDomain, type: appType };
}

function normalizeZeroTrustServiceToken(
  rawToken: RawZeroTrustServiceToken
): CloudflareZeroTrustStatus['serviceTokens'][number] | null {
  if (!isNonEmptyString(rawToken.id)) return null;
  return {
    id: rawToken.id,
    name: isNonEmptyString(rawToken.name) ? rawToken.name : rawToken.id,
    clientIdPresent: Boolean(rawToken.clientId ?? rawToken.client_id),
    expiresAt: toIsoOrNull(rawToken.expiresAt ?? rawToken.expires_at),
  };
}

function extractTurnstileFlows(widgets: readonly RawTurnstileWidget[]): string[] {
  const uniqueFlows = new Set<string>();
  for (const widget of widgets) {
    if (isNonEmptyString(widget.name)) {
      uniqueFlows.add(widget.name.trim());
    }
    for (const domain of widget.domains ?? []) {
      if (isNonEmptyString(domain)) {
        uniqueFlows.add(domain.trim());
      }
    }
  }
  return Array.from(uniqueFlows).slice(0, MAX_PROTECTED_FLOWS);
}

export class CloudflareApiClient {
  private readonly http: FetchClient;
  private readonly apiToken: string | undefined;
  private readonly accountId: string | undefined;
  private readonly zoneId: string | undefined;
  private resolvedZonePromise: Promise<ZoneResolutionResult> | null = null;

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
      const payload = await read();
      return { mode: 'live', data: payload, detail: 'Connected' };
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

  private async resolveZoneId(): Promise<ZoneResolutionResult> {
    if (isNonEmptyString(this.zoneId)) {
      return { mode: 'live', zoneId: this.zoneId, discovered: false };
    }
    if (!this.isConfigured) {
      return { mode: 'unconfigured', zoneId: null, discovered: false };
    }
    if (!this.resolvedZonePromise) {
      this.resolvedZonePromise = (async () => {
        const result = await this.safeRead(async () =>
          this.getJson<Array<{ id: string; name?: string }>>(
            `/zones?account.id=${this.accountId}&status=active&per_page=5`
          )
        );
        return {
          mode: result.mode,
          zoneId: result.data?.[0]?.id ?? null,
          discovered: true,
        };
      })();
    }
    return this.resolvedZonePromise;
  }

  // ── Account / zone ────────────────────────────────────────────────────────

  async getAccountStatus(): Promise<CloudflareAccountStatus> {
    const startedAt = Date.now();
    const accountRead = await this.safeRead(async () =>
      this.getJson<{ id: string; name?: string }>(`/accounts/${this.accountId}`)
    );

    if (accountRead.mode === 'live') {
      return {
        id: 'cloudflare-account',
        label: 'Cloudflare Account',
        mode: 'live',
        endpointConfigured: this.isConfigured,
        latencyMs: Date.now() - startedAt,
        detail: accountRead.data?.name ? `Connected — ${accountRead.data.name}` : 'Connected',
        lastSyncedAt: new Date().toISOString(),
      };
    }

    if (accountRead.mode === 'insufficient') {
      const verifyPath =
        detectCloudflareTokenKind(this.apiToken) === 'account'
          ? `/accounts/${this.accountId}/tokens/verify`
          : '/user/tokens/verify';
      const verifyRead = await this.safeRead(async () =>
        this.getJson<{ id?: string; status?: string }>(verifyPath)
      );
      if (verifyRead.mode === 'live' && verifyRead.data?.status === 'active') {
        return {
          id: 'cloudflare-account',
          label: 'Cloudflare Account',
          mode: 'live',
          endpointConfigured: this.isConfigured,
          latencyMs: Date.now() - startedAt,
          detail: 'Token active (scoped account access)',
          lastSyncedAt: new Date().toISOString(),
        };
      }
    }

    return {
      id: 'cloudflare-account',
      label: 'Cloudflare Account',
      mode: accountRead.mode,
      endpointConfigured: this.isConfigured,
      latencyMs: null,
      detail: accountRead.detail,
      lastSyncedAt: null,
    };
  }

  // ── Zero Trust ────────────────────────────────────────────────────────────

  async getZeroTrustStatus(): Promise<CloudflareZeroTrustStatus> {
    if (!this.isConfigured) {
      return {
        mode: 'unconfigured',
        tokenConfigured: false,
        hasAccessReadScope: false,
        policies: [],
        applications: [],
        serviceTokens: [],
        lastSyncedAt: null,
      };
    }

    const settled = await Promise.allSettled([
      this.getJson<RawZeroTrustPolicy[]>(`/accounts/${this.accountId}/access/policies`),
      this.getJson<RawZeroTrustApp[]>(`/accounts/${this.accountId}/access/apps`),
      this.getJson<RawZeroTrustServiceToken[]>(`/accounts/${this.accountId}/access/service_tokens`),
    ]);

    const [policiesResult, appsResult, tokensResult] = settled;
    const hasFulfilled = settled.some((entry) => entry.status === 'fulfilled');
    const allForbidden = settled.every(
      (entry) => entry.status === 'rejected' && entry.reason instanceof ForbiddenError
    );
    const mode: CloudflareConnectionMode = hasFulfilled
      ? 'live'
      : allForbidden
        ? 'insufficient'
        : 'fallback';

    const policies =
      policiesResult.status === 'fulfilled'
        ? (policiesResult.value ?? [])
            .map(normalizeZeroTrustPolicy)
            .filter((entry): entry is CloudflareZeroTrustPolicy => entry !== null)
        : [];
    const applications =
      appsResult.status === 'fulfilled'
        ? (appsResult.value ?? [])
            .map(normalizeZeroTrustApp)
            .filter(
              (entry): entry is CloudflareZeroTrustStatus['applications'][number] => entry !== null
            )
        : [];
    const serviceTokens =
      tokensResult.status === 'fulfilled'
        ? (tokensResult.value ?? [])
            .map(normalizeZeroTrustServiceToken)
            .filter(
              (entry): entry is CloudflareZeroTrustStatus['serviceTokens'][number] => entry !== null
            )
        : [];

    return {
      mode,
      tokenConfigured: true,
      hasAccessReadScope: mode === 'live',
      policies,
      applications,
      serviceTokens,
      lastSyncedAt: mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Tunnel ────────────────────────────────────────────────────────────────

  async getTunnelStatus(): Promise<CloudflareTunnelStatus> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () =>
      this.getJson<RawTunnel[]>(`/accounts/${this.accountId}/cfd_tunnel?is_deleted=false`)
    );

    const tunnels: CloudflareTunnel[] = (result.data ?? []).map((tunnel) => ({
      id: tunnel.id,
      name: tunnel.name,
      status: TUNNEL_STATUS_MAP[tunnel.status] ?? 'inactive',
      routes: null,
      lastSeenAt: toIsoOrNull(tunnel.connections?.[0]?.opened_at),
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
      this.getJson<RawWorkerScript[]>(`/accounts/${this.accountId}/workers/scripts`)
    );

    const workers: CloudflareWorker[] = (result.data ?? []).map((script) => ({
      id: script.id,
      name: script.name ?? script.id,
      version: script.versions?.[0]?.tag ?? null,
      hasDeployments: Boolean(script.versions?.length || script.modified_on),
      deploymentStatus: script.modified_on ? 'success' : 'unknown',
      lastDeployedAt: toIsoOrNull(script.modified_on ?? script.created_on),
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
      this.getJson<RawQueue[]>(`/accounts/${this.accountId}/queues`)
    );

    const queues: CloudflareQueue[] = (result.data ?? [])
      .map((queue): CloudflareQueue | null => {
        const queueId = queue.queue_id ?? queue.id ?? '';
        if (!isNonEmptyString(queueId)) return null;
        return {
          id: queueId,
          name: queue.queue_name ?? queue.name ?? queueId,
          pendingMessages: null,
          hasDlq: null,
          consumerHealthy:
            typeof queue.consumers_total_count === 'number'
              ? queue.consumers_total_count > 0
              : null,
          dlqDepth: null,
        };
      })
      .filter((entry): entry is CloudflareQueue => entry !== null);

    return {
      mode: result.mode,
      tokenConfigured,
      queues,
      lastSyncedAt: result.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── Turnstile ─────────────────────────────────────────────────────────────

  async getTurnstileStatus(): Promise<CloudflareTurnstileStatus> {
    const envSiteKeyConfigured = Boolean(process.env[CLOUDFLARE_ENV_VARS.turnstileSiteKey]);
    const secretKeyConfigured = Boolean(process.env[CLOUDFLARE_ENV_VARS.turnstileSecretKey]);

    if (!this.isConfigured) {
      return {
        mode: 'unconfigured',
        siteKeyConfigured: envSiteKeyConfigured,
        secretKeyConfigured,
        verificationHealthy: null,
        failureRatePercent: null,
        protectedFlows: [],
        lastSyncedAt: null,
      };
    }

    const widgetResult = await this.safeRead(async () =>
      this.getJson<RawTurnstileWidget[]>(`/accounts/${this.accountId}/challenges/widgets`)
    );
    const widgets = widgetResult.data ?? [];
    const siteKeyConfigured = envSiteKeyConfigured || widgets.length > 0;
    const protectedFlows = widgetResult.mode === 'live' ? extractTurnstileFlows(widgets) : [];
    const mode: CloudflareConnectionMode =
      widgetResult.mode === 'live'
        ? 'live'
        : widgetResult.mode === 'insufficient'
          ? 'insufficient'
          : widgetResult.mode;

    return {
      mode,
      siteKeyConfigured,
      secretKeyConfigured,
      verificationHealthy: null,
      failureRatePercent: null,
      protectedFlows,
      lastSyncedAt: mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── AI Gateway ────────────────────────────────────────────────────────────

  async getAiGatewayStatus(): Promise<CloudflareAiGatewayStatus> {
    const featureEnabled = process.env[CLOUDFLARE_ENV_VARS.aiGatewayEnabled] === 'true';
    const tokenConfigured = this.isConfigured;

    if (!tokenConfigured) {
      return {
        mode: 'unconfigured',
        tokenConfigured: false,
        featureEnabled,
        providers: [],
        requestCount24h: null,
        avgLatencyMs: null,
        errorRatePercent: null,
        costReportingAvailable: false,
        lastSyncedAt: null,
      };
    }

    if (!featureEnabled) {
      return {
        mode: 'unconfigured',
        tokenConfigured: true,
        featureEnabled: false,
        providers: [],
        requestCount24h: null,
        avgLatencyMs: null,
        errorRatePercent: null,
        costReportingAvailable: false,
        lastSyncedAt: null,
      };
    }

    const gatewayResult = await this.safeRead(async () =>
      this.getJson<RawAiGateway[]>(`/accounts/${this.accountId}/ai-gateway/gateways`)
    );
    const providers = Array.from(
      new Set(
        (gatewayResult.data ?? [])
          .map((gateway) => gateway.name ?? gateway.id)
          .filter(isNonEmptyString)
      )
    );

    return {
      mode: gatewayResult.mode,
      tokenConfigured: true,
      featureEnabled: true,
      providers,
      requestCount24h: null,
      avgLatencyMs: null,
      errorRatePercent: null,
      costReportingAvailable: false,
      lastSyncedAt: gatewayResult.mode === 'live' ? new Date().toISOString() : null,
    };
  }

  // ── R2 ────────────────────────────────────────────────────────────────────

  async getR2Status(): Promise<CloudflareR2Status> {
    const tokenConfigured = this.isConfigured;
    const result = await this.safeRead(async () =>
      this.getJson<RawR2Bucket[] | { buckets?: RawR2Bucket[] }>(
        `/accounts/${this.accountId}/r2/buckets`
      )
    );

    const rawBuckets = Array.isArray(result.data) ? result.data : (result.data?.buckets ?? []);

    const buckets: CloudflareR2Bucket[] = rawBuckets.map((bucket) => ({
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
    if (!this.isConfigured) {
      return {
        mode: 'unconfigured',
        tokenConfigured: false,
        wafRules: null,
        rateLimitRules: null,
        accessPolicies: null,
        warnings: [],
        lastSyncedAt: null,
      };
    }

    const zoneLookup = await this.resolveZoneId();
    if (zoneLookup.mode !== 'live') {
      return {
        mode: zoneLookup.mode,
        tokenConfigured: true,
        wafRules: null,
        rateLimitRules: null,
        accessPolicies: null,
        warnings: [
          zoneLookup.mode === 'insufficient'
            ? 'Token lacks ZoneRead scope — security rules unavailable'
            : 'Cloudflare zone discovery unavailable',
        ],
        lastSyncedAt: null,
      };
    }

    if (!zoneLookup.zoneId) {
      return {
        mode: 'live',
        tokenConfigured: true,
        wafRules: 0,
        rateLimitRules: 0,
        accessPolicies: null,
        warnings: [
          'No active Cloudflare zones found for this account — add a zone or set CLOUDFLARE_ZONE_ID to inspect WAF/rate-limit rules',
        ],
        lastSyncedAt: new Date().toISOString(),
      };
    }

    const rulesetsResult = await this.safeRead(async () =>
      this.getJson<RawZoneRuleset[]>(`/zones/${zoneLookup.zoneId}/rulesets`)
    );
    const rulesets = rulesetsResult.data ?? [];
    const warnings =
      rulesetsResult.mode === 'insufficient'
        ? ['Token lacks Zone WAF Read scope — security rules unavailable']
        : [];

    return {
      mode: rulesetsResult.mode,
      tokenConfigured: true,
      wafRules:
        rulesetsResult.mode === 'live'
          ? rulesets.filter(
              (ruleset) =>
                ruleset.phase === 'http_request_firewall_custom' ||
                ruleset.phase === 'http_request_firewall_managed'
            ).length
          : null,
      rateLimitRules:
        rulesetsResult.mode === 'live'
          ? rulesets.filter((ruleset) => ruleset.phase === 'http_ratelimit').length
          : null,
      accessPolicies: null,
      warnings,
      lastSyncedAt: rulesetsResult.mode === 'live' ? new Date().toISOString() : null,
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
