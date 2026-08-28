import React from "react";
import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

describe("ExcavatorActivityList", () => {
  const mockActivities = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2026-08-28",
      shift_type: "day" as const,
      passes: 10,
      loads: 5,
      notes: "Normal operation",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "EX-01" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "A1" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2026-08-28",
      shift_type: "night" as const,
      passes: 8,
      loads: 4,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "EX-02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dump-1",
      material_type: "Waste",
      total_loads: 5,
      total_bcm: 150.5,
      notes: null,
      dumper: {
        name: "DT-01",
        bin_factor: 30.1,
        machine_type: "CAT777",
      },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-2",
      dumper_machine_id: "dump-2",
      material_type: "Ore",
      total_loads: 4,
      total_bcm: 120.0,
      notes: null,
      dumper: {
        name: "DT-02",
        bin_factor: 30.0,
        machine_type: "CAT777",
      },
    },
  ];

  it("renders site headers, shifts, machine names, and aggregate BCM totals", () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />,
    );

    // Site header & aggregate total
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("270.5 BCM")).toBeInTheDocument();
    expect(screen.getByText("9 loads")).toBeInTheDocument();

    // Shift headers
    expect(screen.getAllByText("Day Shift").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Night Shift").length).toBeGreaterThan(0);

    // Machine names
    expect(screen.getByText("EX-01")).toBeInTheDocument();
    expect(screen.getByText("EX-02")).toBeInTheDocument();

    // Dumper details
    expect(screen.getByText("DT-01")).toBeInTheDocument();
    expect(screen.getByText("DT-02")).toBeInTheDocument();
  });
});
