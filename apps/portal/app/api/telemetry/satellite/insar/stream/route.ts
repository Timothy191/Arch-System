/**
 * @swagger
 * /api/telemetry/satellite/insar/stream:
 *   get:
 *     summary: Real-Time InSAR Deformation Telemetry SSE Stream
 *     description: Server-Sent Events (SSE) stream subscribing to Redis pub/sub channel `satellite:insar:stream` for live GeoTIFF deformation point updates.
 *     tags:
 *       - Telemetry
 *     responses:
 *       200:
 *         description: SSE event stream initialized
 */

import { createRedisSubscriber } from "@repo/redis";

// AGENT-TRACE: Server-Sent Events (SSE) stream for real-time InSAR GeoTIFF deformation points
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  let subscriber: Awaited<ReturnType<typeof createRedisSubscriber>> | null = null;
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        subscriber = await createRedisSubscriber();

        await subscriber.subscribe("satellite:insar:stream", (message) => {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch (enqueueErr) {
            // eslint-disable-next-line no-console
            console.error("[InSARStream] Enqueue error:", enqueueErr);
          }
        });

        // Send connection welcome packet
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ event: "connected", timestamp: new Date().toISOString() })}\n\n`
          )
        );

        // Keep-alive heartbeat every 15s
        keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            // Stream closed
          }
        }, 15000);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("[InSARStream] Connection error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err.message || "Stream connection failed" })}\n\n`
          )
        );
        controller.close();
      }
    },
    cancel() {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (subscriber?.isOpen) {
        subscriber.unsubscribe("satellite:insar:stream").catch(() => {});
        subscriber.quit().catch(() => {});
      }
    },
  });

  req.signal.addEventListener("abort", () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (subscriber?.isOpen) {
      subscriber.unsubscribe("satellite:insar:stream").catch(() => {});
      subscriber.quit().catch(() => {});
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
