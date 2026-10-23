import { incrementCounter } from './analytics';
import { getRedisClient } from './client';
import { memoryDeleteByPrefix, memoryDeleteKeys } from './l1';

const TAG_PREFIX = 'arch:__tags__';
const BROADCAST_CHANNEL = 'cache:invalidate:broadcast';
const SCAN_COUNT = 100;
/**
 * A broadcast is one Pub/Sub message: past this many keys the payload is
 * dropped rather than shipping a megabyte of JSON to every subscriber.
 * Peers still converge because the L2 keys themselves were already unlinked.
 */
const BROADCAST_KEY_LIMIT = 1_000;

/** Envelope understood by the L1 subscriber in `cache.ts`. */
type InvalidationBroadcast =
  | { type: 'keys'; keys: string[] }
  | { type: 'prefixes'; prefixes: string[] };

async function broadcast(payload: InvalidationBroadcast): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.publish(BROADCAST_CHANNEL, JSON.stringify(payload));
  } catch {
    await incrementCounter('cache.invalidate.broadcast_failed');
  }
}

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
 * Issued as a single pipelined round-trip rather than one command per tag.
 */
export async function indexCacheKeyByTags(key: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const redis = await getRedisClientSafe();
  if (!redis) return;

  try {
    const pipeline = redis.multi();
    for (const tag of tags) {
      pipeline.sAdd(`${TAG_PREFIX}:${tag}`, key);
    }
    await pipeline.exec();
  } catch {
    // Tag index inconsistency is acceptable; a miss costs one recompute.
    await incrementCounter('cache.invalidate.tag_index_failed');
  }
}

/**
 * Invalidate all cache keys associated with the given tags.
 * Uses SSCAN (not SMEMBERS) to avoid blocking, then UNLINK (non-blocking delete).
 *
 * The local L1 cache is purged unconditionally, BEFORE the broadcast, so
 * correctness on this instance never depends on Pub/Sub — which the serverless
 * REST transport cannot provide at all.
 */
export async function cacheInvalidateTags(tags: string[]): Promise<number> {
  if (tags.length === 0) return 0;
  const redis = await getRedisClientSafe();
  if (!redis) return 0;

  let deleted = 0;
  const touched: string[] = [];

  try {
    for (const tag of tags) {
      const tagKey = `${TAG_PREFIX}:${tag}`;
      const keysToDelete: string[] = [];

      for await (const member of redis.sScanIterator(tagKey, { COUNT: SCAN_COUNT })) {
        keysToDelete.push(member);
        if (keysToDelete.length >= SCAN_COUNT) {
          await redis.unlink(keysToDelete);
          // Purge L1 first so this instance is never serving a deleted key.
          memoryDeleteKeys(keysToDelete);
          if (touched.length <= BROADCAST_KEY_LIMIT) touched.push(...keysToDelete);
          deleted += keysToDelete.length;
          keysToDelete.length = 0;
        }
      }

      if (keysToDelete.length > 0) {
        await redis.unlink(keysToDelete);
        memoryDeleteKeys(keysToDelete);
        if (touched.length <= BROADCAST_KEY_LIMIT) touched.push(...keysToDelete);
        deleted += keysToDelete.length;
      }

      await redis.unlink(tagKey);
    }

    // Best-effort cross-instance L1 invalidation. Peers only know how to purge
    // explicit keys or prefixes, so the resolved key set is what ships.
    if (deleted > 0) {
      if (deleted <= BROADCAST_KEY_LIMIT) {
        await broadcast({ type: 'keys', keys: touched });
      } else {
        await incrementCounter('cache.invalidate.broadcast_skipped', { dimension: tags.join(',') });
      }
    }
  } catch {
    await incrementCounter('cache.invalidate.failed', { dimension: 'tags' });
  }

  return deleted;
}

/**
 * Invalidate all keys matching the given prefixes.
 * Uses SCAN (not KEYS) to avoid blocking the Redis server.
 *
 * The local L1 cache is purged unconditionally, BEFORE the broadcast, so
 * correctness on this instance never depends on Pub/Sub.
 */
export async function cacheInvalidatePrefixes(prefixes: string[]): Promise<number> {
  if (prefixes.length === 0) return 0;
  const redis = await getRedisClientSafe();
  if (!redis) return 0;

  let deleted = 0;

  try {
    for (const prefix of prefixes) {
      // Drop the local copy first: correctness must not wait on a network round-trip.
      memoryDeleteByPrefix(prefix);

      const keysToDelete: string[] = [];

      for await (const key of redis.scanIterator({
        MATCH: `${prefix}*`,
        COUNT: SCAN_COUNT,
      })) {
        keysToDelete.push(key);
        if (keysToDelete.length >= SCAN_COUNT) {
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

    // Best-effort cross-instance L1 invalidation.
    if (deleted > 0) {
      await broadcast({ type: 'prefixes', prefixes });
    }
  } catch {
    await incrementCounter('cache.invalidate.failed', { dimension: 'prefixes' });
  }

  return deleted;
}
