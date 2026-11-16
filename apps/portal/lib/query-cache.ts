/**
 * Client-side TanStack Query persistence, stale-time tiers, cross-tab
 * BroadcastChannel coordination, and rehydrate/purge observability metrics.
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export const QUERY_CACHE_STORAGE_KEY = 'arch-portal-query-cache';
export const QUERY_CACHE_CHANNEL_NAME = 'arch:portal:query-cache';
export const QUERY_CACHE_IDB_NAME = 'arch_query_cache_db';
export const QUERY_CACHE_IDB_STORE = 'query_client';
export const QUERY_CACHE_IDB_VERSION = 1;

const IDB_READWRITE_MODE: IDBTransactionMode = 'readwrite';
const IDB_READONLY_MODE: IDBTransactionMode = 'readonly';

/**
 * Schema revision bumped whenever persisted query shapes or migrations change.
 * Combined with `NEXT_PUBLIC_PORTAL_VERSION` (or `PORTAL_VERSION`) so every
 * release or schema update automatically invalidates stale localStorage snapshots.
 */
export const QUERY_SCHEMA_REVISION = '219';
const DEFAULT_PORTAL_VERSION = '1.6.2';

export function buildQueryCacheBuster(
  version: string = process.env.NEXT_PUBLIC_PORTAL_VERSION ||
    process.env.PORTAL_VERSION ||
    DEFAULT_PORTAL_VERSION,
  schemaRevision: string = QUERY_SCHEMA_REVISION
): string {
  return `portal-v${version}-s${schemaRevision}`;
}

/** Automated cache-buster tied to portal build version + database schema revision. */
export const QUERY_CACHE_BUSTER = buildQueryCacheBuster();

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1_000;

/** Persisted snapshots older than 24 hours are discarded on rehydrate. */
export const QUERY_CACHE_MAX_AGE_MS =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

const SCADA_STALE_SECONDS = 15;
const SHIFT_OPS_STALE_MINUTES = 1;
const DEPT_SUMMARY_STALE_MINUTES = 5;
const REFERENCE_DATA_STALE_MINUTES = 30;
const DEFAULT_GC_MINUTES = 10;

/**
 * Per-domain staleTime tiers (in milliseconds) to avoid applying a coarse
 * 5-minute default to live SCADA telemetry or static reference catalogs.
 */
export const QUERY_STALE_TIMES = {
  scadaTelemetryMs: SCADA_STALE_SECONDS * MS_PER_SECOND,
  shiftOperationsMs: SHIFT_OPS_STALE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
  departmentSummaryMs: DEPT_SUMMARY_STALE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
  referenceDataMs: REFERENCE_DATA_STALE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
  defaultGcTimeMs: DEFAULT_GC_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
} as const;

const TELEMETRY_KEY_TOKENS = ['scada', 'telemetry', 'live', 'pulse', 'alert', 'realtime'];
const SHIFT_KEY_TOKENS = [
  'hourly',
  'loads',
  'delays',
  'excavator',
  'operations',
  'shift',
  'breakdowns',
];
const REFERENCE_KEY_TOKENS = ['machines', 'operators', 'sites', 'blocks', 'departments', 'catalog'];

function normalizeQueryKey(queryKey: readonly unknown[]): string {
  return queryKey
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase() : ''))
    .join(':');
}

function hasMatchingKeyToken(normalizedKey: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => normalizedKey.includes(token));
}

/**
 * Determine whether a TanStack Query key should serialize to persistent storage.
 * Excludes high-frequency telemetry streams (`scada`, `telemetry`, `live`,
 * `pulse`, `alert`, `realtime`) to protect tablet INP and disk quotas.
 */
export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const normalizedKey = normalizeQueryKey(queryKey);
  return !hasMatchingKeyToken(normalizedKey, TELEMETRY_KEY_TOKENS);
}

/**
 * Resolve the appropriate `staleTime` (ms) from a TanStack Query key array.
 */
export function resolveQueryStaleTime(queryKey: readonly unknown[]): number {
  const normalizedKey = normalizeQueryKey(queryKey);

  if (hasMatchingKeyToken(normalizedKey, TELEMETRY_KEY_TOKENS)) {
    return QUERY_STALE_TIMES.scadaTelemetryMs;
  }
  if (hasMatchingKeyToken(normalizedKey, REFERENCE_KEY_TOKENS)) {
    return QUERY_STALE_TIMES.referenceDataMs;
  }
  if (hasMatchingKeyToken(normalizedKey, SHIFT_KEY_TOKENS)) {
    return QUERY_STALE_TIMES.shiftOperationsMs;
  }
  return QUERY_STALE_TIMES.departmentSummaryMs;
}

