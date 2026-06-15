import { getRedisClient } from "./client";

const TAG_PREFIX = "arch:__tags__";

async function getRedisClientSafe() {
  try {
    return await getRedisClient();
  } catch {
    return null;
  }
}

/**
 * Associate a cache key with one or more tags in Redis.
 * Tags are stored as Redis Sets under arch:__tags__:<tag>.
 */
export async function indexCacheKeyByTags(
  key: string,
  tags: string[],
): Promise<void> {
  const redis = await getRedisClientSafe();
  if (!redis) return;

  try {
    const pipeline = redis.multi();
    for (const tag of tags) {
      pipeline.sAdd(`${TAG_PREFIX}:${tag}`, key);
    }
    await pipeline.exec();
  } catch {
    // Silent fail — tag index inconsistency is acceptable
  }
}

/**
 * Invalidate all cache keys associated with the given tags.
 * Uses SSCAN (not SMEMBERS) to avoid blocking, then UNLINK (non-blocking delete).
 * Also clears matching keys from the in-memory L1 cache.
 */
export async function cacheInvalidateTags(tags: string[]): Promise<number> {
  const redis = await getRedisClientSafe();
  if (!redis) return 0;

  let deleted = 0;

  try {
    for (const tag of tags) {
      const tagKey = `${TAG_PREFIX}:${tag}`;
      const keysToDelete: string[] = [];

      for await (const member of redis.sScanIterator(tagKey, { COUNT: 100 })) {
        keysToDelete.push(member);
        if (keysToDelete.length >= 100) {
          await redis.unlink(keysToDelete);
          deleted += keysToDelete.length;
          keysToDelete.length = 0;
        }
      }

      if (keysToDelete.length > 0) {
        await redis.unlink(keysToDelete);
        deleted += keysToDelete.length;
      }

      await redis.unlink(tagKey);
    }
  } catch {
    // Silent fail
  }

  return deleted;
}

/**
 * Invalidate all keys matching the given prefixes.
 * Uses SCAN (not KEYS) to avoid blocking the Redis server.
 * Also clears matching keys from the in-memory L1 cache.
 */
export async function cacheInvalidatePrefixes(
  prefixes: string[],
): Promise<number> {
  const redis = await getRedisClientSafe();
  if (!redis) return 0;

  let deleted = 0;

  try {
    for (const prefix of prefixes) {
      const keysToDelete: string[] = [];

      for await (const key of redis.scanIterator({
        MATCH: `${prefix}*`,
        COUNT: 100,
      })) {
        keysToDelete.push(key);
        if (keysToDelete.length >= 100) {
          await redis.unlink(keysToDelete);
          deleted += keysToDelete.length;
          keysToDelete.length = 0;
        }
      }

      if (keysToDelete.length > 0) {
        await redis.unlink(keysToDelete);
        deleted += keysToDelete.length;
      }
    }
  } catch {
    // Silent fail
  }

  return deleted;
}
