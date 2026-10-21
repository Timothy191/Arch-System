import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { redisEngine } from '@/lib/redis-engine';

function getConfiguredSecret(): string | null {
  const secret = process.env.REDIS_AUTH_SECRET || process.env.N8N_API_KEY;
  if (!secret || secret.trim().length === 0) return null;
  return secret;
}

function safeEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = getConfiguredSecret();
  // Fail closed: an unconfigured secret must never authorize every caller.
  if (!secret) return false;

  const apiKey = request.headers.get('x-n8n-api-key');
  if (apiKey && safeEqual(apiKey, secret)) return true;

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (safeEqual(token, secret)) return true;
  }

  return false;
}

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
