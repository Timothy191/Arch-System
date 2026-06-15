import { NextRequest, NextResponse } from "next/server";

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
}

export async function GET(req: NextRequest) {
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

  // Determine overall status
  const serviceStatuses = Object.values(services).filter(
    (s): s is ServiceHealth => s !== null,
  );
  const anyDown = serviceStatuses.some((s) => s.status === "down");
  const anyDegraded = serviceStatuses.some((s) => s.status === "degraded");
  const _allHealthy = serviceStatuses.every((s) => s.status === "healthy");

  let status: "healthy" | "degraded" | "down";
  let overallStatus: string;

  if (anyDown) {
    status = "down";
    overallStatus = "One or more services are down";
  } else if (anyDegraded) {
    status = "degraded";
    overallStatus = "One or more services are degraded";
  } else if (serviceStatuses.length === 0) {
    status = "down";
    overallStatus = "No services responded";
  } else {
    status = "healthy";
    overallStatus = "All services operational";
  }

  const last_check = new Date().toISOString();
  const _latency_ms = Date.now() - startTime;

  const response: HealthResponse = {
    status,
    overall_status: overallStatus,
    services,
    last_check,
  };

  // Return appropriate HTTP status based on overall health
  const httpStatusCode =
    status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

  return NextResponse.json(response, { status: httpStatusCode });
}
