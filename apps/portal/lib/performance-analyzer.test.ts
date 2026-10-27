import { analyzePerformance, INPMonitor, LCPMonitor } from './performance-analyzer';

interface MockObserverInstance {
  callback: PerformanceObserverCallback;
  observedOptions: PerformanceObserverInit | null;
  disconnected: boolean;
}

describe('analyzePerformance', () => {
  const originalPerformance = globalThis.performance;

  afterEach(() => {
    Object.defineProperty(globalThis, 'performance', {
      value: originalPerformance,
      configurable: true,
      writable: true,
    });
  });

  function disableRealPerformanceEntries() {
    Object.defineProperty(globalThis, 'performance', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }

  it('uses default metrics (lcp=3200, inp=350) when called without arguments', () => {
    disableRealPerformanceEntries();

    const result = analyzePerformance();

    expect(result.lcp.value).toBe(3200);
    expect(result.lcp.rating).toBe('needs-improvement');
    expect(result.inp.value).toBe(350);
    expect(result.inp.rating).toBe('needs-improvement');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('rates good LCP (<=2500ms) and good INP (<=200ms) accurately', () => {
    disableRealPerformanceEntries();

    const result = analyzePerformance({ lcp: 1800, inp: 120 });

    expect(result.lcp.rating).toBe('good');
    expect(result.inp.rating).toBe('good');
    expect(result.lcp.longestSubpart).toBe('resourceLoadTime');
    expect(result.inp.longestSubpart).toBe('processingTime');
    expect(result.lcp.strategies).toContain('Compress and optimize images (WebP, AVIF)');
    expect(result.inp.strategies).toContain('Optimize event handlers (debounce/throttle)');

    const priorities = result.recommendations.map((rec) => rec.priority);
    const priorityRank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(priorityRank[priorities[i]!]).toBeGreaterThanOrEqual(priorityRank[priorities[i - 1]!]);
    }
  });

  it('rates poor LCP (>4000ms) and poor INP (>500ms) and prepends critical strategies', () => {
    disableRealPerformanceEntries();

    const result = analyzePerformance({ lcp: 4800, inp: 650 });

    expect(result.lcp.rating).toBe('poor');
    expect(result.inp.rating).toBe('poor');
    expect(result.lcp.strategies[0]).toContain('CRITICAL: LCP >4s');
    expect(result.inp.strategies[0]).toContain('CRITICAL: INP >500ms');

    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          priority: 'high',
          category: 'lcp',
          action: expect.stringContaining('Reduce LCP from 4800ms to <2500ms'),
        }),
        expect.objectContaining({
          priority: 'high',
          category: 'inp',
          action: expect.stringContaining('Reduce INP from 650ms to <200ms'),
        }),
      ])
    );
  });

  it('computes real LCP breakdown when performance entries are available with matching resource URL', () => {
    const getEntriesByType = jest.fn((type: string) => {
      if (type === 'navigation') {
        return [{ startTime: 0, responseStart: 200 }];
      }
      if (type === 'largest-contentful-paint') {
        return [
          { startTime: 1000, url: 'https://example.com/first.png' },
          { startTime: 2200, url: 'https://example.com/hero.webp' },
        ];
      }
      if (type === 'resource') {
        return [
          { name: 'https://example.com/other.js', startTime: 100, responseEnd: 180 },
          { name: 'https://example.com/hero.webp', startTime: 350, responseEnd: 1950 },
        ];
      }
      return [];
    });

    Object.defineProperty(globalThis, 'performance', {
      value: { getEntriesByType },
      configurable: true,
      writable: true,
    });

    const result = analyzePerformance({ lcp: 2200, inp: 150 });

    expect(result.lcp.breakdown).toEqual({
      ttfb: 200,
      resourceLoadDelay: 150,
      resourceLoadTime: 1600,
      elementRenderDelay: 250,
    });
    expect(result.lcp.longestSubpart).toBe('resourceLoadTime');
  });

  it('identifies ttfb as longest LCP subpart when server response dominates', () => {
    const getEntriesByType = jest.fn((type: string) => {
      if (type === 'navigation') {
        return [{ startTime: 0, responseStart: 1800 }];
      }
      if (type === 'largest-contentful-paint') {
        return [{ startTime: 2000 }];
      }
      return [];
    });

    Object.defineProperty(globalThis, 'performance', {
      value: { getEntriesByType },
      configurable: true,
      writable: true,
    });

    const result = analyzePerformance({ lcp: 2000, inp: 150 });

    expect(result.lcp.longestSubpart).toBe('ttfb');
    expect(result.lcp.strategies).toContain(
      'Optimize server response time (use Edge Functions, CDN caching)'
    );
  });

  it('identifies resourceLoadDelay as longest LCP subpart when resource start is delayed', () => {
    const getEntriesByType = jest.fn((type: string) => {
      if (type === 'navigation') {
        return [{ startTime: 0, responseStart: 100 }];
      }
      if (type === 'largest-contentful-paint') {
        return [{ startTime: 2100, url: 'https://example.com/banner.jpg' }];
      }
      if (type === 'resource') {
        return [{ name: 'https://example.com/banner.jpg', startTime: 1700, responseEnd: 1900 }];
      }
      return [];
    });

    Object.defineProperty(globalThis, 'performance', {
      value: { getEntriesByType },
      configurable: true,
      writable: true,
    });

    const result = analyzePerformance({ lcp: 2100, inp: 150 });

    expect(result.lcp.longestSubpart).toBe('resourceLoadDelay');
    expect(result.lcp.strategies).toContain('Prioritize critical resources with preload hints');
  });

  it('identifies elementRenderDelay as longest LCP subpart when no matching resource exists', () => {
    const getEntriesByType = jest.fn((type: string) => {
      if (type === 'navigation') {
        return [{ startTime: 0, responseStart: 100 }];
      }
      if (type === 'largest-contentful-paint') {
        return [{ startTime: 2000, url: 'https://example.com/unmatched.jpg' }];
      }
      if (type === 'resource') {
        return [{ name: 'https://example.com/other.jpg', startTime: 150, responseEnd: 300 }];
      }
      return [];
    });

    Object.defineProperty(globalThis, 'performance', {
      value: { getEntriesByType },
      configurable: true,
      writable: true,
    });

    const result = analyzePerformance({ lcp: 2000, inp: 150 });

    expect(result.lcp.longestSubpart).toBe('elementRenderDelay');
    expect(result.lcp.strategies).toContain(
      'Optimize CSS for LCP element (avoid layout thrashing)'
    );
  });

  it('falls back to simulated LCP breakdown when navigation entries are empty or getEntriesByType throws', () => {
    Object.defineProperty(globalThis, 'performance', {
      value: {
        getEntriesByType: jest.fn(() => []),
      },
      configurable: true,
      writable: true,
    });

    const emptyNavResult = analyzePerformance({ lcp: 3000, inp: 200 });
    expect(emptyNavResult.lcp.breakdown.ttfb).toBe(450);

    Object.defineProperty(globalThis, 'performance', {
      value: {
        getEntriesByType: jest.fn(() => {
          throw new Error('Performance API unavailable');
        }),
      },
      configurable: true,
      writable: true,
    });

    const errorResult = analyzePerformance({ lcp: 3000, inp: 200 });
    expect(errorResult.lcp.breakdown.ttfb).toBe(450);
  });
});

