import { render, screen } from "@testing-library/react";
import React from "react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

// Mock @repo/ui/GlassCard to render simple div in test environment
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
      activity_date: "2026-03-30",
      shift_type: "day" as const,
      passes: 10,
      loads: 50,
      notes: "Excavating pit A",
      site_id: "site-1",
      block_mined_id: "b-1",
      machine: { name: "EX-01" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit North" },
      block_mined: { name: "Block A1", code: "A1" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2026-03-30",
      shift_type: "night" as const,
      passes: 8,
      loads: 40,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "EX-02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit North" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asg-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Waste",
      total_loads: 30,
      total_bcm: 300,
      notes: null,
      dumper: {
        name: "DT-01",
        bin_factor: 10,
        machine_type: "CAT 777",
      },
    },
    {
      id: "asg-2",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-2",
      material_type: "Ore",
      total_loads: 20,
      total_bcm: 200,
      notes: null,
      dumper: {
        name: "DT-02",
        bin_factor: 10,
        machine_type: "CAT 777",
      },
    },
    {
      id: "asg-3",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-1",
      material_type: "Waste",
      total_loads: 40,
      total_bcm: 400,
      notes: null,
      dumper: {
        name: "DT-01",
        bin_factor: 10,
        machine_type: "CAT 777",
      },
    },
  ];

  it("renders today's activity header and site groupings", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: /Pit North/i })).toBeInTheDocument();
  });

  it("calculates aggregate site BCM and loads correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    // Site totals: 300 + 200 + 400 = 900.0 BCM, 30 + 20 + 40 = 90 loads
    expect(screen.getByText("900.0 BCM")).toBeInTheDocument();
    expect(screen.getByText("90 loads")).toBeInTheDocument();
  });

  it("renders day and night shift operations correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByRole("heading", { level: 5, name: /Day Shift/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: /Night Shift/i })).toBeInTheDocument();
    expect(screen.getByText("EX-01")).toBeInTheDocument();
    expect(screen.getByText("EX-02")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Block A1")).toBeInTheDocument();
  });

  it("renders dumper assignments and calculated metrics per card", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getAllByText(/DT-01/).length).toBeGreaterThan(0);
    expect(screen.getByText(/DT-02/)).toBeInTheDocument();
    expect(screen.getAllByText("Waste").length).toBeGreaterThan(0);
    expect(screen.getByText("Ore")).toBeInTheDocument();

    // Notes check
    expect(screen.getByText("Excavating pit A")).toBeInTheDocument();
  });

  it("handles empty activity list gracefully", () => {
    render(<ExcavatorActivityList todayActivity={[]} todayAssignments={[]} />);

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.queryByText("Day Shift")).not.toBeInTheDocument();
  });
});
