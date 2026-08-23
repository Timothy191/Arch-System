import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
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
      passes: 10,
      loads: 5,
      notes: "Day shift note",
      site_id: "site-1",
      block_mined_id: "bm-1",
      machine: { name: "Excavator 01" },
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
      passes: 12,
      loads: 6,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "Excavator 02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
      block_mined: null,
    },
    {
      id: "act-3",
      machine_id: "m-3",
      operator_id: null,
      activity_date: "2025-01-01",
      shift_type: "day" as const,
      passes: 8,
      loads: 4,
      notes: null,
      site_id: null,
      block_mined_id: null,
      machine: { name: "Excavator 03" },
      operator: null,
      site: null,
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Waste",
      total_loads: 10,
      total_bcm: 150.5,
      notes: null,
      dumper: { name: "CAT 777", bin_factor: 15, machine_type: "Rigid Hauler" },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-2",
      material_type: "Ore",
      total_loads: 5,
      total_bcm: 75.0,
      notes: null,
      dumper: { name: "Komatsu HD785", bin_factor: 15, machine_type: "Rigid Hauler" },
    },
    {
      id: "asgn-3",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-3",
      material_type: "Ore",
      total_loads: 8,
      total_bcm: 120.0,
      notes: null,
      dumper: { name: "CAT 777 #2", bin_factor: 15, machine_type: "Rigid Hauler" },
    },
  ];

  it("renders heading and site groupings correctly", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />,
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("No Site Assigned")).toBeInTheDocument();
  });

  it("correctly computes site header aggregates using pre-indexed assignments", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />,
    );

    // North Pit total BCM = 150.5 + 75.0 + 120.0 = 345.5 BCM
    expect(screen.getByText("345.5 BCM")).toBeInTheDocument();
    // North Pit total loads = 10 + 5 + 8 = 23 loads
    expect(screen.getByText("23 loads")).toBeInTheDocument();
  });

  it("renders shift sections and excavator cards with assignment details", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />,
    );

    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Block A1")).toBeInTheDocument();

    expect(screen.getByText("CAT 777")).toBeInTheDocument();
    expect(screen.getByText("Komatsu HD785")).toBeInTheDocument();
    expect(screen.getByText("Waste")).toBeInTheDocument();
    expect(screen.getAllByText("Ore").length).toBe(2);

    expect(screen.getByText("Excavator 02")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();

    expect(screen.getByText("Excavator 03")).toBeInTheDocument();
    expect(screen.getByText("No Operator")).toBeInTheDocument();
    expect(screen.getByText("No dumper assignments")).toBeInTheDocument();
  });
});
