/**
 * @swagger
 * /api/telemetry/push:
 *   post:
 *     summary: Push telemetry data to SCADA
 *     description: Forward machine telemetry to FUXA SCADA server with two-level caching (in-memory + Redis). Accepts Supabase webhook payloads or direct tag updates. Deduplicates unchanged values.
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
 *         description: Internal server error or SCADA unreachable
 */
import { NextResponse } from "next/server";
import { getRedisClient } from "@repo/redis";
import { withValidation } from "@repo/contract/validation";
import { telemetryPushSchema } from "@repo/contract";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";

// L1 cache (in-memory)
let localLastValues = new Map<string, number>();

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
  const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";
  const endpoint = `${fuxaUrl}/api/tag`;
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

  try {
    const fuxaRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FUXA_API_KEY
          ? { Authorization: `Bearer ${process.env.FUXA_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ name, value: numValue }),
    });

    if (!fuxaRes.ok) {
      return NextResponse.json(
        {
          warning: `FUXA SCADA server returned status ${fuxaRes.status}`,
          synced: false,
        },
        { status: 200 },
      );
    }

    localLastValues.set(name, numValue);
    await setRedisLastValue(name, numValue);

    return NextResponse.json({ success: true, synced: true });
  } catch {
    return NextResponse.json(
      {
        warning: "FUXA SCADA server is unreachable",
        synced: false,
      },
      { status: 200 },
    );
  }
});

export async function POST(req: Request) {
  return withBodyLimit(
    req,
    async () => {
      const response = await handlePost(req);
      // withValidation returns Response (standard Web API) while applyCors expects
      // NextResponse. At runtime NextResponse extends Response so the cast is safe.
      return applyCors(req, response as NextResponse);
    },
    { maxSize: 10485760 },
  );
}

async function handlePost(req: Request) {
  try {
    const body = await req.clone().json();
    const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";
    const endpoint = `${fuxaUrl}/api/tag`;

    // 1. Check if this is a Supabase Database Webhook payload
    if (body.table === "machine_telemetry" && body.record) {
      const {
        machine_id,
        engine_rpm,
        engine_temp,
        hydraulic_pressure,
        vibration_level,
        fuel_level,
        bit_depth,
      } = body.record;

      const metrics = {
        engine_rpm,
        engine_temp,
        hydraulic_pressure,
        vibration_level,
        fuel_level,
        bit_depth,
      };

      const results = [];

      for (const [key, value] of Object.entries(metrics)) {
        if (value !== null && value !== undefined) {
          const tagName = `machine_${machine_id}_${key}`;
          const numValue = Number(value);

          // L1 Check
          if (localLastValues.has(tagName) && localLastValues.get(tagName) === numValue) {
            results.push({ tag: tagName, success: true, cached: true });
            continue;
          }

          // L2 Check (Redis)
          const lastVal = await getRedisLastValue(tagName);
          if (lastVal !== null && lastVal === numValue) {
            localLastValues.set(tagName, numValue);
            results.push({ tag: tagName, success: true, cached: true });
            continue;
          }

          // Change detected or cache miss -> send update
          try {
            const fuxaRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(process.env.FUXA_API_KEY
                  ? { Authorization: `Bearer ${process.env.FUXA_API_KEY}` }
                  : {}),
              },
              body: JSON.stringify({ name: tagName, value: numValue }),
            });

            const ok = fuxaRes.ok;
            results.push({ tag: tagName, success: ok });
            if (ok) {
              localLastValues.set(tagName, numValue);
              await setRedisLastValue(tagName, numValue);
            }
          } catch {
            results.push({
              tag: tagName,
              success: false,
              error: "Connection failed",
            });
          }
        }
      }

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
      { params: Promise.resolve({}) },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to forward telemetry" },
      { status: 500 },
    );
  }
}
