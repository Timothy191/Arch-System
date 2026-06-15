import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ServicesDropdown } from "./ServicesDropdown";

jest.mock("@repo/ui/components/ui/dropdown-menu", () => {
  const React = require("react");
  return {
    DropdownMenu: ({ children, open, onOpenChange }: any) => {
      return (
        <div data-testid="dropdown-menu">
          {React.Children.map(children, (child: any) => {
            if (!child) return null;
            return React.cloneElement(child, {
              isOpen: open,
              onOpenChange,
            });
          })}
        </div>
      );
    },
    DropdownMenuTrigger: ({
      children,
      asChild,
      onClick,
      isOpen,
      onOpenChange,
    }: any) => {
      const handleClick = (e: any) => {
        if (onClick) onClick(e);
        if (onOpenChange) onOpenChange(!isOpen);
      };
      if (asChild) {
        return React.cloneElement(children, {
          onClick: handleClick,
          "aria-expanded": isOpen ? "true" : "false",
        });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    DropdownMenuContent: ({ children, className, isOpen }: any) => {
      if (!isOpen) return null;
      return (
        <div className={className} role="menu">
          {children}
        </div>
      );
    },
    DropdownMenuItem: ({ children, onSelect, className, asChild }: any) => {
      const handleClick = (e: any) => {
        if (onSelect) onSelect(e);
      };
      if (asChild) {
        return React.cloneElement(children, {
          onClick: (e: any) => {
            handleClick(e);
            if (children.props.onClick) children.props.onClick(e);
          },
        });
      }
      return (
        <div onClick={handleClick} className={className} role="menuitem">
          {children}
        </div>
      );
    },
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children, className }: any) => (
      <div className={className} role="button">
        {children}
      </div>
    ),
    DropdownMenuSubContent: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    DropdownMenuPortal: ({ children }: any) => <>{children}</>,
  };
});

jest.mock("@/lib/weather-api", () => ({
  fetchWeather: jest.fn(() =>
    Promise.resolve({
      temperature: 24,
      feelsLike: 26,
      humidity: 62,
      windSpeed: 14,
      windDirection: 135,
      weatherCode: 2,
      description: "Partly cloudy",
      icon: "⛅",
      timestamp: new Date().toISOString(),
      location: { lat: -26.35914, lon: 28.79267, name: "Delmas, Mpumalanga" },
    }),
  ),
  getWindDirection: jest.fn((deg: number) => {
    const dirs = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? "N";
  }),
}));

jest.mock("~/app/actions", () => ({
  logout: jest.fn(),
}));

describe("ServicesDropdown", () => {
  beforeEach(() => {
    // Clear persisted widget position
    window.localStorage.removeItem("arch-services-pos");
    // Seed safety alerts in localStorage
    window.localStorage.setItem(
      "arch-safety-alerts",
      JSON.stringify([
        {
          id: "sa-1",
          severity: "warning",
          message: "High dust levels — Pit B",
          timestamp: Date.now() - 3600000,
        },
        {
          id: "sa-2",
          severity: "info",
          message: "Blasting hold lifted — Sector 4",
          timestamp: Date.now() - 7200000,
        },
      ]),
    );
  });

  afterEach(() => {
    window.localStorage.removeItem("arch-safety-alerts");
    window.localStorage.removeItem("arch-services-pos");
  });

  it("renders system tray trigger icon", () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles dropdown on click", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });

    // Open
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    // Close
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("renders environmental and operations status when open", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      // Weather
      expect(screen.getByText("24°C")).toBeInTheDocument();
      expect(screen.getByText("Partly cloudy")).toBeInTheDocument();

      // Shift
      expect(screen.getByText(/Shift$/)).toBeInTheDocument(); // Day or Night Shift
      expect(screen.getByText(/\d+h remaining/)).toBeInTheDocument();

      // Wind
      expect(screen.getByText("14 km/h")).toBeInTheDocument();
      expect(screen.getByText("Visibility OK")).toBeInTheDocument();

      // Safety alerts
      expect(screen.getByText(/2 active alerts/)).toBeInTheDocument();
    });
  });

  it("renders power options when open", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Lock Screen")).toBeInTheDocument();
      expect(screen.getByText("Sleep")).toBeInTheDocument();
      expect(screen.getByText("Log Out")).toBeInTheDocument();
      expect(screen.getByText("Restart…")).toBeInTheDocument();
      expect(screen.getByText("Shut Down…")).toBeInTheDocument();
    });
  });

  it("shows lock screen overlay and dismisses on click", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    fireEvent.click(trigger);

    const lockItem = screen.getByText("Lock Screen");
    fireEvent.click(lockItem);

    await waitFor(() => {
      expect(screen.getByText("Click anywhere to unlock")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Click anywhere to unlock"));
    await waitFor(() => {
      expect(
        screen.queryByText("Click anywhere to unlock"),
      ).not.toBeInTheDocument();
    });
  });

  it("contains logout form", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    fireEvent.click(trigger);

    const logoutButton = screen.getByText("Log Out");
    expect(logoutButton.closest("form")).toBeInTheDocument();
  });

  it("shows shut down overlay", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    fireEvent.click(trigger);

    const shutDownItem = screen.getByText("Shut Down…");
    fireEvent.click(shutDownItem);

    await waitFor(() => {
      expect(
        screen.getByText("It is now safe to turn off your computer."),
      ).toBeInTheDocument();
    });
  });

  it("renders View and Safety submenus and their contents", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("View")).toBeInTheDocument();
      expect(screen.getByText("Safety & Emergency")).toBeInTheDocument();
      expect(screen.getByText("Reload")).toBeInTheDocument();
      expect(screen.getByText("Toggle Fullscreen")).toBeInTheDocument();
      expect(screen.getByText("Daily Safety Log")).toBeInTheDocument();
      expect(screen.getByText("Safety Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Emergency Line")).toBeInTheDocument();
    });
  });

  it("toggles dropdown on Alt+S keyboard shortcut", async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole("button", { name: /system tray/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Open
    fireEvent.keyDown(window, { key: "s", altKey: true });
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    // Close
    fireEvent.keyDown(window, { key: "s", altKey: true });
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });
});
