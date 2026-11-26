import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { connection } from 'next/server';
import type React from 'react';
import { toast } from 'sonner';
import { getDepartmentContext } from '~/lib/dept-context';
import { type AccessReportsData, getAccessReportsData } from '../actions';
import { AccessControlPdfDocument, MAX_ACCESS_PDF_AUDIT_ROWS } from './AccessControlPdfDocument';
import {
  buildAccessWhatsAppBrief,
  buildAccessWhatsAppUrl,
  DEFAULT_ACCESS_WHATSAPP_SECTIONS,
  formatAccessGateTimestamp,
  MAX_WHATSAPP_AUDIT_HIGHLIGHTS,
} from './access-control-whatsapp';
import {
  AccessReportsStudio,
  buildAccessAuditCsv,
  escapeAccessReportCsvCell,
} from './access-reports-studio';
import AccessControlReportsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/link', () => {
  return function MockNextLink({
    href,
    children,
    onClick,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...rest}
      >
        {children}
      </a>
    );
  };
});

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock('../actions', () => ({
  getAccessReportsData: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="access-pdf-doc">{children}</div>
  ),
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderFn,
  }: {
    children?: React.ReactNode;
    render?: (pageInfo: { pageNumber: number; totalPages: number }) => string;
  }) => <span>{renderFn ? renderFn({ pageNumber: 1, totalPages: 3 }) : children}</span>,
  StyleSheet: { create: (styleMap: unknown) => styleMap },
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  })),
}));

const { pdf: mockedPdf } = jest.requireMock<{ pdf: jest.Mock }>('@react-pdf/renderer');
const mockConnection = connection as jest.Mock;
const mockGetDepartmentContext = getDepartmentContext as jest.Mock;
const mockGetAccessReportsData = getAccessReportsData as jest.Mock;

const REPORT_DATE = '2026-11-19';

const SAMPLE_REPORT_DATA: AccessReportsData = {
  summary: {
    totalEvents: 1240,
    grantedCount: 1190,
    deniedCount: 50,
    complianceRate: 96,
    activeCredentials: 312,
    contractorHoursLogged: 840,
  },
  denialTaxonomy: [
    { reason: 'Expired Medical', count: 30, percentage: 60 },
    { reason: 'Safety Induction Lapsed', count: 20, percentage: 40 },
  ],
  gateTraffic: [
    {
      gateName: 'Main North Gate',
      inbound: 420,
      outbound: 405,
      peakHour: '2026-11-19T07:30:00Z',
    },
    {
      gateName: 'Plant Haul Turnstile',
      inbound: 215,
      outbound: 200,
      peakHour: '—',
    },
  ],
  recentAudits: [
    {
      id: 'audit-0001-alpha',
      timestamp: '11/19/2026, 7:15:00 AM',
      gate: 'Main North Gate',
      entityName: 'Credential Scan (QR)',
      entityType: 'QR',
      action: 'Entry Verification',
      granted: true,
      reason: null,
    },
    {
      id: 'audit-0002-bravo',
      timestamp: '11/19/2026, 7:20:00 AM',
      gate: 'Plant Haul Turnstile',
      entityName: 'Authorized Operator / Truck',
      entityType: 'Personnel',
      action: 'Exit Clearance',
      granted: false,
      reason: 'Expired Medical',
    },
  ],
};

const EMPTY_REPORT_DATA: AccessReportsData = {
  summary: {
    totalEvents: 0,
    grantedCount: 0,
    deniedCount: 0,
    complianceRate: 0,
    activeCredentials: 0,
    contractorHoursLogged: 0,
  },
  denialTaxonomy: [],
  gateTraffic: [],
  recentAudits: [],
};

