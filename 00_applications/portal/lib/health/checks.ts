import { createServerSupabaseClient } from "@repo/supabase/server";
import { getRedisClient } from "@repo/redis";

export type ServiceHealthLevel = "healthy" | "degraded" | "down" | "disabled";

export interface ServiceHealthResult {
  status: ServiceHealthLevel;
  latency_ms: number;
  last_check: string;
  error?: string;
}

function stamp(startedAt: number): Pick<ServiceHealthResult, "latency_ms" | "last_check"> {
  return {
    latency_ms: Date.now() - startedAt,
    last_check: new Date().toISOString(),
  };
}

export async function checkDatabaseHealth(): Promise<ServiceHealthResult> {
  const startedAt = Date.now();
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("employees").select("role").limit(1);

    if (error) {
      return {
        status: "degraded",
        error: error.message,
        ...stamp(startedAt),
      };
    }

    return { status: "healthy", ...stamp(startedAt) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", error: message, ...stamp(startedAt) };
  }
}

export async function checkRedisHealth(): Promise<ServiceHealthResult> {
  const startedAt = Date.now();
  try {
    const redis = await getRedisClient();
    const connected = redis.isOpen ?? false;
    if (!connected) {
      return {
        status: "degraded",
        error: "Redis client not connected",
        ...stamp(startedAt),
      };
    }

    const ping = await redis.ping();
    if (ping !== "PONG") {
      return {
        status: "degraded",
        error: `Unexpected PING response: ${ping}`,
        ...stamp(startedAt),
      };
    }

    return { status: "healthy", ...stamp(startedAt) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", error: message, ...stamp(startedAt) };
  }
}

export async function checkFuxaHealth(): Promise<ServiceHealthResult> {
  const startedAt = Date.now();
  const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL?.trim();

  if (!fuxaUrl) {
    return { status: "disabled", ...stamp(startedAt) };
  }

  try {
    const response = await fetch(fuxaUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return { status: "healthy", ...stamp(startedAt) };
    }

    return {
      status: response.status >= 500 ? "down" : "degraded",
      error: `FUXA returned HTTP ${response.status}`,
      ...stamp(startedAt),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", error: message, ...stamp(startedAt) };
  }
}

export type AggregateHealthLevel = "healthy" | "degraded" | "down";

export function aggregateHealthStatus(
  services: ServiceHealthResult[],
): AggregateHealthLevel {
  const active = services.filter((s) => s.status !== "disabled");
  if (active.length === 0) return "healthy";
  if (active.some((s) => s.status === "down")) return "down";
  if (active.some((s) => s.status === "degraded")) return "degraded";
  return "healthy";
}
