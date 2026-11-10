import { redisCircuitBreaker } from './circuit-breaker';
import { createRedisSubscriber } from './client';
import { getCircuitGuardedRedisClient } from './internal-utils';
import {
  cacheInvalidatePrefixes,
  cacheInvalidateTags,
  cacheInvalidateTagsBatch,
  indexCacheKeyByTags,
} from './invalidation';
import { memoryDelete, memoryDeleteByPrefix, memoryDeleteKeys, memorySet, readMemory } from './l1';
import { acquireRefreshLease, releaseRefreshLease } from './locks';
import { asFieldMap, asStringOrNull, sendSafe } from './raw';
import {
  l1TtlForKey,
  MAX_RECOMMENDED_PAYLOAD_BYTES,
  MAX_TTL_SECONDS,
  resolveL2TtlSeconds,
  resolveSupabaseFallback,
} from './registry';
import { recordCacheHit, recordCacheMiss, recordRedisError, recordXFetchTrigger } from './stats';
import { applyTtlJitter, shouldEarlyExpire, type XFetchWrapper } from './xfetch';

export {
  clearMemoryCache,
  DEFAULT_L1_SWEEP_INTERVAL_MS,
  memoryDelete,
  memoryDeleteByPrefix,
  memoryDeleteKeys,
  memoryGet,
  memoryLiveSize,
  memoryRawSize,
  memorySet,
  memorySweep,
  startL1Sweep,
  stopL1Sweep,
} from './l1';

// ------------------------------------------------------------------
// Redis client safe wrapper
// ------------------------------------------------------------------

let subscriberInitialized = false;

async function getRedisClientSafe() {
  const redis = await getCircuitGuardedRedisClient('cache:getRedisClientSafe');
  if (!redis) {
    return null;
  }

  if (!subscriberInitialized) {
    subscriberInitialized = true;
    createRedisSubscriber()
      .then((sub) => {
        sub
          .subscribe('cache:invalidate:broadcast', (message) => {
            try {
              const payload = JSON.parse(message) as {
                type?: string;
                keys?: string[];
                prefixes?: string[];
              };
              if (payload.type === 'keys' && Array.isArray(payload.keys)) {
                memoryDeleteKeys(payload.keys);
              } else if (payload.type === 'prefixes' && Array.isArray(payload.prefixes)) {
                for (const p of payload.prefixes) {
                  memoryDeleteByPrefix(p);
                }
              }
            } catch {
              // Ignore malformed broadcast messages
            }
          })
          .catch(() => {
            subscriberInitialized = false;
          });
      })
      .catch(() => {
        subscriberInitialized = false;
      });
  }

  return redis;
}

// ------------------------------------------------------------------
// Serialization boundary
// ------------------------------------------------------------------

/**
 * Decode a raw Redis string exactly once.
 *
 * Both the TCP client and the serverless REST adapter return the raw string
 * stored in Redis; non-JSON strings pass through unchanged rather than
 * turning into a false cache miss.
 */
