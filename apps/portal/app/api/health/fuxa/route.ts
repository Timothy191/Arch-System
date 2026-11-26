import { getRedisClient } from '@repo/redis';
import { type NextRequest, NextResponse } from 'next/server';

const PROBE_TIMEOUT_MS = 2_500;
const HTTP_STATUS_OK = 200;

type FuxaHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unconfigured';

export interface FuxaHealthResponse {
  status: FuxaHealthStatus;
  optional: boolean;
  configured: boolean;
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

function getFuxaUrl(): string {
  const raw = process.env.FUXA_URL || process.env.NEXT_PUBLIC_FUXA_URL || '';
  return raw.trim().replace(/\/+$/, '');
}

export async function GET(_req?: NextRequest) {
  const startedAt = Date.now();
  const fuxaUrl = getFuxaUrl();
  const configured = fuxaUrl.length > 0;

  // FUXA is an optional integration: when unconfigured, report clearly and
  // never block deployment or core portal operations.
  if (!configured) {
    const payload: FuxaHealthResponse = {
      status: 'unconfigured',
      optional: true,
      configured: false,
      fuxa_healthy: false,
      iframeLoadable: false,
      corsAllowed: false,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(payload, {
      status: HTTP_STATUS_OK,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  }

  let status: FuxaHealthStatus = 'unavailable';
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
      status = redisHealthy ? 'degraded' : 'unavailable';
    }
  } catch {
    const redisHealthy = await isRedisFallbackHealthy();
    status = redisHealthy ? 'degraded' : 'unavailable';
  }

  const payload: FuxaHealthResponse = {
    status,
    optional: true,
    configured: true,
    fuxa_healthy: fuxaHealthy,
    iframeLoadable,
    corsAllowed,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  // FUXA is optional: always return HTTP 200 so monitors do not alert.
  return NextResponse.json(payload, {
    status: HTTP_STATUS_OK,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
