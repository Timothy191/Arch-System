import type { PersistedClient } from '@tanstack/react-query-persist-client';
import {
  buildQueryCacheBuster,
  createAsyncQueryCachePersister,
  getQueryCacheMetrics,
  inspectPersistedCacheHit,
  purgePersistedQueryCache,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_IDB_NAME,
  QUERY_CACHE_IDB_STORE,
  QUERY_CACHE_IDB_VERSION,
  QUERY_CACHE_STORAGE_KEY,
  QUERY_STALE_TIMES,
  recordCacheRehydrateResult,
  resetQueryCacheMetrics,
  resolveQueryStaleTime,
  shouldPersistQueryKey,
  subscribeQueryCacheCrossTab,
} from './query-cache';

const TEST_PORTAL_VERSION = '1.6.2';
const TEST_SCHEMA_REVISION = '219';
const TEST_BUSTER = `portal-v${TEST_PORTAL_VERSION}-s${TEST_SCHEMA_REVISION}`;
const TEST_MISMATCH_BUSTER = `portal-v${TEST_PORTAL_VERSION}-s220`;
const TEST_MAX_AGE_MS = 60_000;
const SYNC_PERSISTER_THROTTLE_MS = 1_000;

interface MockIdbRequest {
  result: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface MockIdbOpenRequest extends MockIdbRequest {
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
}

interface MockIndexedDbHarness {
  factory: IDBFactory;
  storesByName: Map<string, Map<IDBValidKey, unknown>>;
  closeMock: jest.Mock;
  openMock: jest.Mock;
}

function createMockIndexedDbHarness(
  options: { shouldFailOpen?: boolean } = {}
): MockIndexedDbHarness {
  const storesByName = new Map<string, Map<IDBValidKey, unknown>>();
  const closeMock = jest.fn();

  const createStoreApi = (storeName: string) => ({
    put: (record: unknown, key: IDBValidKey) => {
      const request: MockIdbRequest = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const storeEntries = storesByName.get(storeName);
        storeEntries?.set(key, record);
        request.onsuccess?.();
      });
      return request as unknown as IDBRequest;
    },
    get: (key: IDBValidKey) => {
      const request: MockIdbRequest = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const storeEntries = storesByName.get(storeName);
        request.result = storeEntries?.get(key);
        request.onsuccess?.();
      });
      return request as unknown as IDBRequest;
    },
    delete: (key: IDBValidKey) => {
      const request: MockIdbRequest = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const storeEntries = storesByName.get(storeName);
        storeEntries?.delete(key);
        request.onsuccess?.();
      });
      return request as unknown as IDBRequest;
    },
  });

  const mockDatabase = {
    objectStoreNames: {
      contains: (storeName: string) => storesByName.has(storeName),
    },
    createObjectStore: (storeName: string) => {
      if (!storesByName.has(storeName)) {
        storesByName.set(storeName, new Map());
      }
      return createStoreApi(storeName);
    },
    transaction: (storeName: string) => ({
      objectStore: () => createStoreApi(storeName),
    }),
    close: closeMock,
  };

  const openMock = jest.fn((_dbName: string, _version?: number) => {
    const openRequest: MockIdbOpenRequest = {
      result: mockDatabase,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      onblocked: null,
    };

    queueMicrotask(() => {
      if (options.shouldFailOpen) {
        openRequest.onerror?.();
        return;
      }
      openRequest.onupgradeneeded?.();
      openRequest.onsuccess?.();
    });

    return openRequest as unknown as IDBOpenDBRequest;
  });

  return {
    factory: { open: openMock } as unknown as IDBFactory,
    storesByName,
    closeMock,
    openMock,
  };
}

