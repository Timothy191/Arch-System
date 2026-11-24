import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductionPerformanceClient } from './ProductionPerformanceClient';
import {
  DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  type ProductionPerformanceData,
} from './production-types';

jest.mock('./actions', () => ({
  getProductionPerformanceData: jest.fn(),
}));

const mockPerformanceData: ProductionPerformanceData = {
  selectedMonth: '2026-11',
  monthLabel: 'November 2026',
  availableMonths: [
    { value: '2026-11', label: 'November 2026 (Current MTD)', isPastMonth: false },
    { value: '2026-10', label: 'October 2026 (Passed Month)', isPastMonth: true },
  ],
  targets: DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  shiftRows: [
    {
      id: '2026-11-24|day',
      date: '2026-11-24',
      shiftType: 'day',
      pitBcm: 3100,
      pitBcmTarget: 2900,
      pitBcmAttainmentPct: 106.9,
      coalTonnes: 2400,
      wasteTonnes: 6500,
      haulLoads: 170,
      rolloverBcm: 700,
      smrHours: 98,
      combinedDelayHours: 2.5,
      productiveEfficiencyPct: 97.5,
    },
  ],
  dailyRows: [
    {
      date: '2026-11-24',
      hasData: true,
      pitBcm: 6100,
      pitBcmTarget: 5800,
      pitBcmVariance: 300,
      pitBcmAttainmentPct: 105.2,
      coalTonnes: 4700,
      wasteTonnes: 13000,
      haulLoads: 335,
      rolloverBcm: 1350,
      smrHours: 190,
      combinedDelayHours: 4.5,
    },
    {
      date: '2026-11-23',
      hasData: false,
      pitBcm: 0,
      pitBcmTarget: 5800,
      pitBcmVariance: -5800,
      pitBcmAttainmentPct: 0,
      coalTonnes: 0,
      wasteTonnes: 0,
      haulLoads: 0,
      rolloverBcm: 0,
      smrHours: 0,
      combinedDelayHours: 0,
    },
  ],
  weeklyRows: [
    {
      weekLabel: 'Week 4',
      dateRangeLabel: '11-22 to 11-28',
      startDate: '2026-11-22',
      endDate: '2026-11-28',
      daysCaptured: 1,
      pitBcm: 6100,
      pitBcmTarget: 40600,
      pitBcmAttainmentPct: 15.0,
      coalTonnes: 4700,
      wasteTonnes: 13000,
      haulLoads: 335,
      rolloverBcm: 1350,
      smrHours: 190,
      combinedDelayHours: 4.5,
    },
  ],
  monthlyRows: [
    {
      month: '2026-11',
      monthLabel: 'November 2026',
      pitBcm: 6100,
      pitBcmTarget: 174000,
      pitBcmAttainmentPct: 3.5,
      coalTonnes: 4700,
      coalTarget: 135000,
      wasteTonnes: 13000,
      wasteTarget: 378000,
      haulLoads: 335,
      loadsTarget: 9600,
      rolloverBcm: 1350,
      rolloverTarget: 39000,
      smrHours: 190,
      smrHoursTarget: 5760,
      combinedDelayHours: 4.5,
      stripRatio: 2.77,
    },
  ],
  delayGroups: [
    {
      key: 'production',
      label: 'Production Delays',
      delayHours: 2.0,
      delayMinutes: 120,
      sharePct: 44.4,
      estimatedPitBcmImpact: 64,
      eventCount: 2,
    },
    {
      key: 'engineering',
      label: 'Engineering Delays',
      delayHours: 1.5,
      delayMinutes: 90,
      sharePct: 33.3,
      estimatedPitBcmImpact: 48,
      eventCount: 1,
    },
    {
      key: 'natural',
      label: 'Natural / Weather Delays',
      delayHours: 1.0,
      delayMinutes: 60,
      sharePct: 22.2,
      estimatedPitBcmImpact: 32,
      eventCount: 1,
    },
    {
      key: 'nonSite',
      label: 'Non-Site Delays',
      delayHours: 0,
      delayMinutes: 0,
      sharePct: 0,
      estimatedPitBcmImpact: 0,
      eventCount: 0,
    },
  ],
  foremanSummary: {
    reportDate: '2026-11-30',
    supervisorSummary: 'November 2026 Foreman Production Summary: 6,100 Pit BCM moved.',
    pitBenchProgress: 'Haul Truck Pit BCM: 4,750 BCM · Dozer Rollover: 1,350 BCM.',
    productiveEfficiencyPct: 97.7,
    totalPitBcm: 6100,
    pitBcmTarget: 174000,
    pitBcmAttainmentPct: 3.5,
    totalCoalTonnes: 4700,
    totalWasteTonnes: 13000,
    totalHaulLoads: 335,
    totalRolloverBcm: 1350,
    totalSmrHours: 190,
    totalCombinedDelayHours: 4.5,
    delayGroups: [],
    keyVariances: ['Pit BCM Moved: 6,100 BCM vs 174,000 BCM target.'],
    handoverNotes: ['2026-11-24 (day): Bench 4 haul cycle stable.'],
  },
};

describe('ProductionPerformanceClient', () => {
  it('switches across Shift, Daily, Weekly, Monthly, and Foreman Report tabs', () => {
    render(<ProductionPerformanceClient initialData={mockPerformanceData} deptId="dept-prod" />);

    expect(screen.getByText('Production Performance & Foreman Analytics')).toBeInTheDocument();
    expect(screen.getByText('106.9%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Daily Performance' }));
    expect(screen.getByText(/2026-11-23 · No data captured/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Weekly Performance' }));
    expect(screen.getByText('Week 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Monthly Performance' }));
    expect(screen.getByText('6,100 BCM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Foreman Report' }));
    expect(screen.getByText(/Foreman Shift & Operations Report/i)).toBeInTheDocument();
    expect(screen.getByText(/Productive Efficiency: 97.7%/i)).toBeInTheDocument();
  });

  it('exports performance CSV when CSV button is clicked', () => {
    const createObjectURL = jest.fn(() => 'blob:perf-csv');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    render(<ProductionPerformanceClient initialData={mockPerformanceData} deptId="dept-prod" />);
    fireEvent.click(screen.getByRole('button', { name: /CSV/i }));

    expect(createObjectURL).toHaveBeenCalled();
  });
});
