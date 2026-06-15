import React from "react";
import { render, screen } from "@testing-library/react";
import { ViewportBoundaries } from "./ViewportBoundaries";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { useSplitWindow } from "@/hooks/useSplitWindow";

jest.mock("next/navigation", () => ({
  usePathname: () => "/hub",
}));

jest.mock("@/hooks/useSystemMetrics");
jest.mock("@/hooks/useSplitWindow");

describe("ViewportBoundaries component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    (useSplitWindow as unknown as jest.Mock).mockImplementation(
      (selector: any) => selector({ isOpen: false }),
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
    (useSplitWindow as unknown as jest.Mock).mockImplementation(
      (selector: any) => selector({ isOpen: true }),
    );
    render(<ViewportBoundaries />);
    const dock = screen.getByTestId("unified-dock");
    expect(dock.className).toContain("sm:-translate-x-[200px]");
  });
});
