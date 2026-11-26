/* cspell:words dbsize */
import { getRedisClient } from '@repo/redis/client';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRedisProxyRequest as isAuthorized } from '@/lib/api/telemetry-auth';

const HTTP_UNAUTHORIZED_STATUS = 401;
const HTTP_SERVICE_UNAVAILABLE = 503;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        message:
          'Unauthorized. Provide valid X-N8N-API-KEY, x-redis-token, or Authorization header.',
      },
      { status: HTTP_UNAUTHORIZED_STATUS }
    );
  }

  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          mode: 'primary-disconnected',
          error: 'Primary Redis client is disconnected',
          timestamp: new Date().toISOString(),
        },
        { status: HTTP_SERVICE_UNAVAILABLE }
      );
    }

    const ping = typeof redis.ping === 'function' ? await redis.ping() : 'PONG';
    const activeKeysCount = typeof redis.dbSize === 'function' ? await redis.dbSize() : null;

    return NextResponse.json({
      status: 'healthy',
      mode: 'primary-redis',
      ping,
      activeKeysCount,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        mode: 'primary-error',
        error: 'Failed to probe primary Redis instance',
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_SERVICE_UNAVAILABLE }
    );
  }
}
