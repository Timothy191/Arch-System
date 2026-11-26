import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { toast } from 'sonner';
import { ProductionForemanPdfDocument } from './ProductionForemanPdfDocument';
import { ProductionReportsWorkspace } from './ProductionReportsWorkspace';
import {
  DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  type ProductionPerformanceData,
} from './production-types';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock('./actions', () => ({
  getProductionPerformanceData: jest.fn(),
}));

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="production-pdf-doc">{children}</div>
  ),
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderFn,
  }: {
    children?: React.ReactNode;
    render?: (pageInfo: { pageNumber: number; totalPages: number }) => string;
  }) => <span>{renderFn ? renderFn({ pageNumber: 1, totalPages: 2 }) : children}</span>,
  StyleSheet: { create: (styleMap: unknown) => styleMap },
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  })),
}));

const { pdf: mockedPdf } = jest.requireMock<{ pdf: jest.Mock }>('@react-pdf/renderer');

const mockPerformanceData: ProductionPerformanceData = {
  selectedMonth: '2026-11',
  monthLabel: 'November 2026',
  availableMonths: [{ value: '2026-11', label: 'November 2026 (Current MTD)', isPastMonth: false }],
  targets: DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  shiftRows: [],
  dailyRows: [
    {
      date: '2026-11-24',
      hasData: true,
      pitBcm: 6200,
      pitBcmTarget: 5800,
      pitBcmVariance: 400,
      pitBcmAttainmentPct: 106.9,
      coalTonnes: 4600,
      wasteTonnes: 13200,
      haulLoads: 340,
      rolloverBcm: 1350,
      smrHours: 194,
      combinedDelayHours: 5.0,
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
  weeklyRows: [],
  monthlyRows: [
    {
      month: '2026-11',
      monthLabel: 'November 2026',
      pitBcm: 6200,
      pitBcmTarget: 174000,
      pitBcmAttainmentPct: 3.6,
      coalTonnes: 4600,
      coalTarget: 135000,
      wasteTonnes: 13200,
      wasteTarget: 378000,
      haulLoads: 340,
      loadsTarget: 9600,
      rolloverBcm: 1350,
      rolloverTarget: 39000,
      smrHours: 194,
      smrHoursTarget: 5760,
      combinedDelayHours: 5.0,
      stripRatio: 2.87,
    },
  ],
  delayGroups: [
    {
      key: 'production',
      label: 'Production Delays',
      delayHours: 2.0,
      delayMinutes: 120,
      sharePct: 40.0,
      estimatedPitBcmImpact: 64,
      eventCount: 2,
    },
    {
      key: 'engineering',
      label: 'Engineering Delays',
      delayHours: 1.5,
      delayMinutes: 90,
      sharePct: 30.0,
      estimatedPitBcmImpact: 48,
      eventCount: 1,
    },
    {
      key: 'natural',
      label: 'Natural / Weather Delays',
      delayHours: 1.0,
      delayMinutes: 60,
      sharePct: 20.0,
      estimatedPitBcmImpact: 32,
      eventCount: 1,
    },
    {
      key: 'nonSite',
      label: 'Non-Site Delays',
      delayHours: 0.5,
      delayMinutes: 30,
      sharePct: 10.0,
      estimatedPitBcmImpact: 16,
      eventCount: 1,
    },
  ],
  foremanSummary: {
    reportDate: '2026-11-30',
    supervisorSummary: 'November 2026 Foreman Summary: 6,200 Pit BCM moved.',
    pitBenchProgress: 'Haul Truck Pit BCM: 4,850 BCM · Dozer Rollover: 1,350 BCM.',
    productiveEfficiencyPct: 97.5,
    totalPitBcm: 6200,
    pitBcmTarget: 174000,
    pitBcmAttainmentPct: 3.6,
    totalCoalTonnes: 4600,
    totalWasteTonnes: 13200,
    totalHaulLoads: 340,
    totalRolloverBcm: 1350,
    totalSmrHours: 194,
    totalCombinedDelayHours: 5.0,
    delayGroups: [],
    keyVariances: ['Pit BCM Moved: 6,200 BCM vs 174,000 BCM target.'],
    handoverNotes: ['Bench 4 haulage optimal.'],
  },
};

describe('ProductionReportsWorkspace & Foreman PDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:prod-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('defaults to foreman tab and switches across daily, monthly, and pdf-report tabs', () => {
    render(<ProductionReportsWorkspace initialData={mockPerformanceData} deptId="dept-prod" />);

    expect(screen.getByText(/Foreman Executive Production Report/i)).toBeInTheDocument();
    expect(screen.getByText('Production Delays')).toBeInTheDocument();
    expect(screen.getByText('Engineering Delays')).toBeInTheDocument();
    expect(screen.getByText('Natural / Weather Delays')).toBeInTheDocument();
    expect(screen.getByText('Non-Site Delays')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Daily vs Delays' }));
    expect(screen.getByText(/Daily Production vs Combined Delays Ledger/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Monthly vs Delays' }));
    expect(screen.getByText(/Monthly Production vs Delays Summary/i)).toBeInTheDocument();
  });

  it('opens directly on PDF Report when initialTab is pdf-report and downloads vector PDF without machine SMU tables', async () => {
    render(
      <ProductionReportsWorkspace
        initialData={mockPerformanceData}
        initialTab="pdf-report"
        deptId="dept-prod"
      />
    );

    const preview = within(
      screen.getByRole('article', { name: 'Production Foreman PDF Report Preview' })
    );
    expect(preview.getByText('Foreman Executive Production Summary')).toBeInTheDocument();
    expect(preview.getByText('Production vs Combined Delays Breakdown')).toBeInTheDocument();
    expect(preview.getByText('Daily Production vs Combined Delays Ledger')).toBeInTheDocument();
    expect(preview.getByText('Monthly Production vs Delays Summary')).toBeInTheDocument();
    expect(preview.queryByText(/Start SMR/i)).not.toBeInTheDocument();
    expect(preview.queryByText(/End SMU/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF Report' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Production Foreman & Delays PDF downloaded.')
    );
    expect(mockedPdf).toHaveBeenCalledTimes(1);
  });

  it('renders ProductionForemanPdfDocument sections without machine rows', () => {
    render(<ProductionForemanPdfDocument performance={mockPerformanceData} scope="full" />);

    expect(screen.getByTestId('production-pdf-doc')).toBeInTheDocument();
    expect(screen.getByText('Foreman Executive Production Summary')).toBeInTheDocument();
    expect(screen.getByText('Production vs Combined Delays Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Daily Production vs Combined Delays Ledger')).toBeInTheDocument();
    expect(screen.getByText('Monthly Production vs Delays Summary')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.queryByText(/Machine SMU/i)).not.toBeInTheDocument();
  });
});
