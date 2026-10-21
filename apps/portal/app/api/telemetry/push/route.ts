/**
 * @swagger
 * /api/telemetry/push:
 *   post:
 *     summary: Push telemetry data to SCADA
 *     description: Store machine telemetry in the Redis cache (system of record) for FUXA to pull via /api/scada/tags (reverse-flow ingest). Two-level dedup (in-memory + Redis). Accepts Supabase webhook payloads or direct tag updates.
 *     tags:
 *       - Telemetry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 description: Supabase webhook payload (auto-detected)
 *                 required:
 *                   - table
 *                   - record
 *                 properties:
 *                   table:
 *                     type: string
 *                     enum: [machine_telemetry]
 *                   record:
 *                     type: object
 *                     properties:
 *                       machine_id:
 *                         type: string
 *                       engine_rpm:
 *                         type: number
 *                       engine_temp:
 *                         type: number
 *                       hydraulic_pressure:
 *                         type: number
 *                       vibration_level:
 *                         type: number
 *                       fuel_level:
 *                         type: number
 *                       bit_depth:
 *                         type: number
 *               - type: object
 *                 description: Direct tag update
 *                 required:
 *                   - name
 *                   - value
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Tag name (e.g., machine_123_engine_rpm)
 *                   value:
 *                     type: number
 *                     description: Tag value
 *     responses:
 *       200:
 *         description: Telemetry processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 synced:
 *                   type: boolean
 *                 cached:
 *                   type: boolean
 *                   description: True if value unchanged (deduplicated)
 *                 webhook:
 *                   type: boolean
 *                   description: True for webhook payload format
 *                 processed:
 *                   type: integer
 *                   description: Number of tags processed (webhook mode)
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tag:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                       cached:
 *                         type: boolean
 *                       error:
 *                         type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */

import { timingSafeEqual } from 'node:crypto';
import { telemetryPushSchema } from '@repo/contract/schemas/telemetry.schema';
import { withValidation } from '@repo/contract/validation';
import { getRedisClient } from '@repo/redis';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';

// L1 cache (in-memory)
const localLastValues = new Map<string, number>();

// AGENT-TRACE: Supabase database-webhook payloads use { table, record } rather
// than the direct { name, value } shape. Only the wrapper is validated here;
// individual metric values are coerced and finiteness-checked below.
const webhookPayloadSchema = z
  .object({
    table: z.literal('machine_telemetry'),
    record: z
      .object({
        machine_id: z.union([z.string().min(1).max(128), z.number()]),
      })
      .passthrough(),
  })
  .passthrough();

function getIngestSecret(): string | null {
  const secret = process.env.TELEMETRY_INGEST_SECRET || process.env.TELEMETRY_WEBHOOK_SECRET;
  return secret && secret.trim().length > 0 ? secret : null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Telemetry writes are a safety-relevant ingest path: unsigned callers could
 * poison the values SCADA views read. Require a shared secret.
 *
 * In non-production environments an unconfigured secret is tolerated so local
 * development and tests keep working; production fails closed.
 */
function authorizeIngest(req: Request): NextResponse | null {
  const secret = getIngestSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Telemetry ingest is not configured.' }, { status: 503 });
    }
    return null;
  }

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const provided =
    req.headers.get('x-telemetry-secret') || req.headers.get('x-webhook-secret') || bearer;

  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized telemetry ingest.' }, { status: 401 });
  }

  return null;
}

export function clearTelemetryCache() {
  localLastValues.clear();
}

async function getRedisLastValue(key: string): Promise<number | null> {
  try {
    const client = await getRedisClient();
    const val = await client.get(`telemetry:last:${key}`);
    return val !== null ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

async function setRedisLastValue(key: string, value: number): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.set(`telemetry:last:${key}`, String(value), { EX: 86400 }); // 24 hours TTL
  } catch {
    // ignore
  }
}

// AGENT-TRACE: The webhook path (body.table === "machine_telemetry") does not
// use telemetryPushSchema — Supabase webhook payloads have a different shape
// ({ table, record }). Only the direct single-tag update path is wrapped with
// withValidation. handlePost parses the body once and routes accordingly.
const handleDirectTag = withValidation(telemetryPushSchema, async (_req, data) => {
  const { name, value } = data;
  const numValue = Number(value);

  // L1 Check
  if (localLastValues.has(name) && localLastValues.get(name) === numValue) {
    return NextResponse.json({ success: true, synced: true, cached: true });
  }

  // L2 Check (Redis)
  const lastVal = await getRedisLastValue(name);
  if (lastVal !== null && lastVal === numValue) {
    localLastValues.set(name, numValue);
    return NextResponse.json({ success: true, synced: true, cached: true });
  }

  // AGENT-TRACE: Reverse-flow ingest (D2-a) — Redis is the system of record.
  // FUXA exposes no /api/tag write endpoint; it pulls tags via /api/scada/tags.
  // On change detected (L1/L2 miss), persist to Redis so FUXA's next poll picks it up.
  localLastValues.set(name, numValue);
  await setRedisLastValue(name, numValue);

  return NextResponse.json({ success: true, synced: true });
});

export async function POST(req: Request) {
  const unauthorized = authorizeIngest(req);
  if (unauthorized) {
    return applyCors(req, unauthorized);
  }

  return withBodyLimit(
    req,
    async () => {
      const response = await handlePost(req);
      // withValidation returns Response (standard Web API) while applyCors expects
      // NextResponse. At runtime NextResponse extends Response so the cast is safe.
      return applyCors(req, response as NextResponse);
    },
    { maxSize: 10485760 }
  );
}

async function handlePost(req: Request) {
  try {
    const body: unknown = await req.clone().json();

    // 1. Check if this is a Supabase Database Webhook payload
    const webhook = webhookPayloadSchema.safeParse(body);
    if (webhook.success) {
      const record = webhook.data.record;
      const { machine_id } = record;

      const metrics = {
        engine_rpm: record.engine_rpm,
        engine_temp: record.engine_temp,
        hydraulic_pressure: record.hydraulic_pressure,
        vibration_level: record.vibration_level,
        fuel_level: record.fuel_level,
        bit_depth: record.bit_depth,
      };

      const entries = Object.entries(metrics)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value));

      const results = await Promise.all(
        entries.map(async ([key, numValue]) => {
          const tagName = `machine_${machine_id}_${key}`;

          // L1 Check
          if (localLastValues.has(tagName) && localLastValues.get(tagName) === numValue) {
            return { tag: tagName, success: true, cached: true };
          }

          // L2 Check (Redis)
          const lastVal = await getRedisLastValue(tagName);
          if (lastVal !== null && lastVal === numValue) {
            localLastValues.set(tagName, numValue);
            return { tag: tagName, success: true, cached: true };
          }

          // AGENT-TRACE: Reverse-flow ingest (D2-a) — persist to Redis (system
          // of record); FUXA pulls via /api/scada/tags. No FUXA REST write call.
          localLastValues.set(tagName, numValue);
          await setRedisLastValue(tagName, numValue);
          return { tag: tagName, success: true };
        })
      );

      return NextResponse.json({
        webhook: true,
        processed: results.length,
        results,
      });
    }

    // 2. Direct single tag value update — delegate to validated handler
    return handleDirectTag(
      new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({}) }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to store telemetry' },
      { status: 500 }
    );
  }
}
