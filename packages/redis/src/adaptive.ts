/**
 * Autonomously Adaptive Caching Engine
 *
 * Reverse-engineered & synthesized from:
 * - DragonflyDB & Redis: TinyLFU admission policy, adaptive TTL scaling, cache avalanche jitter
 * - Vercel SWR: Stale-While-Revalidate execution, request deduping intervals, cache mutation
 * - BFE (Baidu Front End): L7 adaptive circuit breaking (Closed/Open/Half-Open state machine)
 * - Kean Nuke: Single-flight request coalescing and resilient fallback pipelines
 * - InterviewReady System Design: Cache penetration defense (negative/null caching)
 */

import { cacheGet, cacheSet } from './cache';

// -----------------------------------------------------------------------------
// 1. TinyLFU Frequency Tracker (Dragonfly / Redis Cache Design)
// -----------------------------------------------------------------------------

interface FrequencyEntry {
  count: number;
  lastAccess: number;
}

const frequencyMap = new Map<string, FrequencyEntry>();
const MAX_FREQUENCY_TRACKERS = 5000;
const FREQUENCY_HALFLIFE_MS = 60_000; // 1-minute halflife for access decay

/**
 * Records an access event for a key and returns its current decayed frequency score.
 */
export function recordKeyAccess(key: string): number {
  const now = Date.now();
  let entry = frequencyMap.get(key);

  if (!entry) {
    if (frequencyMap.size >= MAX_FREQUENCY_TRACKERS) {
      // Evict oldest tracker
      const oldestKey = frequencyMap.keys().next().value;
      if (oldestKey) frequencyMap.delete(oldestKey);
    }
    entry = { count: 1, lastAccess: now };
    frequencyMap.set(key, entry);
    return 1;
  }

  // Apply decay based on elapsed time since last access
  const elapsed = now - entry.lastAccess;
  const decayFactor = 0.5 ** (elapsed / FREQUENCY_HALFLIFE_MS);
  entry.count = entry.count * decayFactor + 1;
  entry.lastAccess = now;

  return Math.round(entry.count * 10) / 10;
}

/**
 * Returns the estimated access frequency of a key.
 */
export function getKeyFrequency(key: string): number {
  const entry = frequencyMap.get(key);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.lastAccess;
  const decayFactor = 0.5 ** (elapsed / FREQUENCY_HALFLIFE_MS);
  return entry.count * decayFactor;
}

// -----------------------------------------------------------------------------
// 2. Adaptive TTL Engine with Avalanche Jitter (Dragonfly / System Design)
// -----------------------------------------------------------------------------

export interface AdaptiveTtlOptions {
  baseTtlSeconds: number;
  minTtlSeconds?: number;
  maxTtlSeconds?: number;
  jitterPct?: number; // default: 0.10 (+/- 10%)
}

/**
 * Dynamically computes an autonomously adaptive TTL based on key temperature:
 * - High-velocity keys: TTL scaled up to 3x (reduces DB queries for hot resources)
 * - Low-velocity keys: TTL scaled down to 0.5x (conserves Redis memory)
 * - Jitter: Random +/- 10% variance to prevent synchronized mass-expiration (Avalanche)
 */
export function computeAdaptiveTtl(key: string, options: AdaptiveTtlOptions): number {
  const {
    baseTtlSeconds,
    minTtlSeconds = Math.max(5, Math.floor(baseTtlSeconds * 0.25)),
    maxTtlSeconds = baseTtlSeconds * 3,
    jitterPct = 0.1,
  } = options;

  const frequency = recordKeyAccess(key);

  // Velocity multiplier: 1.0 at freq=1, scales logarithmically up to 3.0
  let multiplier = 1.0;
  if (frequency > 1) {
    multiplier = Math.min(3.0, 1.0 + Math.log2(frequency) * 0.4);
  } else if (frequency < 0.3) {
    multiplier = 0.5;
  }

  const rawTtl = baseTtlSeconds * multiplier;
  const clampedTtl = Math.max(minTtlSeconds, Math.min(maxTtlSeconds, rawTtl));

  // Add jitter: e.g. between -10% and +10%
  const jitterRange = clampedTtl * jitterPct * 2;
  const jitterOffset = (Math.random() - 0.5) * jitterRange;

  return Math.max(minTtlSeconds, Math.round(clampedTtl + jitterOffset));
}

// -----------------------------------------------------------------------------
// 3. Adaptive Circuit Breaker (BFE - Baidu Front End Pattern)
// -----------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number; // Consecutive failures to trip open
  cooldownPeriodMs: number; // Duration to remain open before half-open probe
}

export class RedisCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastStateChange = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      cooldownPeriodMs: config.cooldownPeriodMs ?? 15_000,
    };
  }

  public getState(): CircuitState {
    const now = Date.now();
    if (this.state === 'OPEN' && now - this.lastStateChange >= this.config.cooldownPeriodMs) {
      this.state = 'HALF_OPEN';
      this.lastStateChange = now;
    }
    return this.state;
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures > 0) {
      this.state = 'CLOSED';
      this.consecutiveFailures = 0;
      this.lastStateChange = Date.now();
    }
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  public isOpen(): boolean {
    return this.getState() === 'OPEN';
  }
}

export const redisCircuitBreaker = new RedisCircuitBreaker();

// -----------------------------------------------------------------------------
// 4. Stale-While-Revalidate Engine with Single-Flight Coalescing (Vercel SWR & Nuke)
// -----------------------------------------------------------------------------

interface SwrEntry<T> {
  data: T;
  cachedAt: number;
  ttlSeconds: number;
}

const swrInFlight = new Map<string, Promise<any>>();
const lastDedupedTimes = new Map<string, number>();