function buildSamplePersistedClient(buster: string = TEST_BUSTER): PersistedClient {
  return {
    timestamp: Date.now(),
    buster,
    clientState: {
      mutations: [],
      queries: [
        {
          queryKey: ['machines', 'catalog'],
          queryHash: '["machines","catalog"]',
          dehydratedAt: Date.now(),
          state: {
            data: { machines: ['EX-01', 'HT-12'] },
            dataUpdateCount: 1,
            dataUpdatedAt: Date.now(),
            error: null,
            errorUpdateCount: 0,
            errorUpdatedAt: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            isInvalidated: false,
            status: 'success',
            fetchStatus: 'idle',
          },
        },
      ],
    },
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('Given the portal query-cache policy and observability layer', () => {
  const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');

  beforeEach(() => {
    resetQueryCacheMetrics();
    window.localStorage.clear();
  });

  afterEach(() => {
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(window, 'indexedDB', originalIndexedDbDescriptor);
      return;
    }
    delete (window as { indexedDB?: IDBFactory }).indexedDB;
  });

  it('When buildQueryCacheBuster is called, Then it encodes both version and schema revision', () => {
    expect(buildQueryCacheBuster(TEST_PORTAL_VERSION, TEST_SCHEMA_REVISION)).toBe(TEST_BUSTER);
    expect(QUERY_CACHE_BUSTER).toContain(`-s${TEST_SCHEMA_REVISION}`);
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

  it('When shouldPersistQueryKey inspects query keys, Then it skips high-frequency telemetry tokens and retains domain queries', () => {
    expect(shouldPersistQueryKey(['scada', 'crusher-1'])).toBe(false);
    expect(shouldPersistQueryKey(['SCADA-telemetry', 'dept-1'])).toBe(false);
    expect(shouldPersistQueryKey(['live', 'feed'])).toBe(false);
    expect(shouldPersistQueryKey(['pulse-metrics'])).toBe(false);
    expect(shouldPersistQueryKey(['alert', 'active'])).toBe(false);
    expect(shouldPersistQueryKey(['realtime', 'sensors'])).toBe(false);

    expect(shouldPersistQueryKey(['machines', 'catalog'])).toBe(true);
    expect(shouldPersistQueryKey(['hourly-loads', '2026-10-29'])).toBe(true);
    expect(shouldPersistQueryKey(['department-kpi', 'overview'])).toBe(true);
    expect(shouldPersistQueryKey([123])).toBe(true);
    expect(shouldPersistQueryKey([])).toBe(true);
  });

  it('When inspectPersistedCacheHit checks localStorage, Then it returns true only for fresh matching busters', () => {
    expect(inspectPersistedCacheHit(TEST_BUSTER, TEST_MAX_AGE_MS)).toBe(false);

    window.localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({ buster: TEST_BUSTER, timestamp: Date.now() })
    );
    expect(inspectPersistedCacheHit(TEST_BUSTER, TEST_MAX_AGE_MS)).toBe(true);
    expect(inspectPersistedCacheHit(TEST_MISMATCH_BUSTER, TEST_MAX_AGE_MS)).toBe(false);
  });

  it('When IndexedDB is available, Then createAsyncQueryCachePersister stores snapshots in IDB, mirrors metadata to localStorage, restores, and removes cleanly', async () => {
    const harness = createMockIndexedDbHarness();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: harness.factory,
    });

    const persister = createAsyncQueryCachePersister(QUERY_CACHE_STORAGE_KEY);
    const sampleClient = buildSamplePersistedClient(QUERY_CACHE_BUSTER);

    await persister.persistClient(sampleClient);

    expect(harness.openMock).toHaveBeenCalledWith(QUERY_CACHE_IDB_NAME, QUERY_CACHE_IDB_VERSION);
    const idbEntry = harness.storesByName.get(QUERY_CACHE_IDB_STORE)?.get(QUERY_CACHE_STORAGE_KEY);
    expect(idbEntry).toEqual(sampleClient);

    const rawMetadata = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    expect(rawMetadata).not.toBeNull();
    const parsedMetadata = JSON.parse(rawMetadata ?? '{}') as Record<string, unknown>;
    expect(parsedMetadata).toEqual({
      buster: sampleClient.buster,
      timestamp: sampleClient.timestamp,
    });
    expect(parsedMetadata.clientState).toBeUndefined();
    expect(inspectPersistedCacheHit()).toBe(true);

    const restoredClient = await persister.restoreClient();
    expect(restoredClient).toEqual(sampleClient);

    await persister.removeClient();
    expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(await persister.restoreClient()).toBeUndefined();
    expect(harness.closeMock).toHaveBeenCalledTimes(4);
  });

  it('When IndexedDB open fails, Then createAsyncQueryCachePersister avoids writing false hit metadata and resolves undefined on restore', async () => {
    const harness = createMockIndexedDbHarness({ shouldFailOpen: true });
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: harness.factory,
    });

    const persister = createAsyncQueryCachePersister(QUERY_CACHE_STORAGE_KEY);
    await persister.persistClient(buildSamplePersistedClient(QUERY_CACHE_BUSTER));

    expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(inspectPersistedCacheHit()).toBe(false);
    expect(await persister.restoreClient()).toBeUndefined();
  });

  it('When IndexedDB is unavailable, Then createAsyncQueryCachePersister delegates to localStorage sync persister', async () => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    jest.useFakeTimers();
    try {
      const persister = createAsyncQueryCachePersister(QUERY_CACHE_STORAGE_KEY);
      const sampleClient = buildSamplePersistedClient(QUERY_CACHE_BUSTER);

      persister.persistClient(sampleClient);
      jest.advanceTimersByTime(SYNC_PERSISTER_THROTTLE_MS);

      expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();
      expect(await persister.restoreClient()).toEqual(sampleClient);

      await persister.removeClient();
      expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
      expect(await persister.restoreClient()).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('When purgePersistedQueryCache runs with IndexedDB available, Then it clears both localStorage metadata and the IndexedDB entry', async () => {
    const harness = createMockIndexedDbHarness();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: harness.factory,
    });

    const persister = createAsyncQueryCachePersister(QUERY_CACHE_STORAGE_KEY);
    await persister.persistClient(buildSamplePersistedClient(QUERY_CACHE_BUSTER));
    expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();

    purgePersistedQueryCache({ shouldBroadcast: false });
    await flushMicrotasks();

    expect(window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(await persister.restoreClient()).toBeUndefined();
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
