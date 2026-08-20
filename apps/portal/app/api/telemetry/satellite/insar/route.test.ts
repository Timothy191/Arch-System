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

describe("POST /api/telemetry/satellite/insar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid body payload", async () => {
    const req = new Request("http://localhost:3000/api/telemetry/satellite/insar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("ingests spatial deformation telemetry and evaluates risk level", async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "sat-123",
                department_id: "123e4567-e89b-12d3-a456-426614174000",
                location_name: "Pit Wall North",
              },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "dept-safety-123" },
            }),
          }),
        }),
      }),
    };

    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    const req = new Request("http://localhost:3000/api/telemetry/satellite/insar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department_id: "123e4567-e89b-12d3-a456-426614174000",
        satellite_name: "Sentinel-1",
        acquisition_date: "2026-08-20",
        reference_date: "2026-08-01",
        location_name: "Pit Wall North - Sector 2",
        latitude: -25.74,
        longitude: 28.22,
        displacement_mm: -18.5,
        coherence_index: 0.75,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.risk_level).toBe("critical");
    expect(body.escalation_triggered).toBe(true);
  });
});
