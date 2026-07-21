import { render, screen, fireEvent, act } from "@testing-library/react";
import { SystemClock } from "./SystemClock";

// Mock Radix Popover
jest.mock("@radix-ui/react-popover", () => {
  const React = require("react");
  return {
    Root: ({ children, open, onOpenChange }: any) => {
      const [isOpenLocal, setIsOpenLocal] = React.useState(open || false);

      React.useEffect(() => {
        if (open !== undefined) {
          setIsOpenLocal(open);
        }
      }, [open]);

      const handleOpenChange = (val: boolean) => {
        setIsOpenLocal(val);
        onOpenChange?.(val);
      };

      return (
        <div data-testid="popover-root">
          {React.Children.map(children, (child: any) => {
            if (!child) return null;
            return React.cloneElement(child, {
              isOpen: isOpenLocal,
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
  beforeEach(() => {
    jest.useFakeTimers();
    // Use jest.setSystemTime to mock standard time
    // Tue Jul 21 2026 12:00:00 SAST is equivalent to Tue Jul 21 2026 10:00:00 UTC
    // Since Africa/Johannesburg (SAST) is UTC+2
    jest.setSystemTime(new Date("2026-07-21T10:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with the initial time string formatted in SAST for the header pill", () => {
    render(<SystemClock />);

    // Tue Jul 21 2026 12:00:00 SAST should render as "Tue 12:00"
    expect(screen.getByText("Tue 12:00")).toBeInTheDocument();
    expect(screen.getByText("SAST")).toBeInTheDocument();
  });

  it("gates high-frequency 1-second interval updating and only ticks when open", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    const { unmount } = render(<SystemClock />);

    // Initially, popover is closed. Only the 10-second header interval is registered
    // There shouldn't be a 1-second interval registered yet
    // Let's count intervals
    const initialIntervalCalls = setIntervalSpy.mock.calls;
    // We expect 1 interval for the 10-second pill update
    expect(initialIntervalCalls.length).toBe(1);

    // Open the popover by clicking the header pill trigger
    const trigger = screen.getByRole("button", { name: "System Clock" });
    fireEvent.click(trigger);

    // The Popover content is now visible
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();

    // Now, opening the popover registers the 1-second interval
    expect(setIntervalSpy.mock.calls.length).toBe(2);

    // Get the second interval delay (which should be 1000ms)
    const secondIntervalDelay = setIntervalSpy.mock.calls[1][1];
    expect(secondIntervalDelay).toBe(1000);

    // Fast-forward 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // The digital clock inside the popover should now update
    const expectedTimeStr1 = new Date("2026-07-21T10:00:01.000Z").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedTimeStr1)).toBeInTheDocument();

    // Close the popover
    fireEvent.click(trigger);
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();

    // Unmount to clean up
    unmount();
  });

  it("immediately synchronizes the state upon opening to prevent staleness", () => {
    render(<SystemClock />);

    // Move time forward by 5 seconds (header pill updates every 10 seconds, analog updates every 1s when open)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Open the popover by clicking trigger
    const trigger = screen.getByRole("button", { name: "System Clock" });
    fireEvent.click(trigger);

    // Upon opening, state should sync immediately
    const expectedTimeStr5 = new Date("2026-07-21T10:00:05.000Z").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(expectedTimeStr5)).toBeInTheDocument();
  });
});
