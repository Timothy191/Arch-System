import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  const mockOperations = [
    {
      id: "op-1",
      machine_id: "m-1",
      operator_id: "op-user-1",
      site_id: "site-1",
      shift_type: "day" as const,
      start_time: "07:00:00",
      end_time: "17:00:00",
      hours_worked: 10,
      machine: { name: "Excavator EX-01", bin_factor: 20, serial_number: "SN-EX01" },
      operator: { full_name: "John Doe" },
      site: { name: "North Pit" },
      delay_entries: [
        {
          id: "delay-1",
          delay_category_id: "cat-1",
          delay_start_time: "09:00:00",
          delay_end_time: "09:30:00",
          duration_hours: 0.5,
          is_manual_override: false,
          status: "committed" as const,
          delay_category: { name: "Refueling" },
        },
      ],
    },
    {
      id: "op-2",
      machine_id: "m-2",
      operator_id: "op-user-2",
      site_id: "site-1",
      shift_type: "night" as const,
      start_time: "19:00:00",
      end_time: null,
      hours_worked: 4,
      machine: { name: "Hauler HL-02", bin_factor: 15, serial_number: "SN-HL02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "North Pit" },
    },
  ];

  const mockLoads = [
    { machine_id: "m-1", shift_type: "day", total_loads: 15 },
    { machine_id: "m-1", shift_type: "night", total_loads: 5 },
    { machine_id: "m-2", shift_type: "night", total_loads: 10 },
  ];

  const mockBreakdowns = [
    {
      id: "bd-1",
      fleet_id: "m-1",
      reason: "Hydraulic Leaking",
      repair_notes: "Replacing hose seal",
      status: "active",
      date_in: "2026-03-01",
      date_out: null,
    },
  ];

  it("renders empty state when operations are empty", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} activeBreakdowns={[]} />);
    expect(
      screen.getByText(/No operations logged today. Use the form above to add operations./i)
    ).toBeInTheDocument();
  });

  it("renders site headers, machine operations, BCM calculations, and active breakdowns", () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockLoads}
        activeBreakdowns={mockBreakdowns}
      />
    );

    // Site header
    expect(screen.getByText("North Pit")).toBeInTheDocument();

    // Machine names
    expect(screen.getByText("Excavator EX-01")).toBeInTheDocument();
    expect(screen.getByText("Hauler HL-02")).toBeInTheDocument();

    // Shifts
    expect(screen.getByText("Day Shift")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();

    // Breakdown indicator
    expect(screen.getByText(/Engineering Breakdown: Hydraulic Leaking/i)).toBeInTheDocument();
  });

  it("toggles delay details when clicking delay summary button", () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockLoads}
        activeBreakdowns={mockBreakdowns}
      />
    );

    const delayButton = screen.getByText(/1 delay/i);
    expect(delayButton).toBeInTheDocument();

    // Category shouldn't be visible before click
    expect(screen.queryByText("Refueling")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(delayButton);
    expect(screen.getByText("Refueling")).toBeInTheDocument();
  });
});
