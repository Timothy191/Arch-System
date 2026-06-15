export { getRedisClient, closeRedis } from "./client";
export {
  cacheGet,
  cacheGetWithStats,
  cacheSet,
  cacheSetWithTags,
  cacheWrap,
  cacheDelete,
  cacheDeletePattern,
  cacheInvalidateTags,
  cacheInvalidatePrefixes,
  cacheEvictL1ByPrefix,
  clearMemoryCache,
} from "./cache";
export {
  CacheCategory,
  CACHE_TTL_REGISTRY,
  buildCacheKey,
  type CacheTtlConfig,
} from "./registry";
export {
  recordCacheHit,
  recordCacheMiss,
  recordRedisError,
  getCacheStats,
  resetCacheStats,
} from "./stats";
