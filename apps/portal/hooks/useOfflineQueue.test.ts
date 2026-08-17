import { useOfflineQueue, initOfflineQueueListeners } from "./useOfflineQueue";
import type { QueuedRequest } from "./useOfflineQueue";

const mockToastInfo = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

function makeRequest(overrides: Partial<QueuedRequest> = {}): QueuedRequest {
  return {
    id: "req-1",
    url: "/api/sync",
    method: "POST",
    body: "{}",
    timestamp: 1,
    description: "sync test",
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

function mockFetch(impl: () => Promise<{ ok: boolean }>) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

describe("useOfflineQueue", () => {
  beforeEach(() => {
    localStorage.clear();
    useOfflineQueue.setState({ queue: [], isOnline: true, isSyncing: false });
    mockToastInfo.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("enqueues a request with an id, timestamp, and toast", () => {
    useOfflineQueue.getState().enqueue({ url: "/api/sync", method: "POST", description: "x" });
    const { queue } = useOfflineQueue.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.url).toBe("/api/sync");
    expect(queue[0]!.id).toEqual(expect.any(String));
    expect(mockToastInfo).toHaveBeenCalledWith(expect.stringContaining("x"));
  });

  it("dequeues a request by id", () => {
    useOfflineQueue.setState({ queue: [makeRequest(), makeRequest({ id: "req-2" })] });
    useOfflineQueue.getState().dequeue("req-1");
    expect(useOfflineQueue.getState().queue.map((r) => r.id)).toEqual(["req-2"]);
  });

  it("clearQueue empties the queue", () => {
    useOfflineQueue.setState({ queue: [makeRequest()] });
    useOfflineQueue.getState().clearQueue();
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
  });

  it("setOnlineStatus updates the status", () => {
    useOfflineQueue.getState().setOnlineStatus(false);
    expect(useOfflineQueue.getState().isOnline).toBe(false);
  });

  it("sync is a no-op when offline", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    mockFetch(fetchMock);
    useOfflineQueue.setState({ isOnline: false, queue: [makeRequest()] });
    await useOfflineQueue.getState().sync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sync dequeues successful requests and toasts", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    mockFetch(fetchMock);
    useOfflineQueue.setState({ queue: [makeRequest()] });

    await useOfflineQueue.getState().sync();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("1"));
    expect(useOfflineQueue.getState().isSyncing).toBe(false);
  });

  it("sync keeps failed requests and toasts an error", async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    useOfflineQueue.setState({ queue: [makeRequest()] });

    await useOfflineQueue.getState().sync();

    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("1"));
  });

  it("sync catches thrown network errors", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));
    useOfflineQueue.setState({ queue: [makeRequest()] });

    await useOfflineQueue.getState().sync();

    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    expect(mockToastError).toHaveBeenCalled();
  });

  it("initOfflineQueueListeners registers window listeners and returns a cleanup", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const cleanup = initOfflineQueueListeners();
    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

    cleanup?.();
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
