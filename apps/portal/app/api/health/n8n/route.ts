/**
 * @swagger
 * /api/health/n8n:
 *   get:
 *     summary: n8n Workflow Engine health check
 *     description: Probes external n8n automation engine. n8n is an optional service; if offline or unreachable, returns HTTP 200 with optional: true and backend_status: normal so the system backend functions like normal.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: n8n health status (always 200 as n8n is an optional integration)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unavailable]
 *                 optional:
 *                   type: boolean
 *                 backend_status:
 *                   type: string
 *                 latency_ms:
 *                   type: integer
 *                 last_check:
 *                   type: string
 *                   format: date-time
 *                 details:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     http_status:
 *                       type: integer
 *                       nullable: true
 *                     error:
 *                       type: string
 *                       nullable: true
 */
import { checkN8nHealth } from "@repo/utils/n8n";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest) {
  const result = await checkN8nHealth({ timeoutMs: 2500 });

  const payload = {
    status: result.status,
    optional: true,
    backend_status: "normal",
    latency_ms: result.latencyMs,
    last_check: new Date().toISOString(),
    details: {
      url: result.url,
      http_status: result.statusCode,
      error: result.error ?? null,
    },
  };

  // n8n is optional: Always return HTTP 200 so external status monitors and health probes
  // do not trigger alerts or break portal operations when n8n is absent.
  return NextResponse.json(payload, { status: 200 });
}