function decode(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isXFetchWrapper<T>(parsed: unknown): parsed is XFetchWrapper<T> {
  return (
    Boolean(parsed) &&
    typeof parsed === 'object' &&
    '__isXFetchWrapper' in (parsed as Record<string, unknown>) &&
    (parsed as XFetchWrapper<T>).__isXFetchWrapper === true
  );
}

function unwrap<T>(parsed: unknown): T {
  if (isXFetchWrapper<T>(parsed)) {
    return parsed.value;
  }
  return parsed as T;
}

// ------------------------------------------------------------------
// Core cache operations with stats
// ------------------------------------------------------------------

/**
 * Get a cached value by key.
 * Checks L1 (In-Memory) first for ultra-low latency, then falls back to L2 (Redis).
 * Returns null if not found or on error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const start = performance.now();

  const l1 = readMemory<unknown>(key);
  if (l1.hit) {
    recordCacheHit('l1', performance.now() - start);
    return unwrap<T>(l1.value);
  }

  try {
    const redis = await getRedisClientSafe();
    if (redis) {
      const raw = await redis.get(key);
      const elapsed = performance.now() - start;

      if (raw !== null && raw !== undefined) {
        recordCacheHit('l2', elapsed);
        const parsed = decode(raw);
        memorySet(key, parsed, l1TtlForKey(key));
        return unwrap<T>(parsed);
      }
    }
  } catch (err) {
    redisCircuitBreaker?.recordFailure();
    recordRedisError();
    console.error('[cache:cacheGet] Redis read error:', err);
  }

  // Durability fallback guard: attempt read-through recovery from Supabase if registered
  const fallback = await resolveSupabaseFallback<T>(key);
  if (fallback !== null) {
    memorySet(key, fallback, l1TtlForKey(key));
    recordCacheHit('l2', performance.now() - start);
    return fallback;
  }

  recordCacheMiss(performance.now() - start);
  return null;
}

/**
 * Get a cached value and report which layer served it.
 * Returns { value, source } where source is "l1", "l2", or null.
 */
export async function cacheGetWithStats<T>(
  key: string
): Promise<{ value: T | null; source: 'l1' | 'l2' | null }> {
  const start = performance.now();

  const l1 = readMemory<unknown>(key);
  if (l1.hit) {
    recordCacheHit('l1', performance.now() - start);
    return { value: unwrap<T>(l1.value), source: 'l1' };
  }

  try {
    const redis = await getRedisClientSafe();
    if (redis) {
      const raw = await redis.get(key);
      const elapsed = performance.now() - start;

      if (raw !== null && raw !== undefined) {
        recordCacheHit('l2', elapsed);
        const parsed = decode(raw);
        memorySet(key, parsed, l1TtlForKey(key));
        return { value: unwrap<T>(parsed), source: 'l2' };
      }
    }
  } catch (err) {
    redisCircuitBreaker?.recordFailure();
    recordRedisError();
    console.error('[cache:cacheGetWithStats] Redis read error:', err);
  }

  const fallback = await resolveSupabaseFallback<T>(key);
  if (fallback !== null) {
    memorySet(key, fallback, l1TtlForKey(key));
    recordCacheHit('l2', performance.now() - start);
    return { value: fallback, source: 'l2' };
  }

  recordCacheMiss(performance.now() - start);
  return { value: null, source: null };
}

async function cacheGetRaw<T>(key: string): Promise<T | XFetchWrapper<T> | null> {
  const l1 = readMemory<unknown>(key);
  if (l1.hit) {
    return l1.value as T | XFetchWrapper<T>;
  }
  try {
    const redis = await getRedisClientSafe();
    if (redis) {
      const raw = await redis.get(key);
      if (raw !== null && raw !== undefined) {
        const parsed = decode(raw);
        memorySet(key, parsed, l1TtlForKey(key));
        return parsed as T | XFetchWrapper<T>;
      }
    }
  } catch {
    // Fall through to Supabase fallback guard
  }

  const fallback = await resolveSupabaseFallback<T>(key);
  if (fallback !== null) {
    memorySet(key, fallback, l1TtlForKey(key));
    return fallback;
  }
  return null;
}

export interface CacheSetOptions {
  jitter?: boolean;
  jitterRatio?: number;
}

/**
 * Store a value in cache with a TTL (seconds).
 * Writes to both L1 (Memory) and L2 (Redis) - Write-Through.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  options?: CacheSetOptions
): Promise<void> {
  const useJitter = options?.jitter !== false;
  const jitterRatio = options?.jitterRatio ?? 0.1;
  const jitteredTtl = useJitter ? applyTtlJitter(ttlSeconds, jitterRatio) : ttlSeconds;
  const effectiveTtlSeconds = Math.min(MAX_TTL_SECONDS, resolveL2TtlSeconds(key, jitteredTtl));

  memorySet(key, value, l1TtlForKey(key, effectiveTtlSeconds));

  try {
    const redis = await getRedisClientSafe();
    if (!redis) return;
    const serializedPayload = JSON.stringify(value);
    const payloadBytes = Buffer.byteLength(serializedPayload, 'utf8');
    if (payloadBytes > MAX_RECOMMENDED_PAYLOAD_BYTES) {
      console.warn(
        `[cache:cacheSet] Big key warning: key="${key}" payloadBytes=${payloadBytes} exceeds 100KB limit`
      );
    }
    await redis.setEx(key, effectiveTtlSeconds, serializedPayload);
  } catch (err) {
    redisCircuitBreaker?.recordFailure();
    recordRedisError();
    console.error('[cache:cacheSet] Redis write error:', err);
  }
}

/**
 * Store a value in cache with a TTL and associate it with tags for later invalidation.
 */
export async function cacheSetWithTags<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  tags?: string[]
): Promise<void> {
  await cacheSet(key, value, ttlSeconds);
  if (tags && tags.length > 0) {
    await indexCacheKeyByTags(key, tags);
  }
}

