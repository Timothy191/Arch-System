import { detectCapabilities, getCacheStats, getRedisClient, isServerlessRedis } from '@repo/redis';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const startedAt = Date.now();
  let degraded = false;

  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      degraded = true;
    } else {
      // Live probe: a trivial PING round-trip proves the socket is usable.
      await redis.ping();
    }
  } catch {
    degraded = true;
  }

  let cacheStats = null;
  try {
    if (typeof getCacheStats === 'function') {
      cacheStats = await getCacheStats();
    }
  } catch {
    // Non-fatal in health check
  }

  // Which command families this deployment can actually serve. Streams being
  // false, for instance, explains a silent loss of realtime telemetry.
  let capabilities = null;
  try {
    capabilities = await detectCapabilities();
  } catch {
    // Non-fatal in health check
  }

  const serverless = typeof isServerlessRedis === 'function' ? isServerlessRedis() : false;

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'healthy',
      engine: capabilities?.redisVersion ? `redis-${capabilities.redisVersion}` : 'redis-7.x',
      mode: serverless ? 'serverless-rest' : 'tcp',
      latencyMs: Date.now() - startedAt,
      cacheStats,
      capabilities,
      timestamp: new Date().toISOString(),
    },
    { status: degraded ? 503 : 200 }
  );
}
