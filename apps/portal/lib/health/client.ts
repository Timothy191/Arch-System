export type TrayServiceStatus = "ok" | "degraded" | "unavailable" | "disabled";
export type TrayOverallStatus = "healthy" | "degraded" | "error";

export interface HealthApiService {
  status?: string;
  latency_ms?: number;
  error?: string;
}

export interface HealthApiResponse {
  status?: string;
  services?: {
    database?: HealthApiService;
    redis?: HealthApiService;
    fuxa?: HealthApiService;
    /** @deprecated OpenAPI alias — same source as database */
    supabase_realtime?: HealthApiService;
  };
  checks?: Record<string, HealthApiService | undefined>;
  latency_ms?: number;
  latencyMs?: number;
  last_check?: string;
  timestamp?: string;
}

export interface MappedTrayHealth {
  status: TrayOverallStatus;
  db: TrayServiceStatus;
  redis: TrayServiceStatus;
  fuxa: TrayServiceStatus;
  responseTime: number;
  timestamp: string;
}

function mapServiceStatus(
  service: HealthApiService | null | undefined,
): TrayServiceStatus {
  if (!service?.status) return "unavailable";

  switch (service.status) {
    case "healthy":
      return "ok";
    case "degraded":
      return "degraded";
    case "disabled":
      return "disabled";
    case "down":
    case "unhealthy":
      return "unavailable";
    default:
      return "unavailable";
  }
}

function resolveService(
  services: HealthApiResponse["services"],
  checks: HealthApiResponse["checks"],
  primary: "database" | "redis" | "fuxa",
  legacy?: keyof NonNullable<HealthApiResponse["services"]>,
): HealthApiService | undefined {
  return services?.[primary] ?? checks?.[primary] ?? (legacy ? services?.[legacy] : undefined);
}

export function mapHealthApiResponse(data: HealthApiResponse): MappedTrayHealth {
  const db = mapServiceStatus(
    resolveService(data.services, data.checks, "database", "supabase_realtime"),
  );
  const redis = mapServiceStatus(resolveService(data.services, data.checks, "redis"));
  const fuxa = mapServiceStatus(resolveService(data.services, data.checks, "fuxa"));

  const rawStatus = data.status ?? "down";
  let status: TrayOverallStatus;
  if (rawStatus === "healthy") {
    status = "healthy";
  } else if (rawStatus === "degraded") {
    status = "degraded";
  } else {
    status = "error";
  }

  return {
    status,
    db,
    redis,
    fuxa,
    responseTime: data.latency_ms ?? data.latencyMs ?? 0,
    timestamp: data.last_check ?? data.timestamp ?? "",
  };
}
