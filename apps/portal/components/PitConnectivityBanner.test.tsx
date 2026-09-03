import { render, screen, fireEvent } from "@testing-library/react";
import { PitConnectivityBanner } from "./PitConnectivityBanner";
import * as sharedHooks from "@repo/shared/hooks";

jest.mock("@repo/shared/hooks", () => ({
  ...jest.requireActual("@repo/shared/hooks"),
  usePitConnectivity: jest.fn(),
}));

describe("PitConnectivityBanner", () => {
  const mockUsePitConnectivity = sharedHooks.usePitConnectivity as jest.Mock;

  it("should render nothing when connection is online", () => {
    mockUsePitConnectivity.mockReturnValue({
      status: "online",
      isOnline: true,
      isDegraded: false,
      latencyMs: 120,
      checkConnectivity: jest.fn(),
    });

    const { container } = render(<PitConnectivityBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("should render warning banner when connection is degraded", () => {
    const mockCheck = jest.fn();
    mockUsePitConnectivity.mockReturnValue({
      status: "degraded",
      isOnline: true,
      isDegraded: true,
      latencyMs: 1450,
      checkConnectivity: mockCheck,
    });

    render(<PitConnectivityBanner />);
    expect(
      screen.getByText(/Degraded Network Detected \(1450ms\) — Local draft buffering active/),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Check Link/i });
    fireEvent.click(button);
    expect(mockCheck).toHaveBeenCalled();
  });

  it("should render offline banner when connection is offline", () => {
    mockUsePitConnectivity.mockReturnValue({
      status: "offline",
      isOnline: false,
      isDegraded: false,
      latencyMs: null,
      checkConnectivity: jest.fn(),
    });

    render(<PitConnectivityBanner />);
    expect(
      screen.getByText(/Offline Mode Active — Inputs are safely preserved in local draft buffer/),
    ).toBeInTheDocument();
  });
});
