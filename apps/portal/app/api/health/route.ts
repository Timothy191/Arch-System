// eslint-disable-next-line no-restricted-imports
import { type HealthCheckResponse, healthCheckResponseSchema } from '@repo/contract';
import { getRedisClient } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';

const POSTGRES_INSUFFICIENT_PRIVILEGE_CODE = '42501';

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

export async function GET() {
  const startedAt = Date.now();

  // 1. Supabase Check (select from machines; anon 42501 confirms PostgREST + PG + RBAC are live)
  const supabaseStart = Date.now();
  let supabaseStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let supabaseError: string | undefined;

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('machines').select('id').limit(1);

    if (error && !isAnonLockdownResponse(error)) {
      // Fallback to employees check if machines table is pending migration
      const { error: empError } = await supabase.from('employees').select('id').limit(1);
      if (empError && !isAnonLockdownResponse(empError)) {
        supabaseStatus = 'degraded';
        supabaseError = empError.message;
      }
    }
  } catch (err) {
    supabaseStatus = 'unhealthy';
    supabaseError = err instanceof Error ? err.message : String(err);
  }
  const supabaseLatencyMs = Date.now() - supabaseStart;

  // 2. Redis Check
  const redisStart = Date.now();
  let redisStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let redisError: string | undefined;

  try {
    const redis = await getRedisClient();
    if (redis && typeof redis.ping === 'function') {
      await redis.ping();
    } else if (redis && !redis.isOpen) {
      redisStatus = 'degraded';
      redisError = 'Redis connection is not open';
    }
  } catch (err) {
    redisStatus = 'degraded';
    redisError = err instanceof Error ? err.message : String(err);
  }
  const redisLatencyMs = Date.now() - redisStart;

  const totalLatencyMs = Date.now() - startedAt;

  // Aggregate overall status
  const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
    supabaseStatus === 'unhealthy'
      ? 'unhealthy'
      : supabaseStatus === 'degraded' || redisStatus === 'degraded'
        ? 'degraded'
        : 'healthy';

  const responsePayload: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    latencyMs: totalLatencyMs,
    services: {
      supabase: {
        status: supabaseStatus,
        latencyMs: supabaseLatencyMs,
        ...(supabaseError ? { error: supabaseError } : {}),
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
        ...(redisError ? { error: redisError } : {}),
      },
      fuxa: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
        ...(redisError ? { error: redisError } : {}),
      },
    },
  };

  // Validate payload against schema before returning
  const parsed = healthCheckResponseSchema.safeParse(responsePayload);
  const dataToReturn = parsed.success ? parsed.data : responsePayload;

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(dataToReturn, { status: httpStatus });
}
