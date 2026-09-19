import React from "react";
import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

// Mock @repo/ui/GlassCard to render a simple div wrapper in test environment
jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

describe("ExcavatorActivityList", () => {
  const sampleActivity = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2026-03-31",
      shift_type: "day" as const,
      passes: 4,
      loads: 20,
      notes: "Smooth operation",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "EX-100" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "BLK-A" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2026-03-31",
      shift_type: "night" as const,
      passes: 5,
      loads: 15,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "EX-200" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
      block_mined: null,
    },
  ];

  const sampleAssignments = [
    {
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-1",
      material_type: "Overburden",
      total_loads: 12,
      total_bcm: 240,
      notes: null,
      dumper: {
        name: "DT-101",
        bin_factor: 20,
        machine_type: "CAT 777",
      },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-2",
      material_type: "Coal",
      total_loads: 8,
      total_bcm: 160,
      notes: null,
      dumper: {
        name: "DT-102",
        bin_factor: 20,
        machine_type: "CAT 777",
      },
    },
    {
      id: "asgn-3",
      excavator_activity_id: "act-2",
      dumper_machine_id: "dumper-1",
      material_type: "Waste",
      total_loads: 15,
      total_bcm: 300,
      notes: null,
      dumper: {
        name: "DT-101",
        bin_factor: 20,
        machine_type: "CAT 777",
      },
    },
  ];

  it("renders site headers, excavator details, shift badges, and dumper assignments correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={sampleActivity}
        todayAssignments={sampleAssignments}
      />
    );

    // Site header
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("700.0 BCM")).toBeInTheDocument();
    expect(screen.getByText("35 loads")).toBeInTheDocument();

    // Day & Night shift headers
    expect(screen.getAllByText(/Day Shift/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Night Shift/).length).toBeGreaterThan(0);

    // Machine and Operator
    expect(screen.getByText("EX-100")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("EX-200")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();

    // Dumper assignment details
    expect(screen.getAllByText("DT-101").length).toBeGreaterThan(0);
    expect(screen.getByText("DT-102")).toBeInTheDocument();
    expect(screen.getByText("Overburden")).toBeInTheDocument();
    expect(screen.getByText("Coal")).toBeInTheDocument();
    expect(screen.getByText("Waste")).toBeInTheDocument();
  });

  it("renders empty state gracefully when there is no activity or assignments", () => {
    render(<ExcavatorActivityList todayActivity={[]} todayAssignments={[]} />);

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.queryByText("North Pit")).not.toBeInTheDocument();
  });
});
