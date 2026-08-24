import { render, screen } from "@testing-library/react";
import { FleetKpiTable } from "./FleetKpiTable";
import type { MachinePerformance } from "@repo/contract/types/shift-compilation.types";

const mockFleet: MachinePerformance[] = [
  {
    machine_id: "11111111-1111-1111-1111-111111111111",
    machine_name: "EX01 - Hitachi 1200",
    machine_type: "excavator",
    hours_worked: 9.5,
    start_time: "06:00:00",
    end_time: "18:00:00",
    breakdown_hours: 1.5,
    delay_hours: 0.5,
    mechanical_availability_pct: 86.4,
  },
  {
    machine_id: "22222222-2222-2222-2222-222222222222",
    machine_name: "DT05 - CAT 777D",
    machine_type: "dump_truck",
    hours_worked: 6.0,
    start_time: "06:00:00",
    end_time: "14:00:00",
    breakdown_hours: 4.0,
    delay_hours: 1.0,
    mechanical_availability_pct: 60.0,
  },
];

describe("FleetKpiTable", () => {
  it("renders empty state when no machines are provided", () => {
    render(<FleetKpiTable fleet={[]} />);
    expect(screen.getByText(/No machine telemetry or operations recorded/i)).toBeInTheDocument();
  });

  it("renders machine rows with correct SMU, breakdown and availability metrics", () => {
    render(<FleetKpiTable fleet={mockFleet} />);

    expect(screen.getByText("EX01 - Hitachi 1200")).toBeInTheDocument();
    expect(screen.getByText("DT05 - CAT 777D")).toBeInTheDocument();

    expect(screen.getByText("9.5h")).toBeInTheDocument();
    expect(screen.getByText("86.4%")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
  });
});
