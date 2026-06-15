import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/observability/metrics";

/**
 * Prometheus Metrics Endpoint
 *
 * Exposes Prometheus-compatible metrics for Control Room operations.
 * This endpoint can be scraped by Prometheus server or Grafana.
 *
 * GET /api/metrics
 */

export async function GET() {
  try {
    const metrics = await getMetrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    return new NextResponse("Error generating metrics", {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}
