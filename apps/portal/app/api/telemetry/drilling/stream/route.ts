/**
 * @swagger
 * /api/telemetry/drilling/stream:
 *   get:
 *     summary: Real-Time Drill Rig Telemetry SSE Stream
 *     description: Server-Sent Events (SSE) endpoint reading the capped Redis stream `drilling:telemetry:stream`. Reconnects replay missed entries via the standard Last-Event-ID header; pub/sub is used only on adapters without XREAD support.
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

import { createRedisSubscriber } from '@repo/redis';
import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { authorizeTelemetryStream } from '@/lib/api/telemetry-auth';
import { logError } from '@/lib/errors/error-logger';

export const maxDuration = 60;

const DRILL_TELEMETRY_STREAM_KEY = 'drilling:telemetry:stream';
const STREAM_READ_BLOCK_MS = 15000;
const STREAM_READ_COUNT = 100;
const HEARTBEAT_MS = 15000;
const VALID_STREAM_ID = /^\d+-\d+$/;
const STREAM_CONNECTION_LIMIT = { windowMs: 60_000, maxRequests: 60 };

type TelemetryClient = Awaited<ReturnType<typeof createRedisSubscriber>>;

// Reject malformed Last-Event-ID values before they reach XREAD.
function resolveStartId(req: Request): string {
  const lastEventId = req.headers.get('last-event-id');
  return lastEventId && VALID_STREAM_ID.test(lastEventId) ? lastEventId : '$';
}

async function pumpStream(
  client: TelemetryClient,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  startId: string,
  isClosed: () => boolean
): Promise<void> {
  let nextId = startId;

  while (!isClosed()) {
    const response = await client.xRead([{ key: DRILL_TELEMETRY_STREAM_KEY, id: nextId }], {
      BLOCK: STREAM_READ_BLOCK_MS,
      COUNT: STREAM_READ_COUNT,
    });

    if (!response) continue;

    for (const stream of response) {
      for (const entry of stream.messages) {
        nextId = entry.id;
        // The ingest route writes the telemetry JSON as the `data` field.
        const payload = entry.message.data ?? JSON.stringify(entry.message);
        if (!isClosed()) {
          controller.enqueue(encoder.encode(`id: ${entry.id}\ndata: ${payload}\n\n`));
        }
      }
    }
  }
}

async function openTelemetryStream(req: Request): Promise<NextResponse> {
  const unauthorized = authorizeTelemetryStream(req);
  if (unauthorized) return unauthorized;

  const encoder = new TextEncoder();
  const startId = resolveStartId(req);

  let client: TelemetryClient | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let streamMode = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (!client?.isOpen) return;
    if (streamMode) {
      // Breaks a pending blocking XREAD immediately.
      client.disconnect().catch(() => {});
    } else {
      client.unsubscribe(DRILL_TELEMETRY_STREAM_KEY).catch(() => {});
      client.quit().catch(() => {});
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        client = await createRedisSubscriber();

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() })}\n\n`
          )
        );

        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            // Controller closed
          }
        }, HEARTBEAT_MS);

        if (typeof client.xRead === 'function') {
          streamMode = true;
          void pumpStream(client, controller, encoder, startId, () => closed).catch((err) => {
            if (closed) return;
            logError(err instanceof Error ? err : new Error(String(err)));
            try {
              controller.close();
            } catch {
              // Already closed
            }
            cleanup();
          });
        } else {
          // Serverless REST adapters cannot block on XREAD; retain the
          // existing lossy pub/sub behavior there.
          await client.subscribe(DRILL_TELEMETRY_STREAM_KEY, (message) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            } catch {
              // Controller closed
            }
          });
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to initialize telemetry stream';
        logError(err instanceof Error ? err : new Error(String(err)));
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
          controller.close();
        } catch {
          // Controller closed
        }
        cleanup();
      }
    },
    cancel() {
      cleanup();
    },
  });

  // Handle client abort / disconnect signal
  req.signal.addEventListener('abort', cleanup);

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  return withRateLimit(req, () => openTelemetryStream(req), {
    customLimit: STREAM_CONNECTION_LIMIT,
  });
}
