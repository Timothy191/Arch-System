import { IDBOfflineStorage } from "./offline-storage";

describe("IDBOfflineStorage", () => {
  it("enqueues and retrieves pending requests in fallback mode", async () => {
    const storage = new IDBOfflineStorage();
    const item = await storage.enqueue({
      idempotencyKey: "idem-100",
      url: "/api/telemetry",
      method: "POST",
      body: JSON.stringify({ depth: 450 }),
      description: "Depth log",
    });

    expect(item.idempotencyKey).toBe("idem-100");
    expect(item.status).toBe("pending");

    const pending = await storage.getPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.find((p) => p.idempotencyKey === "idem-100")).toBeDefined();
  });

  it("caches and retrieves read-through responses", async () => {
    const storage = new IDBOfflineStorage();
    const data = { status: "operational", shift: "A" };

    await storage.cacheResponse("GET:/api/status", data, 5000);
    const cached = await storage.getCachedResponse<typeof data>("GET:/api/status");

    expect(cached).toEqual(data);
  });

  it("returns null for expired cache items", async () => {
    const storage = new IDBOfflineStorage();
    await storage.cacheResponse("GET:/api/expired", { old: true }, -100);

    const cached = await storage.getCachedResponse("GET:/api/expired");
    expect(cached).toBeNull();
  });
});
