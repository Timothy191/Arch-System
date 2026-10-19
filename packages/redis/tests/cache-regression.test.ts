import { cacheGet, cacheGetWithStats, cacheSet, clearMemoryCache } from '../src/cache';

/**
 * Regression suite for the five audit findings, exercised through the public
 * cache API against a stubbed Redis that mimics the node-redis surface.
 *
 * The stub returns RAW strings (as both the TCP client and the REST adapter do),
 * which is exactly what made the old double-decode and truthiness bugs fatal.
 */
const rawStore = new Map<string, string>();

const mockRedisGet = jest.fn(async (key: string) => rawStore.get(key) ?? null);
const mockRedisSetEx = jest.fn(async (key: string, _ttl: number, value: string) => {
  rawStore.set(key, value);
  return 'OK';
});

jest.mock('../src/stats', () => ({
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  recordRedisError: jest.fn(),
  recordXFetchTrigger: jest.fn(),
}));

jest.mock('../src/invalidation', () => ({
  cacheInvalidateTags: jest.fn(),
  cacheInvalidatePrefixes: jest.fn(),
  indexCacheKeyByTags: jest.fn(),
}));

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => ({
    get: (...args: unknown[]) => mockRedisGet(...(args as [string])),
    setEx: (...args: unknown[]) => mockRedisSetEx(...(args as [string, number, string])),
    del: jest.fn(async () => 1),
    isOpen: true,
  })),
  createRedisSubscriber: jest.fn(async () => ({ subscribe: jest.fn(async () => undefined) })),
}));

beforeEach(() => {
  rawStore.clear();
  clearMemoryCache();
  jest.clearAllMocks();
});

describe('Finding 2: falsy cached values round-trip', () => {
  // The old implementation used `if (value)`, so every one of these degraded to
  // a permanent miss and the caller re-queried the database forever.
  const falsyCases: Array<[string, unknown]> = [
    ['zero', 0],
    ['false', false],
    ['empty string', ''],
  ];

  it.each(falsyCases)('L2 read returns cached %s', async (_label, value) => {
    const key = 'arch:metrics:counter';
    await cacheSet(key, value, 60);
    clearMemoryCache(); // drop L1 only, forcing the read through L2

    await expect(cacheGet(key)).resolves.toBe(value);
  });

  it('reports the hit source correctly for falsy payloads', async () => {
    const key = 'arch:metrics:zero';
    await cacheSet(key, 0, 60);
    clearMemoryCache(); // drop L1 only, forcing the read through L2

    const result = await cacheGetWithStats(key);
    expect(result.value).toBe(0);
    expect(result.source).toBe('l2');
  });

  it('serves falsy values from L1 on the second read', async () => {
    const key = 'arch:shift:count';
    await cacheSet(key, 0, 60);

    const first = await cacheGetWithStats(key);
    expect(first.value).toBe(0);

    const second = await cacheGetWithStats(key);
    expect(second.value).toBe(0);
    expect(second.source).toBe('l1');
  });

  it('distinguishes an explicit null from a missing key', async () => {
    const missing = await cacheGetWithStats('arch:metrics:absent');
    expect(missing.value).toBeNull();
    expect(missing.source).toBeNull();
  });
});

describe('Finding 1: single parse boundary', () => {
  it('decodes a JSON object exactly once', async () => {
    const key = 'arch:dept:drilling';
    await cacheSet(key, { id: 1, name: 'Drilling' }, 3600);
    clearMemoryCache(); // drop L1 only, forcing the read through L2

    await expect(cacheGet(key)).resolves.toEqual({ id: 1, name: 'Drilling' });
  });

  it('passes through a non-JSON payload rather than erroring into a miss', async () => {
    const key = 'raw:plain';
    rawStore.set(key, 'not-json-at-all');
    clearMemoryCache();

    await expect(cacheGet(key)).resolves.toBe('not-json-at-all');
  });
});

describe('Registry-driven L1 promotion', () => {
  it('promotes an L2 hit into L1 so the next read is served locally', async () => {
    const key = 'arch:dept:drilling:uuid';
    rawStore.set(key, JSON.stringify('uuid-123'));
    clearMemoryCache();

    const first = await cacheGetWithStats(key);
    expect(first.source).toBe('l2');

    const second = await cacheGetWithStats(key);
    expect(second.source).toBe('l1');
    expect(second.value).toBe('uuid-123');
  });
});
