import { getMetric, incrementMetric, keyPrefix, renderMetrics, resetMetrics } from '../src/metrics';
import {
  getCacheStats,
  recordL1Eviction,
  recordL2RoundTrip,
  recordPrivilegeVersionChange,
  recordWriteThroughDelay,
  resetCacheStats,
} from '../src/stats';

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => null),
}));

describe('metrics', () => {
  beforeEach(() => resetMetrics());

  it('increments counters', () => {
    incrementMetric('hit');
    incrementMetric('hit');
    expect(getMetric('hit')).toBe(2);
  });

  it('renders prometheus format', () => {
    incrementMetric('miss', { key_prefix: 'user' });
    const out = renderMetrics();
    expect(out).toContain('redis_cache_miss_total');
  });

  it('keyPrefix extracts before colon', () => {
    expect(keyPrefix('user:123:profile')).toBe('user');
  });
});

describe('new cache stats and metrics', () => {
  beforeEach(() => {
    resetMetrics();
    resetCacheStats();
  });

  it('increments new MetricName counters', () => {
    incrementMetric('l1_eviction');
    incrementMetric('l2_round_trip');
    incrementMetric('privilege_version_change');
    incrementMetric('write_through_delay_ms');

    expect(getMetric('l1_eviction')).toBe(1);
    expect(getMetric('l2_round_trip')).toBe(1);
    expect(getMetric('privilege_version_change')).toBe(1);
    expect(getMetric('write_through_delay_ms')).toBe(1);
  });

  it('records stats for L1 evictions, L2 round trips, privilege changes, and write-through delay', async () => {
    recordL1Eviction();
    recordL2RoundTrip();
    recordPrivilegeVersionChange();
    recordWriteThroughDelay(42);

    const stats = await getCacheStats();
    expect(stats.l1Evictions).toBe(1);
    expect(stats.l2RoundTrips).toBe(1);
    expect(stats.privilegeVersionChanges).toBe(1);
    expect(stats.avgWriteThroughDelayMs).toBe(42);
  });
});
