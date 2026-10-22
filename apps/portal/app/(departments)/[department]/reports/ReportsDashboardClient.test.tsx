jest.mock('@/styles/print-report.css', () => ({}));

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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getShiftCompleteness } from '@/lib/shift-completeness';
import { getDepartmentContext } from '~/lib/dept-context';
import ReportsPage from './page';
import {
  type MachineOperationLogItem,
  ReportsDashboardClient,
  type ShiftReportRow,
} from './ReportsDashboardClient';
import { buildPdfSiteGroups } from './ShiftPdfReportTab';
import { ShiftReportPdfDocument } from './ShiftReportPdfDocument';

jest.mock('@/features/analytics/components/PDFDownloadButton', () => ({
  PDFDownloadButton: ({ reportData }: { reportData: { title: string } }) => (
    <button type="button" data-testid="pdf-download-btn">
      Export PDF ({reportData.title})
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

describe('ReportsDashboardClient — PDF Report Subtab', () => {
  const shiftRows: ShiftReportRow[] = [
    {
      id: 'Pit North|2026-10-22|day',
      site: 'Pit North',
      date: '2026-10-22',
      shift: 'day',
      hours: 24,
      loads: 40,
      haulBcm: 720,
      dozerRolloverBcm: 2000,
      totalBcm: 2720,
      delayMin: 95,
      dozerPasses: 50,
      fuelLitres: 600,
      coalTonnes: 500,
      wasteTonnes: 220,
      notes: 'Normal operations',
    },
  ];

  // Intentionally provided out of order (Site Machine first, Dozer second, Excavator third)
  // to verify that each site groups machines strictly:
  // 1. Excavators First -> 2. Roll Over -> 3. Machines Worked on Site
  const machineOperationLogs: MachineOperationLogItem[] = [
    {
      id: 'op-truck-1',
      date: '2026-10-22',
      shift: 'day',
      machineName: 'ADT-04 Bell B40E',
      machineType: 'ADT',
      operatorName: 'Sipho Ndlovu',
      siteName: 'Pit North',
      startSmu: 4100.0,
      endSmu: 4108.5,
      hoursWorked: 8.5,
      bcmMoved: 360,
      isDozer: false,
      delayMinutes: 35,
      productionDelayMinutes: 15,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 20,
      nonSiteDelayMinutes: 0,
      excavatorActivity: 'Excavator: EX-01 Liebherr 984 · Coal · 20 loads (360.0 BCM)',
      siteGroupRole: 'site_machine',
      status: 'completed',
    },
    {
      id: 'op-dozer-1',
      date: '2026-10-22',
      shift: 'day',
      machineName: 'DZ-02 CAT D9R',
      machineType: 'Dozer',
      operatorName: 'Thabo Mokoena',
      siteName: 'Pit North',
      startSmu: 8200.0,
      endSmu: 8208.0,
      hoursWorked: 8.0,
      bcmMoved: 2000,
      isDozer: true,
      delayMinutes: 25,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 25,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      excavatorActivity: 'Roll-over: 2,000 BCM (8.0h × 250 BCM/h · 50 passes)',
      siteGroupRole: 'rollover',
      status: 'completed',
    },
    {
      id: 'op-exc-1',
      date: '2026-10-22',
      shift: 'day',
      machineName: 'EX-01 Liebherr 984',
      machineType: 'Excavator',
      operatorName: 'Johannes Mahlangu',
      siteName: 'Pit North',
      startSmu: 12500.5,
      endSmu: 12508.0,
      hoursWorked: 7.5,
      bcmMoved: 720,
      isDozer: false,
      delayMinutes: 35,
      productionDelayMinutes: 20,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 15,
      excavatorActivity: 'Block SS07 · Coal · 40 loads (720.0 BCM) · Dumpers: ADT-04 (20)',
      siteGroupRole: 'excavator',
      status: 'completed',
    },
    {
      id: 'op-grader-prev-day',
      date: '2026-10-21',
      shift: 'night',
      machineName: 'GR-09 CAT 140K',
      machineType: 'Grader',
      operatorName: 'Kabelo Sithole',
      siteName: 'Pit North',
      startSmu: 3000.0,
      endSmu: 3007.0,
      hoursWorked: 7.0,
      bcmMoved: 0,
      isDozer: false,
      delayMinutes: 10,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 10,
      nonSiteDelayMinutes: 0,
      excavatorActivity: 'Haul road maintenance',
      siteGroupRole: 'site_machine',
      status: 'completed',
    },
  ];

  const baseProps = {
    departmentId: 'dept-control-room',
    departmentSlug: 'control-room',
    departmentName: 'Control Room',
    isControlRoom: true,
    todayStr: '2026-10-22',
    currentShift: 'day' as const,
    fromDateStr: '2026-09-01',
    toDateStr: '2026-10-22',
    totalFleetCount: 10,
    coveredFleetCount: 8,
    missingCoverage: [],
    shiftRows,
    machineOperationLogs,
    engineeringLogs: [],
    csvContent: 'Date,Shift\n2026-10-22,day',
    exportRows: [],
    pdfReportData: {
      title: 'Control Room Report',
      subtitle: 'Subtitle',
      kpis: [],
      tableHeaders: [],
      tableRows: [],
    },
  };

  it('should render the PDF Report sub-tab and display site-grouped machines ordered by Excavators first, then Roll Over, then Machines Worked on Site', () => {
    render(<ReportsDashboardClient {...baseProps} />);

    const pdfTabButton = screen.getByRole('tab', { name: /PDF Report/i });
    expect(pdfTabButton).toBeInTheDocument();

    fireEvent.click(pdfTabButton);

    const previewContainer = screen.getByTestId('shift-pdf-report-preview');
    expect(previewContainer).toBeInTheDocument();

    // Verify all required column headers exist
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Machine' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Hours Start - Stop' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Total Worked' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Operator' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Production Delay' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Engineering Delay' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Natural Delays' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Non-Site Related Delays' })
    ).toBeInTheDocument();
    expect(
      within(previewContainer).getByRole('columnheader', { name: 'Excavator Activity' })
    ).toBeInTheDocument();
    // Verify Site header
    expect(within(previewContainer).getByText(/Site: Pit North/i)).toBeInTheDocument();

    // Verify ordering within the Site table:
    // 1. EX-01 Liebherr 984 (Excavator) -> 2. DZ-02 CAT D9R (Roll Over) -> 3. ADT-04 Bell B40E (Site Machine)
    const htmlContent = previewContainer.innerHTML;
    const excIdx = htmlContent.indexOf('EX-01 Liebherr 984');
    const rollIdx = htmlContent.indexOf('DZ-02 CAT D9R');
    const siteMachIdx = htmlContent.indexOf('ADT-04 Bell B40E');

    expect(excIdx).toBeGreaterThan(-1);
    expect(rollIdx).toBeGreaterThan(excIdx);
    expect(siteMachIdx).toBeGreaterThan(rollIdx);

    // Verify SMU start - stop and delay values render
    expect(within(previewContainer).getByText('12500.5 - 12508.0')).toBeInTheDocument();
    expect(within(previewContainer).getByText('8200.0 - 8208.0')).toBeInTheDocument();
    expect(within(previewContainer).getByText('4100.0 - 4108.5')).toBeInTheDocument();

    // Verify Embedded PDF Frame mode toggle works
    fireEvent.click(within(previewContainer).getByRole('button', { name: /Embedded PDF Frame/i }));
    expect(within(previewContainer).getByTitle('Shift Report PDF Preview')).toBeInTheDocument();

    // Verify Shift Date selector filters out machines from other dates
    expect(within(previewContainer).getByText('GR-09 CAT 140K')).toBeInTheDocument();
    const dateSelect = within(previewContainer).getByLabelText('Filter PDF by Shift Date');
    expect(dateSelect).toHaveValue('all');
    fireEvent.change(dateSelect, { target: { value: '2026-10-22' } });
    expect(dateSelect).toHaveValue('2026-10-22');
    expect(within(previewContainer).queryByText('GR-09 CAT 140K')).not.toBeInTheDocument();
    expect(within(previewContainer).getByText('EX-01 Liebherr 984')).toBeInTheDocument();
  });

  it('should render ShiftReportPdfDocument with A4 landscape site-grouped sections', () => {
    const siteGroups = buildPdfSiteGroups(machineOperationLogs);
    render(
      <ShiftReportPdfDocument
        departmentName="Control Room"
        todayStr="2026-10-22"
        currentShift="day"
        periodLabel="2026-10-01 to 2026-10-22"
        shiftFilterLabel="All Shifts"
        siteGroups={siteGroups}
        totals={{
          totalHours: 31,
          totalMachines: 4,
          prod: 85,
          eng: 60,
          nat: 50,
          nonSite: 35,
        }}
      />
    );
    const pdfDoc = screen.getByTestId('shift-pdf-doc');
    expect(within(pdfDoc).getByText(/SITE: Pit North/i)).toBeInTheDocument();
    expect(within(pdfDoc).getByText('EX-01 Liebherr 984')).toBeInTheDocument();
    expect(within(pdfDoc).getByText('DZ-02 CAT D9R')).toBeInTheDocument();
    expect(within(pdfDoc).getByText('ADT-04 Bell B40E')).toBeInTheDocument();
    expect(siteGroups[0]?.orderedMachines.map((m) => m.machineName)).toEqual([
      'EX-01 Liebherr 984',
      'DZ-02 CAT D9R',
      'ADT-04 Bell B40E',
      'GR-09 CAT 140K',
    ]);
  });

  it('should synchronize ?tab=pdf-report and ?tab=shift in URL history without snapping back, and trigger client PDF download', async () => {
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    let downloadedFileName = '';
    const anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileName = this.download;
      });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:shift-report-pdf');
    URL.revokeObjectURL = jest.fn();

    try {
      render(<ReportsDashboardClient {...baseProps} initialTab="pdf-report" />);
      expect(screen.getByRole('tab', { name: /PDF Report/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Switch from PDF Report to Shift and verify it stays on Shift (does not snap back)
      const shiftTabBtn = screen.getByRole('tab', { name: /^Shift/i });
      fireEvent.click(shiftTabBtn);
      expect(shiftTabBtn).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /PDF Report/i })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', expect.stringContaining('tab=shift'));

      // Switch back to PDF Report and trigger client PDF download
      const pdfTabBtn = screen.getByRole('tab', { name: /PDF Report/i });
      fireEvent.click(pdfTabBtn);
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        expect.stringContaining('tab=pdf-report')
      );

      const downloadBtn = screen.getByRole('button', { name: /Download Shift PDF/i });
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(anchorClickSpy).toHaveBeenCalled();
      });
      expect(downloadedFileName).toBe('Shift-Report-dept-control-room-2026-10-22.pdf');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      anchorClickSpy.mockRestore();
      replaceStateSpy.mockRestore();
    }
  });
  it('should not double-count dozerRolloverBcm when a dozer has both machine_operations and dozer_rolls rows, and should bucket all 4 delay types in ReportsPage', async () => {
    const mockTableData: Record<string, unknown[]> = {
      machine_operations: [
        {
          id: 'op-dozer-10',
          machine_id: 'mach-dz-1',
          shift_date: '2026-10-22',
          shift_type: 'day',
          start_smu: 100,
          end_smu: 108,
          hours_worked: 8,
          machine: {
            name: 'DZ-01',
            machine_type: 'Dozer',
            bin_factor: null,
            sites: { name: 'Pit Alpha' },
          },
          operator: { full_name: 'Operator One' },
          site: { name: 'Pit Alpha' },
          delay_entries: [
            {
              duration_hours: 0.5,
              deleted_at: null,
              description: 'Chute wait',
              delay_category: { name: 'Production' },
            },
            {
              duration_hours: 0.25,
              deleted_at: null,
              description: 'Hydraulic hose',
              delay_category: { name: 'Engineering' },
            },
            {
              duration_hours: 0.5,
              deleted_at: null,
              description: 'Heavy rain storm',
              delay_category: { name: 'Weather' },
            },
            {
              duration_hours: 0.25,
              deleted_at: null,
              description: 'Grid outage',
              delay_category: { name: 'External' },
            },
          ],
        },
      ],
      hourly_loads: [],
      excavator_dumper_assignments: [],
      dozer_rolls: [
        {
          id: 'roll-1',
          machine_id: 'mach-dz-1',
          roll_date: '2026-10-22',
          shift_type: 'day',
          blade_passes: 42,
          hours_operated: 8,
          machine: { name: 'DZ-01', machine_type: 'Dozer', sites: { name: 'Pit Alpha' } },
          operator: { full_name: 'Operator One' },
        },
      ],
      breakdowns: [],
      engineering_notes: [],
      daily_logs: [],
    };

    const makeChain = (table: string) => {
      const rows = mockTableData[table] || [];
      const chain: Record<string, unknown> = {};
      const resolveSelf = () => chain;
      chain.select = resolveSelf;
      chain.gte = resolveSelf;
      chain.lte = resolveSelf;
      chain.is = resolveSelf;
      chain.in = resolveSelf;
      chain.order = () => Promise.resolve({ data: rows });
      chain.then = (resolve: (val: { data: unknown[] }) => unknown) =>
        Promise.resolve({ data: rows }).then(resolve);
      return chain;
    };

    (getDepartmentContext as jest.Mock).mockResolvedValue({
      dept: { name: 'control-room', displayName: 'Control Room', type: 'control_room' },
      deptId: 'dept-cr',
      today: '2026-10-22',
      supabase: { from: (t: string) => makeChain(t) },
    });
    (getShiftCompleteness as jest.Mock).mockResolvedValue({ statuses: [] });

    const element = await ReportsPage({
      params: Promise.resolve({ department: 'control-room' }),
      searchParams: Promise.resolve({ tab: 'pdf-report' }),
    });

    render(element);

    const previewContainer = screen.getByTestId('shift-pdf-report-preview');
    // 8 hours * 250 BCM/h = 2,000 BCM once (not 4,000 BCM)
    expect(
      within(previewContainer).getByText(/Site Worked:/i).parentElement?.textContent
    ).toContain('2,000 BCM');
    // Verify the 4 delay buckets (30m prod, 15m eng, 30m natural, 15m non-site)
    expect(within(previewContainer).getAllByText('30m').length).toBeGreaterThanOrEqual(2);
    expect(within(previewContainer).getAllByText('15m').length).toBeGreaterThanOrEqual(2);
  });

  it('should display a visible Partial Data Warning banner when a Supabase query returns an error in ReportsPage', async () => {
    const makeFailingChain = (table: string) => {
      const res =
        table === 'machine_operations'
          ? { data: null, error: { message: 'Embed relation delay_categories failed' } }
          : { data: [], error: null };
      const chain: Record<string, unknown> = {};
      const resolveSelf = () => chain;
      chain.select = resolveSelf;
      chain.gte = resolveSelf;
      chain.lte = resolveSelf;
      chain.is = resolveSelf;
      chain.in = resolveSelf;
      chain.order = () => Promise.resolve(res);
      chain.then = (resolve: (val: typeof res) => unknown) => Promise.resolve(res).then(resolve);
      return chain;
    };

    (getDepartmentContext as jest.Mock).mockResolvedValue({
      dept: { name: 'control-room', displayName: 'Control Room', type: 'control_room' },
      deptId: 'dept-cr',
      today: '2026-10-22',
      supabase: { from: (t: string) => makeFailingChain(t) },
    });
    (getShiftCompleteness as jest.Mock).mockResolvedValue({ statuses: [] });

    const element = await ReportsPage({
      params: Promise.resolve({ department: 'control-room' }),
      searchParams: Promise.resolve({ tab: 'pdf-report' }),
    });

    render(element);

    const warningBanner = screen.getByTestId('reports-query-warning-banner');
    expect(warningBanner).toBeInTheDocument();
    expect(warningBanner).toHaveTextContent(
      'machine_operations: Embed relation delay_categories failed'
    );
  });
});
