/**
 * @jest-environment node
 *
 * Exercises the Redis-backed primitives against a real server instead of the
 * global mocks in setupTests.ts. Skipped unless REDIS_INTEGRATION=1.
 */
import {
  FixedWindowStrategy,
  RateLimiter,
  RedisStore,
  type SimpleRedisClient,
} from '@repo/rate-limiter';
import { closeRedis, getRedisClient } from '@repo/redis';
import { GET } from '../../app/api/telemetry/drilling/stream/route';

jest.mock('@/lib/errors/error-logger', () => ({ logError: jest.fn() }));

jest.setTimeout(30_000);

const ENABLED = process.env.REDIS_INTEGRATION === '1';
const describeIntegration = ENABLED ? describe : describe.skip;
const STREAM_KEY = 'drilling:telemetry:stream';

type RedisClient = Awaited<ReturnType<typeof getRedisClient>>;

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  needle: string,
  timeoutMs = 5000
): Promise<string> {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buffer = '';

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for "${needle}"`);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timed out waiting for "${needle}"`)),
        Math.max(1, deadline - Date.now())
      );
    });

    try {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (value) buffer += decoder.decode(value);
      if (buffer.includes(needle)) return buffer;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new Error(`Stream closed before emitting "${needle}"`);
}

describeIntegration('Redis integration', () => {
  let client: RedisClient;

  beforeAll(async () => {
    client = await getRedisClient();
    await client.ping();
    if (typeof client.xAdd !== 'function') {
      throw new Error('Redis integration tests require a TCP client (XADD/XREAD support)');
    }
  });

  afterAll(async () => {
    await client.del(STREAM_KEY);
    await closeRedis();
  });

  beforeEach(async () => {
    await client.del(STREAM_KEY);
  });

  it('retains only the newest entries when trimmed by MAXLEN', async () => {
    for (let i = 0; i < 15; i++) {
      await client.xAdd(
        STREAM_KEY,
        '*',
        { data: `entry-${i}` },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '=', threshold: 10 } }
      );
    }

    expect(await client.xLen(STREAM_KEY)).toBe(10);

    const entries = await client.xRange(STREAM_KEY, '-', '+');
    expect(entries.map((entry) => entry.message.data)).toEqual(
      Array.from({ length: 10 }, (_, index) => `entry-${index + 5}`)
    );
    expect(entries.every((entry) => /^\d+-\d+$/.test(entry.id))).toBe(true);
  });

  it('reads only entries newer than the supplied id', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await client.xAdd(STREAM_KEY, '*', { data: `entry-${i}` }));
    }

    const response = await client.xRead([{ key: STREAM_KEY, id: ids[2]! }], { COUNT: 100 });
    const messages = response?.[0]?.messages ?? [];

    expect(messages.map((message) => message.message.data)).toEqual(['entry-3', 'entry-4']);
  });

  it('replays missed entries over SSE when Last-Event-ID is supplied', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(await client.xAdd(STREAM_KEY, '*', { data: JSON.stringify({ index: i }) }));
    }

    const res = await GET(
      new Request('http://localhost/api/telemetry/drilling/stream', {
        headers: {
          'last-event-id': ids[1]!,
          'x-forwarded-for': '10.99.0.1',
        },
      })
    );

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = res.body!.getReader();

    try {
      const payload = await readUntil(reader, `id: ${ids[3]}`);

      expect(payload).toContain(`id: ${ids[2]}`);
      expect(payload).toContain('data: {"index":2}');
      expect(payload).toContain('data: {"index":3}');
      expect(payload).not.toContain('id: ' + ids[1]);
    } finally {
      await reader.cancel();
    }
  });

  it('allows exactly the configured number of parallel fixed-window requests', async () => {
    const limiter = new RateLimiter({
      store: new RedisStore(client as unknown as SimpleRedisClient),
      strategy: new FixedWindowStrategy(),
      limit: 10,
      windowMs: 60_000,
      keyPrefix: 'test:integration:fixed:',
    });

    // Unique per run: the fixed-window key embeds the minute, so a reused
    // identifier would inherit the previous run's counter.
    const identifier = `parallel-client-${process.pid}-${Date.now()}`;

    const results = await Promise.all(Array.from({ length: 50 }, () => limiter.check(identifier)));

    const allowed = results.filter((result) => result.allowed);
    expect(allowed).toHaveLength(10);
    expect(allowed.map((result) => result.remaining).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('repairs a counter key that lost its TTL', async () => {
    const windowMs = 60_000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const cacheKey = `test:integration:legacy:fixed:${windowStart}`;

    await client.set(cacheKey, '1');

    const result = await new FixedWindowStrategy().check(
      'test:integration:legacy',
      10,
      windowMs,
      new RedisStore(client as unknown as SimpleRedisClient)
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(8);

    const ttl = await client.pTTL(cacheKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(windowMs);
  });
});