describe('INPMonitor and LCPMonitor', () => {
  const originalPerformanceObserver = globalThis.PerformanceObserver;
  let observerInstances: MockObserverInstance[] = [];

  beforeEach(() => {
    observerInstances = [];

    class MockPerformanceObserver {
      private instance: MockObserverInstance;

      constructor(callback: PerformanceObserverCallback) {
        this.instance = {
          callback,
          observedOptions: null,
          disconnected: false,
        };
        observerInstances.push(this.instance);
      }

      observe(options: PerformanceObserverInit) {
        this.instance.observedOptions = options;
      }

      disconnect() {
        this.instance.disconnected = true;
      }

      takeRecords(): PerformanceEntryList {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'PerformanceObserver', {
      value: MockPerformanceObserver,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'PerformanceObserver', {
      value: originalPerformanceObserver,
      configurable: true,
      writable: true,
    });
  });

  it('INPMonitor observes event entries, trims buffer at 50 entries, and reports 98th percentile', () => {
    const onInp = jest.fn<void, [number]>();
    const monitor = new INPMonitor(onInp);

    monitor.start();
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0]!.observedOptions).toEqual({ type: 'event', buffered: true });

    const triggerEntries = (durations: number[]) => {
      const entries = durations.map((duration) => ({ duration }) as unknown as PerformanceEntry);
      const list = {
        getEntries: () => entries,
        getEntriesByName: () => entries,
        getEntriesByType: () => entries,
      } as PerformanceObserverEntryList;
      observerInstances[0]!.callback(list, {} as PerformanceObserver);
    };

    // Empty entry list reports 0
    triggerEntries([]);
    expect(onInp).toHaveBeenLastCalledWith(0);

    // Push 52 entries to verify buffer cap at 50
    const fiftyTwoDurations = Array.from({ length: 52 }, (_, idx) => (idx + 1) * 10);
    for (const duration of fiftyTwoDurations) {
      triggerEntries([duration]);
    }

    expect(monitor.getEntries()).toHaveLength(50);
    expect(onInp).toHaveBeenLastCalledWith(520);

    monitor.stop();
    expect(observerInstances[0]!.disconnected).toBe(true);
  });

  it('INPMonitor safely no-ops when PerformanceObserver is undefined', () => {
    Object.defineProperty(globalThis, 'PerformanceObserver', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const onInp = jest.fn<void, [number]>();
    const monitor = new INPMonitor(onInp);

    expect(() => monitor.start()).not.toThrow();
    expect(() => monitor.stop()).not.toThrow();
    expect(monitor.getEntries()).toEqual([]);
  });

  it('LCPMonitor observes largest-contentful-paint and reports latest startTime', () => {
    const onLcp = jest.fn<void, [number]>();
    const monitor = new LCPMonitor(onLcp);

    monitor.start();
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0]!.observedOptions).toEqual({
      type: 'largest-contentful-paint',
      buffered: true,
    });

    const triggerLcpEntries = (startTimes: number[]) => {
      const entries = startTimes.map((startTime) => ({ startTime }) as unknown as PerformanceEntry);
      const list = {
        getEntries: () => entries,
        getEntriesByName: () => entries,
        getEntriesByType: () => entries,
      } as PerformanceObserverEntryList;
      observerInstances[0]!.callback(list, {} as PerformanceObserver);
    };

    triggerLcpEntries([]);
    expect(onLcp).toHaveBeenLastCalledWith(0);

    triggerLcpEntries([1200, 2450]);
    expect(onLcp).toHaveBeenLastCalledWith(2450);

    monitor.stop();
    expect(observerInstances[0]!.disconnected).toBe(true);
  });

  it('LCPMonitor safely no-ops when PerformanceObserver is undefined', () => {
    Object.defineProperty(globalThis, 'PerformanceObserver', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const onLcp = jest.fn<void, [number]>();
    const monitor = new LCPMonitor(onLcp);

    expect(() => monitor.start()).not.toThrow();
    expect(() => monitor.stop()).not.toThrow();
  });
});
