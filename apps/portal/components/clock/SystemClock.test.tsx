import { render, screen, fireEvent, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

describe("SystemClock component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set system time to a fixed date/time
    jest.setSystemTime(new Date("2026-06-25T12:00:00.000+02:00")); // 12:00 SAST
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the trigger button with the correct South Africa time and SAST label", () => {
    render(<SystemClock />);

    const trigger = screen.getByLabelText("System Clock");
    expect(trigger).toBeInTheDocument();

    // Calculate expected SAST pill text
    const now = new Date("2026-06-25T12:00:00.000+02:00");
    const expectedTimePart = now.toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const expectedDayPart = now.toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    expect(screen.getByText(`${expectedDayPart} ${expectedTimePart}`)).toBeInTheDocument();
    expect(screen.getByText("SAST")).toBeInTheDocument();
  });

  it("updates the pill time string every 10 seconds", () => {
    render(<SystemClock />);

    // Advance 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    const nowAfter10s = new Date(new Date("2026-06-25T12:00:00.000+02:00").getTime() + 10000);
    const expectedTimePart = nowAfter10s.toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const expectedDayPart = nowAfter10s.toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    expect(screen.getByText(`${expectedDayPart} ${expectedTimePart}`)).toBeInTheDocument();
  });

  it("only activates the high-frequency 1s interval when opened", () => {
    // Spy on setInterval
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    const { unmount } = render(<SystemClock />);

    // Initially, when closed, the 1-second interval should NOT be registered.
    // There is only the 10-second interval registered.
    const initialIntervalCalls = setIntervalSpy.mock.calls;
    const secondIntervalRegistered = initialIntervalCalls.some(
      (call) => call[1] === 1000
    );
    expect(secondIntervalRegistered).toBe(false);

    // Click the trigger to open the Popover
    const trigger = screen.getByLabelText("System Clock");
    fireEvent.click(trigger);

    // Now, the 1-second high-frequency interval should be registered.
    const afterOpenIntervalCalls = setIntervalSpy.mock.calls;
    const secondIntervalRegisteredAfterOpen = afterOpenIntervalCalls.some(
      (call) => call[1] === 1000
    );
    expect(secondIntervalRegisteredAfterOpen).toBe(true);

    // Verify digital time in popover matches expected locale time format
    const now = new Date();
    const expectedDigitalText = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedDigitalText)).toBeInTheDocument();

    unmount();
    setIntervalSpy.mockRestore();
  });

  it("advances the popover clock every second when opened", () => {
    render(<SystemClock />);

    // Open the popover
    const trigger = screen.getByLabelText("System Clock");
    fireEvent.click(trigger);

    // Advance 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const nowAfter1s = new Date(new Date("2026-06-25T12:00:00.000+02:00").getTime() + 1000);
    const expectedDigitalText = nowAfter1s.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    expect(screen.getByText(expectedDigitalText)).toBeInTheDocument();
  });
});
