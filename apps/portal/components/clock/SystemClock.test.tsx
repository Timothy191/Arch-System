import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";
import "@testing-library/jest-dom";

describe("SystemClock Component", () => {
  let setIntervalSpy: jest.SpiedFunction<typeof setInterval>;
  let clearIntervalSpy: jest.SpiedFunction<typeof clearInterval>;

  beforeEach(() => {
    jest.useFakeTimers();
    // Use a fixed system time: 2025-02-15 10:00:00 UTC
    // In South Africa timezone (Africa/Johannesburg, UTC+2), this will be 12:00:00
    jest.setSystemTime(new Date("2025-02-15T10:00:00.000Z"));

    setIntervalSpy = jest.spyOn(global, "setInterval");
    clearIntervalSpy = jest.spyOn(global, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it("renders correctly with formatted SAST time string on header pill", () => {
    render(<SystemClock />);

    // Verify the header pill shows the correct day and time in SAST timezone (UTC+2)
    // 2025-02-15 is Saturday (Sat)
    expect(screen.getByText("Sat 12:00")).toBeInTheDocument();
    expect(screen.getByText("SAST")).toBeInTheDocument();
  });

  it("gates high-frequency 1s interval based on Popover visibility", () => {
    const { unmount } = render(<SystemClock />);

    // On initial mount, only the 10s header update interval should be registered.
    // The 1s high-frequency analog clock interval should NOT be running yet.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    const firstCall = setIntervalSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[1]).toBe(10000);

    // Open the popover by clicking the clock button
    const clockButton = screen.getByRole("button", { name: /System Clock/i });
    act(() => {
      fireEvent.click(clockButton);
    });

    // Now the 1s high-frequency interval should be registered.
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    const secondCall = setIntervalSpy.mock.calls[1];
    expect(secondCall).toBeDefined();
    expect(secondCall?.[1]).toBe(1000);

    // Close the popover by clicking the clock button again
    act(() => {
      fireEvent.click(clockButton);
    });

    // The high-frequency interval should be cleaned up via clearInterval.
    expect(clearIntervalSpy).toHaveBeenCalled();

    unmount();
  });

  it("renders calendar and supports month/year navigation when popover is open", () => {
    render(<SystemClock />);

    // Open the popover
    const clockButton = screen.getByRole("button", { name: /System Clock/i });
    act(() => {
      fireEvent.click(clockButton);
    });

    // February (the month of 2025-02-15) label should be visible as "Feb 2025"
    expect(screen.getByText("Feb 2025")).toBeInTheDocument();

    // Click Next Month (›)
    const nextMonthBtn = screen.getByTitle("Next Month");
    act(() => {
      fireEvent.click(nextMonthBtn);
    });
    expect(screen.getByText("Mar 2025")).toBeInTheDocument();

    // Click Prev Month (‹)
    const prevMonthBtn = screen.getByTitle("Previous Month");
    act(() => {
      fireEvent.click(prevMonthBtn);
    });
    expect(screen.getByText("Feb 2025")).toBeInTheDocument();

    // Click Next Year (»)
    const nextYearBtn = screen.getByTitle("Next Year");
    act(() => {
      fireEvent.click(nextYearBtn);
    });
    expect(screen.getByText("Feb 2026")).toBeInTheDocument();

    // Click Prev Year («)
    const prevYearBtn = screen.getByTitle("Previous Year");
    act(() => {
      fireEvent.click(prevYearBtn);
    });
    expect(screen.getByText("Feb 2025")).toBeInTheDocument();
  });

  it("updates analog and digital times dynamically when 1s interval ticks", () => {
    render(<SystemClock />);

    // Open the popover
    const clockButton = screen.getByRole("button", { name: /System Clock/i });
    act(() => {
      fireEvent.click(clockButton);
    });

    // Verify digital time is initially rendered
    const targetDate = new Date("2025-02-15T10:00:00.000Z");
    const expectedInitialTime = targetDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedInitialTime)).toBeInTheDocument();

    // Fast-forward 5 seconds inside act()
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Assert that the digital clock has updated
    const updatedDate = new Date("2025-02-15T10:00:05.000Z");
    const expectedUpdatedTime = updatedDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedUpdatedTime)).toBeInTheDocument();
  });
});
