cat << 'INNER_EOF' >> apps/portal/setupTests.ts

jest.mock('../../packages/redis/src/cache', () => {
  const actual = jest.requireActual('../../packages/redis/src/cache');
  return {
    ...actual,
    cacheGet: jest.fn(async () => null),
    cacheGetWithStats: jest.fn(async () => ({ value: null, stats: null })),
    cacheSet: jest.fn(async () => undefined),
    cacheSetWithTags: jest.fn(async () => undefined),
    cacheWrap: jest.fn(async (_key, _ttl, loader) => loader()),
    cacheDelete: jest.fn(async () => undefined),
    cacheDeletePattern: jest.fn(async () => undefined),
    cacheEvictL1ByPrefix: jest.fn(() => undefined),
    clearMemoryCache: jest.fn(() => undefined),
  };
});
INNER_EOF
