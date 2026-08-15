import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExcavatorDumperTable, DumperAssignmentRow } from "./ExcavatorDumperTable";

describe("ExcavatorDumperTable", () => {
  const mockSiteDumpers = [
    {
      id: "dumper-1",
      name: "CAT 777D #01",
      machine_type: "777D",
      bin_factor: 50,
      site_id: "site-1",
    },
    {
      id: "dumper-2",
      name: "Komatsu HD785 #02",
      machine_type: "HD785",
      bin_factor: 60,
      site_id: "site-1",
    },
  ];

  const mockTodayDumperLoads = [
    {
      machine_id: "dumper-1",
      shift_type: "day",
      total_loads: 12,
    },
    {
      machine_id: "dumper-2",
      shift_type: "day",
      total_loads: 8,
    },
  ];

  it("renders empty state when siteDumpers is empty", () => {
    render(
      <ExcavatorDumperTable
        siteDumpers={[]}
        shiftType="day"
        todayDumperLoads={[]}
        assignments={[]}
        onAssignmentsChange={jest.fn()}
      />
    );

    expect(screen.getByText("Select a site to see available dumpers.")).toBeDefined();
  });

  it("renders message when no dumpers are assigned", () => {
    render(
      <ExcavatorDumperTable
        siteDumpers={mockSiteDumpers}
        shiftType="day"
        todayDumperLoads={mockTodayDumperLoads}
        assignments={[]}
        onAssignmentsChange={jest.fn()}
      />
    );

    expect(
      screen.getByText(/No dumpers assigned yet. Click "\+ Add Dumper" to add one./)
    ).toBeDefined();
  });

  it("calls onAssignmentsChange with a new row when Add Dumper button is clicked", () => {
    const handleAssignmentsChange = jest.fn();
    render(
      <ExcavatorDumperTable
        siteDumpers={mockSiteDumpers}
        shiftType="day"
        todayDumperLoads={mockTodayDumperLoads}
        assignments={[]}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    const addButton = screen.getByRole("button", { name: /\+ Add Dumper/i });
    fireEvent.click(addButton);

    expect(handleAssignmentsChange).toHaveBeenCalledTimes(1);
    const newAssignments = handleAssignmentsChange.mock.calls[0][0];
    expect(newAssignments).toHaveLength(1);
    expect(newAssignments[0]).toMatchObject({
      dumperMachineId: "",
      materialType: "Overburden",
      totalLoads: 0,
      totalBcm: 0,
    });
  });

  it("calculates loads and BCM correctly when selecting a dumper using O(1) map lookup", () => {
    const handleAssignmentsChange = jest.fn();
    const initialAssignments: DumperAssignmentRow[] = [
      {
        key: "row-1",
        dumperMachineId: "",
        materialType: "Overburden",
        totalLoads: 0,
        totalBcm: 0,
      },
    ];

    render(
      <ExcavatorDumperTable
        siteDumpers={mockSiteDumpers}
        shiftType="day"
        todayDumperLoads={mockTodayDumperLoads}
        assignments={initialAssignments}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    const selects = screen.getAllByRole("combobox");
    const dumperSelect = selects[0]; // first dropdown in row is Dumper select
    fireEvent.change(dumperSelect, { target: { value: "dumper-1" } });

    expect(handleAssignmentsChange).toHaveBeenCalledTimes(1);
    const updatedAssignments = handleAssignmentsChange.mock.calls[0][0];
    expect(updatedAssignments[0]).toMatchObject({
      dumperMachineId: "dumper-1",
      totalLoads: 12,
      totalBcm: 600, // 12 * 50
    });
  });

  it("handles material change correctly", () => {
    const handleAssignmentsChange = jest.fn();
    const initialAssignments: DumperAssignmentRow[] = [
      {
        key: "row-1",
        dumperMachineId: "dumper-1",
        materialType: "Overburden",
        totalLoads: 12,
        totalBcm: 600,
      },
    ];

    render(
      <ExcavatorDumperTable
        siteDumpers={mockSiteDumpers}
        shiftType="day"
        todayDumperLoads={mockTodayDumperLoads}
        assignments={initialAssignments}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    const selects = screen.getAllByRole("combobox");
    const materialSelect = selects[1]; // second dropdown in row is Material select
    fireEvent.change(materialSelect, { target: { value: "Coal" } });

    expect(handleAssignmentsChange).toHaveBeenCalledTimes(1);
    const updatedAssignments = handleAssignmentsChange.mock.calls[0][0];
    expect(updatedAssignments[0]).toMatchObject({
      materialType: "Coal",
    });
  });

  it("handles duplicate row correctly", () => {
    const handleAssignmentsChange = jest.fn();
    const initialAssignments: DumperAssignmentRow[] = [
      {
        key: "row-1",
        dumperMachineId: "dumper-1",
        materialType: "Overburden",
        totalLoads: 12,
        totalBcm: 600,
      },
    ];

    render(
      <ExcavatorDumperTable
        siteDumpers={mockSiteDumpers}
        shiftType="day"
        todayDumperLoads={mockTodayDumperLoads}
        assignments={initialAssignments}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    const duplicateBtn = screen.getByTitle("Duplicate for different material");
    fireEvent.click(duplicateBtn);

    expect(handleAssignmentsChange).toHaveBeenCalledTimes(1);
    const updatedAssignments = handleAssignmentsChange.mock.calls[0][0];
    expect(updatedAssignments).toHaveLength(2);
    expect(updatedAssignments[1]).toMatchObject({
      dumperMachineId: "dumper-1",
      materialType: "Coal",
      totalLoads: 0,
      totalBcm: 0,
    });
  });

  it("handles row removal correctly", () => {
    const handleAssignmentsChange = jest.fn();
    const initialAssignments: DumperAssignmentRow[] = [
      {
        key: "row-1",
        dumperMachineId: "dumper-1",
        materialType: "Overburden",
        totalLoads: 12,
        totalBcm: 600,
      },
    ];

    render(
      <ExcavatorDumperTable
        siteDumpers={mockSiteDumpers}
        shiftType="day"
        todayDumperLoads={mockTodayDumperLoads}
        assignments={initialAssignments}
        onAssignmentsChange={handleAssignmentsChange}
      />
    );

    const removeBtn = screen.getByTitle("Remove");
    fireEvent.click(removeBtn);

    expect(handleAssignmentsChange).toHaveBeenCalledTimes(1);
    expect(handleAssignmentsChange.mock.calls[0][0]).toEqual([]);
  });
});
