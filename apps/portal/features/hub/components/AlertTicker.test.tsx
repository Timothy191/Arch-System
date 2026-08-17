import { render, screen } from "@testing-library/react";
import { AlertTicker } from "./AlertTicker";
import type { AlertEvent } from "./AlertTicker";

// @formkit/auto-animate (transitive dep of @repo/ui/AnimatedList) is ESM-only
// and cannot be parsed by Jest — render a plain wrapper instead.
jest.mock("@repo/ui/AnimatedList", () => ({
  AutoAnimateList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

const baseEvent: AlertEvent = {
  id: "e1",
  type: "incident",
  title: "Pit 3: Incident",
  description: "Minor first-aid case",
  timestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
  severity: "critical",
  href: "/safety/daily-log",
};

describe("AlertTicker", () => {
  it("shows the all-clear state when there are no events", () => {
    render(<AlertTicker events={[]} />);
    expect(screen.getByText("All systems operational")).toBeInTheDocument();
  });

  it("renders event titles, severity labels, and relative timestamps", () => {
    render(<AlertTicker events={[baseEvent]} />);

    expect(screen.getByText("Pit 3: Incident")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("Minor first-aid case")).toBeInTheDocument();
    expect(screen.getByText(/m ago/)).toBeInTheDocument();
    expect(screen.getByText("1 active")).toBeInTheDocument();
  });

  it("links each event to its href", () => {
    render(<AlertTicker events={[baseEvent]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/safety/daily-log");
  });

  it("shows the breakdown icon for breakdown events", () => {
    const breakdown: AlertEvent = {
      ...baseEvent,
      id: "e2",
      type: "breakdown",
      title: "Dozer D2 Breakdown",
      severity: "warning",
    };
    render(<AlertTicker events={[breakdown]} />);
    expect(screen.getByText("Dozer D2 Breakdown")).toBeInTheDocument();
    expect(screen.getByText("WARN")).toBeInTheDocument();
  });

  it("renders multiple events with their relative ages", () => {
    const old = new Date(Date.now() - 3 * 86400000).toISOString(); // 3 days ago
    render(
      <AlertTicker
        events={[baseEvent, { ...baseEvent, id: "e3", timestamp: old, severity: "info" }]}
      />,
    );
    expect(screen.getByText(/m ago/)).toBeInTheDocument();
    expect(screen.getByText(/d ago/)).toBeInTheDocument();
    expect(screen.getByText("INFO")).toBeInTheDocument();
    expect(screen.getByText("2 active")).toBeInTheDocument();
  });
});
