/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

jest.mock("@/features/departments/components/engineering/breakdowns/actions", () => ({
  createBreakdown: jest.fn(),
  bookOutBreakdown: jest.fn(),
  directCheckout: jest.fn(),
}));

const { createServerSupabaseClient } = require("@repo/supabase/server");
const { logError } = require("@/lib/errors/error-logger");
const actions = require("@/features/departments/components/engineering/breakdowns/actions");

function buildRequest(payload: unknown) {
  return new Request("http://localhost:3000/api/ai/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function resolveChain(rows: unknown[]) {
  const promise = Promise.resolve({ data: rows, error: null });
  const chain = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
  };

  Object.assign(chain, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  });

  return chain;
}

function mockSupabase({
  user = { id: "auth-1" },
  employee = { id: "emp-1", department_id: "dept-1" },
  breakdowns = [],
  logs = [],
  hours = [],
}: {
  user?: unknown;
  employee?: unknown;
  breakdowns?: unknown[];
  logs?: unknown[];
  hours?: unknown[];
} = {}) {
  createServerSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn(async () => ({ data: { user }, error: null })),
    },
    from: jest.fn((table: string) => {
      if (table === "employees") return resolveChain(employee ? [employee] : []);
      if (table === "breakdowns") return resolveChain(breakdowns);
      if (table === "daily_logs") return resolveChain(logs);
      if (table === "machine_hours") return resolveChain(hours);
      return resolveChain([]);
    }),
  });
}

describe("POST /api/ai/actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a malformed payload", async () => {
    const res = await POST(buildRequest({ kind: "nope", tool: "get_active_breakdowns" }));
    expect(res.status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects when missing a tool name", async () => {
    const res = await POST(buildRequest({ kind: "read", args: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Missing tool name");
  });

  it("returns 401 when signed out", async () => {
    mockSupabase({ user: null, employee: null });
    const res = await POST(buildRequest({ kind: "read", tool: "get_active_breakdowns", args: {} }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 403 when the employee has no department", async () => {
    mockSupabase({ employee: { id: "emp-1", department_id: null } });
    const res = await POST(buildRequest({ kind: "read", tool: "get_active_breakdowns", args: {} }));
    expect(res.status).toBe(403);
  });

  it("returns active breakdowns for get_active_breakdowns", async () => {
    const breakdowns = [
      {
        id: "b-1",
        fleet_id: "MD-101",
        machine_name: "MD-101",
        machine_type: "Drill",
        date_in: "2026-09-08",
        time_in: "06:00",
        reason: "Hydraulic leak",
        status: "active",
      },
    ];
    mockSupabase({ breakdowns });

    const res = await POST(buildRequest({ kind: "read", tool: "get_active_breakdowns", args: {} }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.breakdowns).toHaveLength(1);
    expect(json.data.breakdowns[0]).toMatchObject({ fleet_id: "MD-101", reason: "Hydraulic leak" });
  });

  it("aggregates shift summary hours across today's logs", async () => {
    const logs = [
      { id: "l1", shift: "DAY", notes: null },
      { id: "l2", shift: "DAY", notes: null },
    ];
    const hours = [{ hours_worked: 4.5 }, { hours_worked: 3.2 }];
    mockSupabase({
      breakdowns: [{ id: "b-1", fleet_id: "MD-101", machine_type: "Drill" }],
      logs,
      hours,
    });

    const res = await POST(buildRequest({ kind: "read", tool: "get_shift_summary", args: {} }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.total_machine_hours).toBeCloseTo(7.7, 5);
    expect(json.data.machine_hour_records).toBe(2);
    expect(json.data.active_breakdowns).toHaveLength(1);
    expect(json.data.shift).toBe("DAY");
    expect(json.data.summary).toContain("1 active breakdown(s)");
  });

  it("returns 400 for an unknown read tool", async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ kind: "read", tool: "bogus", args: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Unknown read tool");
  });

  it("creates a breakdown via the server action with the resolved department", async () => {
    mockSupabase({});
    actions.createBreakdown.mockResolvedValue({ success: true });

    const res = await POST(
      buildRequest({
        kind: "write",
        tool: "create_breakdown",
        args: {
          fleet_id: "md-102",
          machine_type: "Loader",
          date_in: "2026-09-08",
          time_in: "06:15",
          reason: "Transmission fault",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(actions.createBreakdown).toHaveBeenCalledWith(
      "dept-1",
      expect.objectContaining({ fleet_id: "md-102", machine_type: "Loader" }),
    );
    expect((await res.json()).data).toEqual({ success: true });
  });

  it("returns 400 when create_breakdown input is invalid", async () => {
    mockSupabase({});
    const res = await POST(
      buildRequest({
        kind: "write",
        tool: "create_breakdown",
        args: { machine_type: "Loader" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid input");
    expect(actions.createBreakdown).not.toHaveBeenCalled();
  });

  it("returns 400 for book_out_breakdown without a breakdown_id", async () => {
    mockSupabase({});
    const res = await POST(
      buildRequest({
        kind: "write",
        tool: "book_out_breakdown",
        args: { date_out: "2026-09-08", time_out: "14:00" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("breakdown_id");
    expect(actions.bookOutBreakdown).not.toHaveBeenCalled();
  });

  it("books out a breakdown once confirmed", async () => {
    mockSupabase({});
    actions.bookOutBreakdown.mockResolvedValue({ success: true });

    const res = await POST(
      buildRequest({
        kind: "write",
        tool: "book_out_breakdown",
        args: { breakdown_id: "b-1", date_out: "2026-09-08", time_out: "14:00" },
      }),
    );
    expect(res.status).toBe(200);
    expect(actions.bookOutBreakdown).toHaveBeenCalledWith(
      "b-1",
      expect.objectContaining({ date_out: "2026-09-08", time_out: "14:00" }),
    );
  });

  it("routes direct_checkout to the direct checkout action", async () => {
    mockSupabase({});
    actions.directCheckout.mockResolvedValue({ success: true });

    const res = await POST(
      buildRequest({
        kind: "write",
        tool: "direct_checkout",
        args: {
          fleet_id: "MD-103",
          machine_type: "Crusher",
          reason: "Routine",
          date_out: "2026-09-08",
          time_out: "15:00",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(actions.directCheckout).toHaveBeenCalledWith("dept-1", expect.any(Object));
  });

  it("returns 400 for an unknown write tool", async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ kind: "write", tool: "bogus", args: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Unknown write tool");
  });

  it("returns 500 and logs when the database errors", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockRejectedValue(new Error("db failure")),
      },
      from: jest.fn(),
    });

    const res = await POST(buildRequest({ kind: "read", tool: "get_active_breakdowns", args: {} }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("db failure");
    expect(logError).toHaveBeenCalledWith(expect.any(Error), { context: "aria_actions_route" });
  });
});
