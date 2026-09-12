import { render, screen, fireEvent } from "@testing-library/react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  const sampleOperations = [
    {
      id: "op-1",
      machine_id: "m-1",
      operator_id: "op-user-1",
      site_id: "site-1",
      shift_type: "day" as const,
      start_time: "07:00:00",
      end_time: "17:00:00",
      hours_worked: 10,
      machine: { name: "CAT 390D", bin_factor: 15, serial_number: "SN-123" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit A" },
      delay_entries: [
        {
          id: "d-1",
          delay_category_id: "cat-1",
          delay_start_time: "08:00:00",
          delay_end_time: "09:00:00",
          duration_hours: 1,
          is_manual_override: false,
          status: "committed" as const,
          delay_category: { name: "Weather" },
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
      end_time: "05:00:00",
      hours_worked: 10,
      machine: { name: "Komatsu PC1250", bin_factor: 20, serial_number: "SN-456" },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit A" },
      delay_entries: [],
    },
  ];

  const sampleLoads = [
    { machine_id: "m-1", shift_type: "day", total_loads: 50 },
    { machine_id: "m-1", shift_type: "night", total_loads: 10 },
    { machine_id: "m-2", shift_type: "night", total_loads: 40 },
  ];

  const sampleBreakdowns = [
    {
      id: "b-1",
      fleet_id: "m-1",
      reason: "Hydraulic leak",
      repair_notes: null,
      status: "active",
      date_in: "2026-09-12T08:00:00Z",
      date_out: null,
    },
  ];

  it("renders empty state when operations list is empty", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(screen.getByText(/No operations logged today/i)).toBeInTheDocument();
  });

  it("renders grouped operations by site and shift", () => {
    render(
      <MachineOperationsList
        operations={sampleOperations}
        todayLoads={sampleLoads}
        activeBreakdowns={sampleBreakdowns}
      />
    );

    // Site header
    expect(screen.getAllByText("Pit A")[0]).toBeInTheDocument();

    // Shifts
    expect(screen.getByText("Day Shift")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();

    // Machine names
    expect(screen.getByText("CAT 390D")).toBeInTheDocument();
    expect(screen.getByText("Komatsu PC1250")).toBeInTheDocument();

    // Breakdown indicator
    expect(screen.getByText("Active Breakdown")).toBeInTheDocument();
  });

  it("toggles delay details when clicked", () => {
    render(
      <MachineOperationsList
        operations={sampleOperations}
        todayLoads={sampleLoads}
        activeBreakdowns={sampleBreakdowns}
      />
    );

    const toggleButton = screen.getByRole("button", { name: /1 delay/i });
    expect(toggleButton).toBeInTheDocument();

    // Details should not be visible initially
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleButton);
    expect(screen.getByText("Weather")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();
  });
});
