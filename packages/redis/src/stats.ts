/**
 * Cache telemetry.
 *
 * Design rule: **observability must never sit on the hot path.**
 *
 * The previous implementation issued four Redis commands (`HINCRBY` x2, `LPUSH`,
 * `LTRIM`) on *every single cache read* — including sub-millisecond L1 hits that
 * never touched Redis. On a REST/Upstash deployment that is four billable
 * commands per read, and it inverted the very latency the L1 layer exists to
 * avoid.
 *
 * Metrics are now aggregated into a local ring buffer and flushed as one batch,
 * on an interval or when the buffer fills. Concurrent flush commands are issued
 * together so the TCP client pipelines them onto the single socket and the REST
 * client coalesces them into one `/pipeline` request.
 *
 * Set `REDIS_STATS_DISABLED=true` to keep counters purely in-process.
 */
import { getRedisClient } from './client';

export interface CacheStatsSnapshot {
  xFetchTriggers: number;
  hits: number;
  misses: number;
  l1Hits: number;
  l2Hits: number;
  redisErrors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

type CounterKey = 'hits' | 'misses' | 'l1Hits' | 'l2Hits' | 'redisErrors' | 'xFetchTriggers';

const CACHE_HASH_KEY = 'stats:cache';
const LATENCY_LIST_KEY = 'stats:latencies';
const XFETCH_LATENCY_LIST_KEY = 'stats:xfetch_latencies';

const LATENCY_BUFFER_SIZE = 1000;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 100;
const LATENCY_SAMPLE_MAX = 50;
const COUNTER_FLUSH_THRESHOLD = 500;

type LatencyBuffer = { samples: Float64Array; count: number; head: number };

function createLatencyBuffer(size: number): LatencyBuffer {
  return { samples: new Float64Array(size), count: 0, head: 0 };
}

/** O(1) ring write. Replaces the previous O(n) `Array.prototype.shift`. */
function pushLatency(buffer: LatencyBuffer, value: number): void {
  buffer.samples[buffer.head] = value;
  buffer.head = (buffer.head + 1) % buffer.samples.length;
  if (buffer.count < buffer.samples.length) buffer.count++;
}

function readLatencies(buffer: LatencyBuffer): number[] {
  const out = new Array<number>(buffer.count);
  const start = (buffer.head - buffer.count + buffer.samples.length) % buffer.samples.length;
  for (let i = 0; i < buffer.count; i++) {
    out[i] = buffer.samples[(start + i) % buffer.samples.length] as number;
  }
  return out;
}

function emptyDeltas(): Record<CounterKey, number> {
  return {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    redisErrors: 0,
    xFetchTriggers: 0,
  };
}

interface PendingFlush {
  deltas: Record<CounterKey, number>;
  latencies: number[];
  xFetchLatencies: number[];
}

interface StatsState {
  /** Lifetime local totals. Never decremented except by resetCacheStats. */
  counters: Record<CounterKey, number>;
  latencies: LatencyBuffer;
  xFetchLatencies: LatencyBuffer;
  pending: PendingFlush;
  flushTimer: ReturnType<typeof setInterval> | null;
  flushing: boolean;
  disabled: boolean;
}

function createState(): StatsState {
  return {
    counters: emptyDeltas(),
    latencies: createLatencyBuffer(LATENCY_BUFFER_SIZE),
    xFetchLatencies: createLatencyBuffer(LATENCY_BUFFER_SIZE),
    pending: { deltas: emptyDeltas(), latencies: [], xFetchLatencies: [] },
    flushTimer: null,
    flushing: false,
    disabled: process.env.REDIS_STATS_DISABLED === 'true',
  };
}

// Survive dev-server module reloads without losing counters.
const globalObj = globalThis as unknown as { __repoRedisStats?: StatsState };
const state: StatsState = (globalObj.__repoRedisStats ??= createState());

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function summarize(values: number[]): { avg: number; p95: number } {
  if (values.length === 0) return { avg: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    avg: Math.round(avg * 100) / 100,
    p95: Math.round(computePercentile(sorted, 95) * 100) / 100,
  };
}

/** Snapshot from in-process counters. Used when Redis is unreachable. */
function buildSnapshot(): CacheStatsSnapshot {
  const { avg, p95 } = summarize(readLatencies(state.latencies));
  return {
    hits: state.counters.hits,
    misses: state.counters.misses,
    l1Hits: state.counters.l1Hits,
    l2Hits: state.counters.l2Hits,
    redisErrors: state.counters.redisErrors,
    xFetchTriggers: state.counters.xFetchTriggers,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
  };
}

function ensureFlushTimer(): void {
  if (state.flushTimer || state.disabled) return;
  state.flushTimer = setInterval(() => {
    void flushStats();
  }, FLUSH_INTERVAL_MS);
  // Never hold a serverless invocation or CLI process open for telemetry.
  (state.flushTimer as unknown as { unref?: () => void }).unref?.();
}

function pendingTotal(): number {
  const p = state.pending;
  return (
    Object.values(p.deltas).reduce((sum, v) => sum + v, 0) +
    p.latencies.length +
    p.xFetchLatencies.length
  );
}

function takePending(): PendingFlush | null {
  if (pendingTotal() === 0) return null;
  const snapshot = state.pending;
  state.pending = { deltas: emptyDeltas(), latencies: [], xFetchLatencies: [] };
  return snapshot;
}

function requeue(batch: PendingFlush): void {
  for (const key of Object.keys(batch.deltas) as CounterKey[]) {
    state.pending.deltas[key] += batch.deltas[key];
  }
  state.pending.latencies.push(...batch.latencies);
  state.pending.xFetchLatencies.push(...batch.xFetchLatencies);
}

function maybeFlush(): void {
  ensureFlushTimer();
  if (pendingTotal() >= COUNTER_FLUSH_THRESHOLD) void flushStats();
}

/**
 * Push buffered counters to Redis. Issues every command concurrently so the
 * TCP client pipelines them and the REST client coalesces them into a single
 * `/pipeline` request. Never throws: telemetry must not break requests.
 */
export async function flushStats(): Promise<void> {
  if (state.disabled || state.flushing) return;

  const batch = takePending();
  if (!batch) return;

  state.flushing = true;
  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      requeue(batch);
      return;
    }

