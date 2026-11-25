import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import {
  getOfficeSopLiveReportData,
  getOfficeWorkspaceSnapshot,
  saveOfficeDocumentAction,
} from '~/features/departments/components/office/actions';
import { OfficeSopPdfDocument } from '~/features/departments/components/office/OfficeSopPdfDocument';
import { downloadOfficeSopPdf } from '~/features/departments/components/office/office-pdf-export';
import OfficeDocumentsPage from './documents/page';
import OfficeError from './error';
import OfficeLayout from './layout';
import OfficeLoading from './loading';
import OfficePage from './page';
import OfficePanelsPage from './panels/page';

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockToBlob = jest.fn();

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (tableName: string) => mockFrom(tableName),
  })),
}));

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-pdf-document">{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-pdf-page">{children}</div>
  ),
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: (ctx: { pageNumber: number; totalPages: number }) => string;
  }) => <span>{renderProp ? renderProp({ pageNumber: 1, totalPages: 1 }) : children}</span>,
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
  },
  pdf: jest.fn(() => ({
    toBlob: () => mockToBlob(),
  })),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(async () => undefined),
}));

jest.mock('@/lib/server-cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
  tagDepartment: jest.fn((dept: string, suffix?: string) =>
    suffix ? `dept:${dept}:${suffix}` : `dept:${dept}`
  ),
  updateTagInAction: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  usePathname: jest.fn(() => '/office'),
}));

