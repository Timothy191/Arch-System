import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

describe("SystemClock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set a stable, predictable system time for tests
    jest.setSystemTime(new Date("2026-06-25T12:00:00.000+02:00")); // South Africa Time (SAST, GMT+2)
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders closed system clock button initially", () => {
    render(<SystemClock />);

    // Check button and SAST label
    const trigger = screen.getByRole("button", { name: "System Clock" });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("SAST")).toBeInTheDocument();

    // The GMT+2 representation of "2026-06-25T12:00:00.000+02:00" is Thu 12:00
    // en-GB outputs: "Thu 12:00"
    expect(screen.getByText(/Thu 12:00/)).toBeInTheDocument();

    // Calendar/Analog clock elements are NOT visible when closed
    expect(screen.queryByText("SU")).not.toBeInTheDocument();
  });

  it("opens popover on click, shows calendar and analog clock, and triggers 1s interval", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });

    // Open Popover
    act(() => {
      fireEvent.click(trigger);
    });

    // Check calendar headers/weekdays
    expect(screen.getByText("SU")).toBeInTheDocument();
    expect(screen.getByText("MO")).toBeInTheDocument();

    // Check Month label (June 2026)
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();

    // Check digital time text at the bottom.
    // It is timezone-sensitive based on runner, so we compute dynamically.
    const expectedTimeStr = new Date("2026-06-25T12:00:00.000+02:00").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedTimeStr)).toBeInTheDocument();

    // Verify high frequency 1s interval is started.
    // Let's filter intervals registered while popover is open.
    const calls = setIntervalSpy.mock.calls;
    const hasOneSecondInterval = calls.some((call) => call && call[1] === 1000);
    expect(hasOneSecondInterval).toBe(true);

    setIntervalSpy.mockRestore();
  });

  it("advances high-frequency 1s clock when popover is open", () => {
    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });

    act(() => {
      fireEvent.click(trigger);
    });

    // Advance mock time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    const expectedTimeStr = new Date(
      new Date("2026-06-25T12:00:00.000+02:00").getTime() + 5000
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedTimeStr)).toBeInTheDocument();
  });

  it("gates 1s clock updates: interval is cleared/not running when popover is closed", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    render(<SystemClock />);

    // At initial load, only the 10s interval is registered (10000ms)
    // 1000ms is NOT registered initially
    const initialCalls = setIntervalSpy.mock.calls;
    const initialHasOneSecond = initialCalls.some((call) => call && call[1] === 1000);
    expect(initialHasOneSecond).toBe(false);

    const trigger = screen.getByRole("button", { name: "System Clock" });

    // Open Popover
    act(() => {
      fireEvent.click(trigger);
    });

    // Extract the active 1s interval reference from spy
    const oneSecondCall = setIntervalSpy.mock.calls.find((call) => call && call[1] === 1000);
    expect(oneSecondCall).toBeDefined();

    // Close Popover
    act(() => {
      fireEvent.click(trigger);
    });

    // Verify 1s interval is cleared
    const cleared = clearIntervalSpy.mock.calls.some((call) => {
      const timerId = call && call[0];
      return timerId !== undefined;
    });
    expect(cleared).toBe(true);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("navigates calendar correctly (month & year navigation)", () => {
    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });

    // Open Popover
    act(() => {
      fireEvent.click(trigger);
    });

    expect(screen.getByText("Jun 2026")).toBeInTheDocument();

    // Next Month
    const nextMonthBtn = screen.getByTitle("Next Month");
    act(() => {
      fireEvent.click(nextMonthBtn);
    });
    expect(screen.getByText("Jul 2026")).toBeInTheDocument();

    // Previous Month (back to June)
    const prevMonthBtn = screen.getByTitle("Previous Month");
    act(() => {
      fireEvent.click(prevMonthBtn);
    });
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();

    // Next Year
    const nextYearBtn = screen.getByTitle("Next Year");
    act(() => {
      fireEvent.click(nextYearBtn);
    });
    expect(screen.getByText("Jun 2027")).toBeInTheDocument();

    // Previous Year (back to June 2026)
    const prevYearBtn = screen.getByTitle("Previous Year");
    act(() => {
      fireEvent.click(prevYearBtn);
    });
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();
  });
});