    const work: Array<Promise<unknown>> = [];

    for (const [field, delta] of Object.entries(batch.deltas)) {
      if (delta > 0) work.push(redis.hIncrBy(CACHE_HASH_KEY, field, delta));
    }

    // node-redis types RPUSH with a fixed 2-tuple overload; the variadic form is
    // correct at runtime and is what makes the batch a single round-trip.
    const pushAll = redis.rPush as unknown as (key: string, ...values: string[]) => Promise<number>;

    const latencies = batch.latencies.slice(-LATENCY_SAMPLE_MAX);
    if (latencies.length > 0) {
      work.push(pushAll(LATENCY_LIST_KEY, ...latencies.map((v) => v.toString())));
      work.push(redis.lTrim(LATENCY_LIST_KEY, 0, LATENCY_BUFFER_SIZE - 1));
    }

    const xFetch = batch.xFetchLatencies.slice(-LATENCY_SAMPLE_MAX);
    if (xFetch.length > 0) {
      work.push(pushAll(XFETCH_LATENCY_LIST_KEY, ...xFetch.map((v) => v.toString())));
      work.push(redis.lTrim(XFETCH_LATENCY_LIST_KEY, 0, LATENCY_BUFFER_SIZE - 1));
    }

    await Promise.all(work.map((p) => p.catch(() => undefined)));
  } catch {
    // Telemetry is best-effort; drop the batch rather than retry forever.
  } finally {
    state.flushing = false;
  }
}

// -------------------------------------------------------------------------
// Recording API (hot path — allocation-light, no I/O)
// -------------------------------------------------------------------------

export function recordCacheHit(source: 'l1' | 'l2', latencyMs: number): void {
  state.counters.hits++;
  if (source === 'l1') state.counters.l1Hits++;
  else state.counters.l2Hits++;
  pushLatency(state.latencies, latencyMs);

  state.pending.deltas.hits++;
  state.pending.deltas[source === 'l1' ? 'l1Hits' : 'l2Hits']++;
  state.pending.latencies.push(latencyMs);

  maybeFlush();
}

