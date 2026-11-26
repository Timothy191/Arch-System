import { observabilitySummaryResponseSchema } from '@repo/contract';
import { getCacheStats } from '@repo/redis';
import { fetchObservabilitySummary } from './observability-clients';

jest.mock('@repo/redis', () => ({
  getCacheStats: jest.fn(),
}));

const mockGetCacheStats = jest.mocked(getCacheStats);

describe('fetchObservabilitySummary zero-sample fallback integrity', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.PROMETHEUS_URL;
    delete process.env.GRAFANA_URL;
    delete process.env.WOODPECKER_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns null cache_hit_ratio instead of fake 100% when 0 cache requests have occurred', async () => {
    mockGetCacheStats.mockResolvedValueOnce({
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
      redisErrors: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      xFetchTriggers: 0,
      l1Evictions: 0,
      l2RoundTrips: 0,
      privilegeVersionChanges: 0,
      avgWriteThroughDelayMs: 0,
    });

    const summary = await fetchObservabilitySummary();
    const parsed = observabilitySummaryResponseSchema.safeParse(summary);

    expect(parsed.success).toBe(true);
    const hitRatioMetric = summary.metrics.find((metric) => metric.id === 'cache_hit_ratio');
    expect(hitRatioMetric?.value).toBeNull();
  });
});
