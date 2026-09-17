import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  it("renders empty state message when no operations exist", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} activeBreakdowns={[]} />);
    expect(
      screen.getByText("No operations logged today. Use the form above to add operations.")
    ).toBeInTheDocument();
  });

  it("renders operations grouped by site and shift", () => {
    const mockOperations = [
      {
        id: "op1",
        machine_id: "m1",
        operator_id: "op_user1",
        site_id: "site1",
        shift_type: "day" as const,
        start_time: "07:00:00",
        end_time: "17:00:00",
        hours_worked: 10,
        machine: { name: "CAT 777 Dumper 1", bin_factor: 25, serial_number: "SN100" },
        operator: { full_name: "John Doe" },
        site: { name: "Pit A" },
        delay_entries: [],
      },
      {
        id: "op2",
        machine_id: "m2",
        operator_id: "op_user2",
        site_id: "site1",
        shift_type: "night" as const,
        start_time: "19:00:00",
        end_time: null,
        hours_worked: null,
        machine: { name: "CAT 777 Dumper 2", bin_factor: 25, serial_number: "SN200" },
        operator: { full_name: "Jane Smith" },
        site: { name: "Pit A" },
        delay_entries: [
          {
            id: "d1",
            delay_category_id: "c1",
            delay_start_time: "20:00:00",
            delay_end_time: "20:30:00",
            duration_hours: 0.5,
            is_manual_override: false,
            status: "draft" as const,
            delay_category: { name: "Mechanical" },
          },
        ],
      },
    ];

    const mockLoads = [
      { machine_id: "m1", shift_type: "day", total_loads: 10 },
      { machine_id: "m1", shift_type: "day", total_loads: 5 },
    ];

    const mockBreakdowns = [
      {
        id: "b1",
        fleet_id: "SN200",
        reason: "Engine Overheat",
        repair_notes: "Inspecting radiator",
        status: "active",
        date_in: "2025-01-01T00:00:00Z",
        date_out: null,
      },
    ];

    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockLoads}
        activeBreakdowns={mockBreakdowns}
      />
    );

    // Site header check
    expect(screen.getAllByText("Pit A").length).toBeGreaterThan(0);

    // Check shift headers
    expect(screen.getByText("Day Shift")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();

    // Check machine names and operator names
    expect(screen.getByText("CAT 777 Dumper 1")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    expect(screen.getByText("CAT 777 Dumper 2")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();

    // Active breakdown check
    expect(screen.getByText("Active Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Engineering Breakdown: Engine Overheat")).toBeInTheDocument();

    // Check BCM calculations: 15 loads * 25 bin_factor = 375.0 BCM
    expect(screen.getAllByText("375.0 BCM").length).toBeGreaterThan(0);

    // Delay entry toggle check
    const delayButton = screen.getByText("1 delay");
    expect(delayButton).toBeInTheDocument();
    fireEvent.click(delayButton);
    expect(screen.getByText("Mechanical")).toBeInTheDocument();
  });
});
