import { NextResponse } from "next/server";
import { getRedisClient } from "@repo/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6380";

  try {
    const redis = await getRedisClient();
    const connected = redis.isOpen ?? false;
    const ping = connected ? await redis.ping() : null;
    const healthy = connected && ping === "PONG";

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "degraded",
        connected,
        ping,
        url,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: "unhealthy",
        connected: false,
        url,
        error: message,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
