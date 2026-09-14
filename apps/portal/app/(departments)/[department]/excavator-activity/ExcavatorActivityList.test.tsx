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
      loads: 20,
      notes: "Smooth operation",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "Excavator 01" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "A1" },
    },
  ];

  const mockAssignments = [
    {
      id: "asg-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-1",
      material_type: "Waste",
      total_loads: 20,
      total_bcm: 100,
      notes: null,
      dumper: {
        name: "Dumper 01",
        bin_factor: 5,
        machine_type: "CAT777",
      },
    },
  ];

  it("renders activities grouped by site and shift", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("Dumper 01")).toBeInTheDocument();
    expect(screen.getByText("100.0 BCM")).toBeInTheDocument();
  });

  it("handles activities with no assignments", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={[]}
      />
    );

    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("No dumper assignments")).toBeInTheDocument();
  });
});
