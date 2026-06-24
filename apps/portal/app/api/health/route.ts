import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { getRedisClient } from "@repo/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, any> = {};
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  // 1. Check Supabase / PostgreSQL Database connectivity
  try {
    const supabase = await createServerSupabaseClient();
    // Fetch a single row/count from a basic table to check if connection works
    const { error } = await supabase.from("employees").select("role").limit(1);

    if (error) {
      checks.database = { status: "degraded", error: error.message };
      status = "degraded";
    } else {
      checks.database = { status: "healthy" };
    }
  } catch (err: any) {
    checks.database = { status: "unhealthy", error: err.message || String(err) };
    status = "unhealthy";
  }

  // 2. Check Redis Cache connectivity
  try {
    const redis = await getRedisClient();
    const redisConnected = redis.isOpen ?? false;
    checks.redis = {
      status: redisConnected ? "healthy" : "degraded",
      connected: redisConnected,
    };
    if (!redisConnected) {
      if (status !== "unhealthy") {
        status = "degraded";
      }
    }
  } catch (err: any) {
    checks.redis = { status: "unhealthy", error: err.message || String(err) };
    status = "unhealthy";
  }

  const responseStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks,
    },
    { status: responseStatus },
  );
}
