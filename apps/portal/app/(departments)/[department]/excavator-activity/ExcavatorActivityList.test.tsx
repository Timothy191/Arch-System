import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

// Mock @repo/ui/GlassCard
jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

describe("ExcavatorActivityList", () => {
  const mockActivities = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2025-01-01",
      shift_type: "day" as const,
      passes: 4,
      loads: 10,
      notes: "Smooth operation",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "EX-100" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "A1" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2025-01-01",
      shift_type: "night" as const,
      passes: 5,
      loads: 12,
      notes: null,
      site_id: null,
      block_mined_id: null,
      machine: { name: "EX-200" },
      operator: { full_name: "Jane Smith" },
      site: null,
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "assign-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-1",
      material_type: "Waste",
      total_loads: 10,
      total_bcm: 150.5,
      notes: null,
      dumper: {
        name: "CAT-777",
        bin_factor: 15,
        machine_type: "Dumper",
      },
    },
  ];

  it("renders today's activity header and groups by site", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("No Site Assigned")).toBeInTheDocument();
  });

  it("calculates and displays totals correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    // Site header summary
    expect(screen.getByText("150.5 BCM")).toBeInTheDocument();
    expect(screen.getByText("10 loads")).toBeInTheDocument();

    // Machine names
    expect(screen.getByText("EX-100")).toBeInTheDocument();
    expect(screen.getByText("EX-200")).toBeInTheDocument();

    // Dumper assignment details
    expect(screen.getByText("CAT-777")).toBeInTheDocument();
    expect(screen.getByText("Waste")).toBeInTheDocument();
  });

  it("renders empty state gracefully when no activity or assignments are provided", () => {
    render(<ExcavatorActivityList todayActivity={[]} todayAssignments={[]} />);

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.queryByText("North Pit")).not.toBeInTheDocument();
  });
});
