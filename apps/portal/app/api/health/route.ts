import { type HealthCheckResponse, healthCheckResponseSchema } from "@repo/contract";
import { getRedisClient } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  // 1. Supabase Check (select from machines)
  const supabaseStart = Date.now();
  let supabaseStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  let supabaseError: string | undefined;

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("machines").select("id").limit(1);

    if (error) {
      // Fallback to employees check if machines table is pending migration
      const { error: empError } = await supabase.from("employees").select("id").limit(1);
      if (empError) {
        supabaseStatus = "degraded";
        supabaseError = empError.message;
      }
    }
  } catch (err) {
    supabaseStatus = "unhealthy";
    supabaseError = err instanceof Error ? err.message : String(err);
  }
  const supabaseLatencyMs = Date.now() - supabaseStart;

  // 2. Redis Check
  const redisStart = Date.now();
  let redisStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  let redisError: string | undefined;

  try {
    const redis = await getRedisClient();
    if (redis && typeof redis.ping === "function") {
      await redis.ping();
    } else if (redis && !redis.isOpen) {
      redisStatus = "degraded";
      redisError = "Redis connection is not open";
    }
  } catch (err) {
    redisStatus = "degraded";
    redisError = err instanceof Error ? err.message : String(err);
  }
  const redisLatencyMs = Date.now() - redisStart;

  // 3. FUXA SCADA Check (2.5s timeout)
  const fuxaStart = Date.now();
  let fuxaStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  let fuxaStatusCode: number | null = null;
  let fuxaError: string | undefined;
  const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";

  try {
    const res = await fetch(fuxaUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(2500),
    });
    fuxaStatusCode = res.status;
    if (!res.ok) {
      fuxaStatus = "degraded";
      fuxaError = `FUXA HTTP status ${res.status}`;
    }
  } catch (err) {
    fuxaStatus = "degraded";
    fuxaError = err instanceof Error ? err.message : "FUXA timeout or connection error";
  }
  const fuxaLatencyMs = Date.now() - fuxaStart;

  const totalLatencyMs = Date.now() - startedAt;

  // Aggregate overall status
  const overallStatus: "healthy" | "degraded" | "unhealthy" =
    supabaseStatus === "unhealthy"
      ? "unhealthy"
      : supabaseStatus === "degraded" || redisStatus === "degraded" || fuxaStatus === "degraded"
      ? "degraded"
      : "healthy";

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
        status: fuxaStatus,
        latencyMs: fuxaLatencyMs,
        statusCode: fuxaStatusCode,
        ...(fuxaError ? { error: fuxaError } : {}),
      },
    },
  };

  // Validate payload against schema before returning
  const parsed = healthCheckResponseSchema.safeParse(responsePayload);
  const dataToReturn = parsed.success ? parsed.data : responsePayload;

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(dataToReturn, { status: httpStatus });
}
