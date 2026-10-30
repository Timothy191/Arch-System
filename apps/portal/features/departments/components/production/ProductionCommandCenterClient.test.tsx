import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ProductionCommandCenterClient } from './ProductionCommandCenterClient';
import type { ProductionMonthReportData } from './actions';

// Mock dependencies
jest.mock('./actions', () => ({
  getProductionDepartmentData: jest.fn(),
  upsertMonthlyProductionTarget: jest.fn(),
}));

const mockReportData: ProductionMonthReportData = {
  selectedMonth: '2026-03',
  monthLabel: 'March 2026',
  availableMonths: [
    { value: '2026-03', label: 'March 2026', isPastMonth: false },
    { value: '2026-02', label: 'February 2026', isPastMonth: true },
  ],
  target: {
    target_month: '2026-03',
    coal_target_tonnes: 100000,
    waste_target_tonnes: 300000,
    bcm_target: 150000,
    notes: 'March target',
    updated_at: '2026-03-01T00:00:00Z',
  },
  totals: {
    coalTonnes: 85000,
    wasteTonnes: 250000,
    totalTonnes: 335000,
    haulTruckLoads: 4500,
    haulTruckBcm: 90000,
    excavatorBcm: 80000,
    dozerPushBcm: 10000,
    totalBcm: 100000,
    fleetOperatingHours: 450.5,
    stripRatio: 2.94,
    expectedTonnesFromBcm: 195000,
    reconciliationDriftPct: 71.79,
    daysLogged: 10,
    totalDaysInMonth: 31,
    coalTargetProgressPct: 85.0,
    wasteTargetProgressPct: 83.3,
    bcmTargetProgressPct: 66.7,
    remainingCoalTonnes: 15000,
    remainingWasteTonnes: 50000,
    requiredDailyCoalRate: 714,
    requiredDailyWasteRate: 2381,
  },
  dailyRows: [
    {
      date: '2026-03-10',
      dayShiftCoalTonnes: 4500,
      nightShiftCoalTonnes: 4000,
      totalCoalTonnes: 8500,
      dayShiftWasteTonnes: 12000,
      nightShiftWasteTonnes: 13000,
      totalWasteTonnes: 25000,
      haulTruckLoads: 450,
      haulTruckBcm: 9000,
      excavatorBcm: 8000,
      dozerPushBcm: 1000,
      totalBcm: 10000,
      fleetOperatingHours: 45.0,
      activeMachinesCount: 12,
      stripRatio: 2.94,
    },
  ],
};

describe('ProductionCommandCenterClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with monthly targets and single-pass aggregated table totals', () => {
    render(<ProductionCommandCenterClient initialData={mockReportData} deptId="dept-prod-01" />);

    expect(screen.getByText('Production Command & Monthly Reconciliation')).toBeInTheDocument();
    expect(screen.getByText('March 2026 — Automated Daily Production & Stripping Ledger')).toBeInTheDocument();

    // Verify monthly total footer rendering from memoized shift totals
    expect(screen.getByText('MONTHLY TOTAL')).toBeInTheDocument();
    expect(screen.getAllByText('4,500').length).toBeGreaterThan(0); // Day shift coal total
    expect(screen.getAllByText('4,000').length).toBeGreaterThan(0); // Night shift coal total
    expect(screen.getAllByText('85,000 t').length).toBeGreaterThan(0); // Total coal
    expect(screen.getAllByText('250,000 t').length).toBeGreaterThan(0); // Total waste
  });

  it('renders empty state message when dailyRows is empty', () => {
    const emptyData: ProductionMonthReportData = {
      ...mockReportData,
      dailyRows: [],
    };

    render(<ProductionCommandCenterClient initialData={emptyData} deptId="dept-prod-01" />);

    expect(
      screen.getByText('No shift logs or haulage loads recorded for March 2026 yet.')
    ).toBeInTheDocument();
    expect(screen.queryByText('MONTHLY TOTAL')).not.toBeInTheDocument();
  });

  it('triggers CSV export when CSV button is clicked', () => {
    const createObjectURLMock = jest.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<ProductionCommandCenterClient initialData={mockReportData} deptId="dept-prod-01" />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    fireEvent.click(csvButton);

    expect(createObjectURLMock).toHaveBeenCalled();
  });
});
