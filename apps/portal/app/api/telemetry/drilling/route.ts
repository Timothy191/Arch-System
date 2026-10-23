/**
 * @swagger
 * /api/telemetry/drilling:
 *   post:
 *     summary: Ingest drill rig telemetry data
 *     description: Ingests real-time IoT metrics from drill rigs (penetration rate, pull-down force, bit depth, RPM) into database and Redis, forwarding updates to SCADA FUXA.
 *     tags:
 *       - Telemetry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - machine_id
 *             properties:
 *               machine_id:
 *                 type: string
 *                 format: uuid
 *               engine_rpm:
 *                 type: number
 *               engine_temp:
 *                 type: number
 *               hydraulic_pressure:
 *                 type: number
 *               vibration_level:
 *                 type: number
 *               fuel_level:
 *                 type: number
 *               bit_depth:
 *                 type: number
 *               penetration_rate:
 *                 type: number
 *               pull_down_force:
 *                 type: number
 *               rotary_speed:
 *                 type: number
 *               timestamp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Telemetry successfully ingested and synchronized
 *       400:
 *         description: Invalid telemetry payload
 *       500:
 *         description: Server ingestion error
 */

import {
  type DrillTelemetryIngestInput,
  drillTelemetryIngestSchema,
} from '@repo/contract/schemas/drill.schema';
import { withValidation } from '@repo/contract/validation';
import {
  addUnique,
  appendToStream,
  getRedisClient,
  incrementCounter,
  recordSample,
} from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { checkRateLimit, withRateLimit } from '@/lib/api/rate-limit-middleware';
import { authorizeIngest } from '@/lib/api/telemetry-auth';

const DRILL_TELEMETRY_STREAM_KEY = 'drilling:telemetry:stream';
const DRILL_TELEMETRY_STREAM_MAXLEN = 1000;
const TELEMETRY_STATE_TTL_SECONDS = 86_400;

// Ingest sizing: a machine may publish up to 10 samples/sec; the per-IP entry
// cap covers several rigs aggregated behind one gateway address.
const INGEST_RATE_LIMIT = { windowMs: 60_000, maxRequests: 2400 };
const MACHINE_RATE_LIMIT = { windowMs: 60_000, maxRequests: 600 };
const INGEST_PATH = '/api/telemetry/drilling';

interface LiveMetrics {
  machineId: string;
  bitDepth?: number | null;
  penetrationRate?: number | null;
}

/**
 * Live operational numbers, accumulated in Redis so the dashboard reads one
 * counter instead of aggregating `machine_telemetry` per poll. Every call is
 * a single Redis command and none of them can fail the ingest.
 */
async function recordLiveTelemetry(metrics: LiveMetrics): Promise<void> {
  const { machineId, bitDepth, penetrationRate } = metrics;
  await Promise.all([
    incrementCounter('telemetry.drilling.ingest', { dimension: machineId }),
    addUnique({ name: 'telemetry.drilling.machines', identifier: machineId, granularity: 'hour' }),
    ...(typeof bitDepth === 'number'
      ? [
          recordSample({
            name: 'telemetry.drilling.bit_depth',
            value: bitDepth,
            dimension: machineId,
          }),
        ]
      : []),
    ...(typeof penetrationRate === 'number'
      ? [
          recordSample({
            name: 'telemetry.drilling.penetration_rate',
            value: penetrationRate,
            dimension: machineId,
          }),
        ]
      : []),
  ]);
}

