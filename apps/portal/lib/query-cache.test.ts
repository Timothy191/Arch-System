import {
  buildQueryCacheBuster,
  getQueryCacheMetrics,
  inspectPersistedCacheHit,
  purgePersistedQueryCache,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_STORAGE_KEY,
  QUERY_STALE_TIMES,
  recordCacheRehydrateResult,
  resetQueryCacheMetrics,
  resolveQueryStaleTime,
  subscribeQueryCacheCrossTab,
} from './query-cache';

describe('Given the portal query-cache policy and observability layer', () => {
  beforeEach(() => {
    resetQueryCacheMetrics();
    window.localStorage.clear();
  });

  it('When buildQueryCacheBuster is called, Then it encodes both version and schema revision', () => {
    expect(buildQueryCacheBuster('1.6.2', '185')).toBe('portal-v1.6.2-s185');
    expect(QUERY_CACHE_BUSTER).toContain('-s185');
  });

  it('When resolveQueryStaleTime inspects query keys, Then it differentiates SCADA, shift ops, summary, and reference data', () => {
    expect(resolveQueryStaleTime(['scada-telemetry', 'dept-1'])).toBe(
      QUERY_STALE_TIMES.scadaTelemetryMs
    );
    expect(resolveQueryStaleTime(['hourly-loads', '2026-10-29'])).toBe(
      QUERY_STALE_TIMES.shiftOperationsMs
    );
    expect(resolveQueryStaleTime(['machines', 'catalog'])).toBe(QUERY_STALE_TIMES.referenceDataMs);
    expect(resolveQueryStaleTime(['department-kpi', 'overview'])).toBe(
      QUERY_STALE_TIMES.departmentSummaryMs
    );
  });

  it('When inspectPersistedCacheHit checks localStorage, Then it returns true only for fresh matching busters', () => {
    expect(inspectPersistedCacheHit('portal-v1.6.2-s185', 60_000)).toBe(false);

    window.localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({ buster: 'portal-v1.6.2-s185', timestamp: Date.now() })
    );
    expect(inspectPersistedCacheHit('portal-v1.6.2-s185', 60_000)).toBe(true);
    expect(inspectPersistedCacheHit('portal-v1.6.2-s186', 60_000)).toBe(false);
  });

  it('When rehydrate hits, misses, and purges occur, Then getQueryCacheMetrics tracks hit rate and purge counts', () => {
    recordCacheRehydrateResult(true);
    recordCacheRehydrateResult(true);
    recordCacheRehydrateResult(false);
    purgePersistedQueryCache({ shouldBroadcast: false });

    const metrics = getQueryCacheMetrics();
    expect(metrics.rehydrateHits).toBe(2);
    expect(metrics.rehydrateMisses).toBe(1);
    expect(metrics.rehydrateHitRate).toBeCloseTo(2 / 3);
    expect(metrics.purgeCalls).toBe(1);
  });

  it('When a peer tab broadcasts a buster mismatch, Then subscribeQueryCacheCrossTab purges local storage and invokes callback', () => {
    const listeners: Array<(event: MessageEvent) => void> = [];
    const OriginalBroadcastChannel = global.BroadcastChannel;

    class MockBroadcastChannel {
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor() {
        listeners.push((event: MessageEvent) => this.onmessage?.(event));
      }
      postMessage() {}
      close() {}
    }

    global.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;

    try {
      window.localStorage.setItem(QUERY_CACHE_STORAGE_KEY, '{"buster":"old"}');
      const onRemotePurge = jest.fn();
      const unsubscribe = subscribeQueryCacheCrossTab(onRemotePurge);

      for (const listener of listeners) {
        listener(
          new MessageEvent('message', {
            data: { type: 'CACHE_BUSTER_ANNOUNCE', buster: 'portal-v9.9.9-s999' },
          })
        );
      }

      expect(onRemotePurge).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
      expect(getQueryCacheMetrics().crossTabPurges).toBe(1);
      unsubscribe();
    } finally {
      global.BroadcastChannel = OriginalBroadcastChannel;
    }
  });
});
