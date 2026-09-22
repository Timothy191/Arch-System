/**
 * @swagger
 * /api/control-room/scada-status:
 *   get:
 *     summary: Retrieve SCADA & Redis Degraded Status
 *     description: Returns SCADA server health with state machine, hysteresis, and outage tracking.
 *     tags:
 *       - Control Room
 */

import { getRedisClient } from "@repo/redis";
import { NextResponse } from "next/server";
import { applyCors } from "@/lib/api/cors";
import { logError } from "@/lib/errors/error-logger";
import { addEvent, setAttributes, withAsyncSpan } from "@/lib/observability/tracing";

const SCADA_STATE_KEY = "control-room:scada:state";
const HYSTERESIS_MS = 10000;

// Best-effort in-memory circuit breaker
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

export async function GET(req: Request) {
  return withAsyncSpan("api_scada_status", {}, async () => {
    try {
      const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";
      let reportedFuxaHealthy = false;
      let latencyMs = 0;
      let redisConnected = false;
      let lastGoodAt: string | null = null;
      let previousState = "offline";

      let cachedTagCount = 0;

      const redis = await getRedisClient().catch(() => null);
      if (redis) {
        redisConnected = true;
        try {
          const [savedStateStr, tagKeys] = await Promise.all([
            typeof redis.get === "function" ? redis.get(SCADA_STATE_KEY).catch(() => null) : null,
            typeof redis.keys === "function" ? redis.keys("telemetry:last:*").catch(() => []) : [],
          ]);
          cachedTagCount = Array.isArray(tagKeys) ? tagKeys.length : 0;
          if (savedStateStr) {
            const parsed = JSON.parse(savedStateStr);
            lastGoodAt = parsed.lastGoodAt || null;
            previousState = parsed.state || "offline";
          }
        } catch (e) {
          // ignore cache read error
        }
      }

      // Circuit Breaker State Check
      const now = Date.now();
      let breakerTripped = false;
      if (breakerOpenUntil > now) {
        breakerTripped = true;
        latencyMs = 0;
        reportedFuxaHealthy = false;
      } else {
        // Probe FUXA
        const startTime = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000); // 3s budget
          const res = await fetch(fuxaUrl, { method: "HEAD", signal: controller.signal });
          clearTimeout(timeout);
          latencyMs = Date.now() - startTime;

          if (res.ok) {
            reportedFuxaHealthy = true;
            consecutiveFailures = 0; // reset breaker
          } else {
            reportedFuxaHealthy = false;
            consecutiveFailures++;
          }
        } catch (err: any) {
          latencyMs = Date.now() - startTime;
          reportedFuxaHealthy = false;
          consecutiveFailures++;
        }

        // Open breaker if failed 5 times in a row, for 30s
        if (consecutiveFailures >= 5) {
          breakerOpenUntil = now + 30000;
        }
      }

      setAttributes({
        scada_healthy: reportedFuxaHealthy,
        latency_ms: latencyMs,
        breaker_tripped: breakerTripped,
      });

      let currentState = reportedFuxaHealthy ? "healthy" : redisConnected ? "degraded" : "offline";

      // Hysteresis
      if (reportedFuxaHealthy && previousState !== "healthy" && lastGoodAt) {
        const timeSinceGood = now - new Date(lastGoodAt).getTime();
        if (timeSinceGood > 0 && timeSinceGood < HYSTERESIS_MS) {
          currentState = previousState; // Avoid flapping, retain degraded state
        } else {
          lastGoodAt = new Date().toISOString();
        }
      } else if (reportedFuxaHealthy) {
        lastGoodAt = new Date().toISOString();
      }

      const reasons: string[] = [];
      if (breakerTripped) reasons.push("Circuit breaker open due to consecutive failures");
      else if (!reportedFuxaHealthy) reasons.push("SCADA endpoint unreachable or timed out");

      if (!redisConnected) reasons.push("Redis telemetry cache unavailable");

      const isStale = !!lastGoodAt && now - new Date(lastGoodAt).getTime() > 60000;

      const payload = {
        status: currentState,
        state: currentState,
        fuxa_healthy: reportedFuxaHealthy,
        redis_connected: redisConnected,
        cached_tag_count: cachedTagCount,
        reportedFuxaHealthy,
        breakerTripped,
        latencyMs,
        lastGoodAt,
        staleSince: isStale ? lastGoodAt : null,
        reasons,
        timestamp: new Date().toISOString(),
      };

      if (redis && typeof redis.set === "function") {
        try {
          await redis.set(SCADA_STATE_KEY, JSON.stringify(payload), { EX: 60 });
        } catch (cacheErr) {
          logError(cacheErr, { context: "scada_status_cache_write" });
        }
      }

      addEvent("scada_probe_complete", { state: currentState, latencyMs });
      return applyCors(req, NextResponse.json(payload));
    } catch (err: any) {
      logError(err, { context: "scada_status_error" });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
