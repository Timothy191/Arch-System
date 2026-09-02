import { renderHook, act } from "@testing-library/react";
import { useCommandScope } from "@repo/shared/hooks";

describe("useCommandScope hook", () => {
  it("should trigger handler on matching shortcut", () => {
    const handler = jest.fn();

    renderHook(() =>
      useCommandScope({
        shortcuts: [
          {
            shortcut: "ctrl+k",
            handler,
          },
        ],
      }),
    );

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should not trigger if user is typing in an input unless allowed", () => {
    const handler = jest.fn();

    renderHook(() =>
      useCommandScope({
        shortcuts: [
          {
            shortcut: "escape",
            handler,
            allowInInputs: false,
          },
        ],
      }),
    );

    // Mock active element as an input
    const inputEl = document.createElement("input");
    document.body.appendChild(inputEl);
    inputEl.focus();

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(inputEl);
  });
});
