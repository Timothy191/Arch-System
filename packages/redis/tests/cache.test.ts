import { cacheWrap, clearMemoryCache } from '../src/cache';
import type { XFetchWrapper } from '../src/xfetch';

// Mock stats and invalidation to avoid side effects
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

// Mock redis client
const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
const mockRedisDel = jest.fn();

// The client is imported statically by src/cache.ts, so this factory is evaluated
// during module load — before the `const` mocks below are initialised. Each
// property therefore defers to call time.
jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => ({
    get: (...args: unknown[]) => mockRedisGet(...args),
    setEx: (...args: unknown[]) => mockRedisSetEx(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    isOpen: true,
  })),
  createRedisSubscriber: jest.fn(async () => ({
    subscribe: jest.fn(async () => undefined),
  })),
}));

/**
 * Unique key per invocation so repeated runs never share Redis state.
 * `clearMemoryCache()` only resets the in-process L1 layer.
 */
const testKey = () => `test:xfetch:${Math.random().toString(36).slice(2, 10)}`;

describe('X-Fetch Cache Wrapper', () => {
  beforeEach(() => {
    clearMemoryCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Standard Miss & Set', async () => {
    const key = testKey();
    mockRedisGet.mockResolvedValueOnce(null);
    const mockFn = jest.fn().mockResolvedValue('test-data');

    const result = await cacheWrap(key, mockFn, 10);

    expect(result).toBe('test-data');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Check that it was saved as XFetchWrapper in Redis
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      key,
      10,
      expect.stringContaining('"__isXFetchWrapper":true')
    );
  });

  test('Early Expiration Triggered (Stale Return)', async () => {
    const key = testKey();
    // Math.random() = 0 means it will definitely trigger if Math.log(random) is used (log(0) = -Infinity)
    // Wait, log(0) is -Infinity, so -1 * delta * -Infinity = Infinity > ttlRemaining (true)
    jest.spyOn(Math, 'random').mockReturnValue(0.0001);

    const wrapper: XFetchWrapper<string> = {
      value: 'stale-data',
      ttl: 10,
      delta: 1000,
      computedAt: Date.now() - 5000, // 5 seconds ago
      __isXFetchWrapper: true,
    };

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(wrapper));

    // The background function
    const mockFn = jest.fn().mockResolvedValue('fresh-data');

    const start = performance.now();
    const result = await cacheWrap(key, mockFn, 10);
    const latency = performance.now() - start;

    // Should return stale immediately
    expect(result).toBe('stale-data');
    expect(latency).toBeLessThan(10); // less than 10ms

    // Wait for the background execution to complete
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Background execution should happen
    expect(mockFn).toHaveBeenCalledTimes(1);

    expect(mockRedisSetEx).toHaveBeenCalledTimes(1);
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      key,
      10,
      expect.stringContaining('"value":"fresh-data"')
    );
  });

  test('Single-Flight Coalescing', async () => {
    const key = testKey();
    jest.spyOn(Math, 'random').mockReturnValue(0.0001); // Always trigger early expiration

    const wrapper: XFetchWrapper<string> = {
      value: 'stale-data',
      ttl: 10,
      delta: 1000,
      computedAt: Date.now() - 5000, // 5 seconds ago
      __isXFetchWrapper: true,
    };

    mockRedisGet.mockResolvedValue(JSON.stringify(wrapper));

    const mockFn = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10)); // simulated 10ms work
      return 'fresh-data';
    });

    // 100 concurrent requests
    const promises = Array.from({ length: 100 }).map(() => cacheWrap(key, mockFn, 10));
    const results = await Promise.all(promises);

    // All should return the stale data immediately
    results.forEach((res) => expect(res).toBe('stale-data'));

    // Wait for the background function to finish
    await new Promise((resolve) => setTimeout(resolve, 30));

    // The background function should only be called ONCE
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('Early Expiration Not Triggered', async () => {
    const key = testKey();
    // Math.random() = 0.99 means log(0.99) is close to 0, so -delta * log(0.99) is small < ttlRemaining
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const wrapper: XFetchWrapper<string> = {
      value: 'cached-data',
      ttl: 10,
      delta: 100,
      computedAt: Date.now() - 1000, // 1 second ago
      __isXFetchWrapper: true,
    };

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(wrapper));

    const mockFn = jest.fn().mockResolvedValue('fresh-data');

    const result = await cacheWrap(key, mockFn, 10);

    expect(result).toBe('cached-data');

    // Background execution should NOT happen
    expect(mockFn).not.toHaveBeenCalled();
  });

  test('Cold-Miss Single-Flight Coalescing (pre-lookup & post-lookup guards)', async () => {
    const key = testKey();
    mockRedisGet.mockResolvedValue(null);

    const mockFn = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return 'coalesced-value';
    });

    const firstBatch = Array.from({ length: 25 }).map(() => cacheWrap(key, mockFn, 30));
    await new Promise((resolve) => setTimeout(resolve, 5));
    // Second wave arrives while activeMissFetches already holds the in-flight promise
    const secondBatch = Array.from({ length: 25 }).map(() => cacheWrap(key, mockFn, 30));

    const results = await Promise.all([...firstBatch, ...secondBatch]);
    expect(results).toHaveLength(50);
    for (const entry of results) {
      expect(entry).toBe('coalesced-value');
    }
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
