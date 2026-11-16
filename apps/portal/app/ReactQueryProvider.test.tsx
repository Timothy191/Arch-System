import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';

import {
  getQueryCacheMetrics,
  inspectPersistedCacheHit,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_IDB_STORE,
  QUERY_CACHE_STORAGE_KEY,
  resetQueryCacheMetrics,
} from '@/lib/query-cache';
import { ReactQueryProvider } from './ReactQueryProvider';

const TEST_CATALOG_PAYLOAD = { machines: ['EX-01', 'HT-12'] };
const TEST_KPI_PAYLOAD = { throughputTons: 4_250 };
const TEST_SCADA_PAYLOAD = { crusherRpm: 145 };
const TEST_TELEMETRY_PAYLOAD = { beltLoadTons: 62 };
const TEST_REALTIME_PAYLOAD = { sensorState: 'online' };

interface MockIdbRequest {
  result: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface MockIdbOpenRequest extends MockIdbRequest {
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
}

interface ProviderIdbHarness {
  factory: IDBFactory;
  storesByName: Map<string, Map<IDBValidKey, unknown>>;
}

function createProviderIdbHarness(): ProviderIdbHarness {
  const storesByName = new Map<string, Map<IDBValidKey, unknown>>();

  const createStoreApi = (storeName: string) => ({
    put: (record: unknown, key: IDBValidKey) => {
      const request: MockIdbRequest = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        storesByName.get(storeName)?.set(key, record);
        request.onsuccess?.();
      });
      return request as unknown as IDBRequest;
    },
    get: (key: IDBValidKey) => {
      const request: MockIdbRequest = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        request.result = storesByName.get(storeName)?.get(key);
        request.onsuccess?.();
      });
      return request as unknown as IDBRequest;
    },
    delete: (key: IDBValidKey) => {
      const request: MockIdbRequest = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        storesByName.get(storeName)?.delete(key);
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
    close: jest.fn(),
  };

  const factory: IDBFactory = {
    open: () => {
      const openRequest: MockIdbOpenRequest = {
        result: mockDatabase,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        openRequest.onupgradeneeded?.();
        openRequest.onsuccess?.();
      });
      return openRequest as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;

  return { factory, storesByName };
}

function QueryClientProbe({ onClientReady }: { onClientReady: (client: QueryClient) => void }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    onClientReady(queryClient);
  }, [onClientReady, queryClient]);

  return <div data-testid="query-probe">ready</div>;
}

async function flushAsyncPersistence(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe('Given the ReactQueryProvider persistence and selective dehydration boundary', () => {
  const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');

  beforeEach(() => {
    resetQueryCacheMetrics();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(window, 'indexedDB', originalIndexedDbDescriptor);
      return;
    }
    delete (window as { indexedDB?: IDBFactory }).indexedDB;
  });

  it('When queries update in the provider, Then selective dehydration excludes scada, telemetry, and realtime streams while persisting domain queries to IndexedDB', async () => {
    const harness = createProviderIdbHarness();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: harness.factory,
    });

    let activeClient: QueryClient | null = null;
    render(
      <ReactQueryProvider>
        <QueryClientProbe
          onClientReady={(client) => {
            activeClient = client;
          }}
        />
      </ReactQueryProvider>
    );

    await flushAsyncPersistence();
    expect(activeClient).not.toBeNull();
    if (!activeClient) return;

    const capturedClient: QueryClient = activeClient;
    await act(async () => {
      capturedClient.setQueryData(['machines', 'catalog'], TEST_CATALOG_PAYLOAD);
      capturedClient.setQueryData(['department-kpi', 'overview'], TEST_KPI_PAYLOAD);
      capturedClient.setQueryData(['scada', 'crusher-1'], TEST_SCADA_PAYLOAD);
      capturedClient.setQueryData(['telemetry', 'belt-2'], TEST_TELEMETRY_PAYLOAD);
      capturedClient.setQueryData(['realtime', 'sensors'], TEST_REALTIME_PAYLOAD);
    });
    await flushAsyncPersistence();

    const persistedEntry = harness.storesByName
      .get(QUERY_CACHE_IDB_STORE)
      ?.get(QUERY_CACHE_STORAGE_KEY) as PersistedClient | undefined;

    expect(persistedEntry).toBeDefined();
    const persistedKeys = persistedEntry?.clientState.queries.map((query) => query.queryKey) ?? [];
    expect(persistedKeys).toContainEqual(['machines', 'catalog']);
    expect(persistedKeys).toContainEqual(['department-kpi', 'overview']);
    expect(persistedKeys).not.toContainEqual(['scada', 'crusher-1']);
    expect(persistedKeys).not.toContainEqual(['telemetry', 'belt-2']);
    expect(persistedKeys).not.toContainEqual(['realtime', 'sensors']);

    const rawMetadata = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    expect(rawMetadata).not.toBeNull();
    const parsedMetadata = JSON.parse(rawMetadata ?? '{}') as Record<string, unknown>;
    expect(parsedMetadata.buster).toBe(QUERY_CACHE_BUSTER);
    expect(typeof parsedMetadata.timestamp).toBe('number');
    expect(parsedMetadata.clientState).toBeUndefined();
    expect(inspectPersistedCacheHit()).toBe(true);
  });

  it('When a fresh snapshot exists in IndexedDB, Then ReactQueryProvider rehydrates domain queries on mount and cleans up subscriptions on unmount', async () => {
    const harness = createProviderIdbHarness();
    const seededTimestamp = Date.now();
    const seededClient: PersistedClient = {
      timestamp: seededTimestamp,
      buster: QUERY_CACHE_BUSTER,
      clientState: {
        mutations: [],
        queries: [
          {
            queryKey: ['machines', 'catalog'],
            queryHash: '["machines","catalog"]',
            dehydratedAt: seededTimestamp,
            state: {
              data: TEST_CATALOG_PAYLOAD,
              dataUpdateCount: 1,
              dataUpdatedAt: seededTimestamp,
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
    harness.storesByName.set(
      QUERY_CACHE_IDB_STORE,
      new Map([[QUERY_CACHE_STORAGE_KEY, seededClient]])
    );
    window.localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({ buster: QUERY_CACHE_BUSTER, timestamp: seededTimestamp })
    );

    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: harness.factory,
    });

    let activeClient: QueryClient | null = null;
    const renderResult = render(
      <ReactQueryProvider>
        <QueryClientProbe
          onClientReady={(client) => {
            activeClient = client;
          }}
        />
      </ReactQueryProvider>
    );

    await flushAsyncPersistence();
    expect(getQueryCacheMetrics().rehydrateHits).toBe(1);
    expect(activeClient?.getQueryData(['machines', 'catalog'])).toEqual(TEST_CATALOG_PAYLOAD);

    renderResult.unmount();
    await act(async () => {
      activeClient?.setQueryData(['department-kpi', 'after-unmount'], TEST_KPI_PAYLOAD);
    });
    await flushAsyncPersistence();

    const persistedAfterUnmount = harness.storesByName
      .get(QUERY_CACHE_IDB_STORE)
      ?.get(QUERY_CACHE_STORAGE_KEY) as PersistedClient | undefined;
    const keysAfterUnmount =
      persistedAfterUnmount?.clientState.queries.map((query) => query.queryKey) ?? [];
    expect(keysAfterUnmount).not.toContainEqual(['department-kpi', 'after-unmount']);
  });
});
