import { render, screen, fireEvent } from "@testing-library/react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList component", () => {
  const mockOperations = [
    {
      id: "op-1",
      machine_id: "m-101",
      operator_id: "op-1",
      site_id: "site-alpha",
      shift_type: "day" as const,
      start_time: "07:00:00",
      end_time: "15:00:00",
      hours_worked: 8.0,
      machine: { name: "Excavator EX-01", bin_factor: 25.0, serial_number: "SN-EX01" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit Alpha" },
      delay_entries: [
        {
          id: "del-1",
          delay_category_id: "cat-1",
          delay_start_time: "09:00:00",
          delay_end_time: "09:30:00",
          duration_hours: 0.5,
          is_manual_override: false,
          status: "committed" as const,
          delay_category: { name: "Tea Break" },
        },
      ],
    },
    {
      id: "op-2",
      machine_id: "m-102",
      operator_id: "op-2",
      site_id: "site-alpha",
      shift_type: "night" as const,
      start_time: "19:00:00",
      end_time: null,
      hours_worked: null,
      machine: { name: "Hauler HL-02", bin_factor: 18.0, serial_number: "SN-HL02" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit Alpha" },
      delay_entries: [],
    },
  ];

  const mockTodayLoads = [
    { machine_id: "m-101", shift_type: "day", total_loads: 10 },
    { machine_id: "m-101", shift_type: "day", total_loads: 5 },
    { machine_id: "m-102", shift_type: "night", total_loads: 4 },
  ];

  const mockActiveBreakdowns = [
    {
      id: "bd-1",
      fleet_id: "m-101",
      reason: "Hydraulic Hose Leak",
      repair_notes: "Replacing hose",
      status: "active",
      date_in: "2026-03-30T08:00:00Z",
      date_out: null,
    },
  ];

  it("renders empty state card when operations list is empty", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(
      screen.getByText("No operations logged today. Use the form above to add operations."),
    ).toBeInTheDocument();
  });

  it("renders site grouping, shift details, and calculated BCM metrics", () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />,
    );

    // Site header
    expect(screen.getAllByText("Pit Alpha")[0]).toBeInTheDocument();

    // Calculated Site BCM:
    // m-101 loads = 15, bin_factor = 25.0 => 375 BCM
    // m-102 loads = 4, bin_factor = 18.0 => 72 BCM
    // Total = 447.0 BCM
    expect(screen.getByText("447.0 BCM")).toBeInTheDocument();

    // Machine card details
    expect(screen.getByText("Excavator EX-01")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("375.0 BCM")).toBeInTheDocument();

    // Shift section headers
    expect(screen.getByText("Day Shift")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();
  });

  it("displays active breakdown information when matching breakdown exists", () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />,
    );

    expect(screen.getByText("Active Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Engineering Breakdown: Hydraulic Hose Leak")).toBeInTheDocument();
    expect(screen.getByText("Replacing hose")).toBeInTheDocument();
  });

  it("expands and toggles delay details on button click", () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={[]}
      />,
    );

    const delayButton = screen.getByText("1 delay");
    expect(delayButton).toBeInTheDocument();
    expect(screen.queryByText("Tea Break")).not.toBeInTheDocument();

    fireEvent.click(delayButton);
    expect(screen.getByText("Tea Break")).toBeInTheDocument();
    expect(screen.getByText("0.50h")).toBeInTheDocument();
  });
});
