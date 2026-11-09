import { redisCircuitBreaker } from './circuit-breaker';
import { getRedisClient } from './client';

/**
 * Non-blocking timer sleep that detaches the underlying Node timeout handle
 * so background loops do not prevent clean process exit.
 */
export function unrefSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
  });
}

/**
 * Acquires the shared Redis client guarded by `redisCircuitBreaker`.
 * Returns `null` when the circuit breaker is open or connection fails.
 */
export async function getCircuitGuardedRedisClient(
  contextLabel = 'redis:getRedisClientSafe'
): Promise<Awaited<ReturnType<typeof getRedisClient>> | null> {
  if (!redisCircuitBreaker || redisCircuitBreaker.isOpen()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    redisCircuitBreaker.recordSuccess();
    return redis;
  } catch (err) {
    redisCircuitBreaker?.recordFailure();
    console.warn(`[${contextLabel}] Redis unavailable:`, err);
    return null;
  }
}
