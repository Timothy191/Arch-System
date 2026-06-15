import { NextResponse } from "next/server";
import { getCacheStats, getRedisClient } from "@repo/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getCacheStats();
  let redisConnected = false;
  try {
    const redis = await getRedisClient();
    redisConnected = redis.isOpen ?? false;
  } catch {
    // Redis not available
  }

  const total = stats.hits + stats.misses;
  const hitRate =
    total > 0 ? Math.round((stats.hits / total) * 10000) / 10000 : 0;

  return NextResponse.json({
    status: redisConnected ? "healthy" : "degraded",
    hitRate,
    ...stats,
    redisConnected,
    timestamp: new Date().toISOString(),
  });
}
