import * as React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LoginClock } from "./LoginClock";

describe("LoginClock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 15, 9, 41, 0)); // 09:41:00 local
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders the login-clock testid for the visual spec mask contract", () => {
    render(<LoginClock />);
    expect(screen.getByTestId("login-clock")).toBeInTheDocument();
  });

  it("renders a live time string after mount (SSR uses null initial state via useState)", () => {
    render(<LoginClock />);
    const el = screen.getByTestId("login-clock");
    // RTL flushes the mount effect synchronously in jsdom, so the live string is
    // present. SSR safety comes from useState(null) + useEffect — the first
    // server render emits an empty <span> and hydration matches that empty
    // string before the effect runs on the client.
    expect(el.textContent).toBe("9:41 AM");
    expect(el.textContent).toMatch(/\d/);
  });

  it("does not update state after unmount (no setState warning)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<LoginClock />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    unmount();
    // Advance well past a minute boundary while unmounted.
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    // No "Can't perform a React state update on an unmounted component" warning.
    const offending = spy.mock.calls.find((c) =>
      String(c[0] ?? "").includes("unmounted component"),
    );
    expect(offending).toBeUndefined();
    spy.mockRestore();
  });
});
