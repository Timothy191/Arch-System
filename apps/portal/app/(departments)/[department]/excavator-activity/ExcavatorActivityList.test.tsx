import { render, screen } from "@testing-library/react";
import React from "react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

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
      notes: "Test note",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "Excavator 01" },
      operator: { full_name: "John Doe" },
      site: { name: "Site Alpha" },
      block_mined: { name: "Block A", code: "BLK-A" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2025-01-01",
      shift_type: "night" as const,
      passes: 8,
      loads: 4,
      notes: null,
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "Excavator 02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Site Alpha" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "asgn-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Ore",
      total_loads: 5,
      total_bcm: 100,
      notes: null,
      dumper: {
        name: "Dumper 01",
        bin_factor: 20,
        machine_type: "CAT 777",
      },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-2",
      material_type: "Waste",
      total_loads: 4,
      total_bcm: 80,
      notes: null,
      dumper: {
        name: "Dumper 02",
        bin_factor: 20,
        machine_type: "CAT 777",
      },
    },
  ];

  it("renders activities and aggregates BCM and loads correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("Site Alpha").length).toBeGreaterThan(0);
    expect(screen.getByText("180.0 BCM")).toBeInTheDocument();
    expect(screen.getByText("9 loads")).toBeInTheDocument();

    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("Excavator 02")).toBeInTheDocument();
    expect(screen.getByText("Dumper 01")).toBeInTheDocument();
    expect(screen.getByText("Dumper 02")).toBeInTheDocument();
  });
});
