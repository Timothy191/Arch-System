import React from "react";
import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

describe("ExcavatorActivityList", () => {
  const mockActivities = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2025-02-23",
      shift_type: "day" as const,
      passes: 10,
      loads: 5,
      notes: "Smooth operation",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "Excavator 01" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "BLK-A" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2025-02-23",
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
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-1",
      material_type: "Ore",
      total_loads: 10,
      total_bcm: 150.5,
      notes: null,
      dumper: { name: "Dumper 01", bin_factor: 15, machine_type: "CAT 777" },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-2",
      dumper_machine_id: "dumper-2",
      material_type: "Waste",
      total_loads: 5,
      total_bcm: 75.0,
      notes: null,
      dumper: { name: "Dumper 02", bin_factor: 15, machine_type: "CAT 777" },
    },
  ];

  it("renders activities grouped by site and shift", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />,
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("Excavator 02")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("calculates totals accurately using pre-indexed assignments", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />,
    );

    expect(screen.getByText("225.5 BCM")).toBeInTheDocument();
    expect(screen.getByText("15 loads")).toBeInTheDocument();
    expect(screen.getAllByText("150.5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("75.0").length).toBeGreaterThan(0);
  });
});
