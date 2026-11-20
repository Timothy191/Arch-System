/* cspell:ignore mttr */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { getDepartmentContext } from '~/lib/dept-context';
import { EngineeringPdfDocument } from './EngineeringPdfDocument';
import { EngineeringReportsClient } from './EngineeringReportsClient';
import {
  buildEngineeringCsvContent,
  buildEngineeringReportsPayload,
  escapeEngineeringReportCsvCell,
  resolveEngineeringReportRange,
  resolveEngineeringReportTab,
  resolveRangeWindow,
} from './engineering-reports-model';
import { buildEngineeringWhatsappMessage } from './engineering-whatsapp';
import EngineeringReportsPage from './page';

const mockPush = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
  usePathname: () => '/engineering/reports',
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  BarChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-bar-chart">{children}</div>
  ),
  Bar: () => <div />,
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-pdf-document">{children}</div>
  ),
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: (styles: unknown) => styles },
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  })),
}));

function buildSamplePayload(
  initialTab: 'dashboard' | 'pdf-report' | 'whatsapp-report' = 'dashboard'
) {
  return buildEngineeringReportsPayload({
    departmentName: 'Engineering',
    range: '7d',
    initialTab,
    todayStr: '2026-11-20',
    fromDateStr: '2026-11-14',
    toDateStr: '2026-11-20',
    rangeLabel: 'Last 7 Days',
    rawBreakdowns: [
      {
        id: 'bd-1',
        fleet_id: 'DT-01',
        machine_id: 'm1',
        machine_name: 'DT-01 CAT 797F',
        machine_type: 'Dump Truck',
        reason: 'Hydraulic hose leak',
        status: 'active',
        date_in: '2026-11-20',
        time_in: '06:30',
        date_out: null,
        time_out: null,
        duration_hours: null,
        repair_notes: null,
        created_at: '2026-11-20T06:30:00Z',
      },
      {
        id: 'bd-2',
        fleet_id: 'EX-02',
        machine_id: 'm2',
        machine_name: 'EX-02 PC8000',
        machine_type: 'Excavator',
        reason: 'Alternator belt replacement',
        status: 'completed',
        date_in: '2026-11-19',
        time_in: '08:00',
        date_out: '2026-11-19',
        time_out: '12:00',
        duration_hours: 4,
        repair_notes: 'Belt tensioned and tested',
        created_at: '2026-11-19T08:00:00Z',
      },
    ],
    rawMachines: [
      {
        id: 'm1',
        name: 'DT-01 CAT 797F',
        machine_type: 'Dump Truck',
        serial_number: 'SN-001',
        active: true,
      },
      {
        id: 'm2',
        name: 'EX-02 PC8000',
        machine_type: 'Excavator',
        serial_number: 'SN-002',
        active: true,
      },
    ],
    rawTires: [
      {
        id: 't1',
        serial_number: 'TIRE-101',
        brand: 'Michelin',
        size: '59/80R63',
        position: 'Front Left',
        status: 'installed',
        machine_id: 'm1',
        installed_at: '2026-09-01',
        installed_hours: 1400,
        removed_at: null,
        removed_hours: null,
        scrapped_reason: null,
        machines: { id: 'm1', name: 'DT-01 CAT 797F' },
      },
      {
        id: 't2',
        serial_number: 'TIRE-102',
        brand: 'Bridgestone',
        size: '59/80R63',
        position: 'Front Right',
        status: 'inventory',
        machine_id: null,
        installed_at: '2026-09-01',
        installed_hours: 900,
        removed_at: '2026-11-18',
        removed_hours: 1200,
        scrapped_reason: null,
        machines: null,
      },
    ],
    rawTireInspections: [
      {
        id: 'insp-1',
        tire_id: 't1',
        inspection_date: '2026-11-20',
        tread_depth_mm: 12,
        pressure_psi: 105,
        condition_status: 'critical',
        current_smu: 1400,
        notes: '[REPLACEMENT] Machine: DT-01 CAT 797F | Position: Front Left',
      },
      {
        id: 'insp-2',
        tire_id: 't2',
        inspection_date: '2026-11-18',
        tread_depth_mm: 24,
        pressure_psi: 108,
        condition_status: 'good',
        current_smu: 1200,
        notes: '[REMOVAL] Machine: DT-01 CAT 797F | Outcome: inventory',
      },
    ],
    rawMachineHours: [
      { id: 'mh-1', machine_id: 'm1', daily_log_date: '2026-11-20', hours_worked: 14.5 },
      { id: 'mh-2', machine_id: 'm2', daily_log_date: '2026-11-20', hours_worked: 18.0 },
    ],
    rawMachineOperations: [],
  });
}

