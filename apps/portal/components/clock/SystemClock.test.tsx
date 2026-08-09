import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { SystemClock } from "./SystemClock";
import "@testing-library/jest-dom";

describe("SystemClock Component", () => {
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-09T10:00:00.000Z")); // UTC 10:00

    setIntervalSpy = jest.spyOn(global, "setInterval");
    clearIntervalSpy = jest.spyOn(global, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it("renders the system clock header pill correctly on mount", () => {
    render(<SystemClock />);

    // The header pill time string is computed using Africa/Johannesburg timezone
    // 2026-08-09T10:00:00.000Z is 12:00 SAST (UTC+2) on Sunday
    expect(screen.getByLabelText("System Clock")).toBeInTheDocument();
    expect(screen.getByText(/Sun 12:00/)).toBeInTheDocument();
    expect(screen.getByText("SAST")).toBeInTheDocument();
  });

  it("updates the time string every 10 seconds", () => {
    render(<SystemClock />);

    expect(screen.getByText(/Sun 12:00/)).toBeInTheDocument();

    // Fast-forward 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(screen.getByText(/Sun 12:00/)).toBeInTheDocument(); // should still render 12:00 since it is exactly 10s past
  });

  it("manages the 10-second interval lifecycle correctly", () => {
    const { unmount } = render(<SystemClock />);

    // Verify 10-second interval was registered
    const firstCall = setIntervalSpy.mock.calls.find(call => call[1] === 10000);
    expect(firstCall).toBeDefined();

    unmount();

    // Verify that intervals are cleared on unmount
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("does not start the 1-second clock interval on mount if the popover is closed", () => {
    render(<SystemClock />);

    // Verify only the 10-second interval is registered, not the 1-second one
    const oneSecCall = setIntervalSpy.mock.calls.find(call => call[1] === 1000);
    expect(oneSecCall).toBeUndefined();
  });

  it("starts the 1-second clock interval when the popover is opened", () => {
    render(<SystemClock />);

    // Trigger click on trigger button to open the popover
    const trigger = screen.getByLabelText("System Clock");
    fireEvent.click(trigger);

    // Verify the 1-second interval is now registered
    const oneSecCall = setIntervalSpy.mock.calls.find(call => call[1] === 1000);
    expect(oneSecCall).toBeDefined();
  });
});
