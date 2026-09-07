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
  });

  it("returns healthy when database and redis are healthy", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ role: "admin" }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.checks.database.status).toBe("healthy");
    expect(json.checks.redis.status).toBe("healthy");
    expect(json.checks.redis.connected).toBe(true);
    expect(typeof json.latencyMs).toBe("number");
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });

  it("returns degraded when database errors but redis is healthy", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: "db down" } }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.checks.database.status).toBe("degraded");
    expect(json.checks.redis.status).toBe("healthy");
  });

  it("returns unhealthy when redis throws", async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ role: "admin" }], error: null }),
    });

    getRedisClient.mockRejectedValue(new Error("redis connection failed"));

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("unhealthy");
    expect(json.checks.redis.status).toBe("unhealthy");
    expect(json.checks.redis.error).toBe("redis connection failed");
  });
});
