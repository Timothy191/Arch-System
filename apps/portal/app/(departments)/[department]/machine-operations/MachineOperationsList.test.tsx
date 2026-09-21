import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MachineOperationsList } from "./MachineOperationsList";

describe("MachineOperationsList", () => {
  it("renders empty state when operations is empty", () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(
      screen.getByText("No operations logged today. Use the form above to add operations.")
    ).toBeInTheDocument();
  });

  it("renders operations grouped by site and shift with correct BCM calculations", () => {
    const operations = [
      {
        id: "op1",
        machine_id: "m1",
        operator_id: "op1",
        site_id: "s1",
        shift_type: "day" as const,
        start_time: "07:00:00",
        end_time: "17:00:00",
        hours_worked: 10,
        machine: { name: "EX100", bin_factor: 15 },
        operator: { full_name: "John Doe" },
        site: { name: "Pit Alpha" },
        delay_entries: [],
      },
      {
        id: "op2",
        machine_id: "m2",
        operator_id: "op2",
        site_id: "s1",
        shift_type: "night" as const,
        start_time: "19:00:00",
        end_time: null,
        hours_worked: null,
        machine: { name: "EX200", bin_factor: 20 },
        operator: { full_name: "Jane Smith" },
        site: { name: "Pit Alpha" },
        delay_entries: [
          {
            id: "d1",
            delay_category_id: "cat1",
            delay_start_time: "20:00",
            delay_end_time: "21:00",
            duration_hours: 1.0,
            is_manual_override: false,
            status: "draft" as const,
            delay_category: { name: "Weather" },
          },
        ],
      },
    ];

    const todayLoads = [
      { machine_id: "m1", shift_type: "day", total_loads: 10 }, // 10 * 15 = 150 BCM
      { machine_id: "m2", shift_type: "night", total_loads: 5 }, // 5 * 20 = 100 BCM
    ];

    render(<MachineOperationsList operations={operations} todayLoads={todayLoads} />);

    // Site header check ("Pit Alpha" appears in site header and in card details)
    const siteNames = screen.getAllByText("Pit Alpha");
    expect(siteNames.length).toBeGreaterThanOrEqual(1);

    // Site total BCM = 150 + 100 = 250 BCM
    expect(screen.getByText("250.0 BCM")).toBeInTheDocument();

    // Machine names check
    expect(screen.getByText("EX100")).toBeInTheDocument();
    expect(screen.getByText("EX200")).toBeInTheDocument();

    // EX100 calculations: 150.0 BCM, 15.0 BCM/h (150 BCM / 10h)
    expect(screen.getByText("150.0 BCM")).toBeInTheDocument();
    expect(screen.getByText("15.0 BCM/h")).toBeInTheDocument();

    // Delays section test for EX200
    const delayButton = screen.getByText("1 delay");
    expect(delayButton).toBeInTheDocument();
    fireEvent.click(delayButton);
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("1.00h")).toBeInTheDocument();
  });
});
