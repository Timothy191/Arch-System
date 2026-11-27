jest.mock('@/styles/print-report.css', () => ({}));
jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));
jest.mock('@react-pdf/renderer', () => {
  const React = require('react');
  return {
    Document: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="shift-pdf-doc">{children}</div>
    ),
    Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    StyleSheet: { create: (styles: unknown) => styles },
    pdf: jest.fn(() => ({
      toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
    })),
  };
});

const mockRefresh = jest.fn();
type RealtimeCallback = (payload: unknown) => void;
interface MockRealtimeOptions {
  table: string;
  filter?: string;
  event?: string;
  enabled?: boolean;
  onChange?: RealtimeCallback;
}
const mockRealtimeOptions: MockRealtimeOptions[] = [];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@repo/shared/hooks', () => ({
  ...jest.requireActual('@repo/shared/hooks'),
  useSupabaseRealtime: jest.fn((options: MockRealtimeOptions) => {
    mockRealtimeOptions.push(options);
  }),
}));

jest.mock('@repo/supabase/client', () => ({
  ...jest.requireActual('@repo/supabase/client'),
  createBrowserSupabaseClient: jest.fn(() => ({
    channel: jest.fn(),
    removeChannel: jest.fn(),
  })),
}));

jest.mock('@/features/analytics/components/PDFDownloadButton', () => ({
  PDFDownloadButton: () => (
    <button type="button" data-testid="pdf-download-btn">
      Export PDF
    </button>
  ),
}));

jest.mock('@/features/analytics/components/ExportButton', () => ({
  ExportButton: () => <button type="button">Export CSV</button>,
}));

