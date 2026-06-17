import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@repo/logger/next";

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Unified health check for all services
 *     description: Aggregates health status from FUXA, Supabase Realtime, and Redis
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Services are healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, down]
 *                 overall_status:
 *                   type: string
 *                 services:
 *                   type: object
 *                   properties:
 *                     fuxa:
 *                       $ref: '#/components/schemas/ServiceHealth'
 *                     supabase_realtime:
 *                       $ref: '#/components/schemas/ServiceHealth'
 *                     redis:
 *                       $ref: '#/components/schemas/ServiceHealth'
 *                 last_check:
 *                   type: string
 *                   format: date-time
 *                 latency_ms:
 *                   type: integer
 *       503:
 *         description: One or more critical services are down
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 * components:
 *   schemas:
 *     ServiceHealth:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, down]
 *         latency_ms:
 *           type: number
 *         last_check:
 *           type: string
 *           format: date-time
 *     HealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, down]
 *         overall_status:
 *           type: string
 *         services:
 *           type: object
 *         last_check:
 *           type: string
 *           format: date-time
 */

// AGENT-TRACE: Unified health check endpoint aggregating all service health
// Provides single endpoint for monitoring all Control Room dependencies
// Used by monitoring systems and load balancers for health checks

interface ServiceHealth {
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  last_check: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "down";
  overall_status: string;
  services: {
    fuxa: ServiceHealth | null;
    supabase_realtime: ServiceHealth | null;
    redis: ServiceHealth | null;
  };
  last_check: string;
  latency_ms: number;
}

export const GET = withLogging(
  async (req: NextRequest, _context: { params: Promise<unknown> }) => {
    const startTime = Date.now();
    const baseUrl = req.nextUrl.origin;

    // AGENT-TRACE: Fetch health status from all individual health check endpoints
    // Run in parallel for efficiency, handle failures gracefully
    const [fuxaHealth, supabaseHealth, redisHealth] = await Promise.allSettled([
      fetch(`${baseUrl}/api/health/fuxa`, {
        signal: AbortSignal.timeout(5000),
      }).then((res) => res.json()),
      fetch(`${baseUrl}/api/health/supabase-realtime`, {
        signal: AbortSignal.timeout(5000),
      }).then((res) => res.json()),
      fetch(`${baseUrl}/api/health/redis`, {
        signal: AbortSignal.timeout(5000),
      }).then((res) => res.json()),
    ]);

    // Process results
    const services: {
      fuxa: ServiceHealth | null;
      supabase_realtime: ServiceHealth | null;
      redis: ServiceHealth | null;
    } = {
      fuxa: fuxaHealth.status === "fulfilled" ? fuxaHealth.value : null,
      supabase_realtime:
        supabaseHealth.status === "fulfilled" ? supabaseHealth.value : null,
      redis: redisHealth.status === "fulfilled" ? redisHealth.value : null,
    };

    // Determine critical vs non-critical status
    // supabase_realtime and redis are critical; fuxa is non-critical
    const isSupabaseRealtimeDown =
      !services.supabase_realtime ||
      services.supabase_realtime.status === "down";
    const isRedisDown = !services.redis || services.redis.status === "down";
    const isCriticalDown = isSupabaseRealtimeDown || isRedisDown;

    const isFuxaDown = !services.fuxa || services.fuxa.status === "down";

    const serviceStatuses = Object.values(services).filter(
      (s): s is ServiceHealth => s !== null,
    );
    const anyDegraded = serviceStatuses.some((s) => s.status === "degraded");

    let status: "healthy" | "degraded" | "down";
    let overallStatus: string;

    if (isCriticalDown) {
      status = "down";
      overallStatus = "One or more critical services are down";
    } else if (isFuxaDown || anyDegraded) {
      status = "degraded";
      overallStatus = isFuxaDown
        ? "SCADA (FUXA) service is down/unavailable"
        : "One or more services are degraded";
    } else if (serviceStatuses.length === 0) {
      status = "down";
      overallStatus = "No services responded";
    } else {
      status = "healthy";
      overallStatus = "All services operational";
    }

    const last_check = new Date().toISOString();
    const latency_ms = Date.now() - startTime;

    const response: HealthResponse = {
      status,
      overall_status: overallStatus,
      services,
      last_check,
      latency_ms,
    };

    // Return appropriate HTTP status based on overall health
    // Degraded state returns HTTP 200, Down state returns HTTP 503
    const httpStatusCode =
      status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

    return NextResponse.json(response, { status: httpStatusCode });
  },
);
