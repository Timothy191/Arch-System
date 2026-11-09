import { NextRequest, NextResponse } from 'next/server';
import { authorizeRedisProxyRequest as isAuthorized } from '@/lib/api/telemetry-auth';
import { redisEngine } from '@/lib/redis-engine';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Unauthorized. Provide valid X-N8N-API-KEY or Authorization header.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 50;
  const executions = redisEngine.listExecutions(limit);

  return NextResponse.json({
    data: executions,
    count: executions.length,
  });
}
