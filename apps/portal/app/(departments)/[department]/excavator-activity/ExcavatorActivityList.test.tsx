import { render, screen } from "@testing-library/react";
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
      notes: "Test notes",
      site_id: "site-1",
      block_mined_id: "b-1",
      machine: { name: "EX-01" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit A" },
      block_mined: { name: "Block 10", code: "B10" },
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
      machine: { name: "EX-02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit A" },
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
      dumper: { name: "DT-01", bin_factor: 15, machine_type: "CAT777" },
    },
    {
      id: "asgn-2",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-2",
      material_type: "Ore",
      total_loads: 8,
      total_bcm: 120.0,
      notes: null,
      dumper: { name: "DT-02", bin_factor: 15, machine_type: "CAT777" },
    },
  ];

  it("renders correctly and displays site totals and activities", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getAllByText("Pit A").length).toBeGreaterThan(0);
    expect(screen.getByText("EX-01")).toBeDefined();
    expect(screen.getByText("EX-02")).toBeDefined();
    expect(screen.getByText("270.5 BCM")).toBeDefined();
    expect(screen.getByText("18 loads")).toBeDefined();
  });
});
