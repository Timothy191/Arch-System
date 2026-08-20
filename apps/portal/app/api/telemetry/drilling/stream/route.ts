/**
 * @swagger
 * /api/telemetry/drilling/stream:
 *   get:
 *     summary: Real-Time Drill Rig Telemetry SSE Stream
 *     description: Server-Sent Events (SSE) endpoint subscribing to Redis pub/sub channel `drilling:telemetry:stream` to stream live rig telemetry updates.
 *     tags:
 *       - Telemetry
 *     responses:
 *       200:
 *         description: SSE event stream initialized
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */

import { createRedisSubscriber } from "@repo/redis";

// AGENT-TRACE: Server-Sent Events (SSE) stream for real-time drill rig telemetry
// Subscribes to Redis pub/sub channel "drilling:telemetry:stream" and pushes updates to clients
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  let subscriber: Awaited<ReturnType<typeof createRedisSubscriber>> | null = null;
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        subscriber = await createRedisSubscriber();

        // Subscribe to drilling telemetry pub/sub channel
        await subscriber.subscribe("drilling:telemetry:stream", (message) => {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch (enqueueErr) {
            // eslint-disable-next-line no-console
            console.error("[DrillStream] Enqueue error:", enqueueErr);
          }
        });

        // Initial welcome event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ event: "connected", timestamp: new Date().toISOString() })}\n\n`
          )
        );

        // Keep-alive heartbeat every 15 seconds to prevent proxy timeouts
        keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            // Controller closed
          }
        }, 15000);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("[DrillStream] Connection error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err.message || "Failed to initialize telemetry stream" })}\n\n`
          )
        );
        controller.close();
      }
    },
    cancel() {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (subscriber?.isOpen) {
        subscriber.unsubscribe("drilling:telemetry:stream").catch(() => {});
        subscriber.quit().catch(() => {});
      }
    },
  });

  // Handle client abort / disconnect signal
  req.signal.addEventListener("abort", () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (subscriber?.isOpen) {
      subscriber.unsubscribe("drilling:telemetry:stream").catch(() => {});
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
