import { render, screen, act, fireEvent } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

describe("SystemClock component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-25T14:05:00.000Z")); // fixed initial date
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders trigger text with Day and Time, formatted correctly", () => {
    render(<SystemClock />);

    // Day and Time should be displayed (SAST timezone: Africa/Johannesburg)
    // 2026-06-25 is Thursday -> "Thu"
    // Timezone Africa/Johannesburg is UTC+2, so 14:05:00 UTC -> 16:05
    expect(screen.getByText(/Thu 16:05/i)).toBeInTheDocument();
    expect(screen.getByText(/SAST/i)).toBeInTheDocument();
  });

  it("updates the time string every 10 seconds in the background", () => {
    render(<SystemClock />);
    expect(screen.getByText(/Thu 16:05/i)).toBeInTheDocument();

    // Advance time by 60 seconds (1 minute)
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(screen.getByText(/Thu 16:06/i)).toBeInTheDocument();
  });

  it("does not start the high-frequency 1-second interval when closed", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    render(<SystemClock />);

    // Check all registered intervals.
    // The background time update interval is 10000ms.
    const intervals = setIntervalSpy.mock.calls.map(call => call[1]);
    expect(intervals).toContain(10000);
    expect(intervals).not.toContain(1000);
  });

  it("starts the 1-second high frequency interval when popover is open, and cleans up when closed", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: /system clock/i });

    // Open the popover by firing click
    act(() => {
      fireEvent.click(trigger);
    });

    // Let's check intervals. Now there should be a 1000ms interval.
    let intervals = setIntervalSpy.mock.calls.map(call => call[1]);
    expect(intervals).toContain(1000);

    // Let's find the active 1-second interval ID
    const oneSecCallIndex = setIntervalSpy.mock.calls.findIndex(call => call[1] === 1000);
    const oneSecIntervalId = setIntervalSpy.mock.results[oneSecCallIndex]?.value;

    // Close the popover
    act(() => {
      fireEvent.click(trigger);
    });

    // Check that clearInterval was called with the 1-second interval ID
    expect(clearIntervalSpy).toHaveBeenCalledWith(oneSecIntervalId);
  });
});
