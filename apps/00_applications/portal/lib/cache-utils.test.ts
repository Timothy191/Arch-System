import { withCache } from "./cache-utils";
import { cacheGetWithStats, cacheSetWithTags } from "@repo/redis";

jest.mock("@repo/redis", () => ({
  cacheGetWithStats: jest.fn(),
  cacheSetWithTags: jest.fn(),
  buildCacheKey: jest.fn((category, ...parts) => `${category}:${parts.join(":")}`),
  CACHE_TTL_REGISTRY: {
    auth: { l1Seconds: 15, l2Seconds: 3600 },
    dept: { l1Seconds: 15, l2Seconds: 3600 },
  },
}));

const mockCacheGetWithStats = cacheGetWithStats as jest.Mock;
const mockCacheSetWithTags = cacheSetWithTags as jest.Mock;

describe("withCache coalescing & single-flight behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("serves from cache on hit", async () => {
    mockCacheGetWithStats.mockResolvedValue({
      value: "cached-data",
      source: "l1",
    });
    const fn = jest.fn().mockResolvedValue("fresh-data");

    const result = await withCache(fn, { category: "auth", keyParts: ["123"] });

    expect(result).toBe("cached-data");
    expect(fn).not.toHaveBeenCalled();
    expect(mockCacheGetWithStats).toHaveBeenCalledTimes(1);
  });

  it("calls fn on cache miss and caches result", async () => {
    mockCacheGetWithStats.mockResolvedValue({ value: null, source: null });
    const fn = jest.fn().mockResolvedValue("fresh-data");

    const result = await withCache(fn, { category: "auth", keyParts: ["123"] });

    expect(result).toBe("fresh-data");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockCacheSetWithTags).toHaveBeenCalledWith("auth:123", "fresh-data", 3600, undefined);
  });

  it("coalesces concurrent duplicate requests (single-flight)", async () => {
    mockCacheGetWithStats.mockResolvedValue({ value: null, source: null });

    let resolveFn: (_value: string) => void = () => {};
    const pendingPromise = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    const fn = jest.fn().mockReturnValue(pendingPromise);

    // Trigger multiple concurrent calls
    const promise1 = withCache(fn, { category: "auth", keyParts: ["456"] });
    const promise2 = withCache(fn, { category: "auth", keyParts: ["456"] });
    const promise3 = withCache(fn, { category: "auth", keyParts: ["456"] });

    // Await them only after resolving the underlying mock function
    resolveFn("coalesced-data");

    const [res1, res2, res3] = await Promise.all([promise1, promise2, promise3]);

    expect(res1).toBe("coalesced-data");
    expect(res2).toBe("coalesced-data");
    expect(res3).toBe("coalesced-data");

    // The underlying async function must only be called ONCE
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockCacheSetWithTags).toHaveBeenCalledTimes(1);
  });
});
