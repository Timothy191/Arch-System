import { NextRequest, NextResponse } from "next/server";
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
 *       401:
 *         description: Unauthorized - Scrape token mismatch
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Error generating metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */

export async function GET(req: NextRequest) {
  try {
    // AGENT-TRACE: Optional token validation for Prometheus scraping security
    const scrapeToken = process.env.METRICS_SCRAPE_TOKEN;
    if (scrapeToken) {
      const authHeader = req.headers.get("Authorization");
      const queryToken = req.nextUrl.searchParams.get("token");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : queryToken;

      if (token !== scrapeToken) {
        return new NextResponse("Unauthorized", {
          status: 401,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      }
    }

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
