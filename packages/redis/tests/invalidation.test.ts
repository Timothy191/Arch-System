import {
  cacheInvalidatePrefixes,
  cacheInvalidateTags,
  indexCacheKeyByTags,
} from '../src/invalidation';

const mockIncrementCounter = jest.fn();
const mockMemoryDeleteKeys = jest.fn();
const mockMemoryDeleteByPrefix = jest.fn();

jest.mock('../src/analytics', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
}));

jest.mock('../src/l1', () => ({
  memoryDeleteKeys: (...args: unknown[]) => mockMemoryDeleteKeys(...args),
  memoryDeleteByPrefix: (...args: unknown[]) => mockMemoryDeleteByPrefix(...args),
}));

const CHANNEL = 'cache:invalidate:broadcast';

/** Records every command the invalidation path issues. */
function fakeRedis(members: string[] = [], scanned: string[] = []) {
  const calls = { sAdd: [] as string[][], unlink: [] as string[][], publish: [] as string[][] };
  const sScanIterator = jest.fn(async function* iterate() {
    for (const member of members) yield member;
  });
  const scanIterator = jest.fn(async function* iterate() {
    for (const key of scanned) yield key;
  });

  return {
    calls,
    multi: () => ({
      sAdd: (key: string, member: string) => calls.sAdd.push([key, member]),
      exec: async () => [],
    }),
    sScanIterator,
    scanIterator,
    unlink: async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      calls.unlink.push(list);
      return list.length;
    },
    publish: async (channel: string, payload: string) => {
      calls.publish.push([channel, payload]);
      return 1;
    },
  };
}

let client: ReturnType<typeof fakeRedis>;
const mockGetRedisClient = jest.fn(async () => client);

jest.mock('../src/client', () => ({
  getRedisClient: () => mockGetRedisClient(),
}));

describe('Cache Invalidation Broadcast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    client = fakeRedis();
  });

  describe('indexCacheKeyByTags', () => {
    test('indexes one set per tag in a single pipeline', async () => {
      await indexCacheKeyByTags('dept:7:shifts', ['dept:7', 'shifts']);
      expect(client.calls.sAdd).toEqual([
        ['arch:__tags__:dept:7', 'dept:7:shifts'],
        ['arch:__tags__:shifts', 'dept:7:shifts'],
      ]);
    });

    test('does not touch Redis for an empty tag list', async () => {
      await indexCacheKeyByTags('dept:7:shifts', []);
      expect(mockGetRedisClient).not.toHaveBeenCalled();
    });

    test('counts a pipeline failure without throwing', async () => {
      client.multi = () => {
        throw new Error('closed');
      };
      await expect(indexCacheKeyByTags('k', ['t'])).resolves.toBeUndefined();
      expect(mockIncrementCounter).toHaveBeenCalledWith('cache.invalidate.tag_index_failed');
    });
  });

  describe('cacheInvalidateTags', () => {
    test('unlinks keys, purges L1, and broadcasts the resolved key set', async () => {
      client = fakeRedis(['dept:7:shifts', 'dept:7:roster']);

      const deleted = await cacheInvalidateTags(['dept:7']);

      expect(deleted).toBe(2);
      expect(mockMemoryDeleteKeys).toHaveBeenCalledWith(['dept:7:shifts', 'dept:7:roster']);
      expect(client.calls.publish).toEqual([
        [CHANNEL, JSON.stringify({ type: 'keys', keys: ['dept:7:shifts', 'dept:7:roster'] })],
      ]);
      // The tag set itself is dropped last so a concurrent read cannot re-add.
      expect(client.calls.unlink.at(-1)).toEqual(['arch:__tags__:dept:7']);
    });

    test('purges L1 even when the broadcast cannot be delivered', async () => {
      client = fakeRedis(['k-1']);
      client.publish = async () => {
        throw new Error('pubsub unavailable');
      };

      await expect(cacheInvalidateTags(['tag'])).resolves.toBe(1);
      expect(mockMemoryDeleteKeys).toHaveBeenCalledWith(['k-1']);
      expect(mockIncrementCounter).toHaveBeenCalledWith('cache.invalidate.broadcast_failed');
    });

    test('skips the broadcast past the payload cap', async () => {
      const many = Array.from({ length: 1001 }, (_, index) => `key-${index}`);
      client = fakeRedis(many);

      const deleted = await cacheInvalidateTags(['bulk']);

      expect(deleted).toBe(1001);
      expect(client.calls.publish).toHaveLength(0);
      expect(mockIncrementCounter).toHaveBeenCalledWith('cache.invalidate.broadcast_skipped', {
        dimension: 'bulk',
      });
    });

    test('reports nothing deleted and counts the failure when Redis throws', async () => {
      client.sScanIterator = () => {
        throw new Error('broken iterator');
      };

      await expect(cacheInvalidateTags(['tag'])).resolves.toBe(0);
      expect(mockIncrementCounter).toHaveBeenCalledWith('cache.invalidate.failed', {
        dimension: 'tags',
      });
    });
  });

  describe('cacheInvalidatePrefixes', () => {
    test('purges the local tier before scanning and broadcasts the prefixes', async () => {
      client = fakeRedis([], ['dept:7:a', 'dept:7:b']);

      const deleted = await cacheInvalidatePrefixes(['dept:7:']);

      expect(deleted).toBe(2);
      expect(mockMemoryDeleteByPrefix).toHaveBeenCalledWith('dept:7:');
      expect(client.calls.publish).toEqual([
        [CHANNEL, JSON.stringify({ type: 'prefixes', prefixes: ['dept:7:'] })],
      ]);
    });

    test('scans with MATCH and a bounded COUNT', async () => {
      client = fakeRedis([], ['x-1']);
      await cacheInvalidatePrefixes(['x-']);
      expect(client.scanIterator).toHaveBeenCalledWith({ MATCH: 'x-*', COUNT: 100 });
    });

    test('still drops the local copy when Redis is unreachable', async () => {
      mockGetRedisClient.mockImplementationOnce(async () => null);
      await expect(cacheInvalidatePrefixes(['gone:'])).resolves.toBe(0);

      mockGetRedisClient.mockImplementationOnce(async () => {
        throw new Error('no client');
      });
      await expect(cacheInvalidatePrefixes(['gone:'])).resolves.toBe(0);
    });
  });
});
