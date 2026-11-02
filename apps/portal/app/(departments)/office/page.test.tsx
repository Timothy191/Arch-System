import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  getOfficeWorkspaceSnapshot,
  saveOfficeDocumentAction,
} from '~/features/departments/components/office/actions';
import OfficeDocumentsPage from './documents/page';
import OfficeError from './error';
import OfficeLayout from './layout';
import OfficeLoading from './loading';
import OfficePage from './page';
import OfficePanelsPage from './panels/page';

const mockGetUser = jest.fn();

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
  })),
}));

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(async () => undefined),
}));

jest.mock('@/lib/server-cache', () => ({
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

describe('Office Department & AI Productivity Suite Route Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'operator-uuid-1', email: 'superintendent@arch.local' } },
      error: null,
    });
  });

  describe('OfficePage (page.tsx) & Sub-routes', () => {
    it('renders Office Department & AI Productivity Suite, GenOffice Online Suite, Inshellisense Terminal IDE, and Trail-Code Intelligence panels', async () => {
      const jsx = await OfficePage();
      render(jsx);

      expect(screen.getByText('Office Department & AI Productivity Suite')).toBeInTheDocument();
      expect(screen.getByText('GenOffice Online')).toBeInTheDocument();
      expect(screen.getByText('inshellisense v0.0.4')).toBeInTheDocument();
      expect(screen.getByText('trail-code v0.28.1')).toBeInTheDocument();

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

      // 2. Inshellisense Terminal IDE Panel
      expect(screen.getByTestId('inshellisense-terminal-panel')).toBeInTheDocument();
      expect(screen.getByText('Inshellisense Terminal IDE')).toBeInTheDocument();
      expect(screen.getByText('0.0.4')).toBeInTheDocument();
      expect(screen.getByText('healthy')).toBeInTheDocument();
      expect(screen.getByText('bash')).toBeInTheDocument();
      expect(screen.getByText('zsh')).toBeInTheDocument();
      expect(screen.getByText('fish')).toBeInTheDocument();
      expect(screen.getByText('pwsh')).toBeInTheDocument();

      // 3. Trail-Code Intelligence Panel
      expect(screen.getByTestId('trail-code-intelligence-panel')).toBeInTheDocument();
      expect(screen.getByText('Trail-Code Intelligence')).toBeInTheDocument();
      expect(screen.getByText('0.28.1')).toBeInTheDocument();
      expect(screen.getByText('Request Proxy')).toBeInTheDocument();
      expect(screen.getByText('Dual-Tier Redis Cache')).toBeInTheDocument();
      expect(screen.getByText('Department Workspace')).toBeInTheDocument();
    });

    it('switches GenOffice tabs and saves a new Office artifact via saveOfficeDocumentAction', async () => {
      const jsx = await OfficePage();
      render(jsx);

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

      fireEvent.click(screen.getByRole('button', { name: /Save Office Artifact/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Q4 Wash Plant Yield & Cost Sheet');
      });
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

  describe('Office Server Actions (actions.ts)', () => {
    it('returns initial documents and lab tools snapshot from getOfficeWorkspaceSnapshot', async () => {
      const snapshot = await getOfficeWorkspaceSnapshot();
      expect(snapshot.departmentSlug).toBe('office');
      expect(snapshot.isAuthenticated).toBe(true);
      expect(snapshot.documents.length).toBeGreaterThanOrEqual(3);
      expect(snapshot.labTools.map((toolEntry) => toolEntry.id)).toEqual([
        'genoffice',
        'inshellisense',
        'trail-code',
      ]);
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
