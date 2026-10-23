/**
 * Real-time analytics: counters, uniques, distributions and leaderboards.
 *
 * These are the primitives the portal needs for live operational numbers
 * (events per minute, distinct rigs today, worst offenders) without pressing
 * Postgres on every request. Two properties matter and are enforced here:
 *
 *  - **Atomic.** Every write is a single Redis command or a Lua script, so
 *    concurrent instances cannot lose increments to each other — the failure
 *    mode of the previous GET -> parse -> SET paths.
 *  - **Self-limiting.** Each key is bucketed by time window and given a TTL, so
 *    counters expire instead of accumulating forever in a 256 MB instance
 *    configured with `allkeys-lru`, where an unpinned counter would be the
 *    first thing evicted.
 */

import { getRedisClient } from './client';
import {
  asNumber,
  asScoredMembers,
  RedisCommandError,
  type ScoredMember,
  send,
  sendSafe,
} from './raw';

const METRIC_PREFIX = 'arch:metrics';
const MS_PER_SECOND = 1000;
/** Never let a mis-sized TTL create a key that outlives its reporting window. */
const MIN_TTL_SECONDS = 60;
const MAX_COUNTER_WINDOWS = 500;
const MAX_UNIQUE_WINDOWS = 90;
const MAX_LEADERBOARD_LIMIT = 100;
const DEFAULT_LEADERBOARD_LIMIT = 10;

export type CounterGranularity = 'minute' | 'hour' | 'day';

const GRANULARITY_MS: Record<CounterGranularity, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

/** How many buckets a key survives: enough history to render a chart, not a ledger. */
const BUCKET_RETENTION: Record<CounterGranularity, number> = {
  minute: 120,
  hour: 72,
  day: 180,
};

export interface MetricOptions {
  /** Second axis for the same metric (pit id, department, route path). */
  dimension?: string;
  /** Increment size. Defaults to 1. */
  by?: number;
  /** Bucket width. Defaults to `minute`. */
  granularity?: CounterGranularity;
}

/**
 * INCR + TTL in one script. A crash between the two previously left counters
 * with no expiry, which both leaked memory and (for rate limits) blocked an
 * identifier permanently.
 */
const INCR_WITH_TTL_SCRIPT = `
local total = redis.call('INCRBY', KEYS[1], ARGV[1])
if tonumber(ARGV[1]) > 0 and redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return { total, redis.call('PTTL', KEYS[1]) }
`;

/**
 * Count / sum / max for a latency-style metric, updated in one round-trip so
 * concurrent writers cannot interleave a partial sample.
 */
const RECORD_SAMPLE_SCRIPT = `
local count = redis.call('HINCRBY', KEYS[1], 'count', 1)
local sum = redis.call('HINCRBYFLOAT', KEYS[1], 'sum', ARGV[1])
local current = tonumber(redis.call('HGET', KEYS[1], 'max') or '0')
if tonumber(ARGV[1]) > current then
  redis.call('HSET', KEYS[1], 'max', ARGV[1])
  current = tonumber(ARGV[1])
end
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return { count, sum, current }
`;

/**
 * Redis key names must not contain the separator we use to read them back, so a
 * dimension (a path, a slug, a UUID) is escaped rather than interpolated raw.
 */
function encodeDimension(dimension?: string): string {
  if (!dimension) return '';
  return `:${encodeURIComponent(dimension).replace(/:/g, '%3A')}`;
}

function bucketIndex(granularity: CounterGranularity, at: number): number {
  return Math.floor(at / GRANULARITY_MS[granularity]);
}

function bucketTtlSeconds(granularity: CounterGranularity): number {
  return Math.ceil((GRANULARITY_MS[granularity] * BUCKET_RETENTION[granularity]) / MS_PER_SECOND);
}

/** `at` is part of the options so the key builder stays within two parameters. */
type BucketedOptions = MetricOptions & { at?: number };

function counterKey(name: string, options?: BucketedOptions): string {
  const granularity = options?.granularity ?? 'minute';
  const bucket = `${granularity[0]}${bucketIndex(granularity, options?.at ?? Date.now())}`;
  // Dimension before the bucket: `arch:metrics:ctr:<name><dimension>:<bucket>`
  return `${METRIC_PREFIX}:ctr:${name}${encodeDimension(options?.dimension)}:${bucket}`;
}

/**
 * Add to a named counter. Returns the value of the bucket after the increment,
 * or 0 when Redis is unreachable — analytics must never fail a request.
 */
