/**
 * @jest-environment node
 *
 * Real-server coverage for the coordination primitives in `@repo/redis`.
 *
 * The unit suites mock the transport, so they prove which command was issued
 * but not that Redis honours it — and the interesting failure modes here
 * (a lock released by the wrong owner, a claim that never resolves, a stream
 * entry silently lost) only exist on a real server. These tests use the TCP
 * client and are skipped unless `REDIS_INTEGRATION=1`:
 *
 *   docker run -d --name arch-redis-it -p 6379:6379 redis:7.4-alpine
 *   REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration
 *
 * Every key carries a per-run token and is unlinked on the way out, so a shared
 * Redis is never left holding test state.
 */
import {
  addToLeaderboard,
  addUnique,
  estimateUnique,
  incrementCounter,
  incrWithExpire,
  leaderboardTop,
  readCounter,
  readKeyCounter,
  readSample,
  recordSample,
} from '../../src/analytics';
import {
  cacheDelete,
  cacheGet,
  cacheInvalidateTags,
  cacheSetWithTags,
  clearMemoryCache,
} from '../../src/cache';
import { closeRedis, getRedisClient } from '../../src/client';
import {
  abandonIdempotency,
  acquireLock,
  claimIdempotency,
  completeIdempotency,
  type LockHandle,
  LockUnavailableError,
  lockTtl,
  readIdempotencyResult,
  releaseLock,
  renewLock,
  tryWithLock,
  withLock,
} from '../../src/locks';
import { currentTransport, detectCapabilities, resetCapabilityCache, send } from '../../src/raw';
import {
  dropVectorIndex,
  ensureVectorIndex,
  searchAvailability,
  searchVectors,
  upsertVector,
  type VectorIndexSpec,
  vectorIndexStats,
} from '../../src/search';
import {
  bumpPrivilegeVersion,
  type EmployeeRecord,
  employeeCacheKey,
  readSession,
  sessionTtl,
  touchSession,
  writeSession,
} from '../../src/session';
import {
  acknowledge,
  appendToStream,
  claimIdle,
  consumeStream,
  ensureConsumerGroup,
  moveToDeadLetter,
  readFromGroup,
  readPending,
  readStream,
  streamLength,
} from '../../src/streams';

const ENABLED = process.env.REDIS_INTEGRATION === '1';
const describeIntegration = ENABLED ? describe : describe.skip;

/** Namespaces every key this suite touches. */
const RUN = `it-${process.pid}-${Date.now().toString(36)}`;

const CLEANUP_PATTERNS = [
  `arch:lock:${RUN}*`,
  `arch:idem:${RUN}*`,
  `arch:auth:*${RUN}*`,
  `arch:metrics:*${RUN}*`,
  `arch:stream:${RUN}*`,
  `arch:test:${RUN}*`,
  `arch:vector:${RUN}*`,
];

jest.setTimeout(30_000);

type RedisClient = Awaited<ReturnType<typeof getRedisClient>>;

let client: RedisClient;

const employee: EmployeeRecord = {
  id: `emp-${RUN}`,
  role: 'operator',
  department_id: 'drilling',
  accessible_departments: ['drilling', 'control-room'],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SCAN + UNLINK: non-blocking, and `KEYS` is forbidden on a shared instance. */
async function purge(pattern: string): Promise<void> {
  const keys: string[] = [];
  for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    keys.push(key);
    if (keys.length >= 100) {
      await client.unlink(keys);
      keys.length = 0;
    }
  }
  if (keys.length > 0) await client.unlink(keys);
}

/** A handle that does not own the lock, for the "wrong owner" assertions. */
function impostor(handle: LockHandle): LockHandle {
  return { ...handle, token: `not-${handle.token}` };
}

