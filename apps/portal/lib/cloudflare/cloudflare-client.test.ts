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
});
