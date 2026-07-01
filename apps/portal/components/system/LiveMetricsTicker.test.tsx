import { render, screen } from "@testing-library/react";
import { LiveMetricsTicker } from "./LiveMetricsTicker";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";

jest.mock("@/hooks/useSystemMetrics");

describe("LiveMetricsTicker component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemMetrics as jest.Mock).mockReturnValue({
      websocketLatency: 18,
      serverTimeSAST: "14:05:32",
      currentShift: {
        shift: "B",
        label: "Shift B",
        start: "14:00",
        end: "22:00",
      },
      online: true,
    });
  });

  it("renders correctly with monospace classes and pulsing green dot when online", () => {
    render(<LiveMetricsTicker />);
    const ticker = screen.getByTestId("live-metrics-ticker");
    expect(ticker).toBeInTheDocument();
    expect(ticker.className).toContain("font-mono");
    expect(ticker.className).toContain("text-[10px]");

    const indicator = screen.getByTestId("pulsing-indicator");
    expect(indicator.className).toContain("bg-emerald-500");
    expect(indicator.className).toContain("animate-pulse");

    expect(screen.getByText("SYS_OK")).toBeInTheDocument();
    expect(screen.getByText("SAST: 14:05:32")).toBeInTheDocument();
    expect(screen.getByText("RTT: 18ms")).toBeInTheDocument();
    expect(screen.getByText("Shift B (14:00-22:00)")).toBeInTheDocument();
  });

  it("renders offline state with pulsing red dot when offline", () => {
    (useSystemMetrics as jest.Mock).mockReturnValue({
      websocketLatency: 0,
      serverTimeSAST: "23:45:00",
      currentShift: {
        shift: "C",
        label: "Shift C",
        start: "22:00",
        end: "06:00",
      },
      online: false,
    });

    render(<LiveMetricsTicker />);
    const indicator = screen.getByTestId("pulsing-indicator");
    expect(indicator.className).toContain("bg-rose-500");
    expect(screen.getByText("SYS_OFF")).toBeInTheDocument();
  });
});
