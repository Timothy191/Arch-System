import { NextResponse } from "next/server";
import { getRedisClient } from "@repo/redis";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";
import { telemetryPushSchema } from "@repo/contract";

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

export async function POST(req: Request) {
  return withBodyLimit(
    req,
    async () => {
      const response = await handlePost(req);
      return applyCors(req, response);
    },
    { maxSize: 10485760 },
  );
}

async function handlePost(req: Request) {
  try {
    const webhookCheck = req.clone();
    const body = await webhookCheck.json();
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
          if (
            localLastValues.has(tagName) &&
            localLastValues.get(tagName) === numValue
          ) {
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

    // 2. Otherwise, treat as a direct single tag value update
    const webhookCheck2 = req.clone();
    const body2 = await webhookCheck2.json().catch(() => ({}));
    if (!body2.name || body2.value === undefined || body2.value === null) {
      return NextResponse.json(
        { error: "Missing required fields: name, value" },
        { status: 400 },
      );
    }

    const parsed = await validateBody(req, telemetryPushSchema);
    if (parsed instanceof NextResponse) return parsed;

    const { name, value } = parsed.data;
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to forward telemetry" },
      { status: 500 },
    );
  }
}
