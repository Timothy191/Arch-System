/**
 * Distributed locks and coordination primitives.
 *
 * Why this exists: everything that must not run twice (shift closeout
 * compilation, offline replay, seed/migration runners, cache refresh) was
 * protected only by a per-process `Map`. Two server instances — or one instance
 * behind a rolling deploy — could both take the work. These primitives are
 * Redis-backed, so the guarantee holds across processes.
 *
 * Safety rules encoded here:
 *  - A lock is only released by the token that took it, compared *inside* Lua,
 *    so a holder whose TTL expired can never delete the next holder's lock.
 *  - Locks always carry a TTL. There is no way to take a lock that survives a
 *    crashed process.
 *  - Acquisition fails closed: a Redis outage throws instead of pretending the
 *    caller owns something it does not.
 */

import { randomUUID } from 'node:crypto';
import { incrementCounter } from './analytics';
import { getRedisClient } from './client';
import { asNumber, RedisCommandError, send, sendSafe } from './raw';

const LOCK_PREFIX = 'arch:lock:';
const FENCE_SUFFIX = ':fence';
const DEFAULT_TTL_MS = 30_000;
const DEFAULT_RETRY_MS = 50;
const DEFAULT_MAX_WAIT_MS = 0;
/** Cap for exponential backoff between acquisition attempts. */
const MAX_BACKOFF_MS = 1_000;
/** Jitter floor: never sleep less than half the computed backoff. */
const BACKOFF_JITTER_FLOOR = 0.5;
/** Renewal never runs faster than this, whatever the TTL says. */
const MIN_RENEW_INTERVAL_MS = 1_000;
/** Renew at a third of the TTL, leaving two thirds of slack for a failed renew. */
const RENEW_TTL_DIVISOR = 3;
/** Redis PTTL reports -2 when the key does not exist. */
const LOCK_ABSENT = -2;
/** Claims outlive any plausible retry window, but must not accumulate forever. */
const IDEMPOTENCY_TTL_SECONDS = 86_400;

/** Generated once per process so tokens are unique across instances. */
const INSTANCE_ID_LENGTH = 8;
const INSTANCE_ID = randomUUID().slice(0, INSTANCE_ID_LENGTH);

export class LockUnavailableError extends Error {
  constructor(
    message: string,
    readonly lockName: string
  ) {
    super(message);
    this.name = 'LockUnavailableError';
  }
}

export interface LockHandle {
  name: string;
  key: string;
  token: string;
  /** Monotonic across acquisitions; pass it downstream to reject stale writers. */
  fencingToken: number | null;
  acquiredAt: number;
  ttlMs: number;
}

export interface LockOptions {
  /** Ownership deadline. The lock is released by Redis even if the holder dies. */
  ttlMs?: number;
  /** Extra attempts after the first failed acquisition. */
  retries?: number;
  /** Base backoff between attempts (jittered). */
  retryBackoffMs?: number;
  /** Upper bound on total waiting time; contention stops waiting once exceeded. */
  maxWaitMs?: number;
  /** Ask Redis for a monotonic fencing token (one extra INCR). */
  fencing?: boolean;
}

/**
 * Ownership test shared by the release/renew scripts and their no-EVAL
 * fallbacks: the stored value is either the bare token or `token|fence`.
 */
function owns(stored: unknown, token: string): boolean {
  if (typeof stored !== 'string') return false;
  return stored === token || stored.startsWith(`${token}|`);
}

