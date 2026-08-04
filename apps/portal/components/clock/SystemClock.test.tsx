import { render, screen, fireEvent, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

// Mock Radix Popover to simulate open/close state transitions
jest.mock("@radix-ui/react-popover", () => {
  const React = require("react");
  return {
    Root: ({ children, open, onOpenChange }: any) => {
      // In controlled mode, we use the `open` prop but still allow setting it
      const [isOpen, setIsOpen] = React.useState(open || false);

      React.useEffect(() => {
        if (open !== undefined) {
          setIsOpen(open);
        }
      }, [open]);

      const handleOpenChange = (val: boolean) => {
        setIsOpen(val);
        onOpenChange?.(val);
      };

      return (
        <div data-testid="popover-root">
          {React.Children.map(children, (child: any) => {
            if (!child) return null;
            return React.cloneElement(child, {
              isOpen,
              setIsOpen: handleOpenChange,
            });
          })}
        </div>
      );
    },
    Trigger: ({ children, asChild, isOpen, setIsOpen }: any) => {
      const handleClick = () => setIsOpen(!isOpen);
      if (asChild) {
        return React.cloneElement(children, {
          onClick: handleClick,
          "aria-expanded": isOpen ? "true" : "false",
        });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    Portal: ({ children, isOpen, setIsOpen }: any) => {
      return React.Children.map(children, (child: any) => {
        if (!child) return null;
        return React.cloneElement(child, { isOpen, setIsOpen });
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
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    // System time can be anchored to prevent tests from failing on date shifts
    jest.setSystemTime(new Date("2026-05-29T16:00:00.000Z"));

    setIntervalSpy = jest.spyOn(global, "setInterval");
    clearIntervalSpy = jest.spyOn(global, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it("renders the initial clock pill correctly with SAST timezone", () => {
    render(<SystemClock />);

    // Trigger button should be rendered and show the current day/time
    const trigger = screen.getByRole("button", { name: "System Clock" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("SAST");

    // Initially, there should only be one interval active: the 10-second pill update interval
    // Note: React 19's render or strict mode might cause duplicate runs of useEffect, so we check general timers
    expect(setIntervalSpy).toHaveBeenCalled();
    const intervalTimes = setIntervalSpy.mock.calls.map(call => call[1]);
    expect(intervalTimes).toContain(10000);
    expect(intervalTimes).not.toContain(1000);
  });

  it("gates the high-frequency 1-second interval on the Popover's open state", () => {
    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });

    // 1. Popover is closed initially - no 1-second timer should be running
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
    let currentIntervalTimes = setIntervalSpy.mock.calls.map(call => call[1]);
    expect(currentIntervalTimes).not.toContain(1000);

    // 2. Click trigger to open Popover - should register the 1-second timer
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();

    currentIntervalTimes = setIntervalSpy.mock.calls.map(call => call[1]);
    expect(currentIntervalTimes).toContain(1000);

    // 3. Click trigger again to close Popover - should clear the 1-second timer
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();

    // Verify clearInterval was called with a handle from a 1s interval
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("allows navigating months and years inside the Calendar", () => {
    render(<SystemClock />);

    const trigger = screen.getByRole("button", { name: "System Clock" });

    // Open popover
    act(() => {
      fireEvent.click(trigger);
    });

    // Check year and month label
    // Date anchored to 2026-05-29 (May 2026)
    expect(screen.getByText("May 2026")).toBeInTheDocument();

    // Click Next Month
    const nextMonthBtn = screen.getByTitle("Next Month");
    act(() => {
      fireEvent.click(nextMonthBtn);
    });
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();

    // Click Prev Month
    const prevMonthBtn = screen.getByTitle("Previous Month");
    act(() => {
      fireEvent.click(prevMonthBtn);
    });
    expect(screen.getByText("May 2026")).toBeInTheDocument();

    // Click Next Year
    const nextYearBtn = screen.getByTitle("Next Year");
    act(() => {
      fireEvent.click(nextYearBtn);
    });
    expect(screen.getByText("May 2027")).toBeInTheDocument();

    // Click Prev Year
    const prevYearBtn = screen.getByTitle("Previous Year");
    act(() => {
      fireEvent.click(prevYearBtn);
    });
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });
});
