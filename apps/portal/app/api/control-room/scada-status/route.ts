/**
 * @swagger
 * /api/control-room/scada-status:
 *   get:
 *     summary: Retrieve SCADA & Redis Degraded Status
 *     description: Returns SCADA server health, Redis fallback telemetry cache status, and active tag metadata for Control Room resilience.
 *     tags:
 *       - Control Room
 *     responses:
 *       200:
 *         description: SCADA status and cached telemetry retrieved
 */

import { NextResponse } from "next/server";
import { getRedisClient } from "@repo/redis";
import { applyCors } from "@/lib/api/cors";

// AGENT-TRACE: Route to provide Control Room components with Redis-backed SCADA status and fallback telemetry metadata
export async function GET(req: Request) {
  try {
    const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";
    let isFuxaHealthy = false;
    let latencyMs = 0;

    const startTime = Date.now();
    try {
      const res = await fetch(`${fuxaUrl}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      latencyMs = Date.now() - startTime;
      isFuxaHealthy = res.ok;
    } catch {
      latencyMs = Date.now() - startTime;
      isFuxaHealthy = false;
    }

    let cachedTagCount = 0;
    let redisConnected = false;

    try {
      const redis = await getRedisClient();
      redisConnected = true;

      // Scan Redis for cached telemetry keys
      const keys = await redis.keys("telemetry:last:*");
      cachedTagCount = keys.length;
    } catch {
      redisConnected = false;
    }

    const overallStatus = isFuxaHealthy
      ? "healthy"
      : redisConnected
      ? "degraded"
      : "offline";

    const body = {
      status: overallStatus,
      fuxa_healthy: isFuxaHealthy,
      fuxa_url: fuxaUrl,
      latency_ms: latencyMs,
      redis_connected: redisConnected,
      cached_tag_count: cachedTagCount,
      timestamp: new Date().toISOString(),
    };

    return applyCors(req, NextResponse.json(body));
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch SCADA status" },
      { status: 500 }
    );
  }
}
