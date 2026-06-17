import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/observability/metrics";

/**
 * @swagger
 * /api/metrics/prometheus:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     description: Exposes Prometheus-compatible metrics for Control Room operations. This endpoint can be scraped by Prometheus server or Grafana for monitoring and alerting.
 *     tags:
 *       - Metrics
 *     responses:
 *       200:
 *         description: Prometheus metrics in text format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               description: Prometheus metrics exposition format
 *       500:
 *         description: Error generating metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
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
