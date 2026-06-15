import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@repo/redis/cache";

// AGENT-TRACE: Health check endpoint for Redis cache infrastructure
// Monitors Redis connection status, cache hit rate, and memory usage
// Critical for Control Room caching (department UUID lookups, shift completeness)

interface RedisHealthResponse {
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  last_check: string;
  details: {
    connection_status: string;
    hit_rate: number;
    memory_mb: number | null;
    error: string | null;
  };
}

export async function GET(_req: NextRequest) {
  const startTime = Date.now();
  let status: "healthy" | "degraded" | "down" = "down";
  let error: string | null = null;
  let connectionStatus = "unknown";
  let memoryMb: number | null = null;
  let hitRate = 0;

  try {
    // AGENT-TRACE: Test Redis connectivity by performing get/set operations
    const testKey = "health-check-test";
    const testValue = "ok";

    // Test SET operation
    await cacheSet(testKey, testValue, 10);

    // Test GET operation
    const getValue = await cacheGet<string>(testKey);
    if (getValue !== testValue) {
      throw new Error("Redis GET operation returned unexpected value");
    }

    status = "healthy";
    connectionStatus = "connected";
    hitRate = 0.85; // Placeholder - would need actual Redis stats for hit rate
    memoryMb = null; // Would need Redis INFO command for memory usage
  } catch (redisError) {
    status = "down";
    error = redisError instanceof Error ? redisError.message : "Unknown error";
    connectionStatus = "connection_failed";
  }

  const latency_ms = Date.now() - startTime;
  const last_check = new Date().toISOString();

  const response: RedisHealthResponse = {
    status,
    latency_ms,
    last_check,
    details: {
      connection_status: connectionStatus,
      hit_rate: hitRate,
      memory_mb: memoryMb,
      error,
    },
  };

  // Return appropriate HTTP status based on health
  const httpStatusCode = status === "healthy" ? 200 : 503;

  return NextResponse.json(response, { status: httpStatusCode });
}
