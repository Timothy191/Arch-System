import {
  computeAdaptiveTtl,
  getKeyFrequency,
  mutateCache,
  RedisCircuitBreaker,
  recordKeyAccess,
  swrCacheWrap,
} from '../src/adaptive';
import { clearMemoryCache } from '../src/cache';

describe('Autonomously Adaptive Caching Engine', () => {
  beforeEach(() => {
    clearMemoryCache();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    const { closeRedis } = await import('../src/client');
    await closeRedis();
  });

  describe('TinyLFU Frequency Tracker (Dragonfly/Redis)', () => {
    it('accurately increments and tracks access frequency', () => {
      const key = 'test:dept:drilling:frequency';
      expect(getKeyFrequency(key)).toBe(0);

      const score1 = recordKeyAccess(key);
      expect(score1).toBe(1);

      const score2 = recordKeyAccess(key);
      expect(score2).toBeGreaterThanOrEqual(1.9);
      expect(getKeyFrequency(key)).toBeGreaterThanOrEqual(1.8);
    });
  });

  describe('Adaptive TTL with Avalanche Jitter', () => {
    it('computes dynamic TTL scaled by key access frequency', () => {
      const key = 'test:metrics:telemetry';
      const baseTtl = 60;

      // Single access -> baseline TTL with +/- 10% jitter
      const ttl1 = computeAdaptiveTtl(key, { baseTtlSeconds: baseTtl });
      expect(ttl1).toBeGreaterThanOrEqual(baseTtl * 0.85);
      expect(ttl1).toBeLessThanOrEqual(baseTtl * 1.15);

      // Access repeatedly to simulate hot key
      for (let i = 0; i < 15; i++) {
        recordKeyAccess(key);
      }

      const hotTtl = computeAdaptiveTtl(key, { baseTtlSeconds: baseTtl });
      // Hot key should scale up significantly (above base TTL)
      expect(hotTtl).toBeGreaterThan(baseTtl);
    });
  });

  describe('BFE Adaptive Circuit Breaker', () => {
    it('transitions between CLOSED, OPEN, and HALF_OPEN states', () => {
      const breaker = new RedisCircuitBreaker({
        failureThreshold: 3,
        cooldownPeriodMs: 50,
      });

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isOpen()).toBe(false);

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');

      // 3rd failure trips the breaker open
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.isOpen()).toBe(true);

      // Success resets after cooldown
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(breaker.getState()).toBe('HALF_OPEN');
          breaker.recordSuccess();
          expect(breaker.getState()).toBe('CLOSED');
          resolve();
        }, 60);
      });
    });
  });

  describe('Serverless SWR with Single-Flight Coalescing (Vercel SWR & Nuke)', () => {
    it('coalesces concurrent cache misses into a single fetch invocation', async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        return { status: 'operational', timestamp: Date.now() };
      };

      const key = 'test:swr:coalesce';

      // 5 concurrent requests executed at the exact same moment
      const results = await Promise.all([
        swrCacheWrap(key, fetcher),
        swrCacheWrap(key, fetcher),
        swrCacheWrap(key, fetcher),
        swrCacheWrap(key, fetcher),
        swrCacheWrap(key, fetcher),
      ]);

      expect(callCount).toBe(1);
      expect(results[0].status).toBe('operational');
      expect(results[1].timestamp).toBe(results[0].timestamp);
    });

    it('performs negative caching on null/empty results to prevent cache penetration', async () => {
      let callCount = 0;
      const nullFetcher = async () => {
        callCount++;
        return null;
      };

      const key = 'test:swr:null-penetration';

      const res1 = await swrCacheWrap(key, nullFetcher, { negativeCacheTtl: 10 });
      expect(res1).toBeNull();
      expect(callCount).toBe(1);

      // Second read hits negative cache, avoiding fetcher re-invocation
      const res2 = await swrCacheWrap(key, nullFetcher, { negativeCacheTtl: 10 });
      expect(res2).toBeNull();
      expect(callCount).toBe(1);
    });

    it('supports optimistic mutation via mutateCache', async () => {
      const key = 'test:swr:mutation';
      const initial = { count: 1 };
      await mutateCache(key, initial);

      const read = await swrCacheWrap(key, async () => ({ count: 99 }));
      expect(read.count).toBe(1);
    });
  });
});