// AGENT-TRACE: Ingestion route for Drill Rig IoT telemetry
// Updates machine_telemetry table, updates Redis cache, and syncs with SCADA tag system
const handleIngest = withValidation(drillTelemetryIngestSchema, async (_req, data) => {
  try {
    const payload = data as DrillTelemetryIngestInput;
    const {
      machine_id,
      engine_rpm,
      engine_temp,
      hydraulic_pressure,
      vibration_level,
      fuel_level,
      bit_depth,
      penetration_rate,
      pull_down_force,
      rotary_speed,
      timestamp = new Date().toISOString(),
    } = payload;

    const machineLimit = await checkRateLimit(
      `machine:${machine_id}`,
      MACHINE_RATE_LIMIT,
      INGEST_PATH
    );

    if (!machineLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Telemetry rate limit exceeded for machine ${machine_id}.`,
            code: 'RATE_LIMIT_EXCEEDED',
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': machineLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': machineLimit.resetTime.toString(),
            'Retry-After': (machineLimit.retryAfter || 60).toString(),
          },
        }
      );
    }

    const supabase = await createServerSupabaseClient();

    // 1. Verify machine exists and belongs to Drilling department
    const { data: machine } = await supabase
      .from('machines')
      .select('id, name, department_id')
      .eq('id', machine_id)
      .maybeSingle();

    if (!machine) {
      return NextResponse.json(
        { success: false, error: { message: 'Machine not found', code: 'API_ERROR' } },
        { status: 404 }
      );
    }

    // 2. Insert into machine_telemetry log table
    const { error: dbError } = await supabase.from('machine_telemetry').insert({
      machine_id,
      engine_rpm: engine_rpm ?? null,
      engine_temp: engine_temp ?? null,
      hydraulic_pressure: hydraulic_pressure ?? null,
      vibration_level: vibration_level ?? null,
      fuel_level: fuel_level ?? null,
      bit_depth: bit_depth ?? null,
      created_at: timestamp,
    });

    if (dbError) {
      // eslint-disable-next-line no-console
      console.error('[DrillTelemetry] Database insert error:', dbError.message);
    }

    // 3. Cache telemetry state in Redis for rapid dashboard retrieval
    const telemetryState = {
      machine_id,
      machine_name: machine.name,
      engine_rpm,
      engine_temp,
      hydraulic_pressure,
      vibration_level,
      fuel_level,
      bit_depth,
      penetration_rate,
      pull_down_force,
      rotary_speed,
      updated_at: timestamp,
    };

    try {
      const redis = await getRedisClient();
      const serializedState = JSON.stringify(telemetryState);
      await redis.set(`drilling:telemetry:last:${machine_id}`, serializedState, {
        EX: TELEMETRY_STATE_TTL_SECONDS,
      });
      // Streams keep a bounded replay window so SSE clients can resume with
      // Last-Event-ID after a disconnect. `appendToStream` issues XADD on both
      // transports — the typed `xAdd` exists only on the TCP client, so REST
      // deployments used to fall through to publish() and lose the replay log.
      await appendToStream({
        key: DRILL_TELEMETRY_STREAM_KEY,
        fields: { data: serializedState },
        maxLen: DRILL_TELEMETRY_STREAM_MAXLEN,
      });
      await recordLiveTelemetry({
        machineId: machine_id,
        bitDepth: bit_depth,
        penetrationRate: penetration_rate,
      });
    } catch (redisErr) {
      // eslint-disable-next-line no-console
      console.warn('[DrillTelemetry] Redis caching warning:', redisErr);
    }

    // 4. Reverse-flow ingest (D2-a) — expose drilling metrics as FUXA-pullable
    // tags in the telemetry:last:* Redis namespace (read by /api/scada/tags).
    // FUXA exposes no /api/tag write endpoint; it pulls via its WebAPI device.
    let scadaSynced = false;
    try {
      const redis = await getRedisClient();
      const drillMetrics: Record<string, number | null | undefined> = {
        bit_depth,
        engine_rpm,
        engine_temp,
        hydraulic_pressure,
        vibration_level,
        fuel_level,
        penetration_rate,
        pull_down_force,
        rotary_speed,
      };
      for (const [metric, val] of Object.entries(drillMetrics)) {
        if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
          await redis.set(`telemetry:last:drill_${machine_id}_${metric}`, String(val), {
            EX: TELEMETRY_STATE_TTL_SECONDS,
          });
        }
      }
      scadaSynced = true;
    } catch {
      scadaSynced = false;
    }

    return NextResponse.json({
      success: true,
      machine_id,
      timestamp,
      scada_synced: scadaSynced,
      data: telemetryState,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process drill telemetry' },
      { status: 500 }
    );
  }
});

export async function POST(req: Request) {
  return withRateLimit(
    req,
    async () => {
      const unauthorized = authorizeIngest(req);
      if (unauthorized) {
        return applyCors(req, unauthorized);
      }

      return withBodyLimit(
        req,
        async () => {
          const response = await handleIngest(req, { params: Promise.resolve({}) });
          return applyCors(req, response as NextResponse);
        },
        { maxSize: 1048576 } // 1MB payload limit
      );
    },
    { customLimit: INGEST_RATE_LIMIT }
  );
}