describe('Engineering Reports Suite (/engineering/reports)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:http://localhost/test-blob'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(async () => undefined),
      },
    });
    window.print = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('computes engineering metrics, CSV formula neutralization, and WhatsApp dispatch accurately', () => {
    const payload = buildSamplePayload('dashboard');
    expect(payload.summary.totalBreakdowns).toBe(2);
    expect(payload.summary.activeBreakdowns).toBe(1);
    expect(payload.summary.resolvedBreakdowns).toBe(1);
    expect(payload.summary.fleetAvailabilityPct).toBe(50);
    expect(payload.summary.mttrHours).toBe(4);
    expect(payload.summary.totalHoursWorked).toBe(32.5);
    expect(payload.summary.criticalTires).toBe(1);
    expect(payload.summary.tireRemovalsCount).toBe(1);
    expect(payload.summary.tireReplacementsCount).toBe(1);

    expect(escapeEngineeringReportCsvCell('=CMD()')).toBe('"\'=CMD()"');
    expect(escapeEngineeringReportCsvCell('Normal "Note"')).toBe('"Normal ""Note"""');
    const csv = buildEngineeringCsvContent(payload);
    expect(csv).toContain('DT-01 CAT 797F');
    expect(csv).toContain('TIRE-101');

    expect(resolveEngineeringReportTab('pdf-report')).toBe('pdf-report');
    expect(resolveEngineeringReportTab('unknown')).toBe('dashboard');
    expect(resolveEngineeringReportRange('24h')).toBe('24h');
    expect(resolveEngineeringReportRange('other')).toBe('7d');
    expect(resolveRangeWindow({ todayStr: '2026-11-20', range: '24h' }).fromDateStr).toBe(
      '2026-11-20'
    );

    const whatsappText = buildEngineeringWhatsappMessage({
      payload,
      sections: {
        includeKpis: true,
        includeBreakdowns: true,
        includeTireHealth: true,
        includeMachineHours: true,
      },
    });
    expect(whatsappText).toContain('Fleet Availability: 50.0%');
    expect(whatsappText).toContain('DT-01 CAT 797F');
    expect(whatsappText).toContain('TIRE-101');
  });

  it('renders server page with graceful fallback queries and passes data to client', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValue({
      dept: { name: 'engineering', displayName: 'Engineering' },
      deptId: 'dept-eng-1',
      today: '2026-11-20',
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      },
    });

    const jsx = await EngineeringReportsPage({
      searchParams: Promise.resolve({ tab: 'dashboard', range: '30d' }),
    });
    render(jsx);

    expect(screen.getByText(/Engineering Reports & Dispatch Suite/i)).toBeInTheDocument();
    expect(screen.getByTestId('engineering-dashboard-view')).toBeInTheDocument();
  });

  it('supports switching between Dashboard, PDF Report, WhatsApp Report, range switching, and exports', async () => {
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    const payload = buildSamplePayload('dashboard');
    render(<EngineeringReportsClient payload={payload} />);

    // Dashboard charts & KPIs
    expect(screen.getByTestId('engineering-dashboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('recharts-pie-chart')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();

    // Range switch triggers router push
    fireEvent.click(screen.getByRole('button', { name: '30 Days' }));
    expect(mockPush).toHaveBeenCalledWith('/engineering/reports?tab=dashboard&range=30d');

    // CSV Export
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();

    // Switch to PDF Report
    fireEvent.click(screen.getByRole('tab', { name: /PDF Report/i }));
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      '',
      '/engineering/reports?tab=pdf-report&range=7d'
    );
    expect(screen.getByTestId('engineering-pdf-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    expect(screen.getByTestId('engineering-pdf-preview')).toHaveStyle({
      transform: 'scale(0.75)',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(window.print).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('download-engineering-pdf-btn'));
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    });

    // Switch to WhatsApp Report
    fireEvent.click(screen.getByRole('tab', { name: /WhatsApp Report/i }));
    expect(screen.getByTestId('engineering-whatsapp-view')).toBeInTheDocument();
    const preview = screen.getByTestId('whatsapp-message-preview');
    expect(preview).toHaveTextContent('KPI OVERVIEW');

    // Toggle Machine Hours off
    fireEvent.click(screen.getByLabelText('Machine Hours'));
    expect(screen.getByTestId('whatsapp-message-preview')).not.toHaveTextContent(
      'MACHINE HOURS WORKED'
    );

    // Copy & WhatsApp link
    fireEvent.click(screen.getByTestId('copy-whatsapp-report-btn'));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    expect(screen.getByTestId('send-whatsapp-report-link')).toHaveAttribute(
      'href',
      expect.stringContaining('https://web.whatsapp.com/send?text=')
    );
  });

  it('renders EngineeringPdfDocument cleanly with @react-pdf/renderer primitives', () => {
    const payload = buildSamplePayload('pdf-report');
    render(<EngineeringPdfDocument payload={payload} />);
    expect(screen.getByTestId('react-pdf-document')).toBeInTheDocument();
    expect(screen.getByText(/Engineering Executive & Fleet Report/i)).toBeInTheDocument();
    expect(screen.getByText('Hydraulic hose leak')).toBeInTheDocument();
  });
});
