/**
 * @swagger
 * /api/telemetry/drilling/stream:
 *   get:
 *     summary: Real-Time Drill Rig Telemetry SSE Stream
 *     description: Server-Sent Events (SSE) endpoint reading the capped Redis stream `drilling:telemetry:stream`. Reconnects replay missed entries via the standard Last-Event-ID header. Blocking XREAD on TCP, short polls on serverless REST.
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

import { createRedisSubscriber, readNew, supportsBlockingReads } from '@repo/redis';
import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { authorizeTelemetryStream } from '@/lib/api/telemetry-auth';
import { logError } from '@/lib/errors/error-logger';

export const maxDuration = 60;

const DRILL_TELEMETRY_STREAM_KEY = 'drilling:telemetry:stream';
const STREAM_READ_BLOCK_MS = 15000;
const STREAM_READ_COUNT = 100;
/** Floor between two reads: an empty non-blocking read must not spin the loop. */
const STREAM_POLL_MS = 1000;
const HEARTBEAT_MS = 15000;
const VALID_STREAM_ID = /^\d+-\d+$/;
const STREAM_CONNECTION_LIMIT = { windowMs: 60_000, maxRequests: 60 };

type TelemetryClient = Awaited<ReturnType<typeof createRedisSubscriber>>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reject malformed Last-Event-ID values before they reach XREAD.
function resolveStartId(req: Request): string {
  const lastEventId = req.headers.get('last-event-id');
  return lastEventId && VALID_STREAM_ID.test(lastEventId) ? lastEventId : '$';
}

/**
 * Replay-and-follow loop for one SSE client.
 *
 * Reads the same Redis Stream on both transports: `BLOCK` on TCP, short polls
 * on serverless REST (where blocking is impossible and Pub/Sub is unavailable,
 * so the previous implementation delivered nothing at all). A failed read
 * returns empty rather than throwing, so a transient Redis blip leaves the
 * connection idle and self-healing instead of closing it.
 */
async function pumpStream(
  client: TelemetryClient,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  startId: string,
  isClosed: () => boolean
): Promise<void> {
  const blockMs = supportsBlockingReads() ? STREAM_READ_BLOCK_MS : undefined;
  let nextId = startId;

  while (!isClosed()) {
    const startedAt = Date.now();
    const payloads = await readNew(DRILL_TELEMETRY_STREAM_KEY, {
      from: nextId,
      count: STREAM_READ_COUNT,
      client,
      ...(blockMs ? { blockMs } : {}),
    });

    for (const payload of payloads) {
      for (const entry of payload.entries) {
        nextId = entry.id;
        // The ingest route writes the telemetry JSON as the `data` field.
        const data = entry.fields.data ?? JSON.stringify(entry.fields);
        if (isClosed()) return;
        controller.enqueue(encoder.encode(`id: ${entry.id}\ndata: ${data}\n\n`));
      }
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < STREAM_POLL_MS) await sleep(STREAM_POLL_MS - elapsed);
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

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (!client?.isOpen) return;
    // Breaks a pending blocking XREAD immediately. REST has no socket to drop.
    client.disconnect().catch(() => {});
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
