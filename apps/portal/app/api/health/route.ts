import { NextResponse } from "next/server";
import {
  aggregateHealthStatus,
  checkDatabaseHealth,
  checkFuxaHealth,
  checkRedisHealth,
} from "~/lib/health/checks";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const last_check = new Date().toISOString();

  const [database, redis, fuxa] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkFuxaHealth(),
  ]);

  const status = aggregateHealthStatus([database, redis, fuxa]);
  const latency_ms = Date.now() - startedAt;

  const services = {
    database,
    redis,
    fuxa,
    // OpenAPI compatibility alias — same Postgres connectivity probe
    supabase_realtime: database,
  };

  const checks = {
    database,
    redis,
    fuxa,
  };

  const httpStatus = status === "down" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      overall_status: status,
      services,
      checks,
      last_check,
      timestamp: last_check,
      latency_ms,
      latencyMs: latency_ms,
    },
    { status: httpStatus },
  );
}
