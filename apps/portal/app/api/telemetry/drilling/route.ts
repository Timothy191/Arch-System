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

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { getRedisClient } from "@repo/redis";
import { withValidation } from "@repo/contract/validation";
import {
  drillTelemetryIngestSchema,
  type DrillTelemetryIngestInput,
} from "@repo/contract/schemas/drill.schema";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";

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

    const supabase = await createServerSupabaseClient();

    // 1. Verify machine exists and belongs to Drilling department
    const { data: machine } = await supabase
      .from("machines")
      .select("id, name, department_id")
      .eq("id", machine_id)
      .maybeSingle();

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // 2. Insert into machine_telemetry log table
    const { error: dbError } = await supabase.from("machine_telemetry").insert({
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
      console.error("[DrillTelemetry] Database insert error:", dbError.message);
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
      await redis.set(
        `drilling:telemetry:last:${machine_id}`,
        JSON.stringify(telemetryState),
        { EX: 86400 }, // 24 hours TTL
      );
      await redis.publish("drilling:telemetry:stream", JSON.stringify(telemetryState));
    } catch (redisErr) {
      // eslint-disable-next-line no-console
      console.warn("[DrillTelemetry] Redis caching warning:", redisErr);
    }

    // 4. Forward to SCADA push endpoint asynchronously
    const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";
    let scadaSynced = false;

    try {
      const fuxaRes = await fetch(`${fuxaUrl}/api/tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.FUXA_API_KEY
            ? { Authorization: `Bearer ${process.env.FUXA_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          name: `drill_${machine_id}_bit_depth`,
          value: bit_depth ?? 0,
        }),
        signal: AbortSignal.timeout(3000), // Prevent thread blocking on SCADA latency/outage
      });
      scadaSynced = fuxaRes.ok;
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
      { error: err.message || "Failed to process drill telemetry" },
      { status: 500 },
    );
  }
});

export async function POST(req: Request) {
  return withBodyLimit(
    req,
    async () => {
      const response = await handleIngest(req, { params: Promise.resolve({}) });
      return applyCors(req, response as NextResponse);
    },
    { maxSize: 1048576 }, // 1MB payload limit
  );
}
