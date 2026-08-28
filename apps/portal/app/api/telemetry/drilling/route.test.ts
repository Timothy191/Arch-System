/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    set: jest.fn().mockResolvedValue("OK"),
    publish: jest.fn().mockResolvedValue(1),
  }),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

describe("POST /api/telemetry/drilling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid body payload", async () => {
    const req = new Request("http://localhost:3000/api/telemetry/drilling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid_field: 123 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when target machine is not found", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = new Request("http://localhost:3000/api/telemetry/drilling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machine_id: "123e4567-e89b-12d3-a456-426614174000",
        bit_depth: 25.5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Machine not found");
  });

  it("successfully ingests drill telemetry payload", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table) => {
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: "123e4567-e89b-12d3-a456-426614174000",
                    name: "DR-101",
                    department_id: "dept-1",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "machine_telemetry") {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const req = new Request("http://localhost:3000/api/telemetry/drilling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machine_id: "123e4567-e89b-12d3-a456-426614174000",
        engine_rpm: 1800,
        bit_depth: 45.2,
        penetration_rate: 12.5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.machine_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    // Reverse-flow ingest (D2-a): FUXA pulls /api/scada/tags — no FUXA REST write.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
