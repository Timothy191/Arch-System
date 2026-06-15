import { renderHook, act } from "@testing-library/react";
import { useAdaptivePerformance } from "./useAdaptivePerformance";
import { useFocusMode } from "./useFocusMode";

jest.mock("./useFocusMode", () => ({
  useFocusMode: jest.fn(),
}));

describe("useAdaptivePerformance", () => {
  let rafCallback: ((_time: number) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    rafCallback = null;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb as any;
      return 1;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns false initially when frame rate is fine", () => {
    (useFocusMode as any).mockImplementation((selector: any) =>
      selector({ enabled: false }),
    );
    const { result } = renderHook(() => useAdaptivePerformance());
    expect(result.current).toBe(false);
  });

  it("returns true immediately if Focus Mode is enabled", () => {
    (useFocusMode as any).mockImplementation((selector: any) =>
      selector({ enabled: true }),
    );
    const { result } = renderHook(() => useAdaptivePerformance());
    expect(result.current).toBe(true);
  });

  it("signals low performance if FPS drops below 50 for 1.5 seconds", () => {
    (useFocusMode as any).mockImplementation((selector: any) =>
      selector({ enabled: false }),
    );
    const { result } = renderHook(() => useAdaptivePerformance());

    expect(result.current).toBe(false);

    // Simulate 1.5 seconds of slow frames (e.g. 30ms interval = ~33 FPS)
    act(() => {
      let time = 100;
      // Trigger initial rAF frame
      if (rafCallback) rafCallback(time);

      // Advance past the 2.5s warm-up period
      time += 2500;
      if (rafCallback) rafCallback(time);

      // Simulate 1.6 seconds of frames every 30ms (~53 frames)
      for (let i = 0; i < 55; i++) {
        time += 30;
        if (rafCallback) rafCallback(time);
      }
    });

    expect(result.current).toBe(true);
  });

  it("does not trigger fallback if FPS stays high (e.g. 60 FPS)", () => {
    (useFocusMode as any).mockImplementation((selector: any) =>
      selector({ enabled: false }),
    );
    const { result } = renderHook(() => useAdaptivePerformance());

    expect(result.current).toBe(false);

    // Simulate 3 seconds of fast frames (16.6ms interval = 60 FPS)
    act(() => {
      let time = 100;
      if (rafCallback) rafCallback(time);

      for (let i = 0; i < 200; i++) {
        time += 16.6;
        if (rafCallback) rafCallback(time);
      }
    });

    expect(result.current).toBe(false);
  });
});