const OWNED_BY_TOKEN_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
if current ~= ARGV[1] and string.sub(current, 1, #ARGV[1] + 1) ~= ARGV[1] .. '|' then
  return 0
end
`;

/** Compare-and-delete release. */
const RELEASE_SCRIPT = `${OWNED_BY_TOKEN_LUA}return redis.call('DEL', KEYS[1])`;

/**
 * Compare-and-pexpire renewal. A holder that already lost ownership cannot
 * extend somebody else's lock.
 */
const RENEW_SCRIPT = `${OWNED_BY_TOKEN_LUA}return redis.call('PEXPIRE', KEYS[1], ARGV[2])`;

/**
 * NX acquire + optional fencing token in one atomic step. The fence counter is
 * persistent so a restart cannot reset the sequence and hand out a stale token.
 */
const ACQUIRE_FENCE_SCRIPT = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) == false then
  return nil
end
local fence = redis.call('INCR', KEYS[2])
redis.call('SET', KEYS[1], ARGV[1] .. '|' .. tostring(fence), 'PX', ARGV[2])
return fence
`;

export function lockKey(name: string): string {
  return `${LOCK_PREFIX}${name}`;
}

/** Refresh-lease key: cheap proof that somebody is already recomputing `key`. */
export function refreshLeaseKey(key: string): string {
  return `arch:lease:refresh:${key}`;
}

function idempotencyKey(key: string): string {
  return `arch:idem:${key}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
  });
}

function tokenFor(): string {
  return `${INSTANCE_ID}:${randomUUID()}`;
}

interface AcquireAttempt {
  name: string;
  key: string;
  token: string;
  ttlMs: number;
  fencing: boolean;
}

async function acquireOnce(attempt: AcquireAttempt): Promise<LockHandle | null> {
  const { name, key, token, ttlMs, fencing } = attempt;
  const redis = await getRedisClient();
  const acquiredAt = Date.now();

  if (fencing) {
    try {
      const fence = await send(redis, [
        'EVAL',
        ACQUIRE_FENCE_SCRIPT,
        2,
        key,
        `${key}${FENCE_SUFFIX}`,
        token,
        ttlMs,
      ]);
      // A `nil` reply means the key was already held by someone else.
      if (fence === null) return null;
      const value = asNumber(fence, -1);
      if (value > 0) {
        return { name, key, token, fencingToken: value, acquiredAt, ttlMs };
      }
      // An unexpected reply shape falls through to the non-scripted path.
    } catch {
      // EVAL unsupported by this endpoint: fall through to SET NX PX.
    }
  }

  const reply = await send(redis, ['SET', key, fencing ? `${token}|1` : token, 'NX', 'PX', ttlMs]);
  if (reply !== 'OK') return null;
  return {
    name,
    key,
    token,
    fencingToken: fencing ? 1 : null,
    acquiredAt,
    ttlMs,
  };
}

/**
 * Take a lock, or return null when somebody else holds it.
 *
 * Throws `RedisCommandError` when Redis is unreachable — callers coordinating
 * writes must not proceed under a false impression of exclusivity.
 */
export async function acquireLock(name: string, options?: LockOptions): Promise<LockHandle | null> {
  const ttlMs = Math.max(1, options?.ttlMs ?? DEFAULT_TTL_MS);
  const retries = Math.max(0, options?.retries ?? 0);
  const backoffMs = Math.max(1, options?.retryBackoffMs ?? DEFAULT_RETRY_MS);
  const maxWaitMs = Math.max(0, options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS);
  const fencing = options?.fencing ?? false;
  const key = lockKey(name);
  const token = tokenFor();
  const deadline = Date.now() + maxWaitMs;

  for (let attempt = 0; ; attempt++) {
    const handle = await acquireOnce({ name, key, token, ttlMs, fencing });
    if (handle) return handle;

    if (attempt >= retries) {
      await incrementCounter('lock.contended', { dimension: name });
      return null;
    }
    const remaining = deadline - Date.now();
    if (maxWaitMs > 0 && remaining <= 0) {
      await incrementCounter('lock.timeout', { dimension: name });
      return null;
    }
    const wait =
      Math.min(backoffMs * 2 ** attempt, MAX_BACKOFF_MS) * (BACKOFF_JITTER_FLOOR + Math.random());
    await sleep(maxWaitMs > 0 ? Math.min(wait, Math.max(1, remaining)) : wait);
  }
}

/**
 * Extend ownership of a live lock. Callers running work longer than `ttlMs`
 * renew periodically; a false result means ownership was lost and the caller
 * must stop writing.
 */
export async function renewLock(lock: LockHandle, ttlMs?: number): Promise<boolean> {
  const nextTtl = Math.max(1, ttlMs ?? lock.ttlMs);
  const redis = await getRedisClient();
  try {
    const renewed = await send(redis, ['EVAL', RENEW_SCRIPT, 1, lock.key, lock.token, nextTtl]);
    const ok = asNumber(renewed) === 1;
    if (ok) lock.acquiredAt = Date.now();
    return ok;
  } catch (error) {
    // No EVAL: best-effort PEXPIRE guarded by an ownership read.
    if (!(error instanceof RedisCommandError)) throw error;
    const current = await sendSafe(redis, ['GET', lock.key]);
    if (!owns(current, lock.token)) return false;
    return asNumber(await sendSafe(redis, ['PEXPIRE', lock.key, nextTtl])) === 1;
  }
}

/**
 * Release a lock, but only if this handle still owns it.
 * Returns false when the lock already expired and another process took it.
 */
export async function releaseLock(lock: LockHandle): Promise<boolean> {
  const redis = await getRedisClient();

  try {
    const deleted = await send(redis, ['EVAL', RELEASE_SCRIPT, 1, lock.key, lock.token]);
    return asNumber(deleted) === 1;
  } catch {
    const current = await sendSafe(redis, ['GET', lock.key]);
    if (!owns(current, lock.token)) return false;
    return asNumber(await sendSafe(redis, ['DEL', lock.key])) === 1;
  }
}

/**
 * Drop a lock held by anyone — operator recovery for a lock stranded by a
 * process killed before its TTL elapsed. Not exposed to request handlers.
 */
export async function forceReleaseLock(name: string): Promise<boolean> {
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['DEL', lockKey(name)])) === 1;
}

/** Remaining ownership time in ms; -2 when the lock does not exist. */
export async function lockTtl(name: string): Promise<number> {
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['PTTL', lockKey(name)]), LOCK_ABSENT);
}

export interface WithLockOptions extends LockOptions {
  /** Keep the lock alive for `fn` by renewing at this fraction of its TTL. */
  autoRenew?: boolean;
}

/** One guarded run: which lock to hold, for how long, and how to retry. */
export interface LockRunInput extends WithLockOptions {
  name: string;
}

/**
 * Run `fn` while holding `name`. Throws `LockUnavailableError` if the lock is
 * held elsewhere, so callers decide whether contention is a 409 or a retry.
 */
export async function withLock<T>(
  input: LockRunInput,
  fn: (lock: LockHandle) => Promise<T>
): Promise<T> {
  const { name } = input;
  const lock = await acquireLock(name, input);
  if (!lock) {
    throw new LockUnavailableError(`Could not acquire lock "${name}"`, name);
  }

  const ttlMs = lock.ttlMs;
  let renewer: ReturnType<typeof setInterval> | null = null;

  if (input.autoRenew) {
    renewer = setInterval(
      () => {
        void renewLock(lock, ttlMs).catch(() => undefined);
      },
      Math.max(MIN_RENEW_INTERVAL_MS, Math.floor(ttlMs / RENEW_TTL_DIVISOR))
    );
    (renewer as unknown as { unref?: () => void }).unref?.();
  }

  try {
    return await fn(lock);
  } finally {
    if (renewer) clearInterval(renewer);
    await releaseLock(lock).catch(() => false);
  }
}

/** `withLock` that returns null instead of throwing on contention. */
export async function tryWithLock<T>(
  input: LockRunInput,
  fn: (lock: LockHandle) => Promise<T>
): Promise<T | null> {
  const lock = await acquireLock(input.name, input);
  if (!lock) return null;
  try {
    return await fn(lock);
  } finally {
    await releaseLock(lock).catch(() => false);
  }
}

export type IdempotencyClaim = 'new' | 'in-flight' | 'duplicate';

const IN_FLIGHT_MARKER = '__in_flight__';

/**
 * Claim an idempotency key before doing side-effecting work.
 *
 * `SET NX` makes the claim atomic, and the marker value distinguishes "another
 * process is doing this right now" from "this already completed". Completed
 * claims keep their result payload so a retry can return the original outcome
 * instead of re-executing.
 */
export async function claimIdempotency(
  key: string,
  options?: { ttlSeconds?: number }
): Promise<IdempotencyClaim> {
  const ttlSeconds = Math.max(1, options?.ttlSeconds ?? IDEMPOTENCY_TTL_SECONDS);
  const redis = await getRedisClient();
  const redisKey = idempotencyKey(key);

  const taken = await send(redis, ['SET', redisKey, IN_FLIGHT_MARKER, 'NX', 'EX', ttlSeconds]);
  if (taken === 'OK') return 'new';

  const existing = await sendSafe(redis, ['GET', redisKey]);
  if (existing === IN_FLIGHT_MARKER) return 'in-flight';
  return existing === null ? 'new' : 'duplicate';
}

/** Read the stored result of a completed idempotency claim. */
export async function readIdempotencyResult<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  const raw = await sendSafe(redis, ['GET', idempotencyKey(key)]);
  if (typeof raw !== 'string' || raw === IN_FLIGHT_MARKER) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface IdempotencyCompletion {
  key: string;
  /** Stored as JSON so a retry can return the original outcome. */
  result: unknown;
  ttlSeconds?: number;
}

/** Persist the result so replays return it instead of re-running the work. */
export async function completeIdempotency(input: IdempotencyCompletion): Promise<void> {
  const ttlSeconds = Math.max(1, input.ttlSeconds ?? IDEMPOTENCY_TTL_SECONDS);
  const redis = await getRedisClient();
  await sendSafe(redis, [
    'SET',
    idempotencyKey(input.key),
    JSON.stringify(input.result),
    'EX',
    ttlSeconds,
  ]);
}

/** Give the claim back so a legitimate retry can run again. */
export async function abandonIdempotency(key: string): Promise<void> {
  const redis = await getRedisClient();
  await sendSafe(redis, ['DEL', idempotencyKey(key)]);
}

/**
 * Lease guarding a cache refresh. Only the caller that gets `true` recomputes
 * the expensive value; everyone else serves the stale copy. The lease is left to
 * expire rather than released on success, so a slow upstream is not hammered by
 * the very next request either. This is the cross-process half of the
 * single-flight map in `cache.ts`, which is per-instance by construction.
 */
export async function acquireRefreshLease(key: string, ttlMs = 5_000): Promise<boolean> {
  const redis = await getRedisClient();
  const reply = await send(redis, [
    'SET',
    refreshLeaseKey(key),
    tokenFor(),
    'NX',
    'PX',
    Math.max(1, ttlMs),
  ]);
  if (reply === 'OK') return true;
  await incrementCounter('refresh.lease.busy', { dimension: key });
  return false;
}

/** Drop a refresh lease early — used when the recompute failed. */
export async function releaseRefreshLease(key: string): Promise<void> {
  const redis = await getRedisClient();
  await sendSafe(redis, ['DEL', refreshLeaseKey(key)]);
}
