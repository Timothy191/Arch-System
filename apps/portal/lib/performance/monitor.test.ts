import { performanceMonitor } from './monitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  describe('startup time', () => {
    it('records and returns the startup time with attributes', () => {
      performanceMonitor.recordStartupTime(420, {
        layer: 'application',
        kind: 'startup',
      });

      expect(performanceMonitor.getStartupTime()).toBe(420);
    });

    it('ignores non-finite and negative durations', () => {
      performanceMonitor.recordStartupTime(Number.NaN);
      performanceMonitor.recordStartupTime(-5);
      performanceMonitor.recordStartupTime(Infinity);

      expect(performanceMonitor.getStartupTime()).toBeNull();
    });
  });

  describe('measureExecution', () => {
    it('measures a synchronous operation and records a non-negative duration', async () => {
      const result = await performanceMonitor.measureExecution('op.sync', () => 7);

      expect(result).toBe(7);
      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.executionMeasurements).toHaveLength(1);
      const entry = snapshot.executionMeasurements[0]!;
      expect(entry.name).toBe('op.sync');
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
      expect(entry.attributes).toEqual({});
    });

    it('measures an asynchronous operation and awaits its result', async () => {
      const result = await performanceMonitor.measureExecution('op.async', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return 'done';
      });

      expect(result).toBe('done');
    });

    it('records attributes when provided', async () => {
      await performanceMonitor.measureExecution('op.attr', () => 1, {
        attributes: { module: 'control-room', kind: 'load' },
      });

      const entry = performanceMonitor.getSnapshot().executionMeasurements[0]!;
      expect(entry.attributes).toEqual({ module: 'control-room', kind: 'load' });
    });

    it('propagates errors thrown by the measured function', async () => {
      await expect(
        performanceMonitor.measureExecution('op.fail', () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });

    it('still records a measurement when the function throws', async () => {
      await expect(
        performanceMonitor.measureExecution('op.throw', () => {
          throw new Error('x');
        })
      ).rejects.toThrow();

      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.executionMeasurements).toHaveLength(1);
      expect(snapshot.executionMeasurements[0]!.name).toBe('op.throw');
    });
  });

  describe('recordApiResponse', () => {
    it('accumulates API response measurements', () => {
      performanceMonitor.recordApiResponse({
        endpoint: '/api/metrics',
        method: 'GET',
        statusCode: 200,
        durationMs: 120,
      });
      performanceMonitor.recordApiResponse({
        endpoint: '/api/telemetry/push',
        method: 'POST',
        statusCode: 200,
        durationMs: 80,
      });

      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.apiMeasurements).toHaveLength(2);
      expect(snapshot.summary.averageApiResponseDurationMs).toBeCloseTo(100);
    });

    it('ignores non-finite or negative durations', () => {
      performanceMonitor.recordApiResponse({
        endpoint: '/api/x',
        method: 'GET',
        statusCode: 200,
        durationMs: Number.NaN,
      });
      performanceMonitor.recordApiResponse({
        endpoint: '/api/y',
        method: 'GET',
        statusCode: 200,
        durationMs: -10,
      });

      expect(performanceMonitor.getSnapshot().apiMeasurements).toHaveLength(0);
    });
  });

  describe('recordResourceConsumption', () => {
    it('records resource samples and tracks distinct types', () => {
      performanceMonitor.recordResourceConsumption({
        type: 'memory',
        metrics: { usedMib: 507, totalMib: 961, usedPct: 52.8 },
      });
      performanceMonitor.recordResourceConsumption({
        type: 'memory',
        metrics: { usedMib: 512, totalMib: 961, usedPct: 53.3 },
      });
      performanceMonitor.recordResourceConsumption({
        type: 'disk',
        metrics: { usedPct: 24.2 },
      });

      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.resourceSamples).toHaveLength(3);
      expect(snapshot.summary.resourceTypesTracked).toBe(2);
    });
  });

  describe('recordError', () => {
    it('records errors for frequency tracking', () => {
      performanceMonitor.recordError({
        error: new Error('connection failed'),
        context: { source: 'redis', operation: 'get' },
      });
      performanceMonitor.recordError({
        error: new TypeError('bad payload'),
      });

      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.errorSamples).toHaveLength(2);
      expect(snapshot.summary.errorCount).toBe(2);
      expect(snapshot.errorSamples[0]!.errorName).toBe('Error');
    });
  });

  describe('recordCacheEffectiveness', () => {
    it('computes the cache hit rate from hit/miss samples', () => {
      performanceMonitor.recordCacheEffectiveness({ tier: 'l1', hit: true, latencyMs: 1 });
      performanceMonitor.recordCacheEffectiveness({ tier: 'l1', hit: true, latencyMs: 2 });
      performanceMonitor.recordCacheEffectiveness({ tier: 'l2', hit: false, latencyMs: 20 });

      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.cacheSamples).toHaveLength(3);
      expect(snapshot.summary.cacheHitRate).toBeCloseTo((2 / 3) * 100);
    });

    it('returns null cache hit rate when there are no samples', () => {
      expect(performanceMonitor.getSnapshot().summary.cacheHitRate).toBeNull();
    });
  });

  describe('getSnapshot', () => {
    it('returns frozen arrays so callers cannot mutate internal state', () => {
      performanceMonitor.recordStartupTime(100);

      const snapshot = performanceMonitor.getSnapshot();
      expect(Object.isFrozen(snapshot.executionMeasurements)).toBe(true);
      expect(Object.isFrozen(snapshot.apiMeasurements)).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all measurements', () => {
      performanceMonitor.recordStartupTime(100);
      performanceMonitor.recordError({ error: new Error('x') });

      performanceMonitor.reset();

      expect(performanceMonitor.getStartupTime()).toBeNull();
      const snapshot = performanceMonitor.getSnapshot();
      expect(snapshot.executionMeasurements).toHaveLength(0);
      expect(snapshot.apiMeasurements).toHaveLength(0);
      expect(snapshot.resourceSamples).toHaveLength(0);
      expect(snapshot.errorSamples).toHaveLength(0);
      expect(snapshot.cacheSamples).toHaveLength(0);
      expect(snapshot.summary.errorCount).toBe(0);
      expect(snapshot.summary.resourceTypesTracked).toBe(0);
    });
  });
});
