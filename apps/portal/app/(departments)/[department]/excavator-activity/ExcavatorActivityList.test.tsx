import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

describe("ExcavatorActivityList", () => {
  const mockActivities = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2026-03-30",
      shift_type: "day" as const,
      passes: 10,
      loads: 5,
      notes: "Heavy clay section",
      site_id: "site-a",
      block_mined_id: "block-1",
      machine: { name: "Excavator 01" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit North" },
      block_mined: { name: "Block A", code: "A1" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2026-03-30",
      shift_type: "night" as const,
      passes: 12,
      loads: 6,
      notes: null,
      site_id: "site-a",
      block_mined_id: null,
      machine: { name: "Excavator 02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit North" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Coal",
      total_loads: 10,
      total_bcm: 250.5,
      notes: null,
      dumper: {
        name: "Haul Truck 101",
        bin_factor: 25,
        machine_type: "dump_truck",
      },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-2",
      material_type: "Waste",
      total_loads: 5,
      total_bcm: 125,
      notes: null,
      dumper: {
        name: "Haul Truck 102",
        bin_factor: 25,
        machine_type: "dump_truck",
      },
    },
    {
      id: "asgn-3",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-3",
      material_type: "Overburden",
      total_loads: 8,
      total_bcm: 200,
      notes: null,
      dumper: {
        name: "Haul Truck 103",
        bin_factor: 25,
        machine_type: "dump_truck",
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
    expect(screen.getAllByText("Pit North").length).toBeGreaterThan(0);
  });

  it("correctly aggregates and displays site-level BCM and load totals", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    // Total BCM for Pit North = 250.5 + 125 + 200 = 575.5 BCM
    // Total loads for Pit North = 10 + 5 + 8 = 23 loads
    expect(screen.getByText("575.5 BCM")).toBeInTheDocument();
    expect(screen.getByText("23 loads")).toBeInTheDocument();
  });

  it("renders activities under Day and Night shifts with correct dumper assignments", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getAllByText("Day Shift").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Night Shift").length).toBeGreaterThan(0);
    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("Excavator 02")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Haul Truck 101")).toBeInTheDocument();
    expect(screen.getByText("Haul Truck 102")).toBeInTheDocument();
    expect(screen.getByText("Haul Truck 103")).toBeInTheDocument();
  });

  it("renders empty dumper assignment state when an activity has no dumper assignments", () => {
    render(
      <ExcavatorActivityList
        todayActivity={[mockActivities[0]!]}
        todayAssignments={[]}
      />
    );

    expect(screen.getByText("No dumper assignments")).toBeInTheDocument();
  });
});