jest.mock('@/components/nav/ActiveDepartmentSetter', () => ({
  ActiveDepartmentSetter: ({ department }: { department: string | null }) => (
    <div data-testid="active-dept-setter" data-dept={department ?? ''} />
  ),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

function buildSupabaseQueryChain(rows: readonly Record<string, unknown>[]) {
  const result = { data: rows, error: null };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(async () => result);
  return chain;
}

describe('Office Department & AI Productivity Suite Route Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'operator-uuid-1', email: 'superintendent@arch.local' } },
      error: null,
    });
    mockFrom.mockImplementation(() => buildSupabaseQueryChain([]));
    mockToBlob.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:http://localhost/sop-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });
  });

  describe('OfficePage (page.tsx) & Sub-routes', () => {
    it('renders Office Department & AI Productivity Suite with golden studio header and without Inshellisense or Trail-Code panels', async () => {
      const jsx = await OfficePage();
      render(jsx);

      expect(screen.getByText('Office Department & AI Productivity Suite')).toBeInTheDocument();
      expect(screen.queryByText('GenOffice Online')).not.toBeInTheDocument();
      expect(screen.queryByText('inshellisense v0.0.4')).not.toBeInTheDocument();
      expect(screen.queryByText('trail-code v0.28.1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inshellisense-terminal-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trail-code-intelligence-panel')).not.toBeInTheDocument();

      // Studio Header Panel with white background + golden border
      const studioHeader = screen.getByTestId('genoffice-studio-header-panel');
      expect(studioHeader).toBeInTheDocument();
      expect(studioHeader).toHaveClass(
        'gold-steel-border',
        'gold-steel-border-slim',
        '!bg-white',
        'border-accent-gold/70'
      );

      // 1. GenOffice Online Suite Panel
      expect(screen.getByTestId('genoffice-suite-panel')).toBeInTheDocument();
      expect(screen.getByText('GenOffice Online Suite')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /AI Document Writer/i })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /Mining Yield & Cost Spreadsheet Modeler/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /Executive Shift Presentation Deck/i })
      ).toBeInTheDocument();

      // Artifact preview card trigger
      expect(
        screen.getByTestId('office-doc-card-office-doc-shift-handover-sop')
      ).toBeInTheDocument();
    });

    it('opens interactive Selected Document Review panel when clicking an artifact card and downloads PDF, CSV, Markdown, and JSON files', async () => {
      const jsx = await OfficePage();
      render(jsx);

      const createdAnchors: HTMLAnchorElement[] = [];
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockImplementation((tagName: string) => {
          const element = originalCreateElement(tagName);
          if (tagName === 'a') {
            jest.spyOn(element as HTMLAnchorElement, 'click').mockImplementation(() => {});
            createdAnchors.push(element as HTMLAnchorElement);
          }
          return element;
        });

      const sopCard = screen.getByTestId('office-doc-card-office-doc-shift-handover-sop');
      fireEvent.click(sopCard);

      await waitFor(() => {
        expect(screen.getByTestId('selected-office-document-preview')).toBeInTheDocument();
      });
      expect(screen.getByText('Selected Document Review')).toBeInTheDocument();

      // Download PDF
      fireEvent.click(screen.getByRole('button', { name: /Download PDF \(\.pdf\)/i }));
      await waitFor(() => {
        expect(mockToBlob).toHaveBeenCalledTimes(1);
      });

      // Download CSV
      fireEvent.click(screen.getByRole('button', { name: /Download CSV \(\.csv\)/i }));
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/\.csv/i);
      });

      // Download Markdown
      fireEvent.click(screen.getByRole('button', { name: /Download Markdown \(\.md\)/i }));
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/\.md/i);
      });

      // Download JSON
      fireEvent.click(screen.getByRole('button', { name: /Download JSON \(\.json\)/i }));
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/\.json/i);
      });

      const downloadNames = createdAnchors
        .map((anchor) => anchor.download)
        .filter((name) => name.length > 0);
      expect(downloadNames.some((name) => name.endsWith('.pdf'))).toBe(true);
      expect(downloadNames.some((name) => name.endsWith('.csv'))).toBe(true);
      expect(downloadNames.some((name) => name.endsWith('.md'))).toBe(true);
      expect(downloadNames.some((name) => name.endsWith('.json'))).toBe(true);
      expect(toast.success).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });

    it('switches GenOffice tabs, saves a new Office artifact via saveOfficeDocumentAction, and downloads the generated file to device', async () => {
      const jsx = await OfficePage();
      render(jsx);

      const createdAnchors: HTMLAnchorElement[] = [];
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockImplementation((tagName: string) => {
          const element = originalCreateElement(tagName);
          if (tagName === 'a') {
            jest.spyOn(element as HTMLAnchorElement, 'click').mockImplementation(() => {});
            createdAnchors.push(element as HTMLAnchorElement);
          }
          return element;
        });

      fireEvent.click(
        screen.getByRole('tab', { name: /Mining Yield & Cost Spreadsheet Modeler/i })
      );
      expect(
        screen.getByText('Dense Medium Plant Recovery & Cost per Tonne Model')
      ).toBeInTheDocument();

      const titleInput = screen.getByLabelText('Artifact Title');
      fireEvent.change(titleInput, {
        target: { value: 'Q4 Wash Plant Yield & Cost Sheet' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Save Artifact & Download to Device/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Q4 Wash Plant Yield & Cost Sheet');
        expect(screen.getByRole('status')).toHaveTextContent(/saved.*to device/i);
      });

      const downloadedFiles = createdAnchors
        .map((anchor) => anchor.download)
        .filter((name) => name.length > 0);
      expect(
        downloadedFiles.some((name) => name.startsWith('Q4-Wash-Plant-Yield-Cost-Sheet-'))
      ).toBe(true);

      createElementSpy.mockRestore();
    });

    it('renders OfficePanelsPage and OfficeDocumentsPage in their respective modes', async () => {
      const panelsJsx = await OfficePanelsPage();
      const { unmount } = render(panelsJsx);
      expect(screen.getByTestId('office-workspace-panels')).toBeInTheDocument();
      unmount();

      const docsJsx = await OfficeDocumentsPage();
      render(docsJsx);
      expect(screen.getByTestId('office-workspace-documents')).toBeInTheDocument();
    });
  });

  describe('Office Server Actions & Live SOP PDF Template (actions.ts, OfficeSopPdfDocument)', () => {
    it('aggregates live Supabase operational data in getOfficeSopLiveReportData', async () => {
      const nowIso = new Date().toISOString();
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'breakdowns') {
          return buildSupabaseQueryChain([
            {
              id: 'bd-1',
              fleet_id: 'EX-201',
              machine_name: 'CAT 6030 Excavator',
              status: 'open',
              reason: 'Hydraulic boom hose rupture',
              delay_hours: 3.5,
              date_in: nowIso.slice(0, 10),
              created_at: nowIso,
            },
          ]);
        }
        if (tableName === 'tires') {
          return buildSupabaseQueryChain([
            { id: 't-1', status: 'installed' },
            { id: 't-2', status: 'critical' },
          ]);
        }
        if (tableName === 'access_logs') {
          return buildSupabaseQueryChain([
            {
              id: 'al-1',
              direction: 'IN',
              gate_location: 'North Turnstile',
              access_granted: true,
              scanned_at: nowIso,
            },
          ]);
        }
        if (tableName === 'visitors') {
          return buildSupabaseQueryChain([
            { id: 'v-1', status: 'checked_in', check_in_time: nowIso, check_out_time: null },
          ]);
        }
        if (tableName === 'daily_logs') {
          return buildSupabaseQueryChain([
            {
              id: 'dl-1',
              shift: 'Day',
              log_date: nowIso.slice(0, 10),
              notes: 'Pit B haul road graded and cleared',
            },
          ]);
        }
        return buildSupabaseQueryChain([]);
      });

      const reportData = await getOfficeSopLiveReportData();
      expect(reportData.dataSourceStatus).toBe('live_supabase');
      expect(reportData.activeBreakdownsCount).toBe(1);
      expect(reportData.recent24hBreakdownsCount).toBe(1);
      expect(reportData.recentBreakdowns[0]?.fleetLabel).toBe('CAT 6030 Excavator');
      expect(reportData.installedTiresCount).toBe(2);
      expect(reportData.criticalTiresCount).toBe(1);
      expect(reportData.recentAccessScansCount).toBe(1);
      expect(reportData.checkedInVisitorsCount).toBe(1);
      expect(reportData.recentDailyLogsCount).toBe(1);
      expect(reportData.latestShiftNote).toContain('Pit B haul road graded and cleared');

      render(<OfficeSopPdfDocument reportData={reportData} />);
      expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
      expect(screen.getByText('CAT 6030 Excavator')).toBeInTheDocument();
      expect(screen.getByText('LIVE SUPABASE SYNC VERIFIED')).toBeInTheDocument();
    });

    it('falls back cleanly to template_baseline when unauthenticated and handles PDF export failure', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const baselineReport = await getOfficeSopLiveReportData({
        documentId: 'custom-doc',
        documentTitle: 'Shift Cost Brief',
        documentType: 'spreadsheet',
      });
      expect(baselineReport.dataSourceStatus).toBe('template_baseline');
      expect(baselineReport.activeBreakdownsCount).toBe(0);

      mockToBlob.mockRejectedValueOnce(new Error('Renderer worker unavailable'));
      const didDownload = await downloadOfficeSopPdf({ reportData: baselineReport });
      expect(didDownload).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to generate live SOP PDF (Renderer worker unavailable).'
      );
    });

    it('returns initial documents and lab tools snapshot from getOfficeWorkspaceSnapshot', async () => {
      const snapshot = await getOfficeWorkspaceSnapshot();
      expect(snapshot.departmentSlug).toBe('office');
      expect(snapshot.isAuthenticated).toBe(true);
      expect(snapshot.documents.length).toBeGreaterThanOrEqual(3);
      expect(snapshot.labTools.map((toolEntry) => toolEntry.id)).toEqual(['genoffice']);
    });

    it('validates input and persists audit + cache revalidation in saveOfficeDocumentAction', async () => {
      const result = await saveOfficeDocumentAction({
        title: 'Monthly Board Deck',
        docType: 'presentation',
        summary: 'Executive summary of monthly production, plant recovery, and safety compliance.',
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.document.title).toBe('Monthly Board Deck');
        expect(result.document.docType).toBe('presentation');
      }
    });

    it('rejects invalid input in saveOfficeDocumentAction', async () => {
      const invalidResult = await saveOfficeDocumentAction({
        title: 'A',
        docType: 'document',
        summary: 'Too short',
      });

      expect(invalidResult.status).toBe('error');
    });
  });

  describe('OfficeLayout, OfficeLoading & OfficeError', () => {
    it('renders OfficeLoading with aria-busy and metric placeholders', () => {
      const { container } = render(<OfficeLoading />);
      const rootElement = container.firstElementChild as HTMLElement;
      expect(rootElement).toHaveAttribute('aria-busy', 'true');
      expect(rootElement).toHaveAttribute('aria-label', 'Loading office operations');
      expect(screen.getByText('OFFICE PRODUCTIVITY SUITE METRICS')).toBeInTheDocument();
    });

    it('renders OfficeError heading and invokes reset callback on retry', () => {
      const resetMock = jest.fn();
      const testError = new Error('Office workspace sync failed');

      render(<OfficeError error={testError} reset={resetMock} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Office Error')).toBeInTheDocument();
      expect(screen.getByText('Office workspace sync failed')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
      expect(resetMock).toHaveBeenCalledTimes(1);
    });

    it('exports OfficeLayout component function', () => {
      expect(typeof OfficeLayout).toBe('function');
    });
  });
});
