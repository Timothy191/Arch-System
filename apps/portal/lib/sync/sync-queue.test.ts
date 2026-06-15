/**
 * SyncQueue tests.
 *
 * The SyncQueue singleton uses IndexedDB (browser-only) and is created at
 * module load time. We set up a fake IndexedDB globally so the constructor
 * has something to work with, then test the public API methods by accessing
 * the private fields via bracket notation.
 */

// ---------------------------------------------------------------------------
// Fake IDB helpers
// ---------------------------------------------------------------------------

const _db: Record<number, any> = {};
let _dbNextId = 1;

function makeFakeReq<T>(value: T, err: Error | null = null) {
  const req: any = { result: value, error: err };
  queueMicrotask(() => {
    if (err && req.onerror) req.onerror();
    else if (!err && req.onsuccess) req.onsuccess();
  });
  return req;
}

const fakeIDBStore = {
  index: () => ({
    getAll: () => {
      const pending = Object.values(_db).filter((a) => a.status === "pending");
      return makeFakeReq(pending);
    },
  }),
  add: (item: any) => {
    const id = _dbNextId++;
    _db[id] = { ...item, id };
    return makeFakeReq(id);
  },
  put: (item: any) => {
    _db[item.id] = { ...item };
    return makeFakeReq(undefined);
  },
  createIndex: () => {},
};

const fakeIDBDB: any = {
  transaction: () => ({ objectStore: () => fakeIDBStore }),
  objectStoreNames: { contains: () => false },
  createObjectStore: () => fakeIDBStore,
};

// jsdom does not provide IDBKeyRange
(global as any).IDBKeyRange = {
  only: (v: unknown) => v,
  bound: (l: unknown, u: unknown) => ({ lower: l, upper: u }),
};

// Install fake indexedDB globally BEFORE module is imported
(global as any).indexedDB = {
  open: () => {
    const req: any = { result: fakeIDBDB, error: null };
    queueMicrotask(() => {
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  },
};

// Mock navigator
Object.defineProperty(global, "navigator", {
  value: { onLine: true },
  writable: true,
  configurable: true,
});

// Mock crypto
Object.defineProperty(global, "crypto", {
  value: { randomUUID: () => `uuid-${_dbNextId++}` },
  writable: true,
  configurable: true,
});

// Mock fetch
(global as any).fetch = jest.fn().mockResolvedValue({ ok: true });

// Now import the module (singleton will be created with the fake IDB above)
import type { QueuedAction } from "./sync-queue";
const { syncQueue } = require("./sync-queue");

// Helper to reset the singleton's isProcessing flag between tests
function resetProcessing() {
  (syncQueue as any).isProcessing = false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear store
    for (const k of Object.keys(_db)) delete _db[k as any];
    _dbNextId = 1;
    resetProcessing();
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });
    (global as any).navigator = { onLine: true };
  });

  describe("processQueue", () => {
    it("returns early when navigator is offline", async () => {
      (global as any).navigator = { onLine: false };
      await syncQueue.processQueue();
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it("returns early when isProcessing is already true", async () => {
      (syncQueue as any).isProcessing = true;
      await syncQueue.processQueue();
      expect((global as any).fetch).not.toHaveBeenCalled();
      resetProcessing();
    });

    it("does not call fetch when queue is empty", async () => {
      // Patch db with empty result
      (syncQueue as any).db = fakeIDBDB;
      await syncQueue.processQueue();
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it("calls playback endpoint for a pending action", async () => {
      _db[1] = {
        id: 1,
        idempotencyKey: "key-abc",
        actionType: "ADD_BREAKDOWN",
        payload: { fleet_id: "EXC-01" },
        departmentId: "dept-1",
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
      };
      (syncQueue as any).db = fakeIDBDB;

      await syncQueue.processQueue();
      await new Promise((r) => setTimeout(r, 10));

      expect((global as any).fetch).toHaveBeenCalledWith(
        "/api/sync/playback",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("marks action as failed after 5 retries", async () => {
      _db[1] = {
        id: 1,
        idempotencyKey: "key-retry",
        actionType: "ADD_DAILY_LOG",
        payload: {},
        departmentId: "dept-1",
        status: "pending",
        retryCount: 4,
        createdAt: Date.now(),
      };
      (syncQueue as any).db = fakeIDBDB;
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 500, statusText: "Error" });

      await syncQueue.processQueue();
      await new Promise((r) => setTimeout(r, 10));

      expect(_db[1].status).toBe("failed");
      expect(_db[1].retryCount).toBe(5);
    });

    it("increments retryCount on failure when below max retries", async () => {
      _db[1] = {
        id: 1,
        idempotencyKey: "key-retry2",
        actionType: "ADD_DAILY_LOG",
        payload: {},
        departmentId: "dept-1",
        status: "pending",
        retryCount: 1,
        createdAt: Date.now(),
      };
      (syncQueue as any).db = fakeIDBDB;
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 500, statusText: "Error" });

      await syncQueue.processQueue();
      await new Promise((r) => setTimeout(r, 10));

      expect(_db[1].retryCount).toBe(2);
      expect(_db[1].status).toBe("pending");
    });
  });

  describe("QueuedAction interface", () => {
    it("constructs a valid QueuedAction shape", () => {
      const action: QueuedAction = {
        idempotencyKey: "k",
        actionType: "ADD_BREAKDOWN",
        payload: { fleet_id: "EXC-01" },
        departmentId: "dept-1",
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
      };
      expect(action.status).toBe("pending");
      expect(action.retryCount).toBe(0);
    });
  });

  describe("enqueueAction", () => {
    it("enqueues an action and returns an idempotency key", async () => {
      (syncQueue as any).db = fakeIDBDB;
      const key = await syncQueue.enqueueAction(
        "ADD_DAILY_LOG",
        { note: "test" },
        "dept-1",
      );
      expect(typeof key).toBe("string");
      expect(key).toMatch(/^uuid-/);
    });

    it("enqueues and does not call fetch when offline", async () => {
      (syncQueue as any).db = fakeIDBDB;
      (global as any).navigator = { onLine: false };
      const key = await syncQueue.enqueueAction(
        "ADD_SAFETY_INCIDENT",
        { title: "slip" },
        "dept-2",
      );
      expect(typeof key).toBe("string");
      // No fetch because navigator.onLine=false
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it("calls processQueue after enqueue when online", async () => {
      (syncQueue as any).db = fakeIDBDB;
      (global as any).navigator = { onLine: true };
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });
      await syncQueue.enqueueAction(
        "RESOLVE_BREAKDOWN",
        { id: "b1" },
        "dept-1",
      );
      // processQueue runs async — just confirm enqueue returns a key
      await new Promise((r) => setTimeout(r, 20));
      expect((global as any).fetch).toHaveBeenCalled();
    });
  });

  describe("processQueue – success path", () => {
    it("marks action as synced after successful playback", async () => {
      _db[1] = {
        id: 1,
        idempotencyKey: "key-sync",
        actionType: "ADD_BREAKDOWN",
        payload: { fleet_id: "EXC-99" },
        departmentId: "dept-1",
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
      };
      (syncQueue as any).db = fakeIDBDB;
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });

      await syncQueue.processQueue();
      await new Promise((r) => setTimeout(r, 10));

      expect(_db[1].status).toBe("synced");
    });
  });
});
