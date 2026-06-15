import { getMonolithizedDashboard } from "./dashboard-service";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/redis", () => ({
  cacheWrap: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);
const { cacheWrap } = jest.requireMock("@repo/redis");

const MOCK_PAYLOAD = {
  department_id: "dept-drilling",
  daily_logs: [
    {
      id: "dl-1",
      log_date: "2026-05-17",
      shift: "day" as const,
      notes: "Normal operations",
      sync_status: "synced" as const,
      idempotency_key: "key-1",
      last_synced_at: "2026-05-17T12:00:00Z",
    },
  ],
  breakdowns: [],
  safety_incidents: [],
};

describe("getMonolithizedDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls cacheWrap with correct cache key and 15s TTL", async () => {
    cacheWrap.mockImplementation(
      async (_key: string, fn: () => Promise<unknown>) => fn(),
    );

    const mockRpc = jest
      .fn()
      .mockResolvedValue({ data: MOCK_PAYLOAD, error: null });
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
      rpc: mockRpc,
    });

    await getMonolithizedDashboard("dept-drilling");

    expect(cacheWrap).toHaveBeenCalledWith(
      "dept:dashboard:monolith:dept-drilling",
      expect.any(Function),
      15,
    );
  });

  it("returns payload from cacheWrap when cache hits", async () => {
    cacheWrap.mockResolvedValue(MOCK_PAYLOAD);

    const result = await getMonolithizedDashboard("dept-drilling");

    expect(result).toEqual(MOCK_PAYLOAD);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("calls the Supabase RPC with correct dept_id on cache miss", async () => {
    cacheWrap.mockImplementation(
      async (_key: string, fn: () => Promise<unknown>) => fn(),
    );

    const mockRpc = jest
      .fn()
      .mockResolvedValue({ data: MOCK_PAYLOAD, error: null });
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
      rpc: mockRpc,
    });

    const result = await getMonolithizedDashboard("dept-drilling");

    expect(mockRpc).toHaveBeenCalledWith(
      "get_monolithized_department_dashboard_payload",
      { dept_id: "dept-drilling" },
    );
    expect(result).toEqual(MOCK_PAYLOAD);
  });

  it("throws when Supabase RPC returns an error", async () => {
    cacheWrap.mockImplementation(
      async (_key: string, fn: () => Promise<unknown>) => fn(),
    );

    const mockRpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "RPC not found" },
    });
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
      rpc: mockRpc,
    });

    await expect(getMonolithizedDashboard("dept-bad")).rejects.toThrow(
      "Failed to query dashboard data",
    );
  });

  it("uses department-specific cache key for each department", async () => {
    const keys: string[] = [];
    cacheWrap.mockImplementation(
      async (key: string, fn: () => Promise<unknown>) => {
        keys.push(key);
        return fn();
      },
    );

    const mockRpc = jest
      .fn()
      .mockResolvedValue({ data: MOCK_PAYLOAD, error: null });
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
      rpc: mockRpc,
    });

    await getMonolithizedDashboard("dept-drilling");
    await getMonolithizedDashboard("dept-production");

    expect(keys[0]).toBe("dept:dashboard:monolith:dept-drilling");
    expect(keys[1]).toBe("dept:dashboard:monolith:dept-production");
    expect(keys[0]).not.toBe(keys[1]);
  });
});
