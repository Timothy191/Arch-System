import { MemoryStore } from "../stores/memory.store";
import { RedisStore } from "../stores/redis.store";
import { FixedWindowStrategy } from "../strategies/fixed-window";
import { SlidingWindowStrategy } from "../strategies/sliding-window";
import { TokenBucketStrategy } from "../strategies/token-bucket";
import { RateLimiter } from "../index";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe("get", () => {
    test("returns null for non-existent key", async () => {
      const result = await store.get("nonexistent");
      expect(result).toBeNull();
    });

    test("returns value for existing key", async () => {
      await store.set("key1", "value1", 60);
      const result = await store.get("key1");
      expect(result).toBe("value1");
    });

    test("returns null for expired key", async () => {
      await store.set("key1", "value1", 0); // 0 seconds TTL
      // Wait a bit to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await store.get("key1");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    test("stores value with TTL", async () => {
      await store.set("key1", "value1", 60);
      const result = await store.get("key1");
      expect(result).toBe("value1");
    });

    test("overwrites existing value", async () => {
      await store.set("key1", "value1", 60);
      await store.set("key1", "value2", 60);
      const result = await store.get("key1");
      expect(result).toBe("value2");
    });
  });

  describe("delete", () => {
    test("removes existing key", async () => {
      await store.set("key1", "value1", 60);
      await store.delete("key1");
      const result = await store.get("key1");
      expect(result).toBeNull();
    });

    test("handles non-existent key gracefully", async () => {
      await expect(store.delete("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("clear", () => {
    test("removes all entries", async () => {
      await store.set("key1", "value1", 60);
      await store.set("key2", "value2", 60);
      store.clear();
      expect(await store.get("key1")).toBeNull();
      expect(await store.get("key2")).toBeNull();
    });
  });
});

describe("RedisStore", () => {
  let mockClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    eval: jest.Mock;
  };
  let store: RedisStore;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn(),
    };
    store = new RedisStore(mockClient as any);
  });

  describe("get", () => {
    test("returns value from client", async () => {
      mockClient.get.mockResolvedValueOnce("test-value");
      const result = await store.get("key1");
      expect(result).toBe("test-value");
      expect(mockClient.get).toHaveBeenCalledWith("key1");
    });

    test("returns null when client returns null", async () => {
      mockClient.get.mockResolvedValueOnce(null);
      const result = await store.get("key1");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    test("calls client set with EX option", async () => {
      await store.set("key1", "value1", 60);
      expect(mockClient.set).toHaveBeenCalledWith("key1", "value1", { EX: 60 });
    });

    test("ensures minimum TTL of 1 second", async () => {
      await store.set("key1", "value1", 0);
      expect(mockClient.set).toHaveBeenCalledWith("key1", "value1", { EX: 1 });
    });

    test("handles negative TTL by using 1", async () => {
      await store.set("key1", "value1", -5);
      expect(mockClient.set).toHaveBeenCalledWith("key1", "value1", { EX: 1 });
    });
  });

  describe("delete", () => {
    test("calls client del", async () => {
      await store.delete("key1");
      expect(mockClient.del).toHaveBeenCalledWith("key1");
    });
  });

  describe("eval", () => {
    test("calls client eval with script", async () => {
      mockClient.eval.mockResolvedValueOnce("result");
      const result = await store.eval("return 1", ["key1"], ["arg1"]);
      expect(result).toBe("result");
      expect(mockClient.eval).toHaveBeenCalledWith("return 1", {
        keys: ["key1"],
        arguments: ["arg1"],
      });
    });

    test("throws when client does not support eval", async () => {
      const clientWithoutEval = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
      const storeWithoutEval = new RedisStore(clientWithoutEval as any);
      await expect(storeWithoutEval.eval("script", [], [])).rejects.toThrow(
        "Redis client does not support eval method",
      );
    });
  });
});

