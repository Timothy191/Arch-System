import { renderHook, act } from "@testing-library/react";
import { useDebounce, useDebouncedCallback } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("test", 500));
    expect(result.current).toBe("test");
  });

  test("debounces value updates", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "initial", delay: 500 },
    });

    // Update value
    rerender({ value: "updated", delay: 500 });

    // Should still be initial value
    expect(result.current).toBe("initial");

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Should now be updated
    expect(result.current).toBe("updated");
  });

  test("cancels pending update on new value", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "initial", delay: 500 },
    });

    // First update
    rerender({ value: "first", delay: 500 });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Second update before first completes
    rerender({ value: "second", delay: 500 });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Should be second value
    expect(result.current).toBe("second");
  });
});

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("debounces callback execution", () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    // Call the debounced function multiple times
    act(() => {
      result.current("arg1");
      result.current("arg2");
      result.current("arg3");
    });

    // Callback should not have been called yet
    expect(callback).not.toHaveBeenCalled();

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Callback should be called once with last arguments
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("arg3");
  });

  test("cancels pending call on new invocation", () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    // First call
    act(() => {
      result.current("first");
      jest.advanceTimersByTime(300);
    });

    // Second call before first completes
    act(() => {
      result.current("second");
      jest.advanceTimersByTime(500);
    });

    // Only second call should have executed
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("second");
  });
});
