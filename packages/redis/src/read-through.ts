// packages/redis/src/read-through.ts
import { randomUUID } from 'node:crypto';
import { cacheGet, cacheSet } from './cache';
import { getRedisClient } from './client';
import { evalScript, sendSafe } from './raw';
import { resolveL2TtlSeconds } from './registry';
import { applyTtlJitter } from './xfetch';

export const NULL_SENTINEL = '__REDIS_NULL__' as const;

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_FETCH_TIMEOUT_MS = 4_500;
const DEFAULT_LOCK_TTL_MS = DEFAULT_FETCH_TIMEOUT_MS + 500;
const DEFAULT_NEGATIVE_TTL_SECONDS = 60;
const MAX_NEGATIVE_TTL_SECONDS = 300;
const DEFAULT_WAIT_POLL_MS = 25;
const DEFAULT_MAX_WAIT_MS = 2_000;

const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

export interface GetOrSetOptions {
  ttl?: number;
  lockTtlMs?: number;
  fetchTimeoutMs?: number;
  negativeTtl?: number;
  jitter?: boolean;
  jitterRatio?: number;
  maxWaitMs?: number;
  waitPollMs?: number;
  allowStaleOnLockTimeout?: boolean;
  fallback?: unknown;
}

const activeFlights = new Map<string, Promise<unknown>>();

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const jitteredDelay = (baseMs: number) => baseMs + Math.floor(Math.random() * baseMs * 0.25);

export function assertNegativeTtlLt(positiveTtl: number, negativeTtl: number): void {
  if (negativeTtl >= positiveTtl) {
    throw new Error(
      `negativeTtl (${negativeTtl}s) must be strictly < positiveTtl (${positiveTtl}s)`
    );
  }
  if (negativeTtl > MAX_NEGATIVE_TTL_SECONDS) {
    throw new Error(`negativeTtl (${negativeTtl}s) exceeds hard cap ${MAX_NEGATIVE_TTL_SECONDS}s`);
  }
}

export async function acquireLock(
  key: string,
  ttlMs: number
): Promise<{ token: string; acquired: boolean }> {
  const token = randomUUID();
  try {
    const redis = await getRedisClient();
    const result = await sendSafe(redis, ['SET', `lock:${key}`, token, 'NX', 'PX', String(ttlMs)]);
    const acquired = result === 'OK' || result === 1 || result === true;
    return { token, acquired };
  } catch {
    return { token, acquired: false };
  }
}

export async function releaseLock(key: string, token: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const reply = await evalScript(redis, RELEASE_LOCK_LUA, [`lock:${key}`], [token]);
    return Number(reply) === 1;
  } catch {
    return false;
  }
}

export async function bustNegative(key: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    const current = await sendSafe(redis, ['GET', key]);
    if (current === NULL_SENTINEL) {
      await sendSafe(redis, ['UNLINK', key]);
    }
  } catch {
    /* best effort */
  }
}

async function raceWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: GetOrSetOptions = {}
): Promise<T | null> {
  const ttl = options.ttl ?? DEFAULT_TTL_SECONDS;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const lockTtlMs = options.lockTtlMs ?? fetchTimeoutMs + 500;
  const negativeTtl = Math.min(
    options.negativeTtl ?? DEFAULT_NEGATIVE_TTL_SECONDS,
    MAX_NEGATIVE_TTL_SECONDS
  );
  const jitter = options.jitter !== false;
  const jitterRatio = options.jitterRatio ?? 0.1;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const waitPollMs = options.waitPollMs ?? DEFAULT_WAIT_POLL_MS;
  const allowStale = options.allowStaleOnLockTimeout ?? false;

  assertNegativeTtlLt(ttl, negativeTtl);

  // 1. Cache hit path.
  const cached = await cacheGet<unknown>(key);
  if (cached !== null && cached !== undefined) {
    return cached === NULL_SENTINEL ? null : (cached as T);
  }

  // 2. In-process single-flight (fast path — lock-winner only registers).
  const existing = activeFlights.get(key);
  if (existing) {
    try {
      const shared = (await existing) as T | null;
      return shared === NULL_SENTINEL ? null : (shared as T | null);
    } catch {
      /* fall through to acquire a fresh lock */
    }
  }

  // 3. Distributed lock.
  const { token, acquired } = await acquireLock(key, lockTtlMs);

  if (acquired) {
    const flight = (async (): Promise<T | null> => {
      try {
        const result = await raceWithTimeout(
          fetcher(),
          fetchTimeoutMs,
          `getOrSet fetcher for ${key}`
        );
        if (result === null || result === undefined) {
          const negTtl = jitter
            ? Math.min(applyTtlJitter(negativeTtl, jitterRatio), MAX_NEGATIVE_TTL_SECONDS)
            : negativeTtl;
          await cacheSet(key, NULL_SENTINEL, negTtl, { jitter: false });
          return null;
        }
        const effectiveTtl = jitter ? applyTtlJitter(ttl, jitterRatio) : ttl;
        await cacheSet(key, result, resolveL2TtlSeconds(key, effectiveTtl), {
          jitter: false,
        });
        return result as T;
      } finally {
        await releaseLock(key, token).catch(() => undefined);
        activeFlights.delete(key);
      }
    })();
    activeFlights.set(key, flight);
    return flight;
  }

  // 4. Lock-loser: poll for the winner's cache write (bounded).
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await delay(jitteredDelay(waitPollMs));
    const polled = await cacheGet<unknown>(key);
    if (polled !== null && polled !== undefined) {
      return polled === NULL_SENTINEL ? null : (polled as T);
    }
  }

  // 5. Wait exhausted.
  if (allowStale) {
    const stale = await cacheGet<unknown>(`stale:${key}`);
    if (stale !== null && stale !== undefined && stale !== NULL_SENTINEL) {
      return stale as T;
    }
  }
  // Direct fetch fallback (bounded herd > stalled request). Do NOT cache —
  // the lock winner owns the write path; racing it would clobber the value.
  try {
    const result = await raceWithTimeout(
      fetcher(),
      fetchTimeoutMs,
      `getOrSet fallback fetcher for ${key}`
    );
    if (result === null || result === undefined) return null;
    return result as T;
  } catch {
    return (options.fallback as T) ?? null;
  }
}
