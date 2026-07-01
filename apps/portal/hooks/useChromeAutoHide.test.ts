import { act, renderHook } from "@testing-library/react";
import { useChromeAutoHide } from "./useChromeAutoHide";

describe("useChromeAutoHide", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.className = "";
    document.documentElement.className = "";
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.classList.remove("chrome-auto-hidden");
    document.documentElement.classList.remove("chrome-auto-hidden");
  });

  it("hides chrome after the initial idle delay", () => {
    renderHook(() => useChromeAutoHide());

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(document.body.classList.contains("chrome-auto-hidden")).toBe(true);
  });

  it("reveals the dock when the pointer enters the bottom edge zone", () => {
    renderHook(() => useChromeAutoHide());

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    act(() => {
      const event = new Event("pointermove", { bubbles: true }) as PointerEvent;
      Object.defineProperty(event, "clientY", {
        value: window.innerHeight - 40,
      });
      window.dispatchEvent(event);
    });

    expect(document.body.classList.contains("chrome-auto-hidden")).toBe(false);
  });

  it("cleans up body classes on unmount", () => {
    const { unmount } = renderHook(() => useChromeAutoHide());

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    unmount();

    expect(document.body.classList.contains("chrome-auto-hidden")).toBe(false);
    expect(document.documentElement.classList.contains("chrome-auto-hidden")).toBe(false);
  });
});
