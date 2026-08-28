/**
 * @swagger
 * /api/scada/tags:
 *   get:
 *     summary: FUXA WebAPI tag source (reverse-flow ingest)
 *     description: Serves the current telemetry tag values from the Redis cache in the FUXA WebAPI device shape (`[{id,name,value,type}]`). FUXA polls this endpoint via its WebAPI device `getTags` URL — FUXA exposes no /api/tag write endpoint, so ingest is pull-based (D2-a).
 *     tags:
 *       - SCADA
 *     responses:
 *       200:
 *         description: FUXA WebAPI tag array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   value:
 *                     oneOf:
 *                       - type: number
 *                       - type: string
 *                       - type: "null"
 *                   type:
 *                     type: string
 *                     enum: [number, string]
 *       500:
 *         description: Failed to read SCADA tags
 */

import { NextResponse } from "next/server";
import { getRedisClient } from "@repo/redis";
import { applyCors } from "@/lib/api/cors";

export interface FuxaWebApiTag {
  id: string;
  name: string;
  value: number | string | null;
  type: "number" | "string";
}

// AGENT-TRACE: FUXA ingests external data by *pulling* a flat tag list from a
// WebAPI device (upstream frangoteam/FUXA issue #650 + DeepWiki). The portal's
// telemetry is persisted to Redis by /api/telemetry/push; this route is the
// `getTags` source that FUXA polls. Configure a FUXA WebAPI device with
// getTags = http://host.docker.internal:3000/api/scada/tags (dev) — see
// docs/operations/fuxa-integration-plan.md.

export async function GET(req: Request) {
  try {
    const redis = await getRedisClient();
    const keys = (await redis.keys("telemetry:last:*")) as string[];
    const tags: FuxaWebApiTag[] = [];

    if (keys.length > 0) {
      const values = (await redis.mGet(keys)) as (string | null)[];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined) continue; // noUncheckedIndexedAccess guard
        const name = key.replace(/^telemetry:last:/, "");
        const raw = values[i] ?? null; // coalesce undefined → null
        const num = raw !== null ? Number(raw) : NaN;
        const isNum = !Number.isNaN(num);
        tags.push({
          id: name,
          name,
          value: isNum ? num : raw,
          type: isNum ? "number" : "string",
        });
      }
    }

    return applyCors(req, NextResponse.json(tags));
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to read SCADA tags" },
      { status: 500 },
    );
  }
}
