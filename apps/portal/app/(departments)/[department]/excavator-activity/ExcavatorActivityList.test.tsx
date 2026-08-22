import { render, screen } from "@testing-library/react";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

describe("ExcavatorActivityList", () => {
  const sampleActivities = [
    {
      id: "act-1",
      machine_id: "m-1",
      operator_id: "op-1",
      activity_date: "2025-01-01",
      shift_type: "day" as const,
      passes: 10,
      loads: 5,
      notes: "Day shift work",
      site_id: "site-1",
      block_mined_id: "block-1",
      machine: { name: "EX-01" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      block_mined: { name: "Block A", code: "BLK-A" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2025-01-01",
      shift_type: "night" as const,
      passes: 12,
      loads: 6,
      notes: "Night shift work",
      site_id: "site-1",
      block_mined_id: null,
      machine: { name: "EX-02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
      block_mined: null,
    },
  ];

  const sampleAssignments = [
    {
      id: "assign-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "d-1",
      material_type: "Overburden",
      total_loads: 10,
      total_bcm: 150.5,
      notes: null,
      dumper: {
        name: "DT-01",
        bin_factor: 15,
        machine_type: "CAT 777",
      },
    },
    {
      id: "assign-2",
      excavator_activity_id: "act-2",
      dumper_machine_id: "d-2",
      material_type: "Coal",
      total_loads: 8,
      total_bcm: 120.0,
      notes: null,
      dumper: {
        name: "DT-02",
        bin_factor: 15,
        machine_type: "CAT 777",
      },
    },
  ];

  it("renders excavator activity grouped by site and shift", () => {
    render(
      <ExcavatorActivityList
        todayActivity={sampleActivities}
        todayAssignments={sampleAssignments}
      />,
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText("North Pit").length).toBeGreaterThan(0);
    expect(screen.getByText("EX-01")).toBeInTheDocument();
    expect(screen.getByText("EX-02")).toBeInTheDocument();
    expect(screen.getByText("DT-01")).toBeInTheDocument();
    expect(screen.getByText("DT-02")).toBeInTheDocument();
    expect(screen.getByText("Overburden")).toBeInTheDocument();
    expect(screen.getByText("Coal")).toBeInTheDocument();
  });
});