export function recordCacheMiss(latencyMs: number): void {
  state.counters.misses++;
  pushLatency(state.latencies, latencyMs);

  state.pending.deltas.misses++;
  state.pending.latencies.push(latencyMs);

  maybeFlush();
}

export function recordRedisError(): void {
  state.counters.redisErrors++;
  state.pending.deltas.redisErrors++;
  maybeFlush();
}

export function recordXFetchTrigger(latencyMs: number): void {
  state.counters.xFetchTriggers++;
  state.pending.deltas.xFetchTriggers++;
  pushLatency(state.xFetchLatencies, latencyMs);
  state.pending.xFetchLatencies.push(latencyMs);
  maybeFlush();
}

export async function getCacheStats(): Promise<CacheStatsSnapshot> {
  // Fold anything still buffered down before reading the distributed totals.
  await flushStats().catch(() => undefined);

  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      const data = await redis.hGetAll(CACHE_HASH_KEY);
      const latencyStrs = await redis.lRange(LATENCY_LIST_KEY, 0, LATENCY_BUFFER_SIZE - 1);
      const { avg, p95 } = summarize(latencyStrs.map(Number).filter((v) => !Number.isNaN(v)));
      const read = (field: string) => Number.parseInt(data[field] || '0', 10) || 0;

      return {
        hits: read('hits'),
        misses: read('misses'),
        l1Hits: read('l1Hits'),
        l2Hits: read('l2Hits'),
        redisErrors: read('redisErrors'),
        avgLatencyMs: avg,
        p95LatencyMs: p95,
        xFetchTriggers: read('xFetchTriggers'),
      };
    }
  } catch {
    // Fall through to the in-process snapshot.
  }
  return buildSnapshot();
}

export function resetCacheStats(): void {
  state.counters = emptyDeltas();
  state.latencies = createLatencyBuffer(LATENCY_BUFFER_SIZE);
  state.xFetchLatencies = createLatencyBuffer(LATENCY_BUFFER_SIZE);
  state.pending = { deltas: emptyDeltas(), latencies: [], xFetchLatencies: [] };

  void getRedisClient()
    .then((redis) => {
      if (redis?.isOpen) {
        redis.del(CACHE_HASH_KEY).catch(() => {});
        redis.del(LATENCY_LIST_KEY).catch(() => {});
        redis.del(XFETCH_LATENCY_LIST_KEY).catch(() => {});
      }
    })
    .catch(() => {});
}

// -------------------------------------------------------------------------
// Durable Stats Persistence (survives restarts via Redis snapshot key + optional Supabase sink)
// -------------------------------------------------------------------------

const SNAPSHOT_REDIS_KEY = 'stats:cache:snapshot:v1';
const SNAPSHOT_TTL_SECONDS = 86400;

type StatsPersistenceSink = (snapshot: CacheStatsSnapshot) => Promise<void>;
let externalPersistenceSink: StatsPersistenceSink | null = null;

/**
 * Register an external durable sink (e.g. Supabase table writer) to persist
 * periodic CacheStatsSnapshots across container/Redis restarts.
 */
export function registerStatsPersistenceSink(sink: StatsPersistenceSink | null): void {
  externalPersistenceSink = sink;
}

/**
 * Compute the current CacheStatsSnapshot, persist it to Redis with a 24h TTL
 * and to any registered Supabase/Postgres sink, and return the snapshot.
 */
export async function persistCacheStatsSnapshot(): Promise<CacheStatsSnapshot> {
  const snapshot = await getCacheStats();
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      await redis.setEx(
        SNAPSHOT_REDIS_KEY,
        SNAPSHOT_TTL_SECONDS,
        JSON.stringify({ ...snapshot, persistedAt: new Date().toISOString() })
      );
    }
  } catch {
    // Best-effort Redis snapshot persistence
  }

  if (externalPersistenceSink) {
    try {
      await externalPersistenceSink(snapshot);
    } catch {
      // Best-effort external persistence
    }
  }
  return snapshot;
}