export interface QueryCacheMetricsSnapshot {
  rehydrateHits: number;
  rehydrateMisses: number;
  rehydrateHitRate: number;
  purgeCalls: number;
  crossTabPurges: number;
}

const metricsState = {
  rehydrateHits: 0,
  rehydrateMisses: 0,
  purgeCalls: 0,
  crossTabPurges: 0,
};

export function recordCacheRehydrateResult(didHit: boolean): void {
  if (didHit) {
    metricsState.rehydrateHits += 1;
    return;
  }
  metricsState.rehydrateMisses += 1;
}

export function getQueryCacheMetrics(): QueryCacheMetricsSnapshot {
  const totalRehydrates = metricsState.rehydrateHits + metricsState.rehydrateMisses;
  const rehydrateHitRate = totalRehydrates > 0 ? metricsState.rehydrateHits / totalRehydrates : 0;
  return {
    rehydrateHits: metricsState.rehydrateHits,
    rehydrateMisses: metricsState.rehydrateMisses,
    rehydrateHitRate,
    purgeCalls: metricsState.purgeCalls,
    crossTabPurges: metricsState.crossTabPurges,
  };
}

export function resetQueryCacheMetrics(): void {
  metricsState.rehydrateHits = 0;
  metricsState.rehydrateMisses = 0;
  metricsState.purgeCalls = 0;
  metricsState.crossTabPurges = 0;
}

interface PersistedCacheMetadata {
  buster: string;
  timestamp: number;
}

function isIndexedDbAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.indexedDB !== 'undefined' &&
    window.indexedDB !== null
  );
}

function getSafeLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function writeCacheMetadataMirror(storageKey: string, metadata: PersistedCacheMetadata): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({ buster: metadata.buster, timestamp: metadata.timestamp })
    );
  } catch {
    // Quota or private-browsing error; metadata mirror is best-effort.
  }
}

function removeLocalStorageCacheEntry(storageKey: string): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Storage unavailable — nothing to purge.
  }
}

function closeDatabaseSafely(database: IDBDatabase): void {
  try {
    database.close();
  } catch {
    // Ignore close errors if database handle is already closed.
  }
}

function isValidPersistedClient(candidate: unknown): candidate is PersistedClient {
  if (!candidate || typeof candidate !== 'object') return false;
  const record = candidate as Partial<PersistedClient>;
  return (
    typeof record.timestamp === 'number' &&
    typeof record.buster === 'string' &&
    typeof record.clientState === 'object' &&
    record.clientState !== null
  );
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const openRequest = window.indexedDB.open(QUERY_CACHE_IDB_NAME, QUERY_CACHE_IDB_VERSION);

      openRequest.onupgradeneeded = () => {
        const database = openRequest.result;
        if (!database.objectStoreNames.contains(QUERY_CACHE_IDB_STORE)) {
          database.createObjectStore(QUERY_CACHE_IDB_STORE);
        }
      };

      openRequest.onsuccess = () => {
        resolve(openRequest.result);
      };

      openRequest.onerror = () => {
        resolve(null);
      };

      openRequest.onblocked = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function executeIdbRequest<TResult>(options: {
  mode: IDBTransactionMode;
  createRequest: (store: IDBObjectStore) => IDBRequest;
  mapResult: (requestResult: unknown) => TResult;
  fallbackResult: TResult;
}): Promise<TResult> {
  const database = await openDatabase();
  if (!database) return options.fallbackResult;

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(QUERY_CACHE_IDB_STORE, options.mode);
      const store = transaction.objectStore(QUERY_CACHE_IDB_STORE);
      const request = options.createRequest(store);

      request.onsuccess = () => {
        const mappedResult = options.mapResult(request.result);
        closeDatabaseSafely(database);
        resolve(mappedResult);
      };

      request.onerror = () => {
        closeDatabaseSafely(database);
        resolve(options.fallbackResult);
      };
    } catch {
      closeDatabaseSafely(database);
      resolve(options.fallbackResult);
    }
  });
}

function writePersistedClientToIdb(
  storageKey: string,
  persistedClient: PersistedClient
): Promise<boolean> {
  return executeIdbRequest({
    mode: IDB_READWRITE_MODE,
    createRequest: (store) => store.put(persistedClient, storageKey),
    mapResult: () => true,
    fallbackResult: false,
  });
}

function readPersistedClientFromIdb(storageKey: string): Promise<PersistedClient | undefined> {
  return executeIdbRequest<PersistedClient | undefined>({
    mode: IDB_READONLY_MODE,
    createRequest: (store) => store.get(storageKey),
    mapResult: (requestResult) =>
      isValidPersistedClient(requestResult) ? requestResult : undefined,
    fallbackResult: undefined,
  });
}

