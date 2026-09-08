import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ViewportBoundaries } from "./ViewportBoundaries";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { useSplitWindow } from "@/hooks/useSplitWindow";
import { useDockPreferences } from "@/hooks/useDockPreferences";

jest.mock("next/navigation", () => ({
  usePathname: () => "/hub",
}));

jest.mock("@/hooks/useSystemMetrics");
jest.mock("@/hooks/useSplitWindow");

describe("ViewportBoundaries component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDockPreferences.setState({ autoHide: true });
    (useSystemMetrics as jest.Mock).mockReturnValue({
      websocketLatency: 25,
      serverTimeSAST: "09:30:15",
      currentShift: {
        shift: "A",
        label: "Shift A",
        start: "06:00",
        end: "14:00",
      },
      online: true,
    });
    (useSplitWindow as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ isOpen: false }),
    );
  });

  it("renders unified-dock with app buttons and system metrics", () => {
    render(<ViewportBoundaries />);
    expect(screen.getByTestId("unified-dock")).toBeInTheDocument();
    expect(screen.getByText("09:30:15")).toBeInTheDocument();
    expect(screen.getByText("Shift A")).toBeInTheDocument();
    expect(screen.getByText("25 ms")).toBeInTheDocument();

    // Check apps in dock
    expect(screen.getByText("Hub")).toBeInTheDocument();
    expect(screen.getByText("Drilling")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should not apply shift class when split window is closed", () => {
    render(<ViewportBoundaries />);
    const dock = screen.getByTestId("unified-dock");
    expect(dock.className).not.toContain("sm:-translate-x-[200px]");
  });

  it("should apply shift class when split window is open", () => {
    (useSplitWindow as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ isOpen: true }),
    );
    render(<ViewportBoundaries />);
    const dock = screen.getByTestId("unified-dock");
    expect(dock.className).toContain("sm:-translate-x-[200px]");
  });

  describe("auto-hide feature", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("hides dock by default when autoHide is true", () => {
      render(<ViewportBoundaries />);
      const dock = screen.getByTestId("unified-dock");
      expect(dock.className).toContain("translate-y-[calc(100%+1.5rem)]");
      expect(dock.className).toContain("opacity-0");
      expect(dock.className).toContain("pointer-events-none");
    });

    it("shows peek indicator and trigger zone when autoHide is true", () => {
      render(<ViewportBoundaries />);
      expect(screen.getByTestId("dock-trigger-zone")).toBeInTheDocument();
      expect(screen.getByTestId("dock-peek-indicator")).toBeInTheDocument();
    });

    it("reveals dock on mouseEnter and hides after mouseLeave timeout", () => {
      render(<ViewportBoundaries />);
      const dock = screen.getByTestId("unified-dock");

      // Mouse enters dock
      fireEvent.mouseEnter(dock);
      expect(dock.className).toContain("translate-y-0");
      expect(dock.className).toContain("opacity-100");
      expect(dock.className).toContain("pointer-events-auto");

      // Mouse leaves dock
      fireEvent.mouseLeave(dock);
      // Immediately after leave, should still be visible during grace period
      expect(dock.className).toContain("translate-y-0");

      // Advance timers by 400ms grace period
      act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(dock.className).toContain("translate-y-[calc(100%+1.5rem)]");
    });

    it("reveals dock on trigger zone hover", () => {
      render(<ViewportBoundaries />);
      const dock = screen.getByTestId("unified-dock");
      const trigger = screen.getByTestId("dock-trigger-zone");

      fireEvent.mouseEnter(trigger);
      expect(dock.className).toContain("translate-y-0");
      expect(dock.className).toContain("opacity-100");
    });

    it("keeps dock visible when an element inside receives keyboard focus", () => {
      render(<ViewportBoundaries />);
      const dock = screen.getByTestId("unified-dock");
      const startButton = screen.getByRole("button", { name: "Start Menu" });

      // Focus start button inside dock
      fireEvent.focus(startButton);
      expect(dock.className).toContain("translate-y-0");
      expect(dock.className).toContain("opacity-100");
    });

    it("toggles autoHide when pin button is clicked and stays pinned", () => {
      render(<ViewportBoundaries />);
      const dock = screen.getByTestId("unified-dock");
      const toggleButton = screen.getByTestId("dock-autohide-toggle");

      // Initially autoHide is true, so dock is hidden
      expect(dock.className).toContain("translate-y-[calc(100%+1.5rem)]");

      // Click to pin
      fireEvent.click(toggleButton);
      expect(useDockPreferences.getState().autoHide).toBe(false);

      // Pinned dock is visible even when not hovered
      expect(dock.className).toContain("translate-y-0");
      expect(dock.className).toContain("opacity-100");
    });

    it("toggles autoHide on right-click contextmenu on dock", () => {
      render(<ViewportBoundaries />);
      const dock = screen.getByTestId("unified-dock");

      fireEvent.contextMenu(dock);
      expect(useDockPreferences.getState().autoHide).toBe(false);
    });
  });
});

