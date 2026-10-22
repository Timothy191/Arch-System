import {
  clearClientMetrics,
  getClientMetrics,
  MAX_METRICS_BUFFER,
  metrics,
  recordClientMetric,
  trackClientMetric,
} from './client-telemetry';

describe('client-telemetry bounded metrics buffer and deduplication', () => {
  beforeEach(() => {
    clearClientMetrics();
  });

  describe('Given duplicate telemetry metrics', () => {
    it('When recording identical (name, timestamp, value/duration) entries, Then it deduplicates and stores only one entry', () => {
      const metric = {
        name: 'pit.dispatch.fetch',
        duration: 42.5,
        value: 42.5,
        timestamp: 1_700_000_000_000,
        attributes: { dept: 'mining' },
      };

      const firstRecorded = recordClientMetric(metric);
      const duplicateRecorded = recordClientMetric({ ...metric });

      expect(firstRecorded).toBe(true);
      expect(duplicateRecorded).toBe(false);
      expect(metrics).toHaveLength(1);
      expect(getClientMetrics()).toEqual([metric]);
    });

    it('When recording metrics with different timestamps or values, Then both entries are retained', () => {
      recordClientMetric({
        name: 'pit.dispatch.fetch',
        duration: 40,
        value: 40,
        timestamp: 1000,
      });
      recordClientMetric({
        name: 'pit.dispatch.fetch',
        duration: 40,
        value: 40,
        timestamp: 1001,
      });
      recordClientMetric({
        name: 'pit.dispatch.fetch',
        duration: 55,
        value: 55,
        timestamp: 1001,
      });

      expect(metrics).toHaveLength(3);
    });
  });

  describe('Given a telemetry buffer reaching MAX_METRICS_BUFFER', () => {
    it('When recording more than MAX_METRICS_BUFFER metrics, Then it evicts the oldest entries to stay bounded at MAX_METRICS_BUFFER', () => {
      for (let i = 0; i < MAX_METRICS_BUFFER + 25; i++) {
        recordClientMetric({
          name: `metric-${i}`,
          duration: i,
          value: i,
          timestamp: 10_000 + i,
        });
      }

      expect(metrics.length).toBe(MAX_METRICS_BUFFER);
      expect(metrics[0]?.name).toBe('metric-25');
      expect(metrics[MAX_METRICS_BUFFER - 1]?.name).toBe(`metric-${MAX_METRICS_BUFFER + 24}`);
    });
  });

  describe('Given trackClientMetric execution', () => {
    it('When wrapping synchronous and asynchronous operations, Then it records execution duration into the bounded buffer', async () => {
      trackClientMetric('sync.op', () => {
        // no-op
      });

      await trackClientMetric('async.op', async () => {
        await Promise.resolve();
      });

      expect(metrics.length).toBe(2);
      expect(metrics[0]?.name).toBe('sync.op');
      expect(metrics[1]?.name).toBe('async.op');
    });
  });
});