describe("FixedWindowStrategy", () => {
  let store: MemoryStore;
  let strategy: FixedWindowStrategy;

  beforeEach(() => {
    store = new MemoryStore();
    strategy = new FixedWindowStrategy();
  });

  test("allows request within limit", async () => {
    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  test("blocks request exceeding limit", async () => {
    for (let i = 0; i < 5; i++) {
      await strategy.check("user:123", 5, 60000, store);
    }
    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("resets count after window expires", async () => {
    // Use a very short window for testing
    const windowMs = 100;
    for (let i = 0; i < 3; i++) {
      await strategy.check("user:123", 3, windowMs, store);
    }
    // Should be blocked now
    const blocked = await strategy.check("user:123", 3, windowMs, store);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

    // Should be allowed again
    const allowed = await strategy.check("user:123", 3, windowMs, store);
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(2);
  });

  test("tracks different users separately", async () => {
    await strategy.check("user:1", 2, 60000, store);
    await strategy.check("user:1", 2, 60000, store);
    const user1 = await strategy.check("user:1", 2, 60000, store);
    const user2 = await strategy.check("user:2", 2, 60000, store);
    expect(user1.allowed).toBe(false);
    expect(user2.allowed).toBe(true);
  });

  test("handles corrupted store data gracefully", async () => {
    // Manually set corrupted data
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000;
    const cacheKey = `user:123:fixed:${windowStart}`;
    await store.set(cacheKey, "invalid-json", 60);

    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("SlidingWindowStrategy", () => {
  let store: MemoryStore;
  let strategy: SlidingWindowStrategy;

  beforeEach(() => {
    store = new MemoryStore();
    strategy = new SlidingWindowStrategy();
  });

  test("allows request within limit", async () => {
    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  test("blocks request exceeding limit", async () => {
    for (let i = 0; i < 5; i++) {
      await strategy.check("user:123", 5, 60000, store);
    }
    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("allows requests after oldest timestamp expires", async () => {
    const windowMs = 200;
    // Fill the window
    for (let i = 0; i < 3; i++) {
      await strategy.check("user:123", 3, windowMs, store);
    }
    const blocked = await strategy.check("user:123", 3, windowMs, store);
    expect(blocked.allowed).toBe(false);

    // Wait for oldest timestamp to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

    const allowed = await strategy.check("user:123", 3, windowMs, store);
    expect(allowed.allowed).toBe(true);
  });

  test("tracks different users separately", async () => {
    await strategy.check("user:1", 2, 60000, store);
    await strategy.check("user:1", 2, 60000, store);
    const user1 = await strategy.check("user:1", 2, 60000, store);
    const user2 = await strategy.check("user:2", 2, 60000, store);
    expect(user1.allowed).toBe(false);
    expect(user2.allowed).toBe(true);
  });

  test("handles corrupted store data gracefully", async () => {
    const cacheKey = `user:123:sliding`;
    await store.set(cacheKey, "invalid-json", 60);

    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test("filters out expired timestamps correctly", async () => {
    const windowMs = 100;
    // Add timestamps
    await strategy.check("user:123", 5, windowMs, store);
    await strategy.check("user:123", 5, windowMs, store);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

    // Should allow new requests (old timestamps filtered out)
    const result = await strategy.check("user:123", 5, windowMs, store);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("TokenBucketStrategy", () => {
  let store: MemoryStore;
  let strategy: TokenBucketStrategy;

  beforeEach(() => {
    store = new MemoryStore();
    strategy = new TokenBucketStrategy();
  });

  test("allows request when tokens available", async () => {
    const result = await strategy.check("user:123", 10, 60000, store);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.limit).toBe(10);
  });

  test("refills tokens over time", async () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      await strategy.check("user:123", 10, 1000, store);
    }
    const blocked = await strategy.check("user:123", 10, 1000, store);
    expect(blocked.allowed).toBe(false);

    // Wait for tokens to refill
    await new Promise((resolve) => setTimeout(resolve, 200));

    const allowed = await strategy.check("user:123", 10, 1000, store);
    expect(allowed.allowed).toBe(true);
  });

  test("does not exceed max tokens", async () => {
    // Wait to ensure tokens would have refilled beyond max
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = await strategy.check("user:123", 5, 60000, store);
    expect(result.remaining).toBeLessThanOrEqual(4); // 5 - 1 consumed
  });

  test("tracks different users separately", async () => {
    // Consume all tokens for user 1
    for (let i = 0; i < 10; i++) {
      await strategy.check("user:1", 10, 60000, store);
    }
    const user1 = await strategy.check("user:1", 10, 60000, store);
    const user2 = await strategy.check("user:2", 10, 60000, store);
    expect(user1.allowed).toBe(false);
    expect(user2.allowed).toBe(true);
  });

  test("handles corrupted store data gracefully", async () => {
    const cacheKey = `user:123:tokenbucket`;
    await store.set(cacheKey, "invalid-json", 60);

    const result = await strategy.check("user:123", 10, 60000, store);
    expect(result.allowed).toBe(true);
  });

  test("calculates correct retryAfter when blocked", async () => {
    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      await strategy.check("user:123", 5, 5000, store);
    }
    const result = await strategy.check("user:123", 5, 5000, store);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(2); // Should be ~1 second
  });
});

describe("RateLimiter (Integration)", () => {
  let store: MemoryStore;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe("with FixedWindowStrategy", () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        store,
        strategy: new FixedWindowStrategy(),
        limit: 3,
        windowMs: 60000,
      });
    });

    test("allows requests within limit", async () => {
      const result1 = await rateLimiter.check("user:123");
      const result2 = await rateLimiter.check("user:123");
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    test("blocks requests exceeding limit", async () => {
      for (let i = 0; i < 3; i++) {
        await rateLimiter.check("user:123");
      }
      const result = await rateLimiter.check("user:123");
      expect(result.allowed).toBe(false);
    });

    test("uses custom key prefix", async () => {
      const customLimiter = new RateLimiter({
        store,
        strategy: new FixedWindowStrategy(),
        limit: 1,
        windowMs: 60000,
        keyPrefix: "api:",
      });
      await customLimiter.check("endpoint");
      const result = await customLimiter.check("endpoint");
      expect(result.allowed).toBe(false);
    });
  });

  describe("with SlidingWindowStrategy", () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        store,
        strategy: new SlidingWindowStrategy(),
        limit: 3,
        windowMs: 60000,
      });
    });

    test("allows requests within limit", async () => {
      const result = await rateLimiter.check("user:123");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    test("blocks requests exceeding limit", async () => {
      for (let i = 0; i < 3; i++) {
        await rateLimiter.check("user:123");
      }
      const result = await rateLimiter.check("user:123");
      expect(result.allowed).toBe(false);
    });
  });

  describe("with TokenBucketStrategy", () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        store,
        strategy: new TokenBucketStrategy(),
        limit: 5,
        windowMs: 1000,
      });
    });

    test("allows requests when tokens available", async () => {
      const result = await rateLimiter.check("user:123");
      expect(result.allowed).toBe(true);
    });

    test("refills tokens over time", async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check("user:123");
      }
      const blocked = await rateLimiter.check("user:123");
      expect(blocked.allowed).toBe(false);

      // Wait for refill
      await new Promise((resolve) => setTimeout(resolve, 200));
      const allowed = await rateLimiter.check("user:123");
      expect(allowed.allowed).toBe(true);
    });
  });
});

describe("Edge Cases", () => {
  test("handles zero limit gracefully", async () => {
    const store = new MemoryStore();
    const strategy = new FixedWindowStrategy();
    const result = await strategy.check("user:123", 0, 60000, store);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("handles very large window sizes", async () => {
    const store = new MemoryStore();
    const strategy = new FixedWindowStrategy();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const result = await strategy.check("user:123", 1000, oneYearMs, store);
    expect(result.allowed).toBe(true);
  });

  test("handles sequential requests correctly", async () => {
    const store = new MemoryStore();
    const strategy = new SlidingWindowStrategy();
    const limit = 5;

    // Make sequential requests up to limit
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(await strategy.check(`user:sequential`, limit, 60000, store));
    }

    const allowed = results.filter((r) => r.allowed);
    const blocked = results.filter((r) => !r.allowed);

    expect(allowed.length).toBe(limit);
    expect(blocked.length).toBe(10 - limit);
  });
});
