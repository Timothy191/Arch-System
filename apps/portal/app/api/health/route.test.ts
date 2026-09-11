/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn(),
}));

const { createServerSupabaseClient } = require("@repo/supabase/server");
const { getRedisClient } = require("@repo/redis");

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as any;
  });

  it("returns healthy status response when all services respond cleanly", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: "m-1" }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue("PONG"),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(["healthy", "degraded"]).toContain(json.status);
    expect(json.services.supabase.status).toBe("healthy");
    expect(json.services.redis.status).toBe("healthy");
    expect(typeof json.latencyMs).toBe("number");
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });

  it("returns degraded status when FUXA fetch fails", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: "m-1" }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue("PONG"),
    });

    global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused")) as any;

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.services.fuxa.status).toBe("degraded");
  });

  it("returns unhealthy status when database throws critical exception", async () => {
    createServerSupabaseClient.mockRejectedValue(new Error("Fatal DB Connection Error"));

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue("PONG"),
    });

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("unhealthy");
    expect(json.services.supabase.status).toBe("unhealthy");
  });
});
