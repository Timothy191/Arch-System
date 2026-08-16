import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ExcavatorDumperTable, DumperAssignmentRow } from "./ExcavatorDumperTable";

const mockDumpers = [
  { id: "d1", name: "CAT 777 #1", machine_type: "dumper", bin_factor: 30, site_id: "site-1" },
  { id: "d2", name: "Komatsu HD785 #2", machine_type: "dumper", bin_factor: 35, site_id: "site-1" },
];

const mockHourlyLoads = [
  { machine_id: "d1", shift_type: "day", total_loads: 10 },
  { machine_id: "d1", shift_type: "night", total_loads: 5 },
  { machine_id: "d2", shift_type: "day", total_loads: 8 },
];

describe("ExcavatorDumperTable", () => {
  it("renders prompt message when no dumpers are available", () => {
    render(
      <ExcavatorDumperTable
        siteDumpers={[]}
        shiftType="day"
        todayDumperLoads={[]}
        assignments={[]}
        onAssignmentsChange={jest.fn()}
      />
    );

    expect(screen.getByText("Select a site to see available dumpers.")).toBeInTheDocument();
  });

  it("renders empty state when dumpers exist but no assignments", () => {
    render(
      <ExcavatorDumperTable
        siteDumpers={mockDumpers}
        shiftType="day"
        todayDumperLoads={mockHourlyLoads}
        assignments={[]}
        onAssignmentsChange={jest.fn()}
      />
    );

    expect(screen.getByText(/No dumpers assigned yet/i)).toBeInTheDocument();
  });

  it("triggers onAssignmentsChange with a new row when Add Dumper is clicked", () => {
    const handleAssignmentsChange = jest.fn();
    render(
      <ExcavatorDumperTable
        siteDumpers={mockDumpers}
        shiftType="day"
        todayDumperLoads={mockHourlyLoads}
        assignments={[]}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ Add Dumper/i }));
    expect(handleAssignmentsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        dumperMachineId: "",
        materialType: "Overburden",
        totalLoads: 0,
        totalBcm: 0,
      }),
    ]);
  });

  it("correctly calculates loads and BCM via memoized Map lookup on dumper selection", () => {
    const handleAssignmentsChange = jest.fn();
    const initialAssignments: DumperAssignmentRow[] = [
      { key: "row-1", dumperMachineId: "", materialType: "Overburden", totalLoads: 0, totalBcm: 0 },
    ];

    render(
      <ExcavatorDumperTable
        siteDumpers={mockDumpers}
        shiftType="day"
        todayDumperLoads={mockHourlyLoads}
        assignments={initialAssignments}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    const comboboxes = screen.getAllByRole("combobox");
    const dumperSelect = comboboxes[0]; // First select is Dumper
    fireEvent.change(dumperSelect, { target: { value: "d1" } });

    // d1 bin_factor = 30, d1 day shift total_loads = 10 => totalBcm = 300
    expect(handleAssignmentsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        dumperMachineId: "d1",
        totalLoads: 10,
        totalBcm: 300,
      }),
    ]);
  });
});
