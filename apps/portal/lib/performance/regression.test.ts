import { performanceRegressionDetector } from './regression';

describe('PerformanceRegressionDetector', () => {
  beforeEach(() => {
    performanceRegressionDetector.reset();
  });

  describe('baseline lookup', () => {
    it('returns null when no baseline exists for the metric', () => {
      expect(
        performanceRegressionDetector.checkRegression('portal.startup.time.ms', 800)
      ).toBeNull();
    });

    it('records and retrieves a baseline with context', () => {
      performanceRegressionDetector.recordBaseline('api.response.time.ms', 250, {
        context: { layer: 'application', kind: 'api' },
      });

      const baseline = performanceRegressionDetector.getBaseline('api.response.time.ms');
      expect(baseline).not.toBeNull();
      expect(baseline!.baselineValue).toBe(250);
      expect(baseline!.context).toEqual({ layer: 'application', kind: 'api' });
    });

    it('returns all registered baseline ids', () => {
      performanceRegressionDetector.recordBaseline('a', 10);
      performanceRegressionDetector.recordBaseline('b', 20);

      expect(performanceRegressionDetector.getBaselineIds()).toEqual(['a', 'b']);
    });
  });

  describe('regression detection', () => {
    it('reports no regression when the current value is at or below baseline', () => {
      performanceRegressionDetector.recordBaseline('api.response.time.ms', 250);

      expect(
        performanceRegressionDetector.checkRegression('api.response.time.ms', 250)!.isRegression
      ).toBe(false);
      expect(
        performanceRegressionDetector.checkRegression('api.response.time.ms', 200)!.isRegression
      ).toBe(false);
    });

    it('reports a regression when the current value exceeds baseline', () => {
      performanceRegressionDetector.recordBaseline('api.response.time.ms', 250);

      const result = performanceRegressionDetector.checkRegression('api.response.time.ms', 262.5)!;
      expect(result.isRegression).toBe(true);
      expect(result.changePercent).toBeCloseTo(5);
      expect(result.severity).toBe('minor');
    });

    it('classifies severity by change percent', () => {
      performanceRegressionDetector.recordBaseline('module.load.time.ms', 100);

      expect(
        performanceRegressionDetector.checkRegression('module.load.time.ms', 105)!.severity
      ).toBe('minor');
      expect(
        performanceRegressionDetector.checkRegression('module.load.time.ms', 110)!.severity
      ).toBe('major');
      expect(
        performanceRegressionDetector.checkRegression('module.load.time.ms', 125)!.severity
      ).toBe('critical');
      expect(
        performanceRegressionDetector.checkRegression('module.load.time.ms', 90)!.severity
      ).toBe('none');
    });

    it('treats any increase over a zero baseline as a critical regression', () => {
      performanceRegressionDetector.recordBaseline('cache.lookup.latency.ms', 0);

      const result = performanceRegressionDetector.checkRegression('cache.lookup.latency.ms', 5)!;
      expect(result.isRegression).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.changePercent).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('config loading', () => {
    it('loads multiple baselines from a config array', () => {
      performanceRegressionDetector.loadBaselinesFromConfig([
        { metricId: 'portal.startup.time.ms', baselineValue: 800 },
        { metricId: 'module.load.time.ms', baselineValue: 150 },
      ]);

      expect(
        performanceRegressionDetector.getBaseline('portal.startup.time.ms')!.baselineValue
      ).toBe(800);
      expect(performanceRegressionDetector.getBaseline('module.load.time.ms')!.baselineValue).toBe(
        150
      );
    });

    it('returns null for non-finite current values', () => {
      performanceRegressionDetector.recordBaseline('a', 10);

      expect(performanceRegressionDetector.checkRegression('a', Number.NaN)).toBeNull();
      expect(performanceRegressionDetector.checkRegression('a', Infinity)).toBeNull();
    });
  });
});
