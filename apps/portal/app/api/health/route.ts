// eslint-disable-next-line no-restricted-imports
import { type HealthCheckResponse, healthCheckResponseSchema } from '@repo/contract';
import { NextResponse } from 'next/server';
import {
  probeFuxaEndpoint,
  probeRedis,
  probeSupabase,
  resolveFuxaUrl,
  resolveOverallStatus,
  type ServiceProbeResult,
} from '@/lib/observability/health-probes';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

export async function GET() {
  const startedAt = Date.now();
  const fuxaUrl = resolveFuxaUrl();

  const [supabaseResult, redisResult, fuxaProbeResult] = await Promise.all([
    probeSupabase(),
    probeRedis(),
    fuxaUrl ? probeFuxaEndpoint(fuxaUrl) : Promise.resolve(null),
  ]);

  const fuxaResult: ServiceProbeResult = fuxaProbeResult ?? {
    status: 'degraded',
    latencyMs: 0,
    error: 'FUXA_URL is not configured',
  };

  const totalLatencyMs = Date.now() - startedAt;
  const overallStatus = resolveOverallStatus([
    supabaseResult.status,
    redisResult.status,
    fuxaUrl ? fuxaResult.status : null,
  ]);

  const responsePayload: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    latencyMs: totalLatencyMs,
    services: {
      supabase: supabaseResult,
      redis: {
        status: redisResult.status,
        latencyMs: redisResult.latencyMs,
        ...(redisResult.error ? { error: redisResult.error } : {}),
      },
      fuxa: fuxaResult,
    },
  };

  // Validate payload against schema before returning
  const parsed = healthCheckResponseSchema.safeParse(responsePayload);
  const validatedPayload = parsed.success ? parsed.data : responsePayload;
  const responseBody = {
    ...validatedPayload,
    services: {
      ...validatedPayload.services,
      redis: {
        ...validatedPayload.services.redis,
        mode: redisResult.mode,
      },
    },
  };

  const httpStatus =
    overallStatus === 'unhealthy' ? HTTP_STATUS_SERVICE_UNAVAILABLE : HTTP_STATUS_OK;
  const serverTiming = [
    `supabase;dur=${supabaseResult.latencyMs}`,
    `redis;dur=${redisResult.latencyMs}`,
    `fuxa;dur=${fuxaResult.latencyMs}`,
    `total;dur=${totalLatencyMs}`,
  ].join(', ');

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Server-Timing': serverTiming,
    },
  });
}
