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
    jest.useFakeTimers();
    rafCallback = null;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb as any;
      return 1;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns false initially when frame rate is fine", () => {
    (useFocusMode as any).mockImplementation((selector: any) => selector({ enabled: false }));
    const { result } = renderHook(() => useAdaptivePerformance());
    expect(result.current).toBe(false);
  });

  it("returns true immediately if Focus Mode is enabled", () => {
    (useFocusMode as any).mockImplementation((selector: any) => selector({ enabled: true }));
    const { result } = renderHook(() => useAdaptivePerformance());
    expect(result.current).toBe(true);
  });

  it("signals low performance if FPS drops below 30 after warm-up", () => {
    (useFocusMode as any).mockImplementation((selector: any) => selector({ enabled: false }));
    const { result } = renderHook(() => useAdaptivePerformance());

    expect(result.current).toBe(false);

    // Simulate slow frames: 50ms interval = ~20 FPS (well below 30 threshold)
    act(() => {
      let time = 100;
      // Trigger initial rAF frame
      if (rafCallback) rafCallback(time);

      // Advance past the 5s warm-up period
      time += 5000;
      if (rafCallback) rafCallback(time);

      // Simulate 2.1 seconds of frames every 50ms (~42 frames at 20 FPS)
      for (let i = 0; i < 45; i++) {
        time += 50;
        if (rafCallback) rafCallback(time);
      }
    });

    expect(result.current).toBe(true);
  });

  it("does not trigger fallback if FPS stays high (e.g. 60 FPS)", () => {
    (useFocusMode as any).mockImplementation((selector: any) => selector({ enabled: false }));
    const { result } = renderHook(() => useAdaptivePerformance());

    expect(result.current).toBe(false);

    // Simulate frames through warm-up and measurement at 60 FPS (16.6ms)
    act(() => {
      let time = 100;
      if (rafCallback) rafCallback(time);

      // Past warm-up
      time += 5000;
      if (rafCallback) rafCallback(time);

      // 3 seconds of 60 FPS frames
      for (let i = 0; i < 200; i++) {
        time += 16.6;
        if (rafCallback) rafCallback(time);
      }
    });

    expect(result.current).toBe(false);
  });

  it("does not trigger fallback at 40 FPS (above 30 threshold)", () => {
    (useFocusMode as any).mockImplementation((selector: any) => selector({ enabled: false }));
    const { result } = renderHook(() => useAdaptivePerformance());

    expect(result.current).toBe(false);

    // Simulate 25ms interval = 40 FPS (above 30 threshold, should NOT degrade)
    act(() => {
      let time = 100;
      if (rafCallback) rafCallback(time);

      time += 5000;
      if (rafCallback) rafCallback(time);

      for (let i = 0; i < 120; i++) {
        time += 25;
        if (rafCallback) rafCallback(time);
      }
    });

    expect(result.current).toBe(false);
  });

});
