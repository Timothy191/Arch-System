import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

describe("ExcavatorActivityList", () => {
  const mockActivity = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2026-09-01",
      shift_type: "day" as const,
      passes: 10,
      loads: 5,
      notes: "Smooth operation",
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
      activity_date: "2026-09-01",
      shift_type: "night" as const,
      passes: 15,
      loads: 8,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "Excavator 02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asg-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Coal",
      total_loads: 5,
      total_bcm: 120.5,
      notes: null,
      dumper: { name: "Dumper 101", bin_factor: 24, machine_type: "CAT777" },
    },
    {
      id: "asg-2",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-2",
      material_type: "Waste",
      total_loads: 8,
      total_bcm: 180.0,
      notes: null,
      dumper: { name: "Dumper 102", bin_factor: 22.5, machine_type: "CAT777" },
    },
  ];

  it("renders heading and site groupings", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivity} todayAssignments={mockAssignments} />,
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
  });

  it("displays totals correctly aggregated across assignments", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivity} todayAssignments={mockAssignments} />,
    );

    // Total BCM = 120.5 + 180.0 = 300.5 BCM
    expect(screen.getByText("300.5 BCM")).toBeInTheDocument();
    // Total loads = 13 loads
    expect(screen.getByText("13 loads")).toBeInTheDocument();
  });

  it("renders Day and Night shift details with machine names and dumpers", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivity} todayAssignments={mockAssignments} />,
    );

    expect(screen.getAllByText(/Day Shift/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Night Shift/i).length).toBeGreaterThan(0);

    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("Excavator 02")).toBeInTheDocument();

    expect(screen.getByText("Dumper 101")).toBeInTheDocument();
    expect(screen.getByText("Dumper 102")).toBeInTheDocument();
    expect(screen.getByText("Coal")).toBeInTheDocument();
    expect(screen.getByText("Waste")).toBeInTheDocument();
  });
});
