import { getCacheStats, getRedisClient, isServerlessRedis } from '@repo/redis';
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

  const serverless = typeof isServerlessRedis === 'function' ? isServerlessRedis() : false;

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'healthy',
      engine: 'redis-7.x',
      mode: serverless ? 'serverless-rest' : 'tcp',
      latencyMs: Date.now() - startedAt,
      cacheStats,
      timestamp: new Date().toISOString(),
    },
    { status: degraded ? 503 : 200 }
  );
}
