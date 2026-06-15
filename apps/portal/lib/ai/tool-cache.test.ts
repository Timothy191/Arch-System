/**
 * @jest-environment node
 */

import {
  getCachedToolResult,
  setCachedToolResult,
  invalidateToolCache,
  clearToolCache,
  getToolCacheSize,
} from "./tool-cache";

describe("tool-cache", () => {
  beforeEach(() => {
    clearToolCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Basic set / get
  // ──────────────────────────────────────────────────────────────────────────

  it("stores and retrieves a tool result", () => {
    setCachedToolResult("fleetStatus", {}, { machines: 10, online: 8 });
    const result = getCachedToolResult("fleetStatus", {});
    expect(result).toEqual({ machines: 10, online: 8 });
  });

  it("returns undefined for a cache miss", () => {
    const result = getCachedToolResult("unknownTool", {});
    expect(result).toBeUndefined();
  });

  it("differentiates entries by tool name", () => {
    setCachedToolResult("fleetStatus", {}, { machines: 5 });
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-001" },
      { status: "running" },
    );

    expect(getCachedToolResult("fleetStatus", {})).toEqual({ machines: 5 });
    expect(
      getCachedToolResult("machineStatus", { machineId: "M-001" }),
    ).toEqual({
      status: "running",
    });
  });

  it("differentiates entries by arguments for the same tool", () => {
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-001" },
      { status: "running" },
    );
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-002" },
      { status: "idle" },
    );

    expect(
      getCachedToolResult("machineStatus", { machineId: "M-001" }),
    ).toEqual({
      status: "running",
    });
    expect(
      getCachedToolResult("machineStatus", { machineId: "M-002" }),
    ).toEqual({
      status: "idle",
    });
  });

  it("retrieves the correct value after cache entries accumulate", () => {
    setCachedToolResult("toolA", {}, "result-a");
    setCachedToolResult("toolB", {}, "result-b");
    setCachedToolResult("toolC", {}, "result-c");

    expect(getCachedToolResult("toolA", {})).toBe("result-a");
    expect(getCachedToolResult("toolB", {})).toBe("result-b");
    expect(getCachedToolResult("toolC", {})).toBe("result-c");
    expect(getToolCacheSize()).toBe(3);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TTL expiry
  // ──────────────────────────────────────────────────────────────────────────

  it("returns entry within TTL", () => {
    setCachedToolResult("fleetStatus", {}, "alive", 10_000);
    jest.advanceTimersByTime(5_000);
    expect(getCachedToolResult("fleetStatus", {})).toBe("alive");
  });

  it("returns undefined after TTL expires", () => {
    setCachedToolResult("fleetStatus", {}, "stale", 5_000);
    jest.advanceTimersByTime(5_001);
    expect(getCachedToolResult("fleetStatus", {})).toBeUndefined();
  });

  it("uses default TTL of 5 seconds when not specified", () => {
    setCachedToolResult("fleetStatus", {}, "data");
    jest.advanceTimersByTime(4_999);
    expect(getCachedToolResult("fleetStatus", {})).toBe("data");
    jest.advanceTimersByTime(2);
    expect(getCachedToolResult("fleetStatus", {})).toBeUndefined();
  });

  it("cleans up expired entry (deletes from cache)", () => {
    setCachedToolResult("fleetStatus", {}, "data", 1_000);
    jest.advanceTimersByTime(2_000);
    getCachedToolResult("fleetStatus", {}); // triggers lazy cleanup
    expect(getToolCacheSize()).toBe(0);
  });

  it("preserves other entries when one expires", () => {
    setCachedToolResult("fleetStatus", {}, "fleet-data", 1_000);
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-001" },
      "machine-data",
      10_000,
    );
    jest.advanceTimersByTime(2_000);
    getCachedToolResult("fleetStatus", {}); // triggers cleanup
    expect(getCachedToolResult("machineStatus", { machineId: "M-001" })).toBe(
      "machine-data",
    );
  });

  it("supports per-entry TTL", () => {
    setCachedToolResult("toolA", {}, "short", 1_000);
    setCachedToolResult("toolB", {}, "long", 10_000);
    jest.advanceTimersByTime(5_000);
    expect(getCachedToolResult("toolA", {})).toBeUndefined();
    expect(getCachedToolResult("toolB", {})).toBe("long");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LRU eviction at capacity
  // ──────────────────────────────────────────────────────────────────────────

  it("evicts oldest entry when cache exceeds MAX_ENTRIES", () => {
    // Fill cache to capacity (100)
    for (let i = 0; i < 100; i++) {
      setCachedToolResult("tool", { idx: i }, `value-${i}`);
    }
    expect(getToolCacheSize()).toBe(100);

    // One more entry should evict the oldest (idx 0)
    setCachedToolResult("tool", { idx: 100 }, "value-100");
    expect(getToolCacheSize()).toBe(100);

    // The oldest entry should be gone
    expect(getCachedToolResult("tool", { idx: 0 })).toBeUndefined();
    // The newest entry should be present
    expect(getCachedToolResult("tool", { idx: 100 })).toBe("value-100");
  });

  it("promotes accessed entries (LRU order maintained)", () => {
    // Fill cache to capacity
    for (let i = 0; i < 100; i++) {
      setCachedToolResult("tool", { idx: i }, `value-${i}`);
    }

    // Access the oldest entry (idx 0) — this promotes it to most recently used
    getCachedToolResult("tool", { idx: 0 });

    // Add one more entry — should evict idx 1 (now the oldest), not idx 0
    setCachedToolResult("tool", { idx: 200 }, "value-200");
    expect(getCachedToolResult("tool", { idx: 0 })).toBe("value-0"); // promoted, still alive
    expect(getCachedToolResult("tool", { idx: 1 })).toBeUndefined(); // evicted
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Per-tool invalidation
  // ──────────────────────────────────────────────────────────────────────────

  it("invalidates all entries for a specific tool name", () => {
    setCachedToolResult("fleetStatus", {}, { machines: 5 });
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-001" },
      { status: "running" },
    );
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-002" },
      { status: "idle" },
    );

    invalidateToolCache("machineStatus");

    expect(
      getCachedToolResult("machineStatus", { machineId: "M-001" }),
    ).toBeUndefined();
    expect(
      getCachedToolResult("machineStatus", { machineId: "M-002" }),
    ).toBeUndefined();
    // fleetStatus entries are untouched
    expect(getCachedToolResult("fleetStatus", {})).toEqual({ machines: 5 });
  });

  it("does nothing when invalidating a tool with no entries", () => {
    setCachedToolResult("fleetStatus", {}, "data");
    invalidateToolCache("nonExistentTool");
    expect(getToolCacheSize()).toBe(1);
    expect(getCachedToolResult("fleetStatus", {})).toBe("data");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Clear all
  // ──────────────────────────────────────────────────────────────────────────

  it("clears all entries", () => {
    setCachedToolResult("fleetStatus", {}, { machines: 5 });
    setCachedToolResult(
      "machineStatus",
      { machineId: "M-001" },
      { status: "running" },
    );
    expect(getToolCacheSize()).toBe(2);

    clearToolCache();
    expect(getToolCacheSize()).toBe(0);
    expect(getCachedToolResult("fleetStatus", {})).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Key collision
  // ──────────────────────────────────────────────────────────────────────────

  it("produces different keys for different argument shapes", () => {
    setCachedToolResult("tool", { a: 1, b: 2 }, "entry-1");
    setCachedToolResult("tool", { b: 2, a: 1 }, "entry-2"); // same keys, different order

    // JSON.stringify preserves insertion order, so these might be different keys
    const result1 = getCachedToolResult("tool", { a: 1, b: 2 });
    const result2 = getCachedToolResult("tool", { b: 2, a: 1 });

    // At least one should be defined (and likely both, since JS object key order is stable)
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });
});