jest.mock('./CopyReportButton', () => ({
  CopyReportButton: () => <button type="button">Copy CSV</button>,
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock('@/lib/shift-completeness', () => ({
  getShiftCompleteness: jest.fn(),
}));

jest.mock('@/app/(departments)/[department]/engineering-notes/actions', () => ({
  saveMachineOverviewRow: jest.fn().mockResolvedValue({ success: true }),
}));

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReportsDashboardClient } from './ReportsDashboardClient';
import type { MachineOperationLogItem } from './reports-types';
import { ShiftActivityDashboard } from './ShiftActivityDashboard';

function makeLog(
  overrides: Partial<MachineOperationLogItem> & { id: string }
): MachineOperationLogItem {
  return {
    id: overrides.id,
    date: '2026-11-27',
    shift: 'day',
    machineName: 'EX-01 Liebherr 984',
    machineType: 'Excavator',
    operatorName: 'Operator One',
    siteName: 'Pit North',
    startSmu: 100,
    endSmu: 108,
    hoursWorked: 8,
    bcmMoved: 100,
    isDozer: false,
    delayMinutes: 20,
    status: 'completed',
    ...overrides,
  };
}

const representativeLogs: MachineOperationLogItem[] = [
  makeLog({ id: 'activity-1', date: '2026-11-27' }),
  makeLog({
    id: 'activity-2',
    date: '2026-11-26',
    shift: 'night',
    machineName: 'ADT-04 Bell B40E',
    machineType: 'ADT',
    operatorName: 'Operator Two',
    hoursWorked: 10,
    bcmMoved: 250,
    delayMinutes: 35,
    status: 'active',
    material: 'Coal',
    blockMined: 'SS07',
  }),
];

const baseProps = {
  departmentId: 'dept-control-room',
  departmentSlug: 'control-room',
  departmentName: 'Control Room',
  isControlRoom: true,
  todayStr: '2026-11-27',
  currentShift: 'day' as const,
  fromDateStr: '2026-10-28',
  toDateStr: '2026-11-27',
  totalFleetCount: 10,
  coveredFleetCount: 8,
  missingCoverage: [],
  shiftRows: [],
  machineOperationLogs: representativeLogs,
  engineeringLogs: [],
  csvContent: 'Date,Shift\n2026-11-27,day',
  exportRows: [],
  pdfReportData: {
    title: 'Control Room Report',
    subtitle: 'Subtitle',
    kpis: [],
    tableHeaders: [],
    tableRows: [],
  },
};

describe('ShiftActivityDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealtimeOptions.length = 0;
  });

  it('should render KPIs and activity rows from the supplied machine operation logs', () => {
    render(<ShiftActivityDashboard departmentId="dept-control-room" logs={representativeLogs} />);

    const section = screen.getByRole('region', { name: 'Shift activity dashboard' });
    const table = within(section).getByRole('table', { name: 'Shift activity' });

    expect(within(section).getByText('Active machines')).toBeInTheDocument();
    expect(within(section).getByText('1')).toBeInTheDocument();
    expect(within(section).getByText('55 min')).toBeInTheDocument();
    expect(within(section).getByText('350 BCM')).toBeInTheDocument();
    expect(within(section).getByText('50%')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('EX-01 Liebherr 984')).toBeInTheDocument();
    expect(within(table).getByText('ADT-04 Bell B40E')).toBeInTheDocument();
  });

  it('should apply shift, status, and date filters to the activity rows', () => {
    render(<ShiftActivityDashboard departmentId="dept-control-room" logs={representativeLogs} />);

    fireEvent.change(screen.getByTestId('activity-shift-filter'), { target: { value: 'night' } });
    expect(screen.queryByText('EX-01 Liebherr 984')).not.toBeInTheDocument();
    expect(screen.getByText('ADT-04 Bell B40E')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('activity-status-filter'), {
      target: { value: 'completed' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('No shift activity matches');

    fireEvent.change(screen.getByTestId('activity-shift-filter'), { target: { value: 'all' } });
    expect(screen.getByText('EX-01 Liebherr 984')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('activity-status-filter'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('activity-date-filter'), {
      target: { value: '2026-11-26' },
    });
    expect(screen.queryByText('EX-01 Liebherr 984')).not.toBeInTheDocument();
    expect(screen.getByText('ADT-04 Bell B40E')).toBeInTheDocument();
  });

  it('should search across machine, operator, site, and block fields', () => {
    render(<ShiftActivityDashboard departmentId="dept-control-room" logs={representativeLogs} />);

    fireEvent.change(screen.getByTestId('activity-search'), { target: { value: 'SS07' } });
    expect(screen.getByText('ADT-04 Bell B40E')).toBeInTheDocument();
    expect(screen.queryByText('EX-01 Liebherr 984')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('activity-search'), { target: { value: 'Operator One' } });
    expect(screen.getByText('EX-01 Liebherr 984')).toBeInTheDocument();
  });

  it('should toggle sort direction when a sortable column header is clicked', () => {
    render(<ShiftActivityDashboard departmentId="dept-control-room" logs={representativeLogs} />);

    const table = screen.getByRole('table', { name: 'Shift activity' });
    const firstDataRow = () => within(table).getAllByRole('row')[1]!;

    expect(within(firstDataRow()).getByText('EX-01 Liebherr 984')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by BCM' }));
    expect(within(firstDataRow()).getByText('EX-01 Liebherr 984')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by BCM' }));
    expect(within(firstDataRow()).getByText('ADT-04 Bell B40E')).toBeInTheDocument();
  });

  it('should paginate activity rows eight at a time', () => {
    const manyLogs = Array.from({ length: 12 }, (_, index) =>
      makeLog({
        id: `activity-page-${index}`,
        date: `2026-11-${String(27 - index).padStart(2, '0')}`,
        machineName: `Machine-${index}`,
      })
    );

    render(<ShiftActivityDashboard departmentId="dept-control-room" logs={manyLogs} />);

    const table = screen.getByRole('table', { name: 'Shift activity' });
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: 'Next activity page' }));

    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Next activity page' })).toBeDisabled();
  });

  it('should subscribe to machine_operations realtime changes and refresh the route', () => {
    render(<ShiftActivityDashboard departmentId="dept-control-room" logs={representativeLogs} />);

    expect(useSupabaseRealtime).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'machine_operations',
        filter: 'department_id=eq.dept-control-room',
        event: '*',
      })
    );

    const latestOptions = mockRealtimeOptions.at(-1);
    expect(latestOptions?.onChange).toBeDefined();

    act(() => {
      latestOptions?.onChange?.({ eventType: 'UPDATE' });
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pdf-download-btn')).not.toBeInTheDocument();
  });

  it('should expose a shift activity sub-tab with no PDF control in the reports action bar', () => {
    render(<ReportsDashboardClient {...baseProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));

    const section = screen.getByRole('region', { name: 'Shift activity dashboard' });
    expect(within(section).getByRole('table', { name: 'Shift activity' })).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /pdf/i })).not.toBeInTheDocument();

    const actionBar = screen.getByTestId('reports-dashboard-action-bar');
    expect(within(actionBar).getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(within(actionBar).getByRole('button', { name: 'Copy CSV' })).toBeInTheDocument();
    expect(within(actionBar).queryByTestId('pdf-download-btn')).not.toBeInTheDocument();
    expect(within(actionBar).queryByRole('button', { name: /pdf/i })).not.toBeInTheDocument();
  });
});
