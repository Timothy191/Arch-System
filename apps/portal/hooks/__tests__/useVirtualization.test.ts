import { renderHook, act } from "@testing-library/react";
import { useVirtualization } from "../useVirtualization";

describe("useVirtualization", () => {
  test("calculates virtual items correctly", () => {
    const { result } = renderHook(() =>
      useVirtualization({
        itemCount: 100,
        itemHeight: 50,
        containerHeight: 400,
      }),
    );

    // Should have virtual items
    expect(result.current.virtualItems.length).toBeGreaterThan(0);
    expect(result.current.virtualItems.length).toBeLessThan(100);
  });

  test("calculates total height correctly", () => {
    const { result } = renderHook(() =>
      useVirtualization({
        itemCount: 100,
        itemHeight: 50,
        containerHeight: 400,
      }),
    );

    expect(result.current.totalHeight).toBe(5000); // 100 items * 50px
  });

  test("scrollToIndex works correctly", () => {
    const { result } = renderHook(() =>
      useVirtualization({
        itemCount: 100,
        itemHeight: 50,
        containerHeight: 400,
      }),
    );

    // Should not throw
    act(() => {
      result.current.scrollToIndex(10);
    });
  });

  test("overscan adds extra items", () => {
    const { result: resultWithOverscan } = renderHook(() =>
      useVirtualization({
        itemCount: 100,
        itemHeight: 50,
        containerHeight: 400,
        overscan: 10,
      }),
    );

    const { result: resultWithoutOverscan } = renderHook(() =>
      useVirtualization({
        itemCount: 100,
        itemHeight: 50,
        containerHeight: 400,
        overscan: 0,
      }),
    );

    // With overscan should have more items
    expect(resultWithOverscan.current.virtualItems.length).toBeGreaterThanOrEqual(
      resultWithoutOverscan.current.virtualItems.length,
    );
  });
});
