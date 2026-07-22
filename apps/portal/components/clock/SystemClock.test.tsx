import { render, screen, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";
import userEvent from "@testing-library/user-event";

// Mock the Popover portal to render inline for testing
jest.mock("@radix-ui/react-popover", () => {
  const original = jest.requireActual("@radix-ui/react-popover");
  return {
    ...original,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("SystemClock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-25T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the initial timezone-sensitive day and time string correctly and does not start second interval when closed", async () => {
    render(<SystemClock />);

    // Get expected local strings matching Africa/Johannesburg timezone
    const expectedTimeStr = new Date("2026-06-25T12:00:00Z").toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const expectedDayStr = new Date("2026-06-25T12:00:00Z").toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    const expectedHeaderStr = `${expectedDayStr} ${expectedTimeStr}`;

    expect(screen.getByText(expectedHeaderStr)).toBeInTheDocument();

    // Fast-forward 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // The digital time detailed text shouldn't be rendered as the popover is closed
    expect(screen.queryByText(/12:00:01/)).not.toBeInTheDocument();
  });

  it("starts the second interval when the popover is opened and syncs immediately", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });
    await user.click(trigger);

    // Expected initial digital clock display format (depends on locale, so let's check format dynamically)
    const expectedTime = new Date("2026-06-25T12:00:00Z").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    expect(screen.getByText(expectedTime)).toBeInTheDocument();

    // Advance 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    const expectedLaterTime = new Date(new Date("2026-06-25T12:00:00Z").getTime() + 5000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    expect(screen.getByText(expectedLaterTime)).toBeInTheDocument();
  });
});
