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
      loads: 20,
      notes: "Smooth operation",
      site_id: "site-a",
      block_mined_id: "block-1",
      machine: { name: "Excavator EX-01" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit Alpha" },
      block_mined: { name: "Block A1", code: "A1" },
    },
    {
      id: "act-2",
      machine_id: "m-2",
      operator_id: "op-2",
      activity_date: "2026-03-30",
      shift_type: "night" as const,
      passes: 8,
      loads: 15,
      notes: null,
      site_id: "site-a",
      block_mined_id: null,
      machine: { name: "Excavator EX-02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit Alpha" },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: "assign-1",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-1",
      material_type: "Coal",
      total_loads: 12,
      total_bcm: 240,
      notes: null,
      dumper: {
        name: "Cat 777D #1",
        bin_factor: 20,
        machine_type: "Haul Truck",
      },
    },
    {
      id: "assign-2",
      excavator_activity_id: "act-1",
      dumper_machine_id: "dumper-2",
      material_type: "Waste",
      total_loads: 8,
      total_bcm: 160,
      notes: null,
      dumper: {
        name: "Cat 777D #2",
        bin_factor: 20,
        machine_type: "Haul Truck",
      },
    },
    {
      id: "assign-3",
      excavator_activity_id: "act-2",
      dumper_machine_id: "dumper-1",
      material_type: "Coal",
      total_loads: 15,
      total_bcm: 300,
      notes: null,
      dumper: {
        name: "Cat 777D #1",
        bin_factor: 20,
        machine_type: "Haul Truck",
      },
    },
  ];

  it("renders site headers, shifts, and aggregated totals correctly", () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />,
    );

    // Site header
    expect(screen.getAllByText("Pit Alpha")[0]).toBeInTheDocument();

    // Aggregated site stats: 240 + 160 + 300 = 700 BCM, 12 + 8 + 15 = 35 loads
    expect(screen.getByText("700.0 BCM")).toBeInTheDocument();
    expect(screen.getByText("35 loads")).toBeInTheDocument();

    // Shift section headers
    expect(screen.getAllByText("Day Shift")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Night Shift")[0]).toBeInTheDocument();

    // Machine names
    expect(screen.getByText("Excavator EX-01")).toBeInTheDocument();
    expect(screen.getByText("Excavator EX-02")).toBeInTheDocument();

    // Block mined badge
    expect(screen.getByText("Block A1")).toBeInTheDocument();

    // Notes
    expect(screen.getByText("Smooth operation")).toBeInTheDocument();
  });

  it("handles empty activity and assignments gracefully", () => {
    render(<ExcavatorActivityList todayActivity={[]} todayAssignments={[]} />);
    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
  });
});
