import { mapHealthApiResponse } from "./client";

describe("mapHealthApiResponse", () => {
  it("maps healthy unified health payload", () => {
    const mapped = mapHealthApiResponse({
      status: "healthy",
      services: {
        database: { status: "healthy", latency_ms: 12 },
        redis: { status: "healthy", latency_ms: 4 },
        fuxa: { status: "healthy", latency_ms: 30 },
      },
      latency_ms: 48,
      last_check: "2026-06-29T12:00:00.000Z",
    });

    expect(mapped.status).toBe("healthy");
    expect(mapped.db).toBe("ok");
    expect(mapped.redis).toBe("ok");
    expect(mapped.fuxa).toBe("ok");
    expect(mapped.responseTime).toBe(48);
  });

  it("maps degraded and down service states", () => {
    const mapped = mapHealthApiResponse({
      status: "degraded",
      services: {
        database: { status: "healthy" },
        redis: { status: "degraded" },
        fuxa: { status: "down" },
      },
      latency_ms: 120,
    });

    expect(mapped.status).toBe("degraded");
    expect(mapped.db).toBe("ok");
    expect(mapped.redis).toBe("degraded");
    expect(mapped.fuxa).toBe("unavailable");
  });

  it("falls back to checks.* when services is absent", () => {
    const mapped = mapHealthApiResponse({
      status: "down",
      checks: {
        database: { status: "down" },
        redis: { status: "healthy" },
        fuxa: { status: "disabled" },
      },
      latencyMs: 88,
      timestamp: "2026-06-29T12:00:00.000Z",
    });

    expect(mapped.status).toBe("error");
    expect(mapped.db).toBe("unavailable");
    expect(mapped.redis).toBe("ok");
    expect(mapped.fuxa).toBe("disabled");
    expect(mapped.responseTime).toBe(88);
    expect(mapped.timestamp).toBe("2026-06-29T12:00:00.000Z");
  });

  it("supports legacy supabase_realtime alias for database row", () => {
    const mapped = mapHealthApiResponse({
      status: "healthy",
      services: {
        supabase_realtime: { status: "healthy" },
        redis: { status: "healthy" },
        fuxa: { status: "disabled" },
      },
    });

    expect(mapped.db).toBe("ok");
  });
});
