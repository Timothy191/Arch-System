import { DatabaseError } from '@repo/errors';
import { type CacheCategory, cacheGetWithStats, cacheSetWithTags } from '@repo/redis';

import { withCache } from './cache-utils';

const TEST_CATEGORY = 'metrics' as CacheCategory;
const TEST_KEY_PART = 'dashboard';
const TEST_CACHE_KEY = 'arch:metrics:dashboard';
const TEST_TAG = 'dept:control-room';
const METRICS_L2_SECONDS = 300;
const CACHE_HIT_COUNT = 7;
const FRESH_COUNT = 9;
const STALE_COUNT = 5;
const DATABASE_ERROR_MESSAGE = 'database unavailable';
const UPSTREAM_ERROR_MESSAGE = 'upstream unavailable';

const CACHE_OPTIONS = {
  category: TEST_CATEGORY,
  keyParts: [TEST_KEY_PART],
  tags: [TEST_TAG],
} as const;

jest.mock('@repo/redis', () => ({
  buildCacheKey: jest.fn((category: string, ...keyParts: (string | number | undefined)[]) => {
    const cleanKeyParts = keyParts.filter(
      (keyPart): keyPart is string | number => keyPart !== undefined
    );
    return `arch:${category}:${cleanKeyParts.join(':')}`;
  }),
  CACHE_TTL_REGISTRY: {
    metrics: {
      l1Seconds: 15,
      l2Seconds: 300,
      durabilityPolicy: 'ephemeral-cache',
    },
  },
  cacheGetWithStats: jest.fn(),
  cacheSetWithTags: jest.fn(),
}));

const mockCacheGetWithStats = cacheGetWithStats as jest.MockedFunction<typeof cacheGetWithStats>;
const mockCacheSetWithTags = cacheSetWithTags as jest.MockedFunction<typeof cacheSetWithTags>;

describe('withCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSetWithTags.mockResolvedValue(undefined);
  });

  it('should return cached payload when cache lookup hits', async () => {
    const cachedPayload = { count: CACHE_HIT_COUNT };
    const fetchFreshPayload = jest.fn(async () => ({ count: FRESH_COUNT }));

    mockCacheGetWithStats.mockResolvedValueOnce({ value: cachedPayload, source: 'l2' });

    await expect(withCache(fetchFreshPayload, CACHE_OPTIONS)).resolves.toBe(cachedPayload);

    expect(fetchFreshPayload).not.toHaveBeenCalled();
    expect(mockCacheSetWithTags).not.toHaveBeenCalled();
  });

  it('should deduplicate concurrent cache misses for the same key', async () => {
    const freshPayload = { count: FRESH_COUNT };
    const fetchFreshPayload = jest.fn(async () => freshPayload);

    mockCacheGetWithStats.mockResolvedValue({ value: null, source: null });

    const firstRequest = withCache(fetchFreshPayload, CACHE_OPTIONS);
    const secondRequest = withCache(fetchFreshPayload, CACHE_OPTIONS);

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      freshPayload,
      freshPayload,
    ]);

    expect(fetchFreshPayload).toHaveBeenCalledTimes(1);
    expect(mockCacheSetWithTags).toHaveBeenCalledTimes(1);
    expect(mockCacheSetWithTags).toHaveBeenCalledWith(
      TEST_CACHE_KEY,
      freshPayload,
      METRICS_L2_SECONDS,
      [TEST_TAG]
    );
  });

  it('should return stale l1 payload when fetch fails and fallback is enabled', async () => {
    const stalePayload = { count: STALE_COUNT };
    const fetchFreshPayload = jest.fn(async () => {
      throw new Error(UPSTREAM_ERROR_MESSAGE);
    });

    mockCacheGetWithStats
      .mockResolvedValueOnce({ value: null, source: null })
      .mockResolvedValueOnce({ value: stalePayload, source: 'l1' });

    await expect(withCache(fetchFreshPayload, CACHE_OPTIONS)).resolves.toBe(stalePayload);

    expect(fetchFreshPayload).toHaveBeenCalledTimes(1);
    expect(mockCacheSetWithTags).not.toHaveBeenCalled();
  });

  it('should rethrow DatabaseError without retrying stale fallback lookup', async () => {
    const databaseError = new DatabaseError(DATABASE_ERROR_MESSAGE);
    const fetchFreshPayload = jest.fn(async () => {
      throw databaseError;
    });

    mockCacheGetWithStats.mockResolvedValue({ value: null, source: null });

    await expect(withCache(fetchFreshPayload, CACHE_OPTIONS)).rejects.toBe(databaseError);

    expect(mockCacheGetWithStats).toHaveBeenCalledTimes(1);
    expect(mockCacheSetWithTags).not.toHaveBeenCalled();
  });
});
