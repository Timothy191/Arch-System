import { getRedisClient } from '@repo/redis';
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

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'healthy',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: degraded ? 503 : 200 }
  );
}
