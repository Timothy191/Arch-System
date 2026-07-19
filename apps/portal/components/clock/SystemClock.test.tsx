import React from "react";
import { render, screen, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

// We follow the Jest fake timer memory guideline:
// "When testing high-frequency timer-based React components with Jest fake timers,
// avoid manually mocking or spying on the global Date constructor, as it can cause
// runtime TypeErrors (e.g., in toLocaleTimeString). Instead, use jest.setSystemTime()
// combined with mocking/spying on setInterval/clearInterval and asserting on DOM changes."

describe("SystemClock component", () => {
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-25T12:00:00Z"));

    setIntervalSpy = jest.spyOn(global, "setInterval");
    clearIntervalSpy = jest.spyOn(global, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it("renders correctly with header pill format, registering only the 10s interval", () => {
    render(<SystemClock />);

    // Expect the clock to display SAST (SAST is Johannesburg time, UTC+2)
    // "2026-06-25T12:00:00Z" is 14:00 Johannesburg time
    // 25th of June is a Thursday
    expect(screen.getByText(/Thu 14:00/)).toBeInTheDocument();
    expect(screen.getByText("SAST")).toBeInTheDocument();

    // Verify only the 10s interval is registered (one call to setInterval)
    // The second (1s) interval is conditional on open state, which starts false
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenLastCalledWith(expect.any(Function), 10000);
  });

  it("updates the time display after 10 seconds", () => {
    render(<SystemClock />);

    expect(screen.getByText(/Thu 14:00/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Time should have advanced by 10s
    expect(screen.getByText(/Thu 14:00/)).toBeInTheDocument();

    // Advance by another 50s (total 1m) to see minute digit increase
    act(() => {
      jest.advanceTimersByTime(50000);
    });
    expect(screen.getByText(/Thu 14:01/)).toBeInTheDocument();
  });
});
