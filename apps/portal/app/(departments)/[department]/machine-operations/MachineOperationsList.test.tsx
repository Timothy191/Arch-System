import { render, screen, fireEvent } from "@testing-library/react";
import MachineOperationsList, { MachineOperationsList as NamedMachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  const sampleOperations = [
    {
      id: "op-1",
      machine_id: "m-1",
      operator_id: "op-id-1",
      site_id: "s-1",
      shift_type: "day" as const,
      start_time: "06:00",
      end_time: "18:00",
      hours_worked: 12,
      machine: { name: "Excavator 01", bin_factor: 15, serial_number: "SN-001" },
      operator: { full_name: "John Doe" },
      site: { name: "Pit Alpha" },
      delay_entries: [
        {
          id: "d-1",
          delay_category_id: "c-1",
          delay_start_time: "10:00",
          delay_end_time: "11:00",
          duration_hours: 1,
          is_manual_override: false,
          status: "committed" as const,
          delay_category: { name: "Mechanical" },
        },
      ],
    },
  ];

  const sampleLoads = [
    { machine_id: "m-1", shift_type: "day", total_loads: 10 },
  ];

  const sampleBreakdowns = [
    {
      id: "b-1",
      fleet_id: "m-1",
      reason: "Engine check",
      repair_notes: null,
      status: "active",
      date_in: "2026-03-30",
      date_out: null,
    },
  ];

  it("renders empty state when no operations", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(screen.getByText(/No operations logged today/i)).toBeInTheDocument();
  });

  it("renders operations grouped by site with pre-indexed BCM calculations", () => {
    render(
      <MachineOperationsList
        operations={sampleOperations}
        todayLoads={sampleLoads}
        activeBreakdowns={sampleBreakdowns}
      />
    );
    expect(screen.getAllByText("Pit Alpha").length).toBeGreaterThan(0);
    expect(screen.getByText("Excavator 01")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getAllByText("150.0 BCM").length).toBeGreaterThan(0);
    expect(screen.getByText("Engineering Breakdown: Engine check")).toBeInTheDocument();
  });

  it("toggles delay details on click", () => {
    render(
      <NamedMachineOperationsList
        operations={sampleOperations}
        todayLoads={sampleLoads}
        activeBreakdowns={sampleBreakdowns}
      />
    );
    const delayButton = screen.getByRole("button", { name: /1 delay/i });
    expect(screen.queryByText("Mechanical")).not.toBeInTheDocument();

    fireEvent.click(delayButton);
    expect(screen.getByText("Mechanical")).toBeInTheDocument();
    expect(screen.getByText("1.00h")).toBeInTheDocument();
  });
});
