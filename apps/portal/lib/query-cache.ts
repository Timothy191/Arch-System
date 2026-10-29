/**
 * Client-side TanStack Query persistence, stale-time tiers, cross-tab
 * BroadcastChannel coordination, and rehydrate/purge observability metrics.
 */

export const QUERY_CACHE_STORAGE_KEY = 'arch-portal-query-cache';
export const QUERY_CACHE_CHANNEL_NAME = 'arch:portal:query-cache';

/**
 * Schema revision bumped whenever persisted query shapes or migrations change.
 * Combined with `NEXT_PUBLIC_PORTAL_VERSION` (or `PORTAL_VERSION`) so every
 * release or schema update automatically invalidates stale localStorage snapshots.
 */
export const QUERY_SCHEMA_REVISION = '185';
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

/**
 * Resolve the appropriate `staleTime` (ms) from a TanStack Query key array.
 */
export function resolveQueryStaleTime(queryKey: readonly unknown[]): number {
  const normalizedKey = queryKey
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase() : ''))
    .join(':');

  if (TELEMETRY_KEY_TOKENS.some((token) => normalizedKey.includes(token))) {
    return QUERY_STALE_TIMES.scadaTelemetryMs;
  }
  if (REFERENCE_KEY_TOKENS.some((token) => normalizedKey.includes(token))) {
    return QUERY_STALE_TIMES.referenceDataMs;
  }
  if (SHIFT_KEY_TOKENS.some((token) => normalizedKey.includes(token))) {
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
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to purge.
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
