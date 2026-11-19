import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { ProductionMonthReportData } from './actions';
import { getProductionDepartmentData } from './actions';
import { MonthlyProductionTargetBanner, ProductionDashboard } from './ProductionDashboard';

const mockReportData: ProductionMonthReportData = {
  selectedMonth: '2026-10',
  monthLabel: 'October 2026',
  availableMonths: [{ value: '2026-10', label: 'October 2026 (Current MTD)', isPastMonth: false }],
  target: {
    target_month: '2026-10',
    coal_target_tonnes: 100000,
    waste_target_tonnes: 300000,
    bcm_target: 150000,
    notes: 'Target',
    updated_at: '2026-10-01T00:00:00Z',
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
    reconciliationDriftPct: 12.5,
    daysLogged: 10,
    totalDaysInMonth: 31,
    coalTargetProgressPct: 85,
    wasteTargetProgressPct: 83.3,
    bcmTargetProgressPct: 66.7,
    remainingCoalTonnes: 15000,
    remainingWasteTonnes: 50000,
    requiredDailyCoalRate: 714,
    requiredDailyWasteRate: 2381,
  },
  dailyRows: [],
};

jest.mock('./actions', () => ({
  getProductionDepartmentData: jest.fn(async () => mockReportData),
}));

jest.mock('./ProductionCommandCenterClient', () => ({
  ProductionCommandCenterClient: ({
    deptId,
    initialData,
  }: {
    deptId: string;
    initialData: ProductionMonthReportData;
  }) => (
    <div data-testid="production-command-center-client">
      <span>{deptId}</span>
      <span>{initialData.monthLabel}</span>
    </div>
  ),
}));

describe('ProductionDashboard & MonthlyProductionTargetBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ProductionDashboard RSC and forwards initialData and deptId', async () => {
    const jsx = await ProductionDashboard({ deptId: 'dept-prod-1', month: '2026-10' });
    render(jsx);

    expect(getProductionDepartmentData).toHaveBeenCalledWith('2026-10', 'dept-prod-1');
    expect(screen.getByTestId('production-command-center-client')).toBeInTheDocument();
    expect(screen.getByText('dept-prod-1')).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });

  it('renders MonthlyProductionTargetBanner with explicit en-US numeric formatting', async () => {
    const jsx = await MonthlyProductionTargetBanner();
    render(jsx);

    expect(screen.getByText('Monthly Production Targets — October 2026')).toBeInTheDocument();
    expect(screen.getByText('85,000 / 100,000 t')).toBeInTheDocument();
    expect(screen.getByText('250,000 / 300,000 t')).toBeInTheDocument();
    expect(screen.getByText('100,000 / 150,000 BCM')).toBeInTheDocument();
    expect(screen.getByText('2.94:1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Adjust/i })).toHaveAttribute('href', '/production');
  });
});
