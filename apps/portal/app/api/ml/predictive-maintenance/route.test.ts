/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

describe("GET /api/ml/predictive-maintenance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const authOk = () => ({ data: { user: { id: "user-1" } } });

  const buildSupabase = ({
    breakdowns = [],
    breakdownError = null,
    _machines = [],
    _machinesError = null,
  } = {}) => ({
    auth: {
      getUser: jest.fn().mockResolvedValue(authOk()),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            data: breakdowns,
            error: breakdownError,
          }),
        }),
      }),
    }),
  });

  const machineQuery = (machines = [], error = null) => ({
    select: jest.fn().mockReturnValue({
      in: jest.fn().mockResolvedValue({ data: machines, error }),
    }),
  });

  it("returns 401 when user is not authenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when breakdowns query fails", async () => {
    const supabase = buildSupabase({
      breakdowns: null,
      breakdownError: { message: "database unavailable" },
    });
    createServerSupabaseClient.mockResolvedValue(supabase);

    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "database unavailable" });
  });

  it("returns empty predictions when there are no breakdowns", async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabase({ breakdowns: [] }));

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictions: [] });
  });

  it("returns empty predictions when no machine exceeds the breakdown threshold", async () => {
    const supabase = buildSupabase({
      breakdowns: [
        { machine_id: "machine-1", date_in: new Date().toISOString() },
        { machine_id: "machine-1", date_in: new Date().toISOString() },
      ],
    });
    supabase.from
      .mockReturnValueOnce(supabase.from({ select: jest.fn() }))
      .mockReturnValueOnce(machineQuery([]));
    createServerSupabaseClient.mockResolvedValue(supabase);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictions: [] });
  });

  it("returns high-risk predictions when a machine exceeds the breakdown threshold", async () => {
    const supabase = buildSupabase({
      breakdowns: [
        { machine_id: "machine-1", date_in: new Date().toISOString() },
        { machine_id: "machine-1", date_in: new Date().toISOString() },
        { machine_id: "machine-1", date_in: new Date().toISOString() },
      ],
    });
    supabase.from
      .mockReturnValueOnce(supabase.from({ select: jest.fn() }))
      .mockReturnValueOnce(
        machineQuery([{ id: "machine-1", name: "Excavator A", type: "excavator", active: true }]),
      );
    createServerSupabaseClient.mockResolvedValue(supabase);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      predictions: [
        {
          machine_id: "machine-1",
          machine_name: "Excavator A",
          type: "excavator",
          risk_level: "HIGH",
          confidence: 0.85,
          reason:
            "Machine has experienced 3 breakdowns in the last 30 days. Model (mock) predicts an 85% chance of critical failure within 72 hours.",
          recommended_action:
            "Schedule immediate preventative maintenance and check hydraulic systems.",
        },
      ],
    });
  });

  it("returns empty predictions when machine details query returns no data", async () => {
    const supabase = buildSupabase({
      breakdowns: [
        { machine_id: "machine-1", date_in: new Date().toISOString() },
        { machine_id: "machine-1", date_in: new Date().toISOString() },
        { machine_id: "machine-1", date_in: new Date().toISOString() },
      ],
    });
    supabase.from
      .mockReturnValueOnce(supabase.from({ select: jest.fn() }))
      .mockReturnValueOnce(machineQuery([]));
    createServerSupabaseClient.mockResolvedValue(supabase);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictions: [] });
  });

  it("returns 500 on unexpected route error", async () => {
    createServerSupabaseClient.mockRejectedValue(new Error("unexpected failure"));

    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "unexpected failure" });
  });
});
