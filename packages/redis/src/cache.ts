import { createRedisSubscriber, getRedisClient } from './client';
import { cacheInvalidatePrefixes, cacheInvalidateTags, indexCacheKeyByTags } from './invalidation';
import {
  clearMemoryCache,
  memoryDelete,
  memoryDeleteByPrefix,
  memoryDeleteKeys,
  memoryGet,
  memoryLiveSize,
  memoryRawSize,
  memorySet,
  memorySweep,
  readMemory,
} from './l1';
import { l1TtlForKey, resolveSupabaseFallback } from './registry';
import { recordCacheHit, recordCacheMiss, recordRedisError, recordXFetchTrigger } from './stats';
import { shouldEarlyExpire, type XFetchWrapper } from './xfetch';

export {
  clearMemoryCache,
  memoryDelete,
  memoryDeleteByPrefix,
  memoryDeleteKeys,
  memoryGet,
  memoryLiveSize,
  memoryRawSize,
  memorySet,
  memorySweep,
} from './l1';

// ------------------------------------------------------------------
// Redis client safe wrapper
// ------------------------------------------------------------------

let subscriberInitialized = false;

async function getRedisClientSafe() {
  try {
    const redis = await getRedisClient();

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
  } catch {
    return null;
  }
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
  } catch {
    recordRedisError();
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
  } catch {
    recordRedisError();
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

/**
 * Store a value in cache with a TTL (seconds).
 * Writes to both L1 (Memory) and L2 (Redis) - Write-Through.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  memorySet(key, value, l1TtlForKey(key, ttlSeconds));

  try {
    const redis = await getRedisClientSafe();
    if (!redis) return;
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    recordRedisError();
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
// Request Coalescing (Single-Flight) map for active computations
const activeFetches = new Map<string, Promise<unknown>>();

export async function cacheWrap<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const start = performance.now();
  const cached = await cacheGetRaw<T>(key);

  if (cached !== null) {
    if (isXFetchWrapper<T>(cached)) {
      if (shouldEarlyExpire(cached)) {
        recordXFetchTrigger(performance.now() - start);
        if (!activeFetches.has(key)) {
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
              await cacheSet(key, newWrapper, ttlSeconds);
              return freshVal;
            })
            .catch(() => {
              // Ignore background refresh errors, serve stale
            })
            .finally(() => {
              activeFetches.delete(key);
            });

          activeFetches.set(key, fetchPromise);
        }
      } else {
        recordCacheHit('l2', performance.now() - start);
      }

      return cached.value;
    }

    recordCacheHit('l2', performance.now() - start);
    return cached as T;
  }

  recordCacheMiss(performance.now() - start);

  // Cache Miss: Check if another request is already computing this key (Single-Flight)
  if (activeFetches.has(key)) {
    return activeFetches.get(key) as Promise<T>;
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
      await cacheSet(key, newWrapper, ttlSeconds);
      return freshVal;
    })
    .finally(() => {
      activeFetches.delete(key);
    });

  activeFetches.set(key, fetchPromise);
  return fetchPromise;
}

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
  } catch {
    recordRedisError();
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

export { cacheInvalidatePrefixes, cacheInvalidateTags };

/**
 * Evict keys from the L1 in-memory cache by prefix.
 * Useful in middleware where Redis may not be available.
 */
export function cacheEvictL1ByPrefix(prefix: string): void {
  memoryDeleteByPrefix(prefix);
}
