/* cspell:words dbsize */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRedisProxyRequest as isAuthorized } from '@/lib/api/telemetry-auth';
import { redisEngine } from '@/lib/redis-engine';

const HTTP_UNAUTHORIZED_STATUS = 401;

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

  const ping = redisEngine.executeCommand('PING', []);
  const activeKeysCount = redisEngine.dbsize();

  return NextResponse.json({
    status: 'healthy',
    mode: 'serverless-http-redis',
    ping,
    activeKeysCount,
    timestamp: new Date().toISOString(),
  });
}