describe('access-control-whatsapp helpers', () => {
  it('formats timestamps with en-US locale and preserves fallback labels', () => {
    expect(formatAccessGateTimestamp('')).toBe('—');
    expect(formatAccessGateTimestamp('—')).toBe('—');
    expect(formatAccessGateTimestamp('Peak Shift Window')).toBe('Peak Shift Window');

    const formatted = formatAccessGateTimestamp('2026-11-19T07:30:00Z');
    expect(formatted).toContain('Nov');
    expect(formatted).toContain('19');
  });

  it('builds a full WhatsApp security brief and encodes the Web URL', () => {
    const brief = buildAccessWhatsAppBrief({
      reportData: SAMPLE_REPORT_DATA,
      reportDate: REPORT_DATE,
      rangeLabel: 'Last 7 Days',
      sections: DEFAULT_ACCESS_WHATSAPP_SECTIONS,
    });

    expect(brief).toContain('*Plantcor Access Control — Security Brief*');
    expect(brief).toContain(`Operational Date: ${REPORT_DATE} | Window: Last 7 Days`);
    expect(brief).toContain('*KPI Summary*');
    expect(brief).toContain('Total Access Events: 1,240');
    expect(brief).toContain('*Denial Reason Taxonomy*');
    expect(brief).toContain('Expired Medical: 30 (60%)');
    expect(brief).toContain('*Perimeter Gate Traffic*');
    expect(brief).toContain('Main North Gate: IN 420 | OUT 405 (Total: 825)');
    expect(brief).toContain('*Audit Trail Highlights*');
    expect(brief).toContain('[GRANTED] Main North Gate');
    expect(brief).toContain('[DENIED] Plant Haul Turnstile');

    const whatsappUrl = buildAccessWhatsAppUrl(brief);
    expect(whatsappUrl.startsWith('https://web.whatsapp.com/send?text=')).toBe(true);
    expect(decodeURIComponent(whatsappUrl.replace('https://web.whatsapp.com/send?text=', ''))).toBe(
      brief
    );
  });

  it('omits toggled-off sections and renders empty-state fallbacks when arrays are empty', () => {
    const partialBrief = buildAccessWhatsAppBrief({
      reportData: EMPTY_REPORT_DATA,
      reportDate: REPORT_DATE,
      rangeLabel: 'Today',
      sections: {
        includeKpiSummary: false,
        includeDenialReasons: true,
        includeGateTraffic: true,
        includeAuditHighlights: true,
      },
    });

    expect(partialBrief).not.toContain('*KPI Summary*');
    expect(partialBrief).toContain('• No denials recorded');
    expect(partialBrief).toContain('• No traffic recorded');
    expect(partialBrief).toContain('• No recent audit events recorded');

    const kpiOnlyBrief = buildAccessWhatsAppBrief({
      reportData: EMPTY_REPORT_DATA,
      reportDate: REPORT_DATE,
      rangeLabel: 'Today',
      sections: {
        includeKpiSummary: true,
        includeDenialReasons: false,
        includeGateTraffic: false,
        includeAuditHighlights: false,
      },
    });

    expect(kpiOnlyBrief).toContain('*KPI Summary*');
    expect(kpiOnlyBrief).not.toContain('*Denial Reason Taxonomy*');
    expect(kpiOnlyBrief).not.toContain('*Perimeter Gate Traffic*');
    expect(kpiOnlyBrief).not.toContain('*Audit Trail Highlights*');
  });

  it(`caps WhatsApp audit highlights at ${MAX_WHATSAPP_AUDIT_HIGHLIGHTS} rows`, () => {
    const manyAudits = Array.from({ length: MAX_WHATSAPP_AUDIT_HIGHLIGHTS + 2 }, (_, idx) => ({
      ...SAMPLE_REPORT_DATA.recentAudits[0]!,
      id: `audit-${idx}`,
      entityName: `Entity-${idx}`,
    }));

    const brief = buildAccessWhatsAppBrief({
      reportData: { ...SAMPLE_REPORT_DATA, recentAudits: manyAudits },
      reportDate: REPORT_DATE,
      rangeLabel: 'Last 7 Days',
      sections: DEFAULT_ACCESS_WHATSAPP_SECTIONS,
    });

    expect(brief).toContain(`Entity-${MAX_WHATSAPP_AUDIT_HIGHLIGHTS - 1}`);
    expect(brief).not.toContain(`Entity-${MAX_WHATSAPP_AUDIT_HIGHLIGHTS}`);
  });
});

describe('CSV sanitization helpers', () => {
  it('neutralizes CSV formula prefixes and escapes quotes', () => {
    expect(escapeAccessReportCsvCell('=SUM(A1:A2)')).toBe(`"'=SUM(A1:A2)"`);
    expect(escapeAccessReportCsvCell('+cmd')).toBe(`"'+cmd"`);
    expect(escapeAccessReportCsvCell('-10')).toBe(`"'-10"`);
    expect(escapeAccessReportCsvCell('@user')).toBe(`"'@user"`);
    expect(escapeAccessReportCsvCell('\tval')).toBe(`"'\tval"`);
    expect(escapeAccessReportCsvCell('\rval')).toBe(`"'\rval"`);
    expect(escapeAccessReportCsvCell('Gate "North"')).toBe(`"Gate ""North"""`);
  });

  it('builds a complete RFC-4180 CSV payload', () => {
    const csv = buildAccessAuditCsv(SAMPLE_REPORT_DATA);
    expect(csv).toContain('Audit ID,Timestamp,Gate Location,Entity,Type,Action,Status,Reason');
    expect(csv).toContain('"audit-0001-alpha"');
    expect(csv).toContain('"GRANTED"');
    expect(csv).toContain('"DENIED","Expired Medical"');
  });
});