async function removePersistedClientFromIdb(storageKey: string): Promise<void> {
  await executeIdbRequest({
    mode: IDB_READWRITE_MODE,
    createRequest: (store) => store.delete(storageKey),
    mapResult: () => undefined,
    fallbackResult: undefined,
  });
}

/**
 * Create an asynchronous IndexedDB-backed TanStack Query `Persister` that keeps
 * large dehydrated snapshots off the main thread and mirrors lightweight
 * `{ buster, timestamp }` metadata to `localStorage` for synchronous hit checks.
 * Falls back to `createSyncStoragePersister` when `window.indexedDB` is absent.
 */
export function createAsyncQueryCachePersister(
  storageKey: string = QUERY_CACHE_STORAGE_KEY
): Persister {
  if (!isIndexedDbAvailable()) {
    return createSyncStoragePersister({
      storage: getSafeLocalStorage(),
      key: storageKey,
    });
  }

  return {
    async persistClient(persistedClient: PersistedClient): Promise<void> {
      const didPersist = await writePersistedClientToIdb(storageKey, persistedClient);
      if (!didPersist) return;
      writeCacheMetadataMirror(storageKey, {
        buster: persistedClient.buster,
        timestamp: persistedClient.timestamp,
      });
    },
    async restoreClient(): Promise<PersistedClient | undefined> {
      return readPersistedClientFromIdb(storageKey);
    },
    async removeClient(): Promise<void> {
      removeLocalStorageCacheEntry(storageKey);
      await removePersistedClientFromIdb(storageKey);
    },
  };
}

export function inspectPersistedCacheHit(
  expectedBuster: string = QUERY_CACHE_BUSTER,
  maxAgeMs: number = QUERY_CACHE_MAX_AGE_MS
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawSnapshot = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!rawSnapshot) return false;
    const parsedSnapshot = JSON.parse(rawSnapshot) as {
      buster?: string;
      timestamp?: number;
    };
    if (parsedSnapshot.buster !== expectedBuster) return false;
    if (typeof parsedSnapshot.timestamp !== 'number') return false;
    return Date.now() - parsedSnapshot.timestamp <= maxAgeMs;
  } catch {
    return false;
  }
}

interface CacheBroadcastMessage {
  type: 'CACHE_PURGE' | 'CACHE_BUSTER_ANNOUNCE';
  buster: string;
}

function broadcastCacheMessage(message: CacheBroadcastMessage): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(QUERY_CACHE_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel unsupported or closed
  }
}

/**
 * Drop the persisted cache and notify peer tabs over BroadcastChannel.
 * Safe to call repeatedly and in any environment.
 */
export function purgePersistedQueryCache(options: { shouldBroadcast?: boolean } = {}): void {
  const { shouldBroadcast = true } = options;
  metricsState.purgeCalls += 1;
  if (typeof window === 'undefined') return;
  removeLocalStorageCacheEntry(QUERY_CACHE_STORAGE_KEY);
  if (isIndexedDbAvailable()) {
    void removePersistedClientFromIdb(QUERY_CACHE_STORAGE_KEY);
  }
  if (shouldBroadcast) {
    broadcastCacheMessage({ type: 'CACHE_PURGE', buster: QUERY_CACHE_BUSTER });
  }
}

/**
 * Subscribe to cross-tab cache purge and cache-buster version coordination.
 * Returns a cleanup callback to close the BroadcastChannel on unmount.
 */
export function subscribeQueryCacheCrossTab(onRemotePurge?: () => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(QUERY_CACHE_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<CacheBroadcastMessage>) => {
      const payload = event.data;
      if (!payload || typeof payload !== 'object') return;

      const isExplicitPurge = payload.type === 'CACHE_PURGE';
      const isBusterMismatch =
        payload.type === 'CACHE_BUSTER_ANNOUNCE' &&
        typeof payload.buster === 'string' &&
        payload.buster !== QUERY_CACHE_BUSTER;

      if (isExplicitPurge || isBusterMismatch) {
        metricsState.crossTabPurges += 1;
        purgePersistedQueryCache({ shouldBroadcast: false });
        onRemotePurge?.();
      }
    };

    channel.postMessage({
      type: 'CACHE_BUSTER_ANNOUNCE',
      buster: QUERY_CACHE_BUSTER,
    } satisfies CacheBroadcastMessage);
  } catch {
    return () => undefined;
  }

  return () => {
    try {
      channel?.close();
    } catch {
      // Ignore close errors
    }
  };
}