export async function incrementCounter(
  name: string,
  options?: MetricOptions & { by?: number }
): Promise<number> {
  const by = options?.by ?? 1;
  const granularity = options?.granularity ?? 'minute';
  const redis = await getRedisClient();
  const key = counterKey(name, options);
  const retainMs = GRANULARITY_MS[granularity] * BUCKET_RETENTION[granularity];

  try {
    const reply = await send(redis, ['EVAL', INCR_WITH_TTL_SCRIPT, 1, key, by, retainMs]);
    if (Array.isArray(reply)) return asNumber(reply[0]);
    return asNumber(reply);
  } catch (error) {
    if (!(error instanceof RedisCommandError)) return 0;
    // Transport without EVAL support: INCRBY then a best-effort expiry.
    const total = asNumber(await sendSafe(redis, ['INCRBY', key, by]));
    if (total === by) await sendSafe(redis, ['EXPIRE', key, bucketTtlSeconds(granularity)]);
    return total;
  }
}

/**
 * Read a counter over the trailing `windows` buckets.
 *
 * Buckets are read in parallel; on the REST transport they coalesce into one
 * pipelined round-trip, on TCP they multiplex over the single socket.
 */
export async function readCounter(
  name: string,
  options?: MetricOptions & { windows?: number }
): Promise<number> {
  const granularity = options?.granularity ?? 'minute';
  const windows = Math.min(MAX_COUNTER_WINDOWS, Math.max(1, options?.windows ?? 1));
  const redis = await getRedisClient();
  const now = Date.now();

  const reads = Array.from({ length: windows }, (_, index) =>
    sendSafe(redis, [
      'GET',
      counterKey(name, { ...options, at: now - index * GRANULARITY_MS[granularity] }),
    ])
  );

  const values = await Promise.all(reads);
  return values.reduce<number>((total, value) => total + asNumber(value), 0);
}

function sampleKey(name: string, dimension?: string): string {
  return `${METRIC_PREFIX}:sample:${name}${encodeDimension(dimension)}`;
}

export interface SampleSummary {
  count: number;
  sum: number;
  max: number | null;
  average: number | null;
}

export interface SampleInput {
  name: string;
  value: number;
  dimension?: string;
  ttlSeconds?: number;
}

/**
 * Record one observation (latency, tonnage, hours) and keep count/sum/max so an
 * average can be read without storing the samples themselves.
 */
export async function recordSample(input: SampleInput): Promise<SampleSummary | null> {
  if (!Number.isFinite(input.value)) return null;
  const redis = await getRedisClient();
  const key = sampleKey(input.name, input.dimension);
  const ttlSeconds = Math.max(MIN_TTL_SECONDS, input.ttlSeconds ?? bucketTtlSeconds('hour'));

  try {
    const reply = await send(redis, [
      'EVAL',
      RECORD_SAMPLE_SCRIPT,
      1,
      key,
      input.value,
      ttlSeconds,
    ]);
    if (Array.isArray(reply)) {
      const count = asNumber(reply[0]);
      const sum = asNumber(reply[1]);
      return { count, sum, max: asNumber(reply[2]), average: count > 0 ? sum / count : null };
    }
  } catch {
    // No EVAL: count and sum stay exact, max is dropped rather than guessed at.
    const [count] = await Promise.all([
      sendSafe(redis, ['HINCRBY', key, 'count', 1]),
      sendSafe(redis, ['HINCRBYFLOAT', key, 'sum', input.value]),
      sendSafe(redis, ['EXPIRE', key, ttlSeconds]),
    ]);
    const resolved = asNumber(count);
    if (resolved > 0) {
      return { count: resolved, sum: input.value, max: null, average: null };
    }
  }
  return null;
}

/** Read the accumulated count/sum/max for a sample metric. */
export async function readSample(
  name: string,
  options?: { dimension?: string }
): Promise<SampleSummary> {
  const redis = await getRedisClient();
  const reply = await sendSafe(redis, [
    'HMGET',
    sampleKey(name, options?.dimension),
    'count',
    'sum',
    'max',
  ]);

  const fields = Array.isArray(reply) ? reply : [];
  const count = asNumber(fields[0]);
  const sum = asNumber(fields[1]);
  const max = fields[2] === null || fields[2] === undefined ? null : asNumber(fields[2]);
  return { count, sum, max, average: count > 0 ? sum / count : null };
}

function hllKey(name: string, options?: BucketedOptions): string {
  const granularity = options?.granularity ?? 'day';
  const bucket = `${granularity[0]}${bucketIndex(granularity, options?.at ?? Date.now())}`;
  return `${METRIC_PREFIX}:hll:${name}${encodeDimension(options?.dimension)}:${bucket}`;
}

export interface UniqueInput {
  name: string;
  /** Rig id, employee id, IP — anything whose distinct count matters. */
  identifier: string;
  dimension?: string;
  granularity?: CounterGranularity;
}

/**
 * Mark an identifier as seen for cardinality estimates. Returns true when the
 * identifier was new to this window.
 */
