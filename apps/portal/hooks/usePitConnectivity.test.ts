import { renderHook, act } from "@testing-library/react";
import { usePitConnectivity } from "@repo/shared/hooks";

describe("usePitConnectivity hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("should initialize as online when fetch succeeds", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const { result } = renderHook(() =>
      usePitConnectivity({
        pingUrl: "/api/health",
        pingIntervalMs: 10000,
        degradedThresholdMs: 1000,
      }),
    );

    await act(async () => {
      await result.current.checkConnectivity();
    });

    expect(result.current.status).toBe("online");
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isDegraded).toBe(false);
  });

  it("should detect offline when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network Error"));

    const onStatusChange = jest.fn();
    const { result } = renderHook(() =>
      usePitConnectivity({
        pingUrl: "/api/health",
        onStatusChange,
      }),
    );

    await act(async () => {
      await result.current.checkConnectivity();
    });

    expect(result.current.status).toBe("offline");
    expect(result.current.isOnline).toBe(false);
    expect(onStatusChange).toHaveBeenCalledWith("offline");
  });
});
