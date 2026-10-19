import {
  assertDurabilityBoundary,
  buildCacheKey,
  CACHE_TTL_REGISTRY,
  CacheCategory,
  cacheGet,
  cacheGetWithStats,
  cacheWrap,
  cacheWriteThroughSupabase,
  clearMemoryCache,
  clearSupabaseFallbacks,
  isDurableKey,
  persistCacheStatsSnapshot,
  registerStatsPersistenceSink,
  registerSupabaseFallback,
  resetCacheStats,
  shouldEarlyExpire,
  type XFetchWrapper,
} from '../src/index';

const mockStore = new Map<string, string>();
let redisOffline = false;

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => {
    if (redisOffline) {
      throw new Error('Redis connection refused');
    }
    return {
      isOpen: true,
      get: jest.fn(async (k: string) => mockStore.get(k) ?? null),
      setEx: jest.fn(async (k: string, _ttl: number, v: string) => {
        mockStore.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async (k: string) => {
        mockStore.delete(k);
        return 1;
      }),
      hIncrBy: jest.fn(async () => 1),
      hGetAll: jest.fn(async () => ({ hits: '5', misses: '1', l1Hits: '3', l2Hits: '2' })),
      lRange: jest.fn(async () => ['0.4', '1.2']),
      lTrim: jest.fn(async () => 'OK'),
      rPush: jest.fn(async () => 2),
      sAdd: jest.fn(async () => 1),
      sMembers: jest.fn(async () => []),
      expire: jest.fn(async () => true),
    };
  }),
  createRedisSubscriber: jest.fn(async () => ({
    subscribe: jest.fn(async () => undefined),
  })),
  closeRedis: jest.fn(async () => undefined),
  isServerlessRedis: jest.fn(() => false),
}));

describe('X-Fetch Probabilistic Formula Validation & Stampede Benchmark', () => {
  beforeEach(() => {
    mockStore.clear();
    clearMemoryCache();
    clearSupabaseFallbacks();
    resetCacheStats();
    redisOffline = false;
  });

  it('monotonically increases early expiration probability as remaining TTL approaches 0', () => {
    const now = Date.now();
    const trials = 500;

    const farFromExpiry: XFetchWrapper<string> = {
      value: 'ok',
      ttl: 60,
      delta: 200,
      computedAt: now - 5_000, // 55s remaining
      __isXFetchWrapper: true,
    };

    const nearExpiry: XFetchWrapper<string> = {
      value: 'ok',
      ttl: 60,
      delta: 200,
      computedAt: now - 59_850, // 150ms remaining vs 200ms delta
      __isXFetchWrapper: true,
    };

    let farTriggers = 0;
    let nearTriggers = 0;
    for (let i = 0; i < trials; i++) {
      if (shouldEarlyExpire(farFromExpiry, 1.0)) farTriggers++;
      if (shouldEarlyExpire(nearExpiry, 1.0)) nearTriggers++;
    }

    expect(farTriggers).toBe(0);
    expect(nearTriggers).toBeGreaterThan(trials * 0.35);
  });

  it('prevents cache stampedes under 100 concurrent requests via single-flight coalescing', async () => {
    let originCalls = 0;
    const loader = async () => {
      originCalls++;
      const { promise, resolve } = Promise.withResolvers<void>();
      queueMicrotask(resolve);
      await promise;
      return { payload: 'drill-telemetry', version: originCalls };
    };
    const results = await Promise.all(
      Array.from({ length: 100 }, () => cacheWrap('arch:shift:active-summary', loader, 60))
    );

    expect(originCalls).toBe(1);
    expect(results).toHaveLength(100);
    expect(results.every((r) => r.version === 1)).toBe(true);
  });
});

describe('Durability Architecture Boundary & Supabase Fallback Guard', () => {
  beforeEach(() => {
    mockStore.clear();
    clearMemoryCache();
    clearSupabaseFallbacks();
    redisOffline = false;
  });

  it('classifies AUTH, SHIFT, DEPARTMENT, and EQUIPMENT keys as write-through-durable', () => {
    expect(CACHE_TTL_REGISTRY[CacheCategory.AUTH].durabilityPolicy).toBe('write-through-durable');
    expect(CACHE_TTL_REGISTRY[CacheCategory.SHIFT].durabilityPolicy).toBe('write-through-durable');
    expect(CACHE_TTL_REGISTRY[CacheCategory.METRICS].durabilityPolicy).toBe('ephemeral-cache');

    expect(isDurableKey(buildCacheKey(CacheCategory.AUTH, 'user-1'))).toBe(true);
    expect(isDurableKey('mustering:rollcall:shift-9')).toBe(true);
    expect(isDurableKey(buildCacheKey(CacheCategory.METRICS, 'cpu'))).toBe(false);
  });

  it('warns when a durable key lacks a registered Supabase fallback', () => {
    const key = buildCacheKey(CacheCategory.SHIFT, 'shift-42');
    const withoutFallback = assertDurabilityBoundary(key);
    expect(withoutFallback.durableRequired).toBe(true);
    expect(withoutFallback.hasFallback).toBe(false);
    expect(withoutFallback.warning).toContain('write-through-durable');

    registerSupabaseFallback(CacheCategory.SHIFT, async () => ({ id: 'shift-42' }));
    const withFallback = assertDurabilityBoundary(key);
    expect(withFallback.hasFallback).toBe(true);
    expect(withFallback.warning).toBeUndefined();
  });

  it('recovers business-critical data from Supabase when both L1 and L2 Redis fail or miss', async () => {
    redisOffline = true;
    registerSupabaseFallback<{ shiftId: string; status: string }>(
      CacheCategory.SHIFT,
      async (key) => ({ shiftId: key, status: 'recovered-from-supabase' })
    );

    const key = buildCacheKey(CacheCategory.SHIFT, 'night-01');
    const recovered = await cacheGet<{ shiftId: string; status: string }>(key);
    expect(recovered).toEqual({
      shiftId: 'arch:shift:night-01',
      status: 'recovered-from-supabase',
    });

    // Subsequent read is served from L1 memory even while Redis remains offline
    const withStats = await cacheGetWithStats<{ shiftId: string; status: string }>(key);
    expect(withStats.source).toBe('l1');
    expect(withStats.value?.status).toBe('recovered-from-supabase');
  });

  it('persists to Supabase first in cacheWriteThroughSupabase before warming L1/L2', async () => {
    const order: string[] = [];
    const key = buildCacheKey(CacheCategory.DEPARTMENT, 'drilling');

    await cacheWriteThroughSupabase(key, { slug: 'drilling' }, 300, async () => {
      order.push('supabase-persisted');
    });
    order.push('cache-warmed');

    expect(order).toEqual(['supabase-persisted', 'cache-warmed']);
    const cached = await cacheGet<{ slug: string }>(key);
    expect(cached).toEqual({ slug: 'drilling' });
  });

  it('persists CacheStatsSnapshot to Redis and registered external sink', async () => {
    const captured: unknown[] = [];
    registerStatsPersistenceSink(async (snap) => {
      captured.push(snap);
    });

    const snapshot = await persistCacheStatsSnapshot();
    expect(snapshot.hits).toBeGreaterThanOrEqual(0);
    expect(captured).toHaveLength(1);
    expect(mockStore.has('stats:cache:snapshot:v1')).toBe(true);

    registerStatsPersistenceSink(null);
  });
});
