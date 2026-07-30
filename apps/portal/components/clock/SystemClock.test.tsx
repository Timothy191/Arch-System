import { render, screen, fireEvent, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

describe("SystemClock Component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with the current formatted time", () => {
    // Set system time to a fixed known date/time
    const fixedDate = new Date("2023-10-27T10:15:00Z");
    jest.setSystemTime(fixedDate);

    render(<SystemClock />);

    const button = screen.getByRole("button", { name: "System Clock" });
    expect(button).toBeInTheDocument();

    // The time is formatted for Africa/Johannesburg (SAST = UTC+2)
    // 2023-10-27T10:15:00Z -> SAST is 12:15
    const expectedTimeStr = fixedDate.toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const expectedDayStr = fixedDate.toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    expect(screen.getByText(`${expectedDayStr} ${expectedTimeStr}`)).toBeInTheDocument();
  });

  it("updates the time string every 10 seconds", () => {
    const fixedDate = new Date("2023-10-27T10:15:00Z");
    jest.setSystemTime(fixedDate);

    render(<SystemClock />);

    const initialDayStr = fixedDate.toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    expect(screen.getByText(`${initialDayStr} 12:15`)).toBeInTheDocument();

    // Fast-forward 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(screen.getByText(`${initialDayStr} 12:15`)).toBeInTheDocument();

    // Fast-forward another 50 seconds (total 1 minute)
    act(() => {
      jest.advanceTimersByTime(50000);
    });

    expect(screen.getByText(`${initialDayStr} 12:16`)).toBeInTheDocument();
  });

  it("only starts the high-frequency 1-second interval when the Popover is open", () => {
    const fixedDate = new Date("2023-10-27T10:15:00Z");
    jest.setSystemTime(fixedDate);

    const setIntervalSpy = jest.spyOn(global, "setInterval");

    render(<SystemClock />);

    // Initially, there's only 1 interval active (the 10-second one)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    const firstCall = setIntervalSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const firstIntervalDelay = firstCall ? firstCall[1] : undefined;
    expect(firstIntervalDelay).toBe(10000);

    setIntervalSpy.mockClear();

    // Open the popover by clicking the button trigger
    const button = screen.getByRole("button", { name: "System Clock" });
    act(() => {
      fireEvent.click(button);
    });

    // Now, the 1-second interval should have been set up
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    const secondCall = setIntervalSpy.mock.calls[0];
    expect(secondCall).toBeDefined();
    const secondIntervalDelay = secondCall ? secondCall[1] : undefined;
    expect(secondIntervalDelay).toBe(1000);

    setIntervalSpy.mockRestore();
  });
});
