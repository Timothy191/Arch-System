import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { SystemClock } from "./SystemClock";

// Mock Radix Popover
jest.mock("@radix-ui/react-popover", () => {
  const ReactMock = require("react");
  return {
    Root: ({ children, open, onOpenChange }: any) => {
      const [isOpen, setIsOpen] = ReactMock.useState(open || false);

      // Keep mock state in sync with prop if it changes
      ReactMock.useEffect(() => {
        if (open !== undefined) {
          setIsOpen(open);
        }
      }, [open]);

      return (
        <div data-testid="popover-root">
          {ReactMock.Children.map(children, (child: any) => {
            if (!child) return null;
            return ReactMock.cloneElement(child, {
              isOpen,
              setIsOpen: (val: boolean) => {
                setIsOpen(val);
                onOpenChange?.(val);
              },
            });
          })}
        </div>
      );
    },
    Trigger: ({ children, asChild, isOpen, setIsOpen }: any) => {
      const handleClick = () => setIsOpen(!isOpen);
      if (asChild) {
        return ReactMock.cloneElement(children, {
          onClick: handleClick,
          "aria-expanded": isOpen ? "true" : "false",
        });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    Portal: ({ children, isOpen, setIsOpen }: any) => {
      return ReactMock.Children.map(children, (child: any) => {
        if (!child) return null;
        return ReactMock.cloneElement(child, { isOpen, setIsOpen });
      });
    },
    Content: ({ children, className, isOpen }: any) => {
      if (!isOpen) return null;
      return (
        <div className={className} data-testid="popover-content">
          {children}
        </div>
      );
    },
  };
});

describe("SystemClock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-29T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the initial pill format with day and time", () => {
    render(<SystemClock />);

    const expectedTimePart = new Date("2026-05-29T12:00:00Z").toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const expectedDayPart = new Date("2026-05-29T12:00:00Z").toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    const expectedText = `${expectedDayPart} ${expectedTimePart}`;
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("updates the timeStr pill every 10 seconds", () => {
    render(<SystemClock />);

    const initialTimeStr = new Date("2026-05-29T12:00:00Z").toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const initialDayPart = new Date("2026-05-29T12:00:00Z").toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });
    expect(screen.getByText(`${initialDayPart} ${initialTimeStr}`)).toBeInTheDocument();

    // Fast-forward 10 seconds (10000ms)
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    const nextDate = new Date("2026-05-29T12:00:10Z");
    const updatedTimeStr = nextDate.toLocaleTimeString("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const updatedDayPart = nextDate.toLocaleDateString("en-GB", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    });

    expect(screen.getByText(`${updatedDayPart} ${updatedTimeStr}`)).toBeInTheDocument();
  });

  it("does not run second interval or show popover content by default", () => {
    const spySetInterval = jest.spyOn(global, "setInterval");
    render(<SystemClock />);

    // By default, popover content should not render
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();

    // There should be only one interval registered for the 10-second updates,
    // and no 1-second interval registered.
    const intervalsRegistered = spySetInterval.mock.calls;
    const hasOneSecondInterval = intervalsRegistered.some(([_, delay]) => delay === 1000);
    expect(hasOneSecondInterval).toBe(false);

    spySetInterval.mockRestore();
  });

  it("opens popover, registers 1-second interval, and updates digital time", () => {
    const spySetInterval = jest.spyOn(global, "setInterval");
    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });
    fireEvent.click(trigger);

    // Popover is now open
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();

    // Should have registered the 1-second interval now
    const intervalsRegistered = spySetInterval.mock.calls;
    const hasOneSecondInterval = intervalsRegistered.some(([_, delay]) => delay === 1000);
    expect(hasOneSecondInterval).toBe(true);

    const initialDisplayTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(initialDisplayTime)).toBeInTheDocument();

    // Advance 5 seconds and check display update
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    const advancedDisplayTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(advancedDisplayTime)).toBeInTheDocument();

    spySetInterval.mockRestore();
  });
});