export async function addUnique(input: UniqueInput): Promise<boolean> {
  const redis = await getRedisClient();
  const key = hllKey(input.name, input);
  const added = await sendSafe(redis, ['PFADD', key, input.identifier]);
  if (added === null) return false;
  // PFADD returns 1 only for a previously unseen element.
  if (asNumber(added) === 1) {
    await sendSafe(redis, ['EXPIRE', key, bucketTtlSeconds(input.granularity ?? 'day')]);
    return true;
  }
  return false;
}

/**
 * Approximate distinct count across the trailing windows. HyperLogLog merges
 * buckets exactly, so a per-day sum is never double-counted.
 */
export async function estimateUnique(
  name: string,
  options?: { dimension?: string; granularity?: CounterGranularity; windows?: number }
): Promise<number> {
  const granularity = options?.granularity ?? 'day';
  const windows = Math.min(MAX_UNIQUE_WINDOWS, Math.max(1, options?.windows ?? 1));
  const redis = await getRedisClient();
  const now = Date.now();

  const keys = Array.from({ length: windows }, (_, index) =>
    hllKey(name, { ...options, at: now - index * GRANULARITY_MS[granularity] })
  );

  return asNumber(await sendSafe(redis, ['PFCOUNT', ...keys]));
}

function leaderboardKey(name: string, dimension?: string): string {
  return `${METRIC_PREFIX}:rank:${name}${encodeDimension(dimension)}`;
}

export interface LeaderboardScoreInput {
  name: string;
  member: string;
  score: number;
  dimension?: string;
  ttlSeconds?: number;
}

/**
 * Score a member on a leaderboard (slowest route, heaviest load, most delays).
 * Ties are broken by Redis on member name, and the whole ranking expires with
 * the window so a stale offender stops being reported forever.
 */
export async function addToLeaderboard(input: LeaderboardScoreInput): Promise<number> {
  const redis = await getRedisClient();
  const key = leaderboardKey(input.name, input.dimension);
  const next = asNumber(await sendSafe(redis, ['ZINCRBY', key, input.score, input.member]));
  await sendSafe(redis, [
    'EXPIRE',
    key,
    Math.max(MIN_TTL_SECONDS, input.ttlSeconds ?? bucketTtlSeconds('day')),
  ]);
  return next;
}

export interface LeaderboardOptions {
  dimension?: string;
  limit?: number;
  /** Lowest scores first (use for latency where smaller is better). */
  ascending?: boolean;
  /** Strip score suffixes so member labels render directly. */
  withScores?: boolean;
}

/** Read the top (or bottom) of a leaderboard. */
export async function leaderboardTop(
  name: string,
  options?: LeaderboardOptions
): Promise<ScoredMember[]> {
  const redis = await getRedisClient();
  const limit = Math.min(
    MAX_LEADERBOARD_LIMIT,
    Math.max(1, options?.limit ?? DEFAULT_LEADERBOARD_LIMIT)
  );
  const range = options?.ascending
    ? ['ZRANGE', leaderboardKey(name, options?.dimension), 0, limit - 1, 'WITHSCORES']
    : ['ZREVRANGE', leaderboardKey(name, options?.dimension), 0, limit - 1, 'WITHSCORES'];

  const reply = await sendSafe(redis, range);
  return asScoredMembers(reply);
}

/**
 * Atomic read-modify-write counter for callers that need the value and its
 * reset time (lockout windows, per-identifier limits) rather than a bucketed
 * analytics counter.
 */
export async function incrWithExpire(
  key: string,
  options: { by?: number; ttlMs: number }
): Promise<{ value: number; resetMs: number }> {
  const by = options.by ?? 1;
  const ttlMs = Math.max(1, options.ttlMs);
  const redis = await getRedisClient();

  try {
    const reply = await send(redis, ['EVAL', INCR_WITH_TTL_SCRIPT, 1, key, by, ttlMs]);
    if (Array.isArray(reply)) {
      return { value: asNumber(reply[0]), resetMs: Math.max(0, asNumber(reply[1])) };
    }
  } catch {
    // fall through
  }

  const value = asNumber(await sendSafe(redis, ['INCRBY', key, by]));
  if (value === by) await sendSafe(redis, ['PEXPIRE', key, ttlMs]);
  return { value, resetMs: ttlMs };
}

/** Current value of an arbitrary counter key (no increment). */
export async function readKeyCounter(key: string): Promise<number> {
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['GET', key]));
}

/** Forget a metric entirely — used by tests and by operator resets. */
export async function resetMetric(name: string, options?: { dimension?: string }): Promise<void> {
  const redis = await getRedisClient();
  await Promise.all([
    sendSafe(redis, ['DEL', sampleKey(name, options?.dimension)]),
    sendSafe(redis, ['DEL', leaderboardKey(name, options?.dimension)]),
  ]);
}
