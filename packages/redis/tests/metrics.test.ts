import { getMetric, incrementMetric, keyPrefix, renderMetrics, resetMetrics } from '../src/metrics';

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
