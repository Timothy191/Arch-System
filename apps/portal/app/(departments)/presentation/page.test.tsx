import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

const mockSnapshot = {
  totalDepartments: 15,
  totalMachines: 30,
  activeMachines: 28,
  fleetAvailabilityPct: 92.9,
  activeBreakdowns: 2,
  resolvedBreakdowns24h: 7,
  totalTires: 72,
  installedTires: 60,
  dailyLogsLast30d: 140,
  accessEventsLast30d: 890,
  migrationsCount: 227,
  rlsCoveragePct: 100,
  verificationGatesCount: 28,
  isLiveTelemetry: true,
  generatedAtIso: '2026-11-20T12:00:00.000Z',
};

const mockToBlob = jest.fn();

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-pdf-document">{children}</div>
  ),
  Page: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-pdf-page">{children}</div>
  ),
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderProp,
  }: {
    children?: ReactNode;
    render?: (ctx: { pageNumber: number; totalPages: number }) => string;
  }) => <span>{renderProp ? renderProp({ pageNumber: 1, totalPages: 2 }) : children}</span>,
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
  },
  pdf: jest.fn(() => ({
    toBlob: () => mockToBlob(),
  })),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="recharts-bar-chart">{children}</div>
  ),
  CartesianGrid: () => <div data-testid="recharts-grid" />,
  XAxis: () => <div data-testid="recharts-x-axis" />,
  YAxis: () => <div data-testid="recharts-y-axis" />,
  Tooltip: () => <div data-testid="recharts-tooltip" />,
  Bar: ({ name }: { name?: string }) => <div data-testid="recharts-bar" data-name={name} />,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  usePathname: jest.fn(() => '/presentation'),
}));

jest.mock('@/components/nav/ActiveDepartmentSetter', () => ({
  ActiveDepartmentSetter: ({ department }: { department: string | null }) => (
    <div data-testid="active-dept-setter" data-dept={department ?? ''} />
  ),
}));

jest.mock('@/lib/server-cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
  tagDepartment: jest.fn((dept: string, suffix?: string) =>
    suffix ? `dept:${dept}:${suffix}` : `dept:${dept}`
  ),
}));

jest.mock('~/features/departments/components/presentation/presentation-data', () => ({
  loadPresentationSnapshot: jest.fn(async () => mockSnapshot),
}));

import { InvestorBriefPdfDocument } from '~/features/departments/components/presentation/InvestorBriefPdfDocument';
import { downloadInvestorPresentationPdf } from '~/features/departments/components/presentation/presentation-pdf-export';
import PresentationArchitecturePage from './architecture/page';
import PresentationDocumentationPage from './documentation/page';
import PresentationError from './error';
import PresentationInvestorPackPage from './investor-pack/page';
import PresentationLayout from './layout';
import PresentationLoading from './loading';
import PresentationPage from './page';

describe('Presentation Department Route & Workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToBlob.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    if (!URL.createObjectURL) {
      URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    } else {
      jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = jest.fn();
    } else {
      jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
  });

  it('renders layout, loading skeleton, and error fallback', async () => {
    const layoutJsx = await PresentationLayout({
      children: <div data-testid="pres-child">Presentation Child</div>,
    });
    render(layoutJsx);
    expect(screen.getByTestId('active-dept-setter')).toHaveAttribute('data-dept', 'presentation');
    expect(screen.getByTestId('pres-child')).toBeInTheDocument();

    const { container } = render(<PresentationLoading />);
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');

    const resetMock = jest.fn();
    render(<PresentationError error={new Error('Boom')} reset={resetMock} />);
    expect(screen.getByText('Presentation Error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('renders main 12-slide presentation deck and supports button, keyboard, speaker notes, auto-tour, fullscreen & PDF export', async () => {
    jest.useFakeTimers();
    const jsx = await PresentationPage();
    render(jsx);

    expect(screen.getByText('Arch-System Executive Presentation')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Arch-System: Autonomous Industrial Mining OS',
      })
    ).toBeInTheDocument();

    // Advance via Next Slide & ArrowRight & End/Home
    fireEvent.click(screen.getByRole('button', { name: /Next Slide/i }));
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Solving Mining’s $10M Visibility & Downtime Gap',
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId('presentation-slide-chart')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'End' });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Measurable ROI & Multi-Site Scaling Roadmap',
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId('presentation-value-chain')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'AI Intelligence Engines & Autonomous Agent Mesh',
      })
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Home' });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Arch-System: Autonomous Industrial Mining OS',
      })
    ).toBeInTheDocument();

    // Toggle Speaker Notes & Fullscreen & Auto Tour
    fireEvent.click(screen.getByRole('button', { name: /Hide Notes/i }));
    expect(screen.queryByText(/Welcome Board Members/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fullscreen/i }));
    expect(screen.getByRole('button', { name: /Exit Fullscreen/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Auto Tour/i }));
    act(() => {
      jest.advanceTimersByTime(8100);
    });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Solving Mining’s $10M Visibility & Downtime Gap',
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Download Investor PDF/i }));
    await waitFor(() => {
      expect(mockToBlob).toHaveBeenCalledTimes(1);
    });
    jest.useRealTimers();
  });

  it('renders searchable documentation view (/presentation/documentation)', async () => {
    const jsx = await PresentationDocumentationPage();
    render(jsx);

    expect(screen.getByTestId('presentation-docs-view')).toBeInTheDocument();
    expect(screen.getByText('Executive Platform Primer: Pit-to-Plant Command')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    expect(
      screen.getByText('Zero-Trust RBAC, RLS InitPlan & 28-Gate CI Verification')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Executive Platform Primer: Pit-to-Plant Command')
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search system documentation'), {
      target: { value: 'nonexistent-query-xyz' },
    });
    expect(screen.getByText(/No documentation chapters matched/i)).toBeInTheDocument();
  });

  it('renders interactive architecture flow view (/presentation/architecture)', async () => {
    const jsx = await PresentationArchitecturePage();
    render(jsx);

    expect(screen.getByTestId('presentation-architecture-view')).toBeInTheDocument();
    expect(
      screen.getByText('Operational Module Flow & Schema Persistence Map')
    ).toBeInTheDocument();
    expect(screen.getByText('Access Control & Gate')).toBeInTheDocument();
  });

  it('renders Investor Pack view, copies summary, triggers PDF export, and handles PDF failure cleanly', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(async () => undefined) },
    });

    const jsx = await PresentationInvestorPackPage();
    render(jsx);

    expect(screen.getByTestId('presentation-investor-pack-view')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Copy Exec Summary/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Copied executive briefing summary');
    });

    render(<InvestorBriefPdfDocument snapshot={mockSnapshot} />);
    expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();

    mockToBlob.mockRejectedValueOnce(new Error('Renderer crash'));
    const failRes = await downloadInvestorPresentationPdf(mockSnapshot);
    expect(failRes.ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Unable to generate Investor PDF: Renderer crash');
  });
});