export interface CacheSetJitterOptions {
  ttlSeconds: number;
  jitterRatio?: number;
  tags?: readonly string[];
}

export async function cacheSetWithJitter<T>(
  key: string,
  payload: T,
  options: CacheSetJitterOptions
): Promise<number> {
  const jitteredTtlSeconds = applyTtlJitter(
    resolveL2TtlSeconds(key, options.ttlSeconds),
    options.jitterRatio
  );
  await cacheSetWithTags(
    key,
    payload,
    jitteredTtlSeconds,
    options.tags ? [...options.tags] : undefined
  );
  return jitteredTtlSeconds;
}

export interface CacheHashSetOptions {
  key: string;
  fields: Readonly<Record<string, string | number | boolean>>;
  ttlSeconds?: number;
}

export async function cacheHashSetFields(options: CacheHashSetOptions): Promise<boolean> {
  memoryDelete(options.key);
  const flatArgs: (string | number)[] = [];
  for (const [field, fieldValue] of Object.entries(options.fields)) {
    flatArgs.push(field, String(fieldValue));
  }
  try {
    const redis = await getRedisClientSafe();
    if (!redis) return false;
    const hsetReply = await sendSafe(redis, ['HSET', options.key, ...flatArgs]);
    await sendSafe(redis, [
      'EXPIRE',
      options.key,
      resolveL2TtlSeconds(options.key, options.ttlSeconds),
    ]);
    return hsetReply !== null;
  } catch {
    return false;
  }
}

export async function cacheHashGetField(key: string, field: string): Promise<string | null> {
  try {
    const redis = await getRedisClientSafe();
    if (!redis) return null;
    const reply = await sendSafe(redis, ['HGET', key, field]);
    return asStringOrNull(reply);
  } catch {
    return null;
  }
}

export async function cacheHashGetAll(key: string): Promise<Record<string, string>> {
  try {
    const redis = await getRedisClientSafe();
    if (!redis) return {};
    const reply = await sendSafe(redis, ['HGETALL', key]);
    return asFieldMap(reply);
  } catch {
    return {};
  }
}

/**
 * Write-through durability helper: persists business-critical data to Supabase
 * FIRST (source of truth), then populates L1 and L2 Redis caches.
 * Guarantees zero business-critical data ever lives solely in Redis.
 */
export async function cacheWriteThroughSupabase<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  persistToSupabase: () => Promise<void>,
  tags?: string[]
): Promise<void> {
  await persistToSupabase();
  await cacheSetWithTags(key, value, ttlSeconds, tags);
}

/**
 * Wrap a function with Redis caching.
 * If the key exists in cache, returns it; otherwise calls fn, stores result, and returns it.
 * Uses XFetch probabilistic early expiration plus single-flight coalescing.
 */
// Request Coalescing (Single-Flight) maps for active miss computations and XFetch background refreshes
const activeMissFetches = new Map<string, Promise<unknown>>();
const activeBackgroundRefreshes = new Set<string>();

