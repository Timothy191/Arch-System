/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/redis", () => ({
  getCacheStats: jest.fn(),
  getRedisClient: jest.fn(),
}));

const { getCacheStats, getRedisClient } = require("@repo/redis");

describe("GET /api/health/cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns healthy cache stats when redis is connected", async () => {
    getCacheStats.mockReturnValue({ hits: 10, misses: 2 });
    getRedisClient.mockResolvedValue({ isOpen: true });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.hitRate).toBeCloseTo(0.8333, 2);
    expect(json.hits).toBe(10);
    expect(json.misses).toBe(2);
    expect(json.redisConnected).toBe(true);
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });

  it("returns degraded when redis is not connected", async () => {
    getCacheStats.mockReturnValue({ hits: 0, misses: 0 });
    getRedisClient.mockResolvedValue({ isOpen: false });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.hitRate).toBe(0);
    expect(json.redisConnected).toBe(false);
  });
});
