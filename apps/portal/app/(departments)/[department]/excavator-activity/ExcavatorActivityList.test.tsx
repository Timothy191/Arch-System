import "@testing-library/jest-dom";
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
      passes: 4,
      loads: 20,
      notes: "Smooth operation",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "EX-200" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "A1" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2026-03-30",
      shift_type: "night" as const,
      passes: 5,
      loads: 15,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "EX-300" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Ore",
      total_loads: 12,
      total_bcm: 240.5,
      notes: null,
      dumper: { name: "DT-101", bin_factor: 20, machine_type: "CAT 777" },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-2",
      material_type: "Waste",
      total_loads: 8,
      total_bcm: 160.0,
      notes: null,
      dumper: { name: "DT-102", bin_factor: 20, machine_type: "CAT 777" },
    },
    {
      id: "asgn-3",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-3",
      material_type: "Ore",
      total_loads: 15,
      total_bcm: 300.0,
      notes: null,
      dumper: { name: "DT-103", bin_factor: 20, machine_type: "Komatsu HD785" },
    },
  ];

  it("renders heading and site grouping correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />,
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
  });

  it("displays total BCM and loads for site", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />,
    );

    // Site totals: total bcm = 240.5 + 160 + 300 = 700.5, total loads = 12 + 8 + 15 = 35
    expect(screen.getByText("700.5 BCM")).toBeInTheDocument();
    expect(screen.getByText(/35 loads/i)).toBeInTheDocument();
  });

  it("renders day and night shift sections with appropriate activities and dumper assignments", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />,
    );

    expect(screen.getByRole("heading", { level: 5, name: /Day Shift/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: /Night Shift/i })).toBeInTheDocument();

    expect(screen.getByText("EX-200")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Block A1")).toBeInTheDocument();
    expect(screen.getByText("Smooth operation")).toBeInTheDocument();

    expect(screen.getByText("EX-300")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();

    expect(screen.getByText("DT-101")).toBeInTheDocument();
    expect(screen.getByText("DT-102")).toBeInTheDocument();
    expect(screen.getByText("DT-103")).toBeInTheDocument();
  });
});
