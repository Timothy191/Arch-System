import { render, screen } from "@testing-library/react";
import { ProductionSummaryCard } from "./ProductionSummaryCard";
import type { UnifiedShiftReport } from "@repo/contract/types/shift-compilation.types";

const mockProduction: UnifiedShiftReport["production"] = {
  total_loads: 142,
  machines: [
    {
      machine_id: "11111111-1111-1111-1111-111111111111",
      machine_name: "EX01 - Hitachi 1200",
      machine_type: "excavator",
      total_loads: 82,
      hourly_distribution: {
        h06: 8,
        h07: 10,
        h08: 9,
        h09: 7,
        h10: 8,
        h11: 9,
        h12: 6,
        h13: 8,
        h14: 7,
        h15: 8,
        h16: 6,
        h17: 6,
      },
    },
    {
      machine_id: "22222222-2222-2222-2222-222222222222",
      machine_name: "EX02 - CAT 390F",
      machine_type: "excavator",
      total_loads: 60,
      hourly_distribution: {
        h06: 5,
        h07: 6,
        h08: 5,
        h09: 6,
        h10: 5,
        h11: 5,
        h12: 5,
        h13: 6,
        h14: 6,
        h15: 5,
        h16: 3,
        h17: 3,
      },
    },
  ],
};

describe("ProductionSummaryCard", () => {
  it("renders total shift loads correctly", () => {
    render(<ProductionSummaryCard production={mockProduction} shiftType="day" />);
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("EX01 - Hitachi 1200")).toBeInTheDocument();
    expect(screen.getByText("EX02 - CAT 390F")).toBeInTheDocument();
  });

  it("renders empty state when no machines are present", () => {
    render(<ProductionSummaryCard production={{ total_loads: 0, machines: [] }} shiftType="day" />);
    expect(screen.getByText(/No hourly load tallies recorded/i)).toBeInTheDocument();
  });
});
