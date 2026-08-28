/**
 * @jest-environment node
 */

import { POST, clearTelemetryCache } from "./route";

// Redis is disabled in tests — setRedisLastValue/getRedisLastValue catch the
// rejection and no-op, so the L1 in-memory cache is the effective dedup store.
jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn().mockRejectedValue(new Error("Redis disabled in tests")),
}));

describe("POST /api/telemetry/push (reverse-flow ingest — Redis is system of record)", () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearTelemetryCache();
  });

  function createRequest(body: unknown) {
    return new Request("http://localhost/api/telemetry/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("rejects direct requests missing name or value with 400", async () => {
    const req = createRequest({ name: "test-tag" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Request body validation failed");
  });

  it("stores a direct single-tag payload in Redis and never calls FUXA", async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    const req = createRequest({ name: "machine_1_engine_rpm", value: 1200 });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.synced).toBe(true);

    // AGENT-TRACE: reverse-flow ingest — FUXA is never POSTed to; it pulls /api/scada/tags.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("processes Supabase database webhook payloads and stores all tags", async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    const webhookBody = {
      type: "INSERT",
      table: "machine_telemetry",
      schema: "public",
      record: {
        id: "telemetry-123",
        machine_id: "machine-uuid-456",
        department_id: "dept-789",
        engine_rpm: 1500,
        engine_temp: 92.4,
        hydraulic_pressure: 210.5,
        vibration_level: 0.12,
        fuel_level: 82.5,
        bit_depth: 14.2,
      },
      old_record: null,
    };

    const req = createRequest(webhookBody);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.webhook).toBe(true);
    expect(json.processed).toBe(6); // 6 metrics are non-null and mapped
    expect(json.results).toHaveLength(6);
    expect(json.results.every((r: { success: boolean }) => r.success)).toBe(true);

    // Reverse-flow: no FUXA REST write — Redis is the system of record.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips storing duplicate tag values (L1 delta-diff caching)", async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    // First request — L1 miss → store.
    const req1 = createRequest({ name: "machine_1_engine_rpm", value: 1200 });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(json1.synced).toBe(true);

    // Second (duplicate) request — L1 hit → cached, no store path, no fetch.
    const req2 = createRequest({ name: "machine_1_engine_rpm", value: 1200 });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.synced).toBe(true);
    expect(json2.cached).toBe(true);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
