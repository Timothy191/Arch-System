// eslint-disable-next-line no-restricted-imports
import { type HealthCheckResponse, healthCheckResponseSchema } from '@repo/contract';
import { getRedisClient, isServerlessRedis } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';

const POSTGRES_INSUFFICIENT_PRIVILEGE_CODE = '42501';
const FUXA_PROBE_TIMEOUT_MS = 2000;
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
type RedisTransportMode = 'serverless-rest' | 'tcp';

interface ServiceProbeResult {
  readonly status: ServiceHealthStatus;
  readonly latencyMs: number;
  readonly error?: string;
}

interface RedisProbeResult extends ServiceProbeResult {
  readonly mode: RedisTransportMode;
}

function isAnonLockdownResponse(
  queryError: { readonly code?: string; readonly message?: string } | null
): boolean {
  if (!queryError) {
    return false;
  }
  return (
    queryError.code === POSTGRES_INSUFFICIENT_PRIVILEGE_CODE ||
    (typeof queryError.message === 'string' && /permission denied/i.test(queryError.message))
  );
}

function resolveRedisMode(): RedisTransportMode {
  if (typeof isServerlessRedis === 'function' && isServerlessRedis()) {
    return 'serverless-rest';
  }
  return 'tcp';
}

async function probeSupabase(): Promise<ServiceProbeResult> {
  const startedAt = Date.now();
  try {
    const supabase = await createServerSupabaseClient({ healthProbe: true });
    const { error: machinesError } = await supabase.from('machines').select('id').limit(1);

    if (!machinesError || isAnonLockdownResponse(machinesError)) {
      return { status: 'healthy', latencyMs: Date.now() - startedAt };
    }

    // Fallback to employees check if machines table is pending migration
    const { error: employeesError } = await supabase.from('employees').select('id').limit(1);
    if (!employeesError || isAnonLockdownResponse(employeesError)) {
      return { status: 'healthy', latencyMs: Date.now() - startedAt };
    }

    return {
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      error: employeesError.message,
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeRedis(): Promise<RedisProbeResult> {
  const startedAt = Date.now();
  let status: ServiceHealthStatus = 'healthy';
  let errorMessage: string | undefined;

  try {
    const redis = await getRedisClient();
    if (redis && typeof redis.ping === 'function') {
      await redis.ping();
    } else if (redis && !redis.isOpen) {
      status = 'degraded';
      errorMessage = 'Redis connection is not open';
    }
  } catch (err) {
    status = 'degraded';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  return {
    status,
    latencyMs: Date.now() - startedAt,
    mode: resolveRedisMode(),
    ...(errorMessage ? { error: errorMessage } : {}),
  };
}

async function probeFuxaEndpoint(fuxaUrl: string): Promise<ServiceProbeResult> {
  const startedAt = Date.now();
  try {
    const probeRes = await fetch(`${fuxaUrl.replace(/\/$/, '')}/api/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(FUXA_PROBE_TIMEOUT_MS),
    });
    if (!probeRes.ok) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - startedAt,
        error: `Fuxa SCADA HTTP ${probeRes.status}`,
      };
    }
    return { status: 'healthy', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return {
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function resolveOverallStatus(
  statuses: readonly [ServiceHealthStatus, ServiceHealthStatus, ServiceHealthStatus]
): ServiceHealthStatus {
  const [supabaseStatus, redisStatus, fuxaStatus] = statuses;
  if (supabaseStatus === 'unhealthy') {
    return 'unhealthy';
  }
  if (supabaseStatus === 'degraded' || redisStatus === 'degraded' || fuxaStatus === 'degraded') {
    return 'degraded';
  }
  return 'healthy';
}

export async function GET() {
  const startedAt = Date.now();
  const fuxaUrl = process.env.FUXA_URL || process.env.NEXT_PUBLIC_FUXA_URL;

  const [supabaseResult, redisResult, fuxaProbeResult] = await Promise.all([
    probeSupabase(),
    probeRedis(),
    fuxaUrl ? probeFuxaEndpoint(fuxaUrl) : Promise.resolve(null),
  ]);

  const fuxaResult: ServiceProbeResult = fuxaProbeResult ?? {
    status: redisResult.status,
    latencyMs: redisResult.latencyMs,
    ...(redisResult.error ? { error: redisResult.error } : {}),
  };

  const totalLatencyMs = Date.now() - startedAt;
  const overallStatus = resolveOverallStatus([
    supabaseResult.status,
    redisResult.status,
    fuxaResult.status,
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
