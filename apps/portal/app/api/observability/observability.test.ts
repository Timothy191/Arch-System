import { observabilityCiResponseSchema, observabilitySummaryResponseSchema } from '@repo/contract';
import {
  fetchObservabilityCi,
  fetchObservabilitySummary,
} from '@/lib/observability/observability-clients';

jest.mock('@repo/redis', () => ({
  getCacheStats: jest.fn(async () => ({
    hits: 42,
    misses: 8,
    l1Hits: 30,
    l2Hits: 12,
    redisErrors: 0,
    avgLatencyMs: 2.4,
    p95LatencyMs: 6.8,
  })),
}));

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Native Observability & CI BFF Clients', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.PROMETHEUS_URL;
    delete process.env.GRAFANA_URL;
    delete process.env.WOODPECKER_URL;
    delete process.env.WOODPECKER_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns schema-valid native fallback summary when external daemons are unconfigured', async () => {
    const summary = await fetchObservabilitySummary();
    const parsed = observabilitySummaryResponseSchema.safeParse(summary);

    expect(parsed.success).toBe(true);
    expect(summary.services).toHaveLength(4);
    expect(
      summary.services.every(
        (service) => service.mode === 'unconfigured' || service.mode === 'fallback'
      )
    ).toBe(true);
    expect(summary.cacheSnapshot.l1Hits).toBe(30);
    expect(summary.metrics.find((m) => m.id === 'cache_hits_l1')?.value).toBe(30);
  });

  it('returns live Prometheus and Grafana data when endpoints respond', async () => {
    process.env.PROMETHEUS_URL = 'http://127.0.0.1:9090';
    process.env.GRAFANA_URL = 'http://127.0.0.1:3005';
    process.env.GRAFANA_PUBLIC_URL = 'https://grafana.arch.example.com';

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/-/ready')) {
        return mockJsonResponse({ status: 'ok' });
      }
      if (url.includes('/api/v1/query')) {
        return mockJsonResponse({
          status: 'success',
          data: { result: [{ value: [0, '99'] }] },
        });
      }
      if (url.includes('/api/health')) {
        return mockJsonResponse({ database: 'ok' });
      }
      if (url.includes('/api/search')) {
        return mockJsonResponse([
          {
            uid: 'arch-main',
            title: 'Arch Portal Golden Signals',
            folderTitle: 'Portal',
            url: '/d/arch-main/golden-signals',
          },
        ]);
      }
      return mockJsonResponse({}, 404);
    }) as typeof fetch;

    const summary = await fetchObservabilitySummary();
    expect(summary.services.find((s) => s.id === 'prometheus')?.mode).toBe('live');
    expect(summary.services.find((s) => s.id === 'grafana')?.mode).toBe('live');
    expect(summary.metrics[0]?.source).toBe('live');
    expect(summary.metrics[0]?.value).toBe(99);
    expect(summary.dashboards[0]?.embedUrl).toBe(
      'https://grafana.arch.example.com/d/arch-main/golden-signals?theme=light&kiosk'
    );
  });

  it('reports Grafana Cloud fallback guidance when /api/health succeeds but /api/search returns 401', async () => {
    process.env.GRAFANA_URL = 'https://bigaloe1811.grafana.net';
    process.env.GRAFANA_PUBLIC_URL = 'https://bigaloe1811.grafana.net';

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/health')) {
        return mockJsonResponse({ database: 'ok' });
      }
      if (url.includes('/api/search')) {
        return mockJsonResponse({ message: 'Unauthorized' }, 401);
      }
      return mockJsonResponse({}, 404);
    }) as typeof fetch;

    const summary = await fetchObservabilitySummary();
    const grafana = summary.services.find((service) => service.id === 'grafana');

    expect(grafana?.mode).toBe('fallback');
    expect(grafana?.endpointConfigured).toBe(true);
    expect(grafana?.latencyMs).not.toBeNull();
    expect(grafana?.detail).toContain('GRAFANA_API_KEY');
    expect(summary.dashboards).toHaveLength(0);
  });

  it('returns schema-valid Woodpecker CI pipelines when live and GitHub fallback otherwise', async () => {
    process.env.WOODPECKER_URL = 'http://127.0.0.1:8000';
    process.env.WOODPECKER_TOKEN = 'wp-test-token';

    globalThis.fetch = jest.fn(async () =>
      mockJsonResponse([
        {
          id: 101,
          number: 12,
          branch: 'main',
          commit: '226e3968deadbeef',
          message: 'feat: native observability',
          status: 'success',
          started: 1763320000,
        },
      ])
    ) as typeof fetch;

    const ci = await fetchObservabilityCi();
    const parsed = observabilityCiResponseSchema.safeParse(ci);

    expect(parsed.success).toBe(true);
    expect(ci.mode).toBe('live');
    expect(ci.pipelines[0]?.commitSha).toBe('226e3968');
    expect(ci.pipelines[0]?.status).toBe('success');
  });
});