function startBackgroundRefresh<T>(key: string, fn: () => Promise<T>, ttlSeconds: number): void {
  if (activeBackgroundRefreshes.has(key) || activeMissFetches.has(key)) return;
  activeBackgroundRefreshes.add(key);

  void (async () => {
    const hasLease = await acquireRefreshLease(key).catch(() => true);
    if (!hasLease) return;
    const fetchStart = performance.now();
    try {
      const freshVal = await fn();
      const delta = performance.now() - fetchStart;
      const newWrapper: XFetchWrapper<T> = {
        value: freshVal,
        ttl: ttlSeconds,
        delta,
        computedAt: Date.now(),
        __isXFetchWrapper: true,
      };
      await cacheSet(key, newWrapper, ttlSeconds, { jitter: false });
    } catch {
      // Serve stale, and drop the lease so the next request can retry immediately
      await releaseRefreshLease(key).catch(() => undefined);
    }
  })().finally(() => {
    activeBackgroundRefreshes.delete(key);
  });
}

export async function cacheWrap<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // 1. Pre-lookup Single-Flight Guard: if a cache-miss computation is already in-flight
  // in this process, coalesce onto it immediately without issuing redundant Redis GETs.
  const existingFlight = activeMissFetches.get(key);
  if (existingFlight !== undefined) {
    return existingFlight as Promise<T>;
  }

  const start = performance.now();
  const cached = await cacheGetRaw<T>(key);

  // 2. Cache Hit (with XFetch early-expiration check)
  if (cached !== null) {
    if (isXFetchWrapper<T>(cached)) {
      if (shouldEarlyExpire(cached)) {
        recordXFetchTrigger(performance.now() - start);
        startBackgroundRefresh(key, fn, ttlSeconds);
      } else {
        recordCacheHit('l2', performance.now() - start);
      }
      return cached.value;
    }

    recordCacheHit('l2', performance.now() - start);
    return cached as T;
  }

  recordCacheMiss(performance.now() - start);

  // 3. Post-lookup Single-Flight Guard: collapse concurrent callers that entered
  // cacheGetRaw simultaneously while the cache was cold.
  const concurrentFlight = activeMissFetches.get(key);
  if (concurrentFlight !== undefined) {
    return concurrentFlight as Promise<T>;
  }

  const fetchStart = performance.now();
  const fetchPromise = fn()
    .then(async (freshVal) => {
      const delta = performance.now() - fetchStart;
      const newWrapper: XFetchWrapper<T> = {
        value: freshVal,
        ttl: ttlSeconds,
        delta,
        computedAt: Date.now(),
        __isXFetchWrapper: true,
      };
      await cacheSet(key, newWrapper, ttlSeconds, { jitter: false });
      return freshVal;
    })
    .finally(() => {
      activeMissFetches.delete(key);
    });

  activeMissFetches.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Alias for {@link cacheWrap}. Referenced as `cacheGetOrSet()` across
 * AGENTS.md and agent documentation; kept as a stable export so docs and
 * code never diverge.
 */
export { cacheWrap as cacheGetOrSet };

/**
 * Delete a specific key from cache.
 * Also removes from memory cache if Redis unavailable.
 */
export async function cacheDelete(key: string): Promise<void> {
  memoryDelete(key);

  try {
    const redis = await getRedisClientSafe();
    if (!redis) return;
    await redis.del(key);
  } catch (err) {
    redisCircuitBreaker?.recordFailure();
    recordRedisError();
    console.error('[cache:cacheDelete] Redis delete error:', err);
  }
}

/**
 * Delete all keys matching a pattern via safe SCAN-based prefix invalidation.
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const prefix = pattern.replace(/\*+$/, '');
  if (prefix) {
    await cacheInvalidatePrefixes([prefix]);
  }
}

export { cacheInvalidatePrefixes, cacheInvalidateTags, cacheInvalidateTagsBatch };

/**
 * Evict keys from the L1 in-memory cache by prefix.
 * Useful in middleware where Redis may not be available.
 */
export function cacheEvictL1ByPrefix(prefix: string): void {
  memoryDeleteByPrefix(prefix);
}
