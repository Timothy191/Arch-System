/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock("@repo/redis/cache", () => ({
  cacheSet: jest.fn(),
  cacheGet: jest.fn(),
}));

const { createServiceRoleClient } = require("@repo/supabase/service-role");
const { cacheSet, cacheGet } = require("@repo/redis/cache");

describe("GET /api/health/warmup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns ok when postgres and redis are healthy", async () => {
    createServiceRoleClient.mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    }));

    cacheSet.mockResolvedValue("OK");
    cacheGet.mockResolvedValue("123");

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.components.postgres).toBe("ok");
    expect(json.components.redis).toBe("ok");
    expect(typeof json.latencyMs).toBe("number");
  });

  it("returns degraded when postgres errors", async () => {
    createServiceRoleClient.mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: "db down" } }),
    }));

    cacheSet.mockResolvedValue("OK");
    cacheGet.mockResolvedValue("123");

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.components.postgres).toContain("error");
    expect(json.components.redis).toBe("ok");
  });

  it("returns degraded when redis cache fails", async () => {
    createServiceRoleClient.mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    }));

    cacheSet.mockRejectedValue(new Error("redis write failed"));

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.components.postgres).toBe("ok");
    expect(json.components.redis).toContain("error");
  });
});