/**
 * `lastDedupedTimes` was previously never pruned: every distinct key ever
 * passed to swrCacheWrap leaked an entry for the lifetime of the process.
 */
const MAX_DEDUPE_TRACKERS = 5000;

function recordDedupedTime(key: string, at: number): void {
  if (lastDedupedTimes.size >= MAX_DEDUPE_TRACKERS) {
    // Map preserves insertion order; the head is the oldest tracker.
    const oldest = lastDedupedTimes.keys().next();
    if (!oldest.done) lastDedupedTimes.delete(oldest.value);
  }
  lastDedupedTimes.set(key, at);
}

export interface SwrOptions {
  baseTtlSeconds?: number;
  dedupingIntervalMs?: number; // SWR deduping window (default: 2000ms)
  allowNegativeCache?: boolean; // Cache nulls with short TTL to prevent penetration
  negativeCacheTtl?: number;
}

/**
 * Autonomously adaptive Stale-While-Revalidate cache wrapper:
 * 1. Checks L1/L2 cache; if found and fresh, returns immediately (< 0.1ms).
 * 2. If found but expired (stale), returns stale data immediately and triggers background revalidation.
 * 3. If missing, coalesces concurrent requests into a single in-flight promise (Nuke pattern).
 * 4. Applies adaptive TTL with avalanche jitter when storing new values.
 * 5. Uses negative caching (15s) for null/empty returns to stop Cache Penetration.
 */
export function swrCacheWrap<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SwrOptions = {}
): Promise<T> {
  const {
    baseTtlSeconds = 60,
    dedupingIntervalMs = 2000,
    allowNegativeCache = true,
    negativeCacheTtl = 15,
  } = options;

  const now = Date.now();

  // 1. SWR Deduping Check: Return existing in-flight promise if within deduping interval
  const inFlight = swrInFlight.get(key);
  const lastTime = lastDedupedTimes.get(key) || 0;
  if (inFlight && now - lastTime < dedupingIntervalMs) {
    return inFlight;
  }

  // 2. Create the core workflow promise synchronously to coalesce concurrent requests
  let isReplaced = false;
  const promise = (async () => {
    try {
      // Read from Cache (L1 -> L2)
      const cached = await cacheGet<SwrEntry<T>>(key);

      if (cached !== null && typeof cached === 'object' && 'data' in cached) {
        const ageSeconds = (Date.now() - cached.cachedAt) / 1000;
        const isStale = ageSeconds > cached.ttlSeconds;

        if (!isStale) {
          // Fresh hit: return immediately
          recordKeyAccess(key);
          return cached.data;
        }

        // Stale: Return stale data immediately, revalidate asynchronously in background (SWR pattern)
        // `slot.promise` breaks the self-reference so the finally block can
        // compare identity without referencing `bgPromise` before assignment.
        const slot: { promise: Promise<T> | undefined } = { promise: undefined };
        const bgPromise = (async () => {
          try {
            const freshData = await fetcher();
            const adaptiveTtl = computeAdaptiveTtl(key, { baseTtlSeconds });
            const newEntry: SwrEntry<T> = {
              data: freshData,
              cachedAt: Date.now(),
              ttlSeconds: adaptiveTtl,
            };
            await cacheSet(key, newEntry, adaptiveTtl);
            return freshData;
          } catch {
            // Keep serving stale data on revalidation error
            return cached.data;
          } finally {
            // The background revalidation owns the slot until it settles.
            if (swrInFlight.get(key) === slot.promise) {
              swrInFlight.delete(key);
            }
          }
        })();

        // Replace the current lookup promise with the background fetch promise for deduping
        slot.promise = bgPromise;
        isReplaced = true;
        swrInFlight.set(key, bgPromise);
        recordDedupedTime(key, Date.now());

        return cached.data;
      }

      // 3. Cache Miss: Execute fetcher
      const freshData = await fetcher();

      // Cache penetration defense: if data is null/undefined, apply short negative cache
      if (freshData === null || freshData === undefined) {
        if (allowNegativeCache) {
          const negEntry: SwrEntry<any> = {
            data: null,
            cachedAt: Date.now(),
            ttlSeconds: negativeCacheTtl,
          };
          await cacheSet(key, negEntry, negativeCacheTtl);
        }
        return freshData;
      }

      const adaptiveTtl = computeAdaptiveTtl(key, { baseTtlSeconds });
      const newEntry: SwrEntry<T> = {
        data: freshData,
        cachedAt: Date.now(),
        ttlSeconds: adaptiveTtl,
      };

      await cacheSet(key, newEntry, adaptiveTtl);
      redisCircuitBreaker.recordSuccess();
      return freshData;
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      throw error;
    } finally {
      // Only delete if it hasn't been replaced by a background revalidation promise
      if (!isReplaced) {
        swrInFlight.delete(key);
      }
    }
  })();

  swrInFlight.set(key, promise);
  recordDedupedTime(key, now);

  return promise;
}

/**
 * Optimistic mutation helper (SWR pattern):
 * Updates the local cache immediately, then optionally persists or revalidates.
 */
export async function mutateCache<T>(
  key: string,
  data: T,
  shouldRevalidate = false,
  revalidateFetcher?: () => Promise<T>
): Promise<T> {
  const entry: SwrEntry<T> = {
    data,
    cachedAt: Date.now(),
    ttlSeconds: 60,
  };

  // Immediate write-through to L1 and L2
  await cacheSet(key, entry, 60);

  if (shouldRevalidate && revalidateFetcher) {
    // Background revalidation
    swrCacheWrap(key, revalidateFetcher, { baseTtlSeconds: 60 }).catch(() => {});
  }

  return data;
}
