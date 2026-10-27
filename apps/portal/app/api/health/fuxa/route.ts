import { getRedisClient } from '@repo/redis';
import { type NextRequest, NextResponse } from 'next/server';

const PROBE_TIMEOUT_MS = 2_500;
const DEFAULT_FUXA_URL = 'http://localhost:1881';
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

type FuxaHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface FuxaHealthResponse {
  status: FuxaHealthStatus;
  fuxa_healthy: boolean;
  iframeLoadable: boolean;
  corsAllowed: boolean;
  latencyMs: number;
  timestamp: string;
}

async function isRedisFallbackHealthy(): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      return false;
    }
    if (typeof redis.ping === 'function') {
      await redis.ping();
    }
    return true;
  } catch {
    return false;
  }
}

export async function GET(_req?: NextRequest) {
  const startedAt = Date.now();
  const fuxaUrl = process.env.FUXA_URL || process.env.NEXT_PUBLIC_FUXA_URL || DEFAULT_FUXA_URL;

  let status: FuxaHealthStatus = 'unhealthy';
  let fuxaHealthy = false;
  let iframeLoadable = false;
  let corsAllowed = false;

  try {
    const response = await fetch(fuxaUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    const xFrameOptions = response.headers?.get('x-frame-options')?.toUpperCase() ?? null;
    const allowOrigin = response.headers?.get('access-control-allow-origin') ?? null;

    corsAllowed = Boolean(allowOrigin && allowOrigin.trim().length > 0);
    iframeLoadable = response.ok && xFrameOptions !== 'DENY';

    if (response.ok && iframeLoadable) {
      fuxaHealthy = true;
      status = 'healthy';
    } else if (response.ok) {
      status = 'degraded';
    } else {
      const redisHealthy = await isRedisFallbackHealthy();
      status = redisHealthy ? 'degraded' : 'unhealthy';
    }
  } catch {
    const redisHealthy = await isRedisFallbackHealthy();
    status = redisHealthy ? 'degraded' : 'unhealthy';
  }

  const httpStatus = status === 'unhealthy' ? HTTP_STATUS_SERVICE_UNAVAILABLE : HTTP_STATUS_OK;

  const payload: FuxaHealthResponse = {
    status,
    fuxa_healthy: fuxaHealthy,
    iframeLoadable,
    corsAllowed,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  });
}