describeIntegration('@repo/redis against a real server', () => {
  beforeAll(async () => {
    client = await getRedisClient();
    await client.ping();
    clearMemoryCache();
    resetCapabilityCache();
  });

  afterAll(async () => {
    for (const pattern of CLEANUP_PATTERNS) {
      await purge(pattern);
    }
    clearMemoryCache();
    await closeRedis();
  });

  describe('capabilities', () => {
    it('reports the TCP transport and the scripting features it implies', async () => {
      const capabilities = await detectCapabilities();

      expect(currentTransport()).toBe('tcp');
      expect(capabilities.transport).toBe('tcp');
      expect(capabilities.eval).toBe(true);
    });
  });

  describe('distributed locks', () => {
    it('grants one holder and rejects the other until it releases', async () => {
      const name = `${RUN}:shift-close`;

      const first = await acquireLock(name, { ttlMs: 5_000 });
      expect(first).not.toBeNull();
      expect(await acquireLock(name, { ttlMs: 5_000 })).toBeNull();
      expect(await lockTtl(name)).toBeGreaterThan(0);

      expect(await releaseLock(first!)).toBe(true);
      const second = await acquireLock(name, { ttlMs: 5_000 });
      expect(second).not.toBeNull();
      await releaseLock(second!);
    });

    it('refuses release and renewal from a handle that does not own the lock', async () => {
      const name = `${RUN}:ownership`;
      const owned = (await acquireLock(name, { ttlMs: 5_000 }))!;
      const other = impostor(owned);

      expect(await renewLock(other, 60_000)).toBe(false);
      expect(await releaseLock(other)).toBe(false);
      expect(await lockTtl(name)).toBeGreaterThan(0);

      expect(await renewLock(owned, 60_000)).toBe(true);
      expect(await releaseLock(owned)).toBe(true);
    });

    it('releases by TTL when the holder dies mid-work', async () => {
      const name = `${RUN}:crashed-holder`;
      const held = (await acquireLock(name, { ttlMs: 300 }))!;

      await sleep(450);

      expect(await lockTtl(name)).toBe(-2);
      expect(await releaseLock(held)).toBe(false);
      const recovered = await acquireLock(name, { ttlMs: 5_000 });
      expect(recovered).not.toBeNull();
      await releaseLock(recovered!);
    });

    it('hands out fencing tokens that never go backwards', async () => {
      const name = `${RUN}:fenced`;
      const tokens: number[] = [];

      for (let attempt = 0; attempt < 3; attempt++) {
        const handle = (await acquireLock(name, { ttlMs: 5_000, fencing: true }))!;
        tokens.push(handle.fencingToken!);
        expect(await send(client, ['GET', handle.key])).toContain(`|${handle.fencingToken}`);
        await releaseLock(handle);
      }

      expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
      expect(new Set(tokens).size).toBe(tokens.length);
    });

    it('keeps ownership past the original TTL when autoRenew is on', async () => {
      const name = `${RUN}:renewing`;
      const seen: Array<{ at: number; contended: boolean }> = [];

      const result = await withLock({ name, ttlMs: 2_000, autoRenew: true }, async () => {
        // The renewer fires at one second, so by 1.2s the lock outlives the
        // TTL it was acquired with — the only way a second holder can be
        // rejected at 2.2s is if the renewal actually happened.
        await sleep(1_200);
        const rival = await acquireLock(name, { ttlMs: 1_000 });
        seen.push({ at: Date.now(), contended: rival === null });
        if (rival) await releaseLock(rival);
        await sleep(1_300);
        return 'done';
      });

      expect(result).toBe('done');
      expect(seen).toEqual([{ at: expect.any(Number), contended: true }]);
      expect(await lockTtl(name)).toBe(-2);
    });

    it('throws on contention under withLock and returns null under tryWithLock', async () => {
      const name = `${RUN}:contended`;
      const held = (await acquireLock(name, { ttlMs: 5_000 }))!;

      await expect(withLock({ name }, async () => 'ran')).rejects.toBeInstanceOf(
        LockUnavailableError
      );
      expect(await tryWithLock({ name }, async () => 'ran')).toBeNull();

      await releaseLock(held);
      expect(await tryWithLock({ name }, async () => 'ran')).toBe('ran');
    });

    it('runs exactly one of many concurrent guarded writers', async () => {
      const name = `${RUN}:single-writer`;
      let writers = 0;

      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () =>
          tryWithLock({ name, ttlMs: 5_000 }, async () => {
            writers++;
            await sleep(20);
            return writers;
          })
        )
      );

      // Each attempt waits for nothing: contention is a miss, not a queue.
      expect(outcomes.filter((value) => value !== null)).toHaveLength(1);
    });
  });

  describe('idempotency', () => {
    it('distinguishes a fresh claim from in-flight work and a completed replay', async () => {
      const key = `${RUN}:closeout-1`;

      expect(await claimIdempotency(key)).toBe('new');
      expect(await claimIdempotency(key)).toBe('in-flight');

      await completeIdempotency({ key, result: { shiftStatusId: 7 }, ttlSeconds: 60 });
      expect(await claimIdempotency(key)).toBe('duplicate');
      expect(await readIdempotencyResult<{ shiftStatusId: number }>(key)).toEqual({
        shiftStatusId: 7,
      });

      await abandonIdempotency(key);
      expect(await claimIdempotency(key)).toBe('new');
      await abandonIdempotency(key);
    });

    it('lets only one of several concurrent replays do the work', async () => {
      const key = `${RUN}:closeout-2`;
      let executions = 0;

      const claims = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const claim = await claimIdempotency(key);
          if (claim === 'new') executions++;
          return claim;
        })
      );

      expect(claims.filter((claim) => claim === 'new')).toHaveLength(1);
      expect(claims.filter((claim) => claim === 'in-flight')).toHaveLength(5);
      expect(executions).toBe(1);

      await abandonIdempotency(key);
    });
  });

  describe('sessions', () => {
    it('writes, reads and expires a session record', async () => {
      const userId = `user-${RUN}-plain`;

      await writeSession({ userId, employee });

      expect(await readSession(userId)).toEqual(employee);
      expect(await sessionTtl(userId)).toBeGreaterThan(0);
      expect(await touchSession(userId, { force: true })).toBe(true);

      // Both tiers must go: `readSession` serves L1 first, so deleting only the
      // Redis key would still return the record from this process's memory.
      await cacheDelete(employeeCacheKey(userId));
      expect(await readSession(userId)).toBeNull();
      expect(await touchSession(userId, { force: true })).toBe(false);
    });

    it('revokes every cached copy with a single privilege bump', async () => {
      const userId = `user-${RUN}-fenced`;

      await writeSession({ userId, employee });
      await writeSession({ userId, sessionId: 'phone', employee });
      expect(await readSession(userId, { sessionId: 'phone' })).toEqual(employee);

      const version = await bumpPrivilegeVersion(userId);
      expect(version).toBeGreaterThan(0);

      // The records are still bytes in Redis; the version check is what rejects
      // them, which is why revocation works on transports without Pub/Sub.
      expect(await client.exists('arch:auth:privilege:' + userId)).toBe(1);
      expect(await readSession(userId)).toBeNull();

      await writeSession({ userId, employee: { ...employee, role: 'admin' } });
      expect(await readSession(userId)).toEqual({ ...employee, role: 'admin' });
    });

    it('keeps concurrent sessions independent', async () => {
      const userId = `user-${RUN}-multi`;

      await writeSession({ userId, sessionId: 'desktop', employee });
      await writeSession({ userId, sessionId: 'phone', employee: { ...employee, role: 'viewer' } });

      expect(await readSession(userId, { sessionId: 'desktop' })).toEqual(employee);
      expect(await readSession(userId, { sessionId: 'phone' })).toEqual({
        ...employee,
        role: 'viewer',
      });

      await bumpPrivilegeVersion(userId);
      expect(await readSession(userId, { sessionId: 'desktop' })).toBeNull();
    });
  });

  describe('analytics', () => {
    it('never loses a concurrent increment', async () => {
      const name = `${RUN}.ingest`;

      await Promise.all(
        Array.from({ length: 25 }, () => incrementCounter(name, { by: 4, granularity: 'minute' }))
      );

      expect(await readCounter(name, { windows: 3 })).toBe(100);
    });

    it('separates dimensions instead of blending them', async () => {
      const name = `${RUN}.routes`;

      await Promise.all([
        incrementCounter(name, { dimension: '/overview' }),
        incrementCounter(name, { dimension: '/admin' }),
        incrementCounter(name, { dimension: '/admin' }),
      ]);

      expect(await readCounter(name, { dimension: '/admin', windows: 3 })).toBe(2);
      expect(await readCounter(name, { dimension: '/overview', windows: 3 })).toBe(1);
    });

    it('aggregates count, sum and max without storing samples', async () => {
      const name = `${RUN}.latency`;

      await recordSample({ name, value: 120 });
      await recordSample({ name, value: 40 });
      await recordSample({ name, value: 200 });
      expect(await recordSample({ name, value: Number.NaN })).toBeNull();

      expect(await readSample(name)).toEqual({
        count: 3,
        sum: 360,
        max: 200,
        average: 120,
      });
    });

    it('counts distinct identifiers exactly at this cardinality', async () => {
      const name = `${RUN}.rigs`;

      const first = await addUnique({ name, identifier: 'rig-1' });
      const repeat = await addUnique({ name, identifier: 'rig-1' });
      await addUnique({ name, identifier: 'rig-2' });

      expect(first).toBe(true);
      expect(repeat).toBe(false);
      expect(await estimateUnique(name)).toBe(2);
    });

    it('ranks members and can read the bottom of the board', async () => {
      const name = `${RUN}.delays`;

      await addToLeaderboard({ name, member: 'conveyor-3', score: 40 });
      await addToLeaderboard({ name, member: 'conveyor-3', score: 30 });
      await addToLeaderboard({ name, member: 'crusher-1', score: 25 });
      await addToLeaderboard({ name, member: 'shovel-2', score: 60 });

      expect(await leaderboardTop(name, { limit: 2 })).toEqual([
        { member: 'conveyor-3', score: 70 },
        { member: 'shovel-2', score: 60 },
      ]);
      expect(await leaderboardTop(name, { ascending: true, limit: 1 })).toEqual([
        { member: 'crusher-1', score: 25 },
      ]);
    });

    it('sets the TTL on the very first increment of a lockout counter', async () => {
      const key = `arch:test:${RUN}:pin`;

      expect(await incrWithExpire(key, { ttlMs: 30_000 })).toMatchObject({ value: 1 });
      expect(await send(client, ['TTL', key])).toBeGreaterThan(0);
      expect((await incrWithExpire(key, { by: 2, ttlMs: 30_000 })).value).toBe(3);
      expect(await readKeyCounter(key)).toBe(3);
    });
  });

  describe('streams', () => {
    const key = `arch:stream:${RUN}:events`;
    const deadKey = `${key}:dead`;
    const group = 'workers';

    beforeEach(async () => {
      await client.del([key, deadKey]);
      clearMemoryCache();
    });

    it('appends trimmed entries that can be read back in order', async () => {
      for (let index = 0; index < 12; index++) {
        // `approx: false`: a rough trim is fine for telemetry but would leave
        // all 12 entries in a stream this small, so the cap could not be tested.
        await appendToStream({
          key,
          fields: { index: String(index), payload: `value-${index}` },
          maxLen: 5,
          approx: false,
        });
      }

      expect(await streamLength(key)).toBe(5);
      const entries = await readStream(key);
      expect(entries.map((entry) => entry.fields.index)).toEqual(['7', '8', '9', '10', '11']);
      expect(entries.every((entry) => /^\d+-\d+$/.test(entry.id))).toBe(true);
    });

    it('creates a group once and splits new work across consumers', async () => {
      expect(await ensureConsumerGroup({ key, group })).toBe(true);
      expect(await ensureConsumerGroup({ key, group })).toBe(false);

      for (let index = 0; index < 6; index++) {
        await appendToStream({ key, fields: { index: String(index) } });
      }

      const handled: string[] = [];
      const results = await Promise.all([
        consumeStream(
          { key, group, consumer: 'worker-a', count: 10, idleMs: 60_000 },
          async (entry) => {
            handled.push(entry.fields.index!);
          }
        ),
        consumeStream(
          { key, group, consumer: 'worker-b', count: 10, idleMs: 60_000 },
          async (entry) => {
            handled.push(entry.fields.index!);
          }
        ),
      ]);

      const totals = results.reduce(
        (acc, value) => ({
          processed: acc.processed + value.processed,
          failed: acc.failed + value.failed,
          dead: acc.dead + value.dead,
        }),
        { processed: 0, failed: 0, dead: 0 }
      );

      expect(totals).toEqual({ processed: 6, failed: 0, dead: 0 });
      expect(handled.sort()).toEqual(['0', '1', '2', '3', '4', '5']);
      expect(await readPending({ key, group })).toEqual([]);
    });

    it('keeps an unacknowledged entry pending until another consumer claims it', async () => {
      await ensureConsumerGroup({ key, group });
      const id = (await appendToStream({ key, fields: { action: 'slow' } }))!;

      const claimed = await readFromGroup({ key, group, consumer: 'slow-worker', count: 1 });
      expect(claimed.map((entry) => entry.id)).toEqual([id]);

      const pending = await readPending({ key, group });
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({ id, consumer: 'slow-worker', deliveries: 1 });

      const rescued = await claimIdle({ key, group, consumer: 'rescuer', idleMs: 0, count: 10 });
      expect(rescued.entries.map((entry) => entry.id)).toEqual([id]);
      expect((await readPending({ key, group }))[0]).toMatchObject({
        consumer: 'rescuer',
        deliveries: 2,
      });

      expect(await acknowledge({ key, group, ids: [id] })).toBe(1);
      expect(await readPending({ key, group })).toEqual([]);
    });

    it('dead-letters a poison entry and clears it from the pending list', async () => {
      await ensureConsumerGroup({ key, group });
      const id = (await appendToStream({ key, fields: { action: 'poison' } }))!;
      const [entry] = await readFromGroup({ key, group, consumer: 'worker-a', count: 1 });

      const movedId = await moveToDeadLetter({
        key,
        group,
        entry: entry!,
        destination: deadKey,
        reason: 'handler rejected it',
      });

      expect(movedId).toBeTruthy();
      expect(await readPending({ key, group })).toEqual([]);
      expect((await readStream(deadKey))[0].fields).toMatchObject({
        action: 'poison',
        _source: key,
        _sourceId: id,
        _reason: 'handler rejected it',
      });
    });

    it('reports handler failures without losing the entry', async () => {
      await ensureConsumerGroup({ key, group });
      await appendToStream({ key, fields: { action: 'boom' } });

      const outcome = await consumeStream(
        { key, group, consumer: 'failing-worker', maxDeliveries: 3 },
        async () => {
          throw new Error('handler exploded');
        }
      );

      expect(outcome).toEqual({ processed: 0, failed: 1, dead: 0 });
      // Still pending, so another pass (or another instance) can retry it.
      expect(await readPending({ key, group })).toHaveLength(1);
    });
  });

  describe('cache invalidation', () => {
    it('drops tagged entries from both tiers', async () => {
      const tag = `${RUN}-dept-7`;
      const cacheKey = `arch:test:${RUN}:tagged`;

      await cacheSetWithTags(cacheKey, { tonnage: 42 }, 60, [tag]);
      expect(await cacheGet<{ tonnage: number }>(cacheKey)).toEqual({ tonnage: 42 });
      expect(await client.exists(cacheKey)).toBe(1);

      expect(await cacheInvalidateTags([tag])).toBe(1);

      expect(await cacheGet(cacheKey)).toBeNull();
      expect(await client.exists(cacheKey)).toBe(0);
      expect(await client.exists(`arch:__tags__:${tag}`)).toBe(0);
    });
  });

  describe('vector search', () => {
    const spec: VectorIndexSpec = {
      indexName: `arch:vector:${RUN}:documents`,
      keyPrefix: `arch:vector:${RUN}:doc:`,
      vectorField: 'embedding',
      dimension: 4,
      algorithm: 'FLAT',
      textFields: ['content'],
    };

    it('states plainly whether the search module is usable here', async () => {
      const availability = await searchAvailability();

      if (!availability.available) {
        // redis:7.4-alpine in CI ships without RediSearch: the reason must be
        // reported so the caller can fall back to pgvector rather than assume
        // the index is broken.
        expect(['no-search-module', 'serverless-rest', 'unreachable']).toContain(
          availability.reason
        );
        return;
      }
      expect(availability.available).toBe(true);
    });

    it('indexes documents and answers a k-NN query when RediSearch is present', async () => {
      if (!(await searchAvailability()).available) return;

      expect(await ensureVectorIndex(spec)).toBe(true);
      expect(await ensureVectorIndex(spec)).toBe(true);

      await upsertVector({ spec, id: 'runway', vector: new Float32Array([1, 0, 0, 0]) });
      await upsertVector({ spec, id: 'blast', vector: new Float32Array([0, 1, 0, 0]) });
      await upsertVector({
        spec,
        id: 'taxiway',
        vector: new Float32Array([0.9, 0.1, 0, 0]),
        fields: { content: 'near the runway' },
      });

      const matches = await searchVectors({
        spec,
        vector: new Float32Array([1, 0, 0, 0]),
        k: 2,
        returns: ['content'],
      });

      expect(matches.map((match) => match.id)).toEqual(['runway', 'taxiway']);
      expect(matches[1]!.fields.content).toBe('near the runway');
      expect(Number(matches[0]!.fields.score)).toBeLessThan(Number(matches[1]!.fields.score));
      expect((await vectorIndexStats(spec.indexName)).numDocs).toBeGreaterThanOrEqual(3);

      expect(await dropVectorIndex(spec.indexName)).toBe(true);
    });
  });
});
