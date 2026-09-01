import { cacheWrap, cacheGet, cacheSet, clearMemoryCache } from "../src/cache";
import { XFetchWrapper } from "../src/xfetch";

// Mock stats and invalidation to avoid side effects
jest.mock("../src/stats", () => ({
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  recordRedisError: jest.fn(),
  recordXFetchTrigger: jest.fn(),
}));

jest.mock("../src/invalidation", () => ({
  cacheInvalidateTags: jest.fn(),
  cacheInvalidatePrefixes: jest.fn(),
  indexCacheKeyByTags: jest.fn(),
}));

// Mock redis client
const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
const mockRedisDel = jest.fn();

jest.mock("../src/client", () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: mockRedisGet,
    setEx: mockRedisSetEx,
    del: mockRedisDel,
    isOpen: true,
  }),
}));

describe("X-Fetch Cache Wrapper", () => {
  beforeEach(() => {
    clearMemoryCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Standard Miss & Set", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    const mockFn = jest.fn().mockResolvedValue("test-data");

    const result = await cacheWrap("test-key", mockFn, 10);

    expect(result).toBe("test-data");
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Check that it was saved as XFetchWrapper in Redis
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      "test-key",
      10,
      expect.stringContaining('"__isXFetchWrapper":true'),
    );
  });

  test("Early Expiration Triggered (Stale Return)", async () => {
    // Math.random() = 0 means it will definitely trigger if Math.log(random) is used (log(0) = -Infinity)
    // Wait, log(0) is -Infinity, so -1 * delta * -Infinity = Infinity > ttlRemaining (true)
    jest.spyOn(Math, "random").mockReturnValue(0.0001);

    const wrapper: XFetchWrapper<string> = {
      value: "stale-data",
      ttl: 10,
      delta: 1000,
      computedAt: Date.now() - 5000, // 5 seconds ago
      __isXFetchWrapper: true,
    };

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(wrapper));

    // The background function
    const mockFn = jest.fn().mockResolvedValue("fresh-data");

    const start = performance.now();
    const result = await cacheWrap("test-key", mockFn, 10);
    const latency = performance.now() - start;

    // Should return stale immediately
    expect(result).toBe("stale-data");
    expect(latency).toBeLessThan(10); // less than 10ms

    // Background execution should happen
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Wait for the background execution to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRedisSetEx).toHaveBeenCalledTimes(1);
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      "test-key",
      10,
      expect.stringContaining('"value":"fresh-data"'),
    );
  });

  test("Single-Flight Coalescing", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.0001); // Always trigger early expiration

    const wrapper: XFetchWrapper<string> = {
      value: "stale-data",
      ttl: 10,
      delta: 1000,
      computedAt: Date.now() - 5000,
      __isXFetchWrapper: true,
    };

    mockRedisGet.mockResolvedValue(JSON.stringify(wrapper));

    const mockFn = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10)); // simulated 10ms work
      return "fresh-data";
    });

    // 100 concurrent requests
    const promises = Array.from({ length: 100 }).map(() => cacheWrap("test-key", mockFn, 10));
    const results = await Promise.all(promises);

    // All should return the stale data immediately
    results.forEach((res) => expect(res).toBe("stale-data"));

    // The background function should only be called ONCE
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Wait for the background function to finish
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  test("Early Expiration Not Triggered", async () => {
    // Math.random() = 0.99 means log(0.99) is close to 0, so -delta * log(0.99) is small < ttlRemaining
    jest.spyOn(Math, "random").mockReturnValue(0.99);

    const wrapper: XFetchWrapper<string> = {
      value: "cached-data",
      ttl: 10,
      delta: 100,
      computedAt: Date.now() - 1000, // 1 second ago
      __isXFetchWrapper: true,
    };

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(wrapper));

    const mockFn = jest.fn().mockResolvedValue("fresh-data");

    const result = await cacheWrap("test-key", mockFn, 10);

    expect(result).toBe("cached-data");

    // Background execution should NOT happen
    expect(mockFn).not.toHaveBeenCalled();
  });
});
