import { renderHook, act } from "@testing-library/react";
import { useThrottledState } from "./useThrottledState";

describe("useThrottledState hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should initialize with the initial value", () => {
    const { result } = renderHook(() => useThrottledState(0, 500));
    expect(result.current[0]).toBe(0);
  });

  it("should update immediately if no previous update occurred recently", () => {
    const { result } = renderHook(() => useThrottledState(0, 500));

    act(() => {
      const setThrottled = result.current[1];
      setThrottled(1);
    });

    expect(result.current[0]).toBe(1);
  });

  it("should throttle subsequent updates within the delay window", () => {
    const { result } = renderHook(() => useThrottledState(0, 500));

    // First update is immediate
    act(() => {
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);

    // Second update is within 500ms delay, so it should be throttled/queued
    act(() => {
      result.current[1](2);
    });
    expect(result.current[0]).toBe(1); // Still 1

    // Advance timer by 499ms (total 499ms since first update)
    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current[0]).toBe(1); // Still 1

    // Advance timer by 1ms (total 500ms since first update)
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBe(2); // Finally updated to 2
  });

  it("should merge intermediate state updates correctly", () => {
    const { result } = renderHook(() => useThrottledState<number[]>(() => [], 500));

    // First update immediate
    act(() => {
      result.current[1]((prev) => [...prev, 1]);
    });
    expect(result.current[0]).toEqual([1]);

    // Fast sequential updates inside the delay window
    act(() => {
      result.current[1]((prev) => [...prev, 2]);
    });
    act(() => {
      result.current[1]((prev) => [...prev, 3]);
    });
    act(() => {
      result.current[1]((prev) => [...prev, 4]);
    });

    expect(result.current[0]).toEqual([1]); // Still just [1]

    // Advance time to release the throttle
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current[0]).toEqual([1, 2, 3, 4]); // All updates correctly merged!
  });
});
