/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/redis", () => ({
  cacheWrap: jest.fn(
    async (_key: string, fn: () => Promise<unknown>, _ttlSeconds: number) => fn(),
  ),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");
const { cacheWrap } = jest.requireMock("@repo/redis");

describe("GET /api/tools/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const req = new Request("http://localhost:3000/api/tools/status");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(cacheWrap).not.toHaveBeenCalled();
  });

  it("returns 200 with tool statuses when authenticated and all tools are online", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const req = new Request("http://localhost:3000/api/tools/status");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      tools: [
        {
          name: "flowise",
          displayName: "Flowise",
          url: "http://localhost:3001",
          description: expect.any(String),
          icon: "Bot",
          color: "#3ecf8e",
          status: "online",
          responseTime: expect.any(Number),
        },
      ],
    });
    expect(cacheWrap).toHaveBeenCalledWith("tools:status", expect.any(Function), 60);
  });

  it("marks a tool offline when the health check request rejects", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });

    global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));

    const req = new Request("http://localhost:3000/api/tools/status");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tools).toHaveLength(1);
    expect(json.tools[0].status).toBe("offline");
    expect(json.tools[0].responseTime).toBeGreaterThanOrEqual(0);
  });

  it("marks a tool offline when the health check responds with a non-ok status", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });

    const req = new Request("http://localhost:3000/api/tools/status");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tools[0].status).toBe("offline");
  });

  it("uses the cache wrapper with the expected key and TTL", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const req = new Request("http://localhost:3000/api/tools/status");
    await GET(req);

    expect(cacheWrap).toHaveBeenCalledTimes(1);
    expect(cacheWrap).toHaveBeenCalledWith(
      "tools:status",
      expect.any(Function),
      60,
    );
  });
});
