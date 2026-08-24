import { render, screen, fireEvent } from "@testing-library/react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  const mockTodayLoads = [
    { machine_id: "m1", shift_type: "day", total_loads: 10 },
    { machine_id: "m1", shift_type: "night", total_loads: 5 },
    { machine_id: "m2", shift_type: "day", total_loads: 8 },
  ];

  const mockOperations = [
    {
      id: "op1",
      machine_id: "m1",
      operator_id: "u1",
      site_id: "s1",
      shift_type: "day" as const,
      start_time: "07:00:00",
      end_time: "17:00:00",
      hours_worked: 10,
      machine: { name: "Excavator EX01", bin_factor: 15 },
      operator: { full_name: "John Doe" },
      site: { name: "Pit Alpha" },
      delay_entries: [
        {
          id: "d1",
          delay_category_id: "cat1",
          delay_start_time: "10:00:00",
          delay_end_time: "11:00:00",
          duration_hours: 1.0,
          is_manual_override: false,
          status: "committed" as const,
          delay_category: { name: "Weather" },
        },
      ],
    },
    {
      id: "op2",
      machine_id: "m2",
      operator_id: "u2",
      site_id: "s1",
      shift_type: "night" as const,
      start_time: "19:00:00",
      end_time: null,
      hours_worked: null,
      machine: { name: "Hauler HL02", bin_factor: 20 },
      operator: { full_name: "Jane Smith" },
      site: { name: "Pit Alpha" },
      delay_entries: [],
    },
  ];

  it("renders empty state message when no operations exist", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(
      screen.getByText("No operations logged today. Use the form above to add operations."),
    ).toBeInTheDocument();
  });

  it("renders operations grouped by site with calculated BCM metrics from pre-indexed loads", () => {
    render(
      <MachineOperationsList operations={mockOperations} todayLoads={mockTodayLoads} />,
    );

    // Site header check
    const siteElements = screen.getAllByText("Pit Alpha");
    expect(siteElements.length).toBeGreaterThan(0);
    expect(siteElements[0]).toBeInTheDocument();

    // EX01 calculations: (10 + 5) loads * 15 bin_factor = 225.0 BCM for m1
    // HL02 calculations: 8 loads * 20 bin_factor = 160.0 BCM for m2
    // Site BCM total: 225 + 160 = 385.0 BCM
    expect(screen.getByText("385.0 BCM")).toBeInTheDocument();

    // Machine names & Operators
    expect(screen.getByText("Excavator EX01")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Hauler HL02")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();

    // Shift section headers
    expect(screen.getByText("Day Shift")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();
  });

  it("calculates delay summary and toggles delay list when clicked", () => {
    render(
      <MachineOperationsList operations={mockOperations} todayLoads={mockTodayLoads} />,
    );

    // Delay summary button
    const delayButton = screen.getByRole("button", { name: /1 delay 1.00h total/i });
    expect(delayButton).toBeInTheDocument();

    // Category detail not visible initially
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();

    // Click to expand delays
    fireEvent.click(delayButton);

    // Category detail should now be visible
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("1.00h")).toBeInTheDocument();
  });
});