describe('AccessControlPdfDocument', () => {
  it('renders executive sections, KPIs, tables, sign-off, and pagination footer', () => {
    render(
      <AccessControlPdfDocument
        reportData={SAMPLE_REPORT_DATA}
        reportDate={REPORT_DATE}
        rangeLabel="Last 7 Days"
      />
    );

    expect(screen.getByTestId('access-pdf-doc')).toBeInTheDocument();
    expect(screen.getByText('ARCH OS · ACCESS CONTROL & SITE SECURITY')).toBeInTheDocument();
    expect(screen.getByText('Security Access & Gate Telemetry Report')).toBeInTheDocument();
    expect(screen.getByText(`Document ID: AC-RPT-${REPORT_DATE}`)).toBeInTheDocument();
    expect(screen.getByText('Reporting Window: Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('1,240')).toBeInTheDocument();
    expect(screen.getAllByText('Expired Medical').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Main North Gate').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Security Officer')).toBeInTheDocument();
    expect(screen.getByText('Site Safety Manager')).toBeInTheDocument();
    expect(
      screen.getByText('Plantcor / Arch OS · Confidential Security Compliance Report')
    ).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('renders empty states and caps audit rows at MAX_ACCESS_PDF_AUDIT_ROWS', () => {
    const { rerender } = render(
      <AccessControlPdfDocument
        reportData={EMPTY_REPORT_DATA}
        reportDate={REPORT_DATE}
        rangeLabel="Today"
      />
    );

    expect(screen.getByText('No denial reasons recorded in this window.')).toBeInTheDocument();
    expect(
      screen.getByText('No perimeter gate traffic recorded in this window.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No security audit events recorded in this window.')
    ).toBeInTheDocument();

    const manyAudits = Array.from({ length: MAX_ACCESS_PDF_AUDIT_ROWS + 3 }, (_, idx) => ({
      ...SAMPLE_REPORT_DATA.recentAudits[0]!,
      id: `bulk-audit-${idx}`,
      entityName: `Operator-${idx}`,
    }));

    rerender(
      <AccessControlPdfDocument
        reportData={{ ...SAMPLE_REPORT_DATA, recentAudits: manyAudits }}
        reportDate={REPORT_DATE}
        rangeLabel="Last 30 Days"
      />
    );

    expect(screen.getByText(`Operator-${MAX_ACCESS_PDF_AUDIT_ROWS - 1}`)).toBeInTheDocument();
    expect(screen.queryByText(`Operator-${MAX_ACCESS_PDF_AUDIT_ROWS}`)).not.toBeInTheDocument();
  });
});

describe('AccessReportsStudio', () => {
  let printSpy: jest.SpyInstance;
  let clickSpy: jest.SpyInstance;
  let createObjectUrlSpy: jest.Mock;
  let revokeObjectUrlSpy: jest.Mock;
  let writeTextMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    createObjectUrlSpy = jest.fn(() => 'blob:access-report');
    revokeObjectUrlSpy = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlSpy,
    });

    writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    printSpy.mockRestore();
    clickSpy.mockRestore();
    jest.useRealTimers();
  });

  it('renders Dashboard by default with navigation links, KPI grid, taxonomy, gate traffic, and audit trail', () => {
    render(<AccessReportsStudio initialData={SAMPLE_REPORT_DATA} reportDate={REPORT_DATE} />);

    const nav = screen.getByRole('navigation', { name: 'Access control report views' });
    const dashboardLink = within(nav).getByRole('link', { name: 'Dashboard' });
    const pdfLink = within(nav).getByRole('link', { name: 'PDF Report' });
    const whatsappLink = within(nav).getByRole('link', { name: 'WhatsApp Report' });

    expect(dashboardLink).toHaveAttribute('href', '/access-control/reports?range=7days');
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    expect(pdfLink).toHaveAttribute('href', '/access-control/reports?tab=pdf-report&range=7days');
    expect(pdfLink).not.toHaveAttribute('aria-current');
    expect(whatsappLink).toHaveAttribute(
      'href',
      '/access-control/reports?tab=whatsapp-report&range=7days'
    );
    expect(whatsappLink).not.toHaveAttribute('aria-current');

    expect(screen.getByText('1,240')).toBeInTheDocument();
    expect(screen.getByText('1,190')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('840h')).toBeInTheDocument();
    expect(screen.getByText('Security Interlock & Denial Reason Taxonomy')).toBeInTheDocument();
    expect(screen.getByText('Perimeter Barrier Traffic & Peak Load')).toBeInTheDocument();
    expect(screen.getByText('Audit Event Trail & Security Exceptions')).toBeInTheDocument();
    expect(screen.getByText('Standard Badge Verification')).toBeInTheDocument();
  });

  it('renders empty audit table message, exports CSV, prints pack, and toggles date range', () => {
    jest.useFakeTimers();
    render(<AccessReportsStudio initialData={EMPTY_REPORT_DATA} reportDate={REPORT_DATE} />);

    expect(
      screen.getByText('No security audit events recorded in this reporting window.')
    ).toBeInTheDocument();

    const todayBtn = screen.getByRole('button', { name: 'Today' });
    fireEvent.click(todayBtn);
    expect(todayBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Last 7 Days' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export Audit CSV' }));
    expect(createObjectUrlSpy).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance audit log exported successfully.');

    jest.runAllTimers();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:access-report');

    fireEvent.click(screen.getByRole('button', { name: 'Print Pack' }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs activeTab when initialTab updates via prop change and via tab link clicks', () => {
    const { rerender } = render(
      <AccessReportsStudio
        initialData={SAMPLE_REPORT_DATA}
        initialTab="dashboard"
        reportDate={REPORT_DATE}
      />
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    rerender(
      <AccessReportsStudio
        initialData={SAMPLE_REPORT_DATA}
        initialTab="pdf-report"
        reportDate={REPORT_DATE}
      />
    );
    expect(screen.getByRole('link', { name: 'PDF Report' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('article', { name: 'Access Control PDF Report Preview' })
    ).toBeInTheDocument();

    rerender(
      <AccessReportsStudio
        initialData={SAMPLE_REPORT_DATA}
        initialTab="whatsapp-report"
        reportDate={REPORT_DATE}
      />
    );
    expect(screen.getByRole('link', { name: 'WhatsApp Report' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByText('WhatsApp Security Dispatch Brief')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders PDF Report view with live A4 preview, zoom controls, print, and dynamic PDF download', async () => {
    render(
      <AccessReportsStudio
        initialData={SAMPLE_REPORT_DATA}
        initialTab="pdf-report"
        reportDate={REPORT_DATE}
      />
    );

    const preview = screen.getByRole('article', { name: 'Access Control PDF Report Preview' });
    expect(within(preview).getByText(`AC-RPT-${REPORT_DATE}`)).toBeInTheDocument();
    expect(within(preview).getByText('Security Officer')).toBeInTheDocument();
    expect(within(preview).getByText('Site Safety Manager')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    expect(preview.style.transform).toBe('scale(0.75)');
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(preview.style.transform).toBe('scale(1)');
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(preview.style.maxWidth).toBe('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Print Pack' }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Download Security PDF' }));
    expect(screen.getByRole('button', { name: 'Preparing PDF…' })).toBeDisabled();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Security compliance PDF report downloaded.')
    );
    expect(mockedPdf).toHaveBeenCalledTimes(1);
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Download Security PDF' })).not.toBeDisabled();
  });

  it('renders PDF Report empty audit row and falls back to print when PDF generation fails', async () => {
    mockedPdf
      .mockReturnValueOnce({
        toBlob: jest.fn().mockRejectedValue(new Error('font worker failed')),
      })
      .mockReturnValueOnce({
        toBlob: jest.fn().mockRejectedValue('unexpected renderer failure'),
      });

    render(
      <AccessReportsStudio
        initialData={EMPTY_REPORT_DATA}
        initialTab="pdf-report"
        reportDate={REPORT_DATE}
      />
    );

    const preview = screen.getByRole('article', { name: 'Access Control PDF Report Preview' });
    expect(
      within(preview).getByText('No security audit events recorded in this reporting window.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download Security PDF' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('font worker failed'))
    );
    expect(printSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Download Security PDF' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('unknown error'))
    );
    expect(printSpy).toHaveBeenCalledTimes(2);
  });

  it('renders WhatsApp Report composer, toggles sections, copies brief, and builds WhatsApp URL', async () => {
    jest.useFakeTimers();
    render(
      <AccessReportsStudio
        initialData={SAMPLE_REPORT_DATA}
        initialTab="whatsapp-report"
        reportDate={REPORT_DATE}
      />
    );

    const preview = screen.getByLabelText('WhatsApp Security Brief Preview');
    expect(preview).toHaveTextContent('*Plantcor Access Control — Security Brief*');
    expect(preview).toHaveTextContent('*KPI Summary*');
    expect(preview).toHaveTextContent('*Denial Reason Taxonomy*');
    expect(preview).toHaveTextContent('*Perimeter Gate Traffic*');
    expect(preview).toHaveTextContent('*Audit Trail Highlights*');

    const kpiSwitch = screen.getByRole('switch', { name: 'Include KPI Summary' });
    expect(kpiSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(kpiSwitch);
    expect(kpiSwitch).toHaveAttribute('aria-checked', 'false');
    expect(preview).not.toHaveTextContent('*KPI Summary*');

    const sendLink = screen.getByRole('link', { name: 'Send via WhatsApp' });
    expect(sendLink).toHaveAttribute('target', '_blank');
    expect(sendLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(sendLink.getAttribute('href')).toContain('https://web.whatsapp.com/send?text=');
    expect(sendLink.getAttribute('href')).not.toContain(encodeURIComponent('*KPI Summary*'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy WhatsApp Report' }));
    });
    expect(writeTextMock).toHaveBeenCalledWith(preview.textContent);
    expect(toast.success).toHaveBeenCalledWith('WhatsApp security brief copied to clipboard.');
    expect(screen.getByText('Copied')).toBeInTheDocument();

    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText('Copy WhatsApp Report')).toBeInTheDocument();
  });

  it('shows an error toast when copying WhatsApp report to clipboard fails', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('Clipboard permission denied'));

    render(
      <AccessReportsStudio
        initialData={SAMPLE_REPORT_DATA}
        initialTab="whatsapp-report"
        reportDate={REPORT_DATE}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy WhatsApp Report' }));
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Unable to copy to clipboard. Please copy the preview text manually.'
    );
  });
});

describe('AccessControlReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDepartmentContext.mockResolvedValue({
      deptId: 'dept-access-1',
      today: REPORT_DATE,
    });
    mockGetAccessReportsData.mockResolvedValue(SAMPLE_REPORT_DATA);
  });

  it('defaults to dashboard view when searchParams are omitted', async () => {
    const element = await AccessControlReportsPage();
    render(element);

    expect(mockConnection).toHaveBeenCalledTimes(1);
    expect(mockGetDepartmentContext).toHaveBeenCalledWith({ department: 'access-control' });
    expect(mockGetAccessReportsData).toHaveBeenCalledWith(
      'dept-access-1',
      expect.any(String),
      expect.any(String)
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('resolves pdf-report and pdf query tabs to the PDF Report view', async () => {
    const pdfElement = await AccessControlReportsPage({
      searchParams: Promise.resolve({ tab: 'pdf-report' }),
    });
    const { rerender } = render(pdfElement);
    expect(screen.getByRole('link', { name: 'PDF Report' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    const shortPdfElement = await AccessControlReportsPage({
      searchParams: Promise.resolve({ tab: 'pdf' }),
    });
    rerender(shortPdfElement);
    expect(screen.getByRole('link', { name: 'PDF Report' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('resolves whatsapp-report and whatsapp query tabs to the WhatsApp Report view', async () => {
    const waElement = await AccessControlReportsPage({
      searchParams: Promise.resolve({ tab: 'whatsapp-report' }),
    });
    const { rerender } = render(waElement);
    expect(screen.getByRole('link', { name: 'WhatsApp Report' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    const shortWaElement = await AccessControlReportsPage({
      searchParams: Promise.resolve({ tab: 'whatsapp' }),
    });
    rerender(shortWaElement);
    expect(screen.getByRole('link', { name: 'WhatsApp Report' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('passes computed date windows to getAccessReportsData when range is provided', async () => {
    const todayElement = await AccessControlReportsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    render(todayElement);
    expect(mockGetAccessReportsData).toHaveBeenCalledWith(
      'dept-access-1',
      '2026-11-19',
      '2026-11-19'
    );
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');

    await AccessControlReportsPage({
      searchParams: Promise.resolve({ range: '7days' }),
    });
    expect(mockGetAccessReportsData).toHaveBeenCalledWith(
      'dept-access-1',
      '2026-11-12',
      '2026-11-19'
    );

    await AccessControlReportsPage({
      searchParams: Promise.resolve({ range: '30days' }),
    });
    expect(mockGetAccessReportsData).toHaveBeenCalledWith(
      'dept-access-1',
      '2026-10-20',
      '2026-11-19'
    );
  });
});
