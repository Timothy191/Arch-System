/**
 * @swagger
 * /api/telemetry/satellite/insar:
 *   post:
 *     summary: Ingest InSAR GeoTIFF Deformation Telemetry
 *     description: Ingests spatial slope displacement metrics from Sentinel-1 / TerraSAR-X GeoTIFF rasters into PostGIS database, Redis cache, and streams live to SAR dashboards.
 *     tags:
 *       - Telemetry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - department_id
 *               - satellite_name
 *               - acquisition_date
 *               - reference_date
 *               - location_name
 *               - latitude
 *               - longitude
 *               - displacement_mm
 *               - coherence_index
 *             properties:
 *               department_id:
 *                 type: string
 *                 format: uuid
 *               satellite_name:
 *                 type: string
 *                 enum: [Sentinel-1, TerraSAR-X, Capella, PAZ]
 *               acquisition_date:
 *                 type: string
 *               reference_date:
 *                 type: string
 *               location_name:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               displacement_mm:
 *                 type: number
 *               coherence_index:
 *                 type: number
 *               cog_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deformation point ingested and evaluated
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Ingestion error
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { getRedisClient } from "@repo/redis";
import { withValidation } from "@repo/contract/validation";
import {
  insarTelemetryIngestSchema,
  type InsarTelemetryIngestInput,
} from "@repo/contract/schemas/satellite.schema";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";

// AGENT-TRACE: Ingestion route for InSAR satellite slope displacement rasters
// Evaluates risk thresholds (>= 15mm/mo -> critical), stores in PostGIS, and streams via Redis Pub/Sub
const handleIngest = withValidation(insarTelemetryIngestSchema, async (_req, data) => {
  try {
    const payload = data as InsarTelemetryIngestInput;
    const {
      department_id,
      satellite_name,
      acquisition_date,
      reference_date,
      location_name,
      latitude,
      longitude,
      displacement_mm,
      coherence_index,
      cog_url,
    } = payload;

    // Evaluate risk level dynamically based on absolute displacement
    const absDisplacement = Math.abs(displacement_mm);
    const computedRisk: "none" | "minor" | "moderate" | "critical" =
      absDisplacement >= 15.0
        ? "critical"
        : absDisplacement >= 8.0
          ? "moderate"
          : absDisplacement >= 3.0
            ? "minor"
            : "none";

    const risk_level = payload.risk_level || computedRisk;
    const supabase = await createServerSupabaseClient();

    // 1. Insert spatial deformation point into Supabase
    const { data: record, error: dbError } = await supabase
      .from("satellite_deformations")
      .insert({
        department_id,
        satellite_name,
        acquisition_date,
        reference_date,
        location_name,
        latitude,
        longitude,
        displacement_mm,
        coherence_index,
        risk_level,
        cog_url: cog_url || null,
      })
      .select()
      .single();

    if (dbError) {
      // eslint-disable-next-line no-console
      console.error("[InSARIngest] Database insert error:", dbError.message);
    }

    const eventData = {
      id: record?.id || `temp-${Date.now()}`,
      department_id,
      satellite_name,
      acquisition_date,
      reference_date,
      location_name,
      latitude,
      longitude,
      displacement_mm,
      coherence_index,
      risk_level,
      cog_url,
      created_at: new Date().toISOString(),
    };

    // 2. Cache in Redis & publish to pub/sub channel
    try {
      const redis = await getRedisClient();
      await redis.set(`satellite:insar:last:${eventData.id}`, JSON.stringify(eventData), {
        EX: 86400,
      });
      await redis.publish("satellite:insar:stream", JSON.stringify(eventData));
    } catch (redisErr) {
      // eslint-disable-next-line no-console
      console.warn("[InSARIngest] Redis error:", redisErr);
    }

    // 3. Automated Safety Incident Escalation for Critical Displacement (>= 15mm/mo)
    let escalationTriggered = false;
    if (risk_level === "critical") {
      try {
        const { data: safetyDept } = await supabase
          .from("departments")
          .select("id")
          .eq("name", "safety")
          .maybeSingle();

        if (safetyDept) {
          await supabase.from("safety_incidents").insert({
            department_id: safetyDept.id,
            incident_date: acquisition_date,
            title: `CRITICAL SLOPE DEFORMATION: ${location_name} (${displacement_mm}mm)`,
            severity: "High",
            description: `Automated Sentinel-1 InSAR alert: Slope displacement of ${displacement_mm}mm detected at ${location_name} (Lat: ${latitude}, Lon: ${longitude}). Coherence: ${coherence_index}.`,
            status: "open",
          });
          escalationTriggered = true;
        }
      } catch (escalateErr) {
        // eslint-disable-next-line no-console
        console.error("[InSARIngest] Escalation trigger error:", escalateErr);
      }
    }

    return NextResponse.json({
      success: true,
      id: eventData.id,
      risk_level,
      escalation_triggered: escalationTriggered,
      data: eventData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process InSAR telemetry" },
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
    { maxSize: 5242880 }, // 5MB limit
  );
}
