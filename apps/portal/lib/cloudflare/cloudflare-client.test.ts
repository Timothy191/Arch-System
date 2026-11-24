import { type CloudflareSummaryResponse, cloudflareSummaryResponseSchema } from '@repo/contract';
import { getCloudflareClient, resetCloudflareClient } from './cloudflare-client';

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Cloudflare API client', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_TUNNEL_ID;
    delete process.env.CLOUDFLARE_AI_GATEWAY_ENABLED;
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    resetCloudflareClient();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns unconfigured mode for every section when no token is set', async () => {
    const client = getCloudflareClient();

    const account = await client.getAccountStatus();
    const zeroTrust = await client.getZeroTrustStatus();
    const tunnel = await client.getTunnelStatus();
    const workers = await client.getWorkersStatus();
    const queues = await client.getQueuesStatus();
    const r2 = await client.getR2Status();

    expect(account.mode).toBe('unconfigured');
    expect(account.endpointConfigured).toBe(false);
    expect(account.latencyMs).toBeNull();
    expect(zeroTrust.mode).toBe('unconfigured');
    expect(zeroTrust.tokenConfigured).toBe(false);
    expect(tunnel.mode).toBe('unconfigured');
    expect(workers.mode).toBe('unconfigured');
    expect(queues.mode).toBe('unconfigured');
    expect(r2.mode).toBe('unconfigured');
  });

  it('returns live Zero Trust data when the API responds', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/access/policies')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [
            {
              id: 'policy-1',
              name: 'Engineers',
              applicationType: 'self_hosted',
              identityProviders: ['google'],
              isActive: true,
              sessionDurationMinutes: 1440,
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/access/apps')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [
            { id: 'app-1', name: 'SCADA UI', domain: 'scada.example.com', type: 'self_hosted' },
          ],
        });
      }
      if (url.includes('/access/service_tokens')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [
            { id: 'st-1', name: 'CI Token', clientId: 'ci-123', expiresAt: '2027-01-01T00:00:00Z' },
          ],
        });
      }
      return mockJsonResponse({ success: true, errors: [], messages: [], result: [] });
    }) as typeof fetch;

    const client = getCloudflareClient();
    const status = await client.getZeroTrustStatus();

    expect(status.mode).toBe('live');
    expect(status.tokenConfigured).toBe(true);
    expect(status.hasAccessReadScope).toBe(true);
    expect(status.policies).toHaveLength(1);
    expect(status.policies[0]?.name).toBe('Engineers');
    expect(status.applications[0]?.domain).toBe('scada.example.com');
    expect(status.serviceTokens[0]?.clientIdPresent).toBe(true);
    expect(status.lastSyncedAt).not.toBeNull();
  });

  it('returns insufficient mode when the API rejects with 403', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';

    globalThis.fetch = jest.fn(async () => {
      const body = {
        success: false,
        errors: [{ code: 10000, message: 'Authentication error' }],
        messages: [],
        result: [],
      };
      return {
        ok: false,
        status: 403,
        json: async () => body,
        text: async () => '',
      } as Response;
    }) as typeof fetch;

    const client = getCloudflareClient();
    const status = await client.getZeroTrustStatus();

    expect(status.mode).toBe('insufficient');
    expect(status.tokenConfigured).toBe(true);
    expect(status.hasAccessReadScope).toBe(false);
    expect(status.policies).toHaveLength(0);
  });

  it('returns fallback mode when the API is unreachable', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';

    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    const client = getCloudflareClient();
    const status = await client.getTunnelStatus();

    expect(status.mode).toBe('fallback');
    expect(status.tunnels).toHaveLength(0);
    expect(status.lastSyncedAt).toBeNull();
  });

  it('reports Turnstile configuration presence without exposing secrets', async () => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY = 'site-key-1';
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret-key-1';

    const client = getCloudflareClient();
    const status = await client.getTurnstileStatus();

    expect(status.siteKeyConfigured).toBe(true);
    expect(status.secretKeyConfigured).toBe(true);
    expect(status.verificationHealthy).toBeNull();
    expect(status.protectedFlows).toEqual([]);
    expect(JSON.stringify(status)).not.toContain('secret-key-1');
  });

  it('reports AI Gateway as disabled by default with no fabricated metrics', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';

    const client = getCloudflareClient();
    const status = await client.getAiGatewayStatus();

    expect(status.featureEnabled).toBe(false);
    expect(status.requestCount24h).toBeNull();
    expect(status.avgLatencyMs).toBeNull();
    expect(status.errorRatePercent).toBeNull();
    expect(status.costReportingAvailable).toBe(false);
  });

  it('fails closed on Turnstile verification when the secret is unconfigured', async () => {
    const client = getCloudflareClient();
    const result = await client.verifyTurnstileToken({ token: 'abc' });

    expect(result.verified).toBe(false);
    expect(result.success).toBe(false);
    expect(result.detail).toContain('not configured');
  });

  it('verifies a Turnstile token when the API returns success', async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret-key-1';

    globalThis.fetch = jest.fn(async () =>
      mockJsonResponse({
        success: true,
        'error-codes': [],
        challenge_ts: '2026-01-01T00:00:00Z',
        hostname: 'example.com',
      })
    ) as typeof fetch;

    const client = getCloudflareClient();
    const result = await client.verifyTurnstileToken({ token: 'token-1' });

    expect(result.verified).toBe(true);
    expect(result.success).toBe(true);
    expect(result.errorCode).toBeNull();
  });

  it('rejects prohibited plant-control event types', async () => {
    const { assertNotPlantControlEventType, PROHIBITED_CLOUDFLARE_EVENT_TYPES } = await import(
      '@repo/contract'
    );

    expect(PROHIBITED_CLOUDFLARE_EVENT_TYPES).toContain('plc.write');
    expect(() => assertNotPlantControlEventType('plc.write')).toThrow(/prohibited/);
    expect(() => assertNotPlantControlEventType('telemetry.ingest')).not.toThrow();
  });

  it('produces a schema-valid aggregate summary in unconfigured state', async () => {
    const client = getCloudflareClient();

    const payload: CloudflareSummaryResponse = {
      generatedAt: new Date().toISOString(),
      deploymentTarget: 'local',
      account: await client.getAccountStatus(),
      zeroTrust: await client.getZeroTrustStatus(),
      tunnel: await client.getTunnelStatus(),
      workers: await client.getWorkersStatus(),
      queues: await client.getQueuesStatus(),
      turnstile: await client.getTurnstileStatus(),
      aiGateway: await client.getAiGatewayStatus(),
      r2: await client.getR2Status(),
      securityCentre: await client.getSecurityCentreStatus(),
    };

    const parsed = cloudflareSummaryResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('connects to /accounts/{id} directly and falls back to token verify endpoints on 403', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'cfut_test_token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';

    globalThis.fetch = jest.fn(async () =>
      mockJsonResponse({
        success: true,
        errors: [],
        messages: [],
        result: { id: 'acct-123', name: 'Arch Mining Ops' },
      })
    ) as typeof fetch;

    const liveStatus = await getCloudflareClient().getAccountStatus();
    expect(liveStatus.mode).toBe('live');
    expect(liveStatus.detail).toBe('Connected — Arch Mining Ops');

    resetCloudflareClient();
    process.env.CLOUDFLARE_API_TOKEN = 'cfat_account_token';
    const seenUrls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.endsWith('/accounts/acct-123')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            errors: [{ code: 9109, message: 'Unauthorized' }],
            messages: [],
            result: null,
          }),
          text: async () => '',
        } as Response;
      }
      if (url.endsWith('/accounts/acct-123/tokens/verify')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: { id: 'tok-acct', status: 'active' },
        });
      }
      return mockJsonResponse({ success: true, errors: [], messages: [], result: null });
    }) as typeof fetch;

    const acctTokenStatus = await getCloudflareClient().getAccountStatus();
    expect(acctTokenStatus.mode).toBe('live');
    expect(acctTokenStatus.detail).toBe('Token active (scoped account access)');
    expect(seenUrls).toContain(
      'https://api.cloudflare.com/client/v4/accounts/acct-123/tokens/verify'
    );

    resetCloudflareClient();
    process.env.CLOUDFLARE_API_TOKEN = 'cfut_user_token';
    const userUrls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      userUrls.push(url);
      if (url.endsWith('/accounts/acct-123')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ success: false, errors: [{ code: 9109, message: 'Unauthorized' }] }),
          text: async () => '',
        } as Response;
      }
      return mockJsonResponse({
        success: true,
        errors: [],
        messages: [],
        result: { id: 'tok-user', status: 'active' },
      });
    }) as typeof fetch;

    const userTokenStatus = await getCloudflareClient().getAccountStatus();
    expect(userTokenStatus.mode).toBe('live');
    expect(userUrls).toContain('https://api.cloudflare.com/client/v4/user/tokens/verify');
  });

  it('normalizes R2 v4 object response, Workers missing names, Queues v4 keys, Tunnels, and Zero Trust partial failures', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'cfat_test_token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/r2/buckets')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: {
            buckets: [
              { name: 'shift-reports', public_access_block: { enabled: true } },
              { name: 'public-assets', public_access_block: { enabled: false } },
            ],
          },
        });
      }
      if (url.includes('/workers/scripts')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [{ id: 'telemetry-worker', modified_on: '2026-11-18T10:00:00Z' }],
        });
      }
      if (url.includes('/queues')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [{ queue_id: 'q-101', queue_name: 'scada-ingest', consumers_total_count: 1 }],
        });
      }
      if (url.includes('/cfd_tunnel?is_deleted=false')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [
            {
              id: 'tun-9',
              name: 'pit-tunnel',
              status: 'healthy',
              connections: [{ opened_at: '2026-11-20T08:00:00Z' }],
            },
          ],
        });
      }
      if (url.includes('/access/policies')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ success: false, errors: [{ code: 10000, message: 'Forbidden' }] }),
          text: async () => '',
        } as Response;
      }
      if (url.includes('/access/apps')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [{ id: 'app-2', name: 'Ops Portal', type: 'bookmark' }],
        });
      }
      if (url.includes('/access/service_tokens')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [
            {
              id: 'st-2',
              name: 'Agent Token',
              client_id: 'cid-abc',
              expires_at: '2027-05-01T00:00:00Z',
            },
          ],
        });
      }
      return mockJsonResponse({ success: true, errors: [], messages: [], result: [] });
    }) as typeof fetch;

    const client = getCloudflareClient();
    const [r2, workers, queues, tunnels, zeroTrust] = await Promise.all([
      client.getR2Status(),
      client.getWorkersStatus(),
      client.getQueuesStatus(),
      client.getTunnelStatus(),
      client.getZeroTrustStatus(),
    ]);

    expect(r2.mode).toBe('live');
    expect(r2.buckets).toHaveLength(2);
    expect(r2.buckets[0]?.isPublic).toBe(false);
    expect(r2.buckets[1]?.isPublic).toBe(true);

    expect(workers.workers[0]?.name).toBe('telemetry-worker');
    expect(workers.workers[0]?.hasDeployments).toBe(true);
    expect(workers.workers[0]?.deploymentStatus).toBe('success');

    expect(queues.queues[0]?.id).toBe('q-101');
    expect(queues.queues[0]?.name).toBe('scada-ingest');
    expect(queues.queues[0]?.consumerHealthy).toBe(true);

    expect(tunnels.tunnels[0]?.status).toBe('active');
    expect(tunnels.tunnels[0]?.originHealthy).toBe(true);
    expect(tunnels.tunnels[0]?.lastSeenAt).toBe('2026-11-20T08:00:00.000Z');

    expect(zeroTrust.mode).toBe('live');
    expect(zeroTrust.applications[0]?.type).toBe('application');
    expect(zeroTrust.applications[0]?.domain).toBe('Ops Portal');
    expect(zeroTrust.serviceTokens[0]?.clientIdPresent).toBe(true);
    expect(zeroTrust.serviceTokens[0]?.expiresAt).toBe('2027-05-01T00:00:00.000Z');
  });

  it('discovers Turnstile widgets, AI Gateway providers, and zones/rulesets automatically', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'cfat_test_token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-123';
    process.env.CLOUDFLARE_AI_GATEWAY_ENABLED = 'true';

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/challenges/widgets')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [{ name: 'Portal Login', domains: ['arch-system-dun.vercel.app'] }],
        });
      }
      if (url.includes('/ai-gateway/gateways')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [{ id: 'arch-ai-gw', name: 'arch-ai-gw' }],
        });
      }
      if (url.includes('/zones?account.id=')) {
        return mockJsonResponse({ success: true, errors: [], messages: [], result: [] });
      }
      return mockJsonResponse({ success: true, errors: [], messages: [], result: [] });
    }) as typeof fetch;

    const client = getCloudflareClient();
    const [turnstile, aiGateway, secNoZone] = await Promise.all([
      client.getTurnstileStatus(),
      client.getAiGatewayStatus(),
      client.getSecurityCentreStatus(),
    ]);

    expect(turnstile.mode).toBe('live');
    expect(turnstile.siteKeyConfigured).toBe(true);
    expect(turnstile.protectedFlows).toEqual(['Portal Login', 'arch-system-dun.vercel.app']);

    expect(aiGateway.mode).toBe('live');
    expect(aiGateway.featureEnabled).toBe(true);
    expect(aiGateway.providers).toEqual(['arch-ai-gw']);

    expect(secNoZone.mode).toBe('live');
    expect(secNoZone.wafRules).toBe(0);
    expect(secNoZone.warnings[0]).toContain('No active Cloudflare zones found');

    resetCloudflareClient();
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/zones?account.id=')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [{ id: 'zone-99', name: 'arch.example' }],
        });
      }
      if (url.endsWith('/zones/zone-99/rulesets')) {
        return mockJsonResponse({
          success: true,
          errors: [],
          messages: [],
          result: [
            { id: 'rs-1', phase: 'http_request_firewall_custom' },
            { id: 'rs-2', phase: 'http_request_firewall_managed' },
            { id: 'rs-3', phase: 'http_ratelimit' },
          ],
        });
      }
      return mockJsonResponse({ success: true, errors: [], messages: [], result: [] });
    }) as typeof fetch;

    const secWithZone = await getCloudflareClient().getSecurityCentreStatus();
    expect(secWithZone.mode).toBe('live');
    expect(secWithZone.wafRules).toBe(2);
    expect(secWithZone.rateLimitRules).toBe(1);
    expect(secWithZone.warnings).toEqual([]);
  });
});
