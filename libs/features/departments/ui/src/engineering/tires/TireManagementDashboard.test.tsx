import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TireManagementDashboard } from "./TireManagementDashboard";
import type { TireWithInspections } from "./types";

// Mock TireWearCurveChart and Modals for JSDOM rendering
jest.mock("./TireWearCurveChart", () => ({
  TireWearCurveChart: () => <div data-testid="wear-curve-chart" />,
}));
jest.mock("./TireInspectionModal", () => ({
  TireInspectionModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div data-testid="inspection-modal">
        <h3>Log Tire Inspection</h3>
        <button type="submit">Record Inspection</button>
      </div>
    ) : null,
}));
jest.mock("./TireReplacementModal", () => ({
  TireReplacementModal: () => null,
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

const mockTires: TireWithInspections[] = [
  {
    id: "tire-1",
    serial_number: "MICH-5980-001",
    brand: "Michelin",
    size: "59/80R63",
    machine_id: "m-1",
    machine_name: "Haul Truck 01",
    position: "Front Left",
    status: "installed",
    installed_at: "2026-01-10",
    installed_hours: 1400,
    removed_at: null,
    removed_hours: null,
    scrapped_reason: null,
    inspections: [
      {
        id: "insp-1",
        inspection_date: "2026-06-01",
        tread_depth_mm: 75,
        pressure_psi: 102,
        condition_status: "good",
        notes: "Initial wear",
        created_at: "2026-06-01T10:00:00Z",
      },
      {
        id: "insp-2",
        inspection_date: "2026-08-10",
        tread_depth_mm: 52,
        pressure_psi: 100,
        condition_status: "good",
        notes: "Normal wear",
        created_at: "2026-08-10T10:00:00Z",
      },
    ],
    latest_inspection: {
      tread_depth_mm: 52,
      pressure_psi: 100,
      condition_status: "good",
      inspection_date: "2026-08-10",
      notes: "Normal wear",
    },
  },
  {
    id: "tire-2",
    serial_number: "BS-4000-002",
    brand: "Bridgestone",
    size: "40.00R57",
    machine_id: "m-2",
    machine_name: "Haul Truck 02",
    position: "Rear Outer Right",
    status: "installed",
    installed_at: "2025-11-20",
    installed_hours: 2800,
    removed_at: null,
    removed_hours: null,
    scrapped_reason: null,
    inspections: [
      {
        id: "insp-3",
        inspection_date: "2026-08-15",
        tread_depth_mm: 14,
        pressure_psi: 88,
        condition_status: "critical",
        notes: "Severe shoulder cut",
        created_at: "2026-08-15T10:00:00Z",
      },
    ],
    latest_inspection: {
      tread_depth_mm: 14,
      pressure_psi: 88,
      condition_status: "critical",
      inspection_date: "2026-08-15",
      notes: "Severe shoulder cut",
    },
  },
];

const mockMachines = [
  { id: "m-1", name: "Haul Truck 01", machine_type: "Haul Truck" },
  { id: "m-2", name: "Haul Truck 02", machine_type: "Haul Truck" },
];

describe("TireManagementDashboard", () => {
  it("renders header, KPI metrics, and fleet table", () => {
    render(<TireManagementDashboard tires={mockTires} machines={mockMachines} />);

    expect(screen.getByText("Tire Management Hub")).toBeInTheDocument();
    expect(screen.getByText("Active Fleet Tires")).toBeInTheDocument();
    expect(screen.getByText("MICH-5980-001")).toBeInTheDocument();
    expect(screen.getByText("BS-4000-002")).toBeInTheDocument();
  });

  it("filters tires by search query", () => {
    render(<TireManagementDashboard tires={mockTires} machines={mockMachines} />);

    const searchInput = screen.getByPlaceholderText(/search serial number/i);
    fireEvent.change(searchInput, { target: { value: "BS-4000" } });

    expect(screen.getByText("BS-4000-002")).toBeInTheDocument();
    expect(screen.queryByText("MICH-5980-001")).not.toBeInTheDocument();
  });

  it("opens inspection modal on clicking Inspect button", () => {
    render(<TireManagementDashboard tires={mockTires} machines={mockMachines} />);

    const inspectButtons = screen.getAllByTitle("Log Inspection");
    fireEvent.click(inspectButtons[0]!);

    expect(screen.getByText(/Log Tire Inspection/i)).toBeInTheDocument();
    expect(screen.getByText(/Record Inspection/i)).toBeInTheDocument();
  });
});
