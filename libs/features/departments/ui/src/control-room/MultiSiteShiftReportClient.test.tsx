import { render, screen, fireEvent } from "@testing-library/react";
import { MultiSiteShiftReportClient } from "./MultiSiteShiftReportClient";
import type { MultiSiteShiftReport } from "@repo/contract/types/multi-site-production.types";

const mockMultiSiteReport: MultiSiteShiftReport = {
  meta: {
    department_id: "123e4567-e89b-12d3-a456-426614174000",
    shift_date: "2026-08-24",
    shift_type: "night",
    status: "open",
    closed_at: null,
    closed_by: null,
    notes: "BKF & EXT Operations",
  },
  production: {
    BKF: [
      {
        excavator_id: "11111111-1111-1111-1111-111111111111",
        excavator_name: "EX01 - CAT 349D",
        operator_name: "T. Khumalo",
        material_type: "4#LOWER",
        block_id: "SS07-08",
        operating_hours: 9.5,
        delays: null,
        total_loads: 64,
        total_bcm: 896.0,
        total_tonnes: 2598.4,
        rate_per_hour: 273.5,
        trucks: [
          {
            truck_id: "22222222-2222-2222-2222-222222222222",
            truck_name: "ADT-01",
            loads: 32,
          },
        ],
      },
    ],
    EXT: [
      {
        excavator_id: "33333333-3333-3333-3333-333333333333",
        excavator_name: "EX02 - Hitachi ZX870",
        operator_name: "P. Ndlovu",
        material_type: "OVERBURDEN",
        block_id: "EX11-05",
        operating_hours: 8.0,
        delays: "Blast dust clear",
        total_loads: 45,
        total_bcm: 630.0,
        total_tonnes: 1827.0,
        rate_per_hour: 228.4,
        trucks: [],
      },
    ],
  },
  rollover: {
    total_bcm: 2625.0,
    entries: [
      {
        machine_id: "44444444-4444-4444-4444-444444444444",
        machine_name: "DZ-01 CAT D9R",
        operator_name: "J. Sithole",
        start_smu: 1420.5,
        end_smu: 1431.0,
        hours: 10.5,
        push_factor: 250.0,
        total_bcm: 2625.0,
      },
    ],
  },
  fleet_smu: {
    BKF: [
      {
        machine_id: "11111111-1111-1111-1111-111111111111",
        machine_name: "EX01 - CAT 349D",
        machine_type: "Excavator",
        start_smu: 4120.0,
        end_smu: 4129.5,
        hours_worked: 9.5,
        operator_name: "T. Khumalo",
        operational_status: "ACTIVE",
        notes: null,
      },
    ],
  },
  ancillary: [],
  breakdowns: [
    {
      id: "55555555-5555-5555-5555-555555555555",
      machine_id: "22222222-2222-2222-2222-222222222222",
      machine_name: "ADT-01",
      site_code: "BKF",
      duration_hours: 1.5,
      reason: "Hydraulic hose leak",
      repair_notes: "Replaced O-ring",
      is_operational_defect: false,
      status: "completed",
    },
  ],
  bredell_workshop: [
    {
      machine_name: "DZ-03 CAT D9R",
      reason: "Final drive overhaul",
      date_in: "2026-08-20",
    },
  ],
};

describe("MultiSiteShiftReportClient", () => {
  it("renders multi-site production report header with shift information", () => {
    render(<MultiSiteShiftReportClient initialReport={mockMultiSiteReport} />);
    expect(screen.getByText("Multi-Site Production & Engineering Report")).toBeInTheDocument();
    expect(screen.getByText(/2026-08-24 — NIGHT SHIFT/i)).toBeInTheDocument();
  });

  it("renders excavator cards for both BKF and EXT sites when ALL is selected", () => {
    render(<MultiSiteShiftReportClient initialReport={mockMultiSiteReport} />);
    expect(screen.getByText("EX01 - CAT 349D")).toBeInTheDocument();
    expect(screen.getByText("EX02 - Hitachi ZX870")).toBeInTheDocument();
  });

  it("filters excavator cards when specific site button is clicked", () => {
    render(<MultiSiteShiftReportClient initialReport={mockMultiSiteReport} />);

    // Switch to BKF filter
    const bkfButton = screen.getByRole("button", { name: "BKF" });
    fireEvent.click(bkfButton);

    expect(screen.getByText("EX01 - CAT 349D")).toBeInTheDocument();
    expect(screen.queryByText("EX02 - Hitachi ZX870")).not.toBeInTheDocument();
  });

  it("renders dozer rollover volume calculation with 250 m3/h push factor", () => {
    render(<MultiSiteShiftReportClient initialReport={mockMultiSiteReport} />);
    expect(screen.getByText("DZ-01 CAT D9R")).toBeInTheDocument();
    expect(screen.getByText("Total: 2,625 BCM")).toBeInTheDocument();
  });

  it("renders engineering downtime and Bredell workshop off-site items", () => {
    render(<MultiSiteShiftReportClient initialReport={mockMultiSiteReport} />);
    expect(screen.getByText("Hydraulic hose leak")).toBeInTheDocument();
    expect(screen.getByText("DZ-03 CAT D9R")).toBeInTheDocument();
    expect(screen.getByText("Final drive overhaul")).toBeInTheDocument();
  });
});
