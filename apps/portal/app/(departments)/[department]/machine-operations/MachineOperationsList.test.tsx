import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  it("renders empty state message when no operations exist", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(
      screen.getByText("No operations logged today. Use the form above to add operations."),
    ).toBeInTheDocument();
  });

  it("renders operations grouped by site with calculated BCM metrics from pre-indexed loads", () => {
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
        machine: { name: "Excavator EX-1", bin_factor: 2.5 },
        operator: { full_name: "John Doe" },
        site: { name: "North Pit" },
      },
    ];

    const mockTodayLoads = [
      { machine_id: "m-1", shift_type: "day", total_loads: 20 },
      { machine_id: "m-1", shift_type: "night", total_loads: 10 },
    ];

    render(<MachineOperationsList operations={mockOperations} todayLoads={mockTodayLoads} />);

    // Site header check
    expect(screen.getAllByText("North Pit")[0]).toBeInTheDocument();
    // Total loads = 30, bin_factor = 2.5 => site BCM = 75.0 BCM
    expect(screen.getAllByText("75.0 BCM")[0]).toBeInTheDocument();
    expect(screen.getByText("10.0h")).toBeInTheDocument();

    // Machine operation card check
    expect(screen.getByText("Excavator EX-1")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("07:00 - 17:00")).toBeInTheDocument();
    // BCM per hour = 75.0 / 10 = 7.5 BCM/h
    expect(screen.getByText("7.5 BCM/h")).toBeInTheDocument();
  });

  it("renders delay entry summaries and expands categories when clicked", () => {
    const mockOperations = [
      {
        id: "op-2",
        machine_id: "m-2",
        operator_id: null,
        site_id: "site-1",
        shift_type: "day" as const,
        start_time: "07:00:00",
        end_time: null,
        hours_worked: null,
        machine: { name: "Hauler DT-2", bin_factor: 1.0 },
        operator: null,
        site: { name: "North Pit" },
        delay_entries: [
          {
            id: "d-1",
            delay_category_id: "cat-1",
            delay_start_time: "09:00:00",
            delay_end_time: "10:00:00",
            duration_hours: 1.0,
            is_manual_override: false,
            status: "committed" as const,
            delay_category: { name: "Refueling" },
          },
          {
            id: "d-2",
            delay_category_id: "cat-2",
            delay_start_time: "11:00:00",
            delay_end_time: "11:30:00",
            duration_hours: 0.5,
            is_manual_override: true,
            status: "draft" as const,
            delay_category: { name: "Maintenance" },
          },
        ],
      },
    ];

    render(<MachineOperationsList operations={mockOperations} todayLoads={[]} />);

    // Total delays = 1.5h, draft = 0.5h
    const toggleButton = screen.getByText("2 delays");
    expect(toggleButton).toBeInTheDocument();
    expect(screen.getByText("1.50h total")).toBeInTheDocument();
    expect(screen.getByText("(0.50h draft)")).toBeInTheDocument();

    // Toggle details
    fireEvent.click(toggleButton);

    expect(screen.getByText("Refueling")).toBeInTheDocument();
    expect(screen.getByText("1.00h")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("0.50h")).toBeInTheDocument();
    expect(screen.getByText("Includes manual override entries")).toBeInTheDocument();
  });
});
