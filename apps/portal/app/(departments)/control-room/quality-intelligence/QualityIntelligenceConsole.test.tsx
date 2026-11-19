import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ControlRoomSubtabs } from '../components/ControlRoomSubtabs';
import {
  type QualityIntelligenceApiResponse,
  QualityIntelligenceConsole,
} from './QualityIntelligenceConsole';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const SAMPLE_SHA256 = 'a'.repeat(64);
const SAMPLE_COMMIT = '1234567890abcdef1234567890abcdef12345678';
const SAMPLE_RUN_ID = '11111111-1111-4111-8111-111111111111';
const SAMPLE_VERIFICATION_ID = '22222222-2222-4222-8222-222222222222';

function createSamplePayload(
  overrides?: Partial<QualityIntelligenceApiResponse>
): QualityIntelligenceApiResponse {
  const latestRun = {
    runId: SAMPLE_RUN_ID,
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: SAMPLE_COMMIT,
    parentCommitSha: 'abcdef1234567',
    pullRequestId: 'PR-42',
    agentId: 'worker-3b',
    taskId: 'qi-ui-01',
    executedAt: '2026-11-19T14:00:00.000Z',
    environment: 'ci',
    mode: 'pr',
    overallStatus: 'FAILED' as const,
    checks: [
      {
        checkId: 'unit-tests',
        name: 'Portal Jest Suite',
        category: 'testing' as const,
        scoringCategory: 'functional_testing' as const,
        owner: 'control-room',
        command: 'pnpm --filter portal test',
        mandatory: true,
        status: 'FAILED' as const,
        exitCode: 1,
        durationMs: 4200,
        logExcerpt: 'Expected 1 to equal 2 in QualityIntelligenceConsole.test.tsx',
        evidenceLinks: ['.ci-local/quality-intelligence/jest.log'],
      },
      {
        checkId: 'auth-matrix',
        name: 'Authorization Matrix Audit',
        category: 'security' as const,
        scoringCategory: 'security' as const,
        owner: 'security-team',
        command: 'pnpm audit:auth-matrix',
        mandatory: true,
        status: 'PASSED' as const,
        exitCode: 0,
        durationMs: 1200,
        evidenceLinks: ['.ci-local/quality-intelligence/auth.log'],
      },
      {
        checkId: 'rls-matrix',
        name: 'PostgreSQL RLS Matrix',
        category: 'database' as const,
        scoringCategory: 'database_integrity' as const,
        owner: 'database-team',
        command: 'pnpm audit:rls-matrix',
        mandatory: true,
        status: 'PASSED' as const,
        exitCode: 0,
        durationMs: 950,
        evidenceLinks: [],
      },
      {
        checkId: 'supabase-health',
        name: 'Supabase & Redis Integration Probe',
        category: 'reliability' as const,
        scoringCategory: 'reliability' as const,
        owner: 'platform-core',
        command: 'pnpm test:integration',
        mandatory: false,
        status: 'PASSED' as const,
        exitCode: 0,
        durationMs: 850,
        evidenceLinks: [],
      },
      {
        checkId: 'portal-build',
        name: 'Next.js Production Build Budget',
        category: 'performance' as const,
        scoringCategory: 'performance' as const,
        owner: 'platform-core',
        command: 'pnpm --filter portal build',
        mandatory: true,
        status: 'PASSED' as const,
        exitCode: 0,
        durationMs: 12300,
        evidenceLinks: [],
      },
    ],
    regressions: [
      {
        id: 'regression:unit-tests',
        severity: 'CRITICAL' as const,
        category: 'testing' as const,
        affectedPackage: 'portal',
        affectedFiles: ['apps/portal/app/example.tsx'],
        previousResult: 'PASSED',
        currentResult: 'FAILED',
        difference: 'Portal Jest Suite regressed from PASSED to FAILED.',
        suggestedRemediation: 'Run pnpm --filter portal test locally and fix failing assertions.',
        evidence: ['.ci-local/quality-intelligence/jest.log'],
        isPreExisting: false,
      },
      {
        id: 'pre-existing:bundle-budget',
        severity: 'MEDIUM' as const,
        category: 'performance' as const,
        affectedPackage: 'portal',
        affectedFiles: [],
        previousResult: 'FAILED',
        currentResult: 'FAILED',
        difference: 'Pre-existing CSS budget warning remains active.',
        suggestedRemediation: 'Trim unused utility CSS.',
        evidence: [],
        isPreExisting: true,
      },
    ],
    score: {
      overallScore: 84.5,
      categoryScores: [
        {
          category: 'security' as const,
          weight: 0.2,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'functional_testing' as const,
          weight: 0.2,
          score: 0,
          verified: 0,
          failed: 1,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'architecture' as const,
          weight: 0.15,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'reliability' as const,
          weight: 0.15,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'performance' as const,
          weight: 0.1,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'database_integrity' as const,
          weight: 0.1,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'accessibility_ux' as const,
          weight: 0.05,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
        {
          category: 'documentation_governance' as const,
          weight: 0.05,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
      ],
      confidencePct: 92.0,
      coveragePct: 78.4,
      securityRiskLevel: 'LOW' as const,
      mandatoryFailures: 1,
      releaseBlocked: true,
    },
    evidenceSha256: SAMPLE_SHA256,
  };

  return {
    latestRun,
    runs: [latestRun],
    agentReports: [
      {
        verificationId: SAMPLE_VERIFICATION_ID,
        agentReport: {
          agentId: 'worker-3b',
          agentName: 'Control Room UI Worker',
          taskId: 'qi-ui-01',
          taskDescription: 'Implement Quality Intelligence UI',
          startingCommitSha: 'abcdef1',
          endingCommitSha: SAMPLE_COMMIT,
          filesCreated: [
            'apps/portal/app/(departments)/control-room/quality-intelligence/page.tsx',
          ],
          filesModified: [],
          filesDeleted: [],
          dependenciesAdded: [],
          dependenciesRemoved: [],
          featuresImplemented: ['Quality Intelligence Console'],
          testsCreated: ['QualityIntelligenceConsole.test.tsx'],
          testsExecuted: ['QualityIntelligenceConsole.test.tsx'],
          commandsExecuted: ['pnpm --filter portal test'],
          commandResults: [
            { command: 'pnpm --filter portal test', exitCode: 1, status: 'FAILED' as const },
          ],
          knownDefects: [],
          unresolvedIssues: ['1 unit test failure'],
          securityImpact: 'None',
          databaseImpact: 'None',
          integrationImpact: 'None',
          performanceImpact: 'None',
          documentationUpdates: [],
          evidenceReferences: ['.ci-local/quality-intelligence/latest.json'],
          state: 'VERIFICATION_PENDING' as const,
          submittedAt: '2026-11-19T14:05:00.000Z',
        },
        actualChangedFiles: [
          'apps/portal/app/(departments)/control-room/quality-intelligence/page.tsx',
        ],
        undeclaredFiles: [],
        missingDeclaredFiles: [],
        fileDiffMatches: true,
        computedState: 'VERIFICATION_FAILED' as const,
        runEvidence: latestRun,
        verifiedBy: 'quality-intelligence-engine',
        verifiedAt: '2026-11-19T14:06:00.000Z',
        findings: ['Mandatory test gate failed'],
      },
    ],
    agentPerformance: [
      {
        agentId: 'worker-3b',
        agentName: 'Control Room UI Worker',
        tasksCompleted: 4,
        tasksIndependentlyVerified: 4,
        firstPassVerificationSuccessCount: 3,
        firstPassSuccessRate: 75,
        defectsIntroduced: 1,
        regressionsIntroduced: 1,
        reopenedTasks: 0,
        testCoverageContribution: 88.5,
        securityFindingsIntroduced: 0,
        avgVerificationDurationMs: 12000,
        unresolvedBlockers: 1,
        documentationCompletenessPct: 100,
        evidenceCompletenessPct: 100,
        speedScore: 91.2,
        correctnessScore: 86.0,
        verificationQualityScore: 95.0,
        regressionRate: 12.5,
      },
    ],
    latestCertification: {
      commitSha: SAMPLE_COMMIT,
      status: 'BLOCKED' as const,
      requirements: Array.from({ length: 10 }, (_, idx) => ({
        requirementId: `req-${idx + 1}`,
        name: `Mandatory Requirement ${idx + 1}`,
        category: 'testing' as const,
        mandatory: true,
        status: idx === 1 ? ('FAILED' as const) : ('PASSED' as const),
        details: idx === 1 ? 'Portal Jest Suite failed' : 'Verified passing',
      })),
      overallScore: 84.5,
      blockers: ['Required tests pass [FAILED]: Portal Jest Suite failed'],
      evidenceRunId: SAMPLE_RUN_ID,
      certifiedAt: '2026-11-19T14:06:00.000Z',
      approvedBy: null,
      approvedAt: null,
      notes: null,
    },
    canCertify: false,
    ...overrides,
  };
}

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('QualityIntelligenceConsole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 14 Control Room Quality Intelligence sections from verified API data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createSamplePayload(),
    });

    renderWithQueryClient(<QualityIntelligenceConsole />);

    expect(await screen.findByText('1. Overall System Quality Score')).toBeInTheDocument();
    expect(screen.getAllByText('84.5%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2. 8-Category Quality Breakdown')).toBeInTheDocument();
    expect(screen.getByText('3. Verification & Block Status')).toBeInTheDocument();
    expect(screen.getByText('4. Verified Commit & Digest')).toBeInTheDocument();
    expect(screen.getByText('5. Agent Activity Summary')).toBeInTheDocument();
    expect(screen.getByText('6. Agent Verification Reports')).toBeInTheDocument();
    expect(screen.getByText('7. Failed Tests & Check Failures')).toBeInTheDocument();
    expect(screen.getByText('8. Security Findings')).toBeInTheDocument();
    expect(screen.getByText('9. Regression Alerts')).toBeInTheDocument();
    expect(screen.getByText('10. Build & Performance Trends')).toBeInTheDocument();
    expect(screen.getByText('11. Database Integrity & Migrations')).toBeInTheDocument();
    expect(screen.getByText('12. Integration Health')).toBeInTheDocument();
    expect(screen.getByText('13. Release Readiness')).toBeInTheDocument();
    expect(screen.getByText('14. Historical Quality Reports')).toBeInTheDocument();

    expect(screen.getByText('securityRiskLevel: LOW')).toBeInTheDocument();
    expect(screen.getByText('Git Diff Matched')).toBeInTheDocument();
    expect(screen.getByText('VERIFICATION_FAILED')).toBeInTheDocument();
    expect(screen.getByText('New Regression')).toBeInTheDocument();
    expect(screen.getByText('Pre-existing Failure')).toBeInTheDocument();
    expect(screen.getByText('10. Mandatory Requirement 10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Certify Release/i })).not.toBeInTheDocument();
  });

  it('renders honest empty state when latestRun is null without fabricating numbers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latestRun: null,
        runs: [],
        agentReports: [],
        agentMetrics: [],
        releaseCertification: null,
        canCertify: false,
      }),
    });

    renderWithQueryClient(<QualityIntelligenceConsole />);

    expect(await screen.findByText('No Verification Run Evidence Available')).toBeInTheDocument();
    expect(screen.queryByText('1. Overall System Quality Score')).not.toBeInTheDocument();
  });

  it('renders error banner and retries when API request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({
      ok: true,
      json: async () => createSamplePayload(),
    });

    renderWithQueryClient(<QualityIntelligenceConsole />);

    expect(
      await screen.findByText('Quality Intelligence Telemetry Unavailable')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry loading quality intelligence/i }));
    expect(await screen.findByText('1. Overall System Quality Score')).toBeInTheDocument();
  });

  it('applies interactive filters to API query params and resets cleanly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => createSamplePayload(),
    });

    renderWithQueryClient(<QualityIntelligenceConsole />);
    await screen.findByText('1. Overall System Quality Score');

    fireEvent.change(screen.getByLabelText('Filter by branch'), {
      target: { value: 'main' },
    });
    fireEvent.change(screen.getByLabelText('Filter by severity'), {
      target: { value: 'CRITICAL' },
    });

    await waitFor(() => {
      const lastCallUrl = String(mockFetch.mock.calls.at(-1)?.[0] ?? '');
      expect(lastCallUrl).toContain('branch=main');
      expect(lastCallUrl).toContain('severity=CRITICAL');
    });

    fireEvent.click(screen.getByLabelText('Reset all quality filters'));

    await waitFor(() => {
      const lastCallUrl = String(mockFetch.mock.calls.at(-1)?.[0] ?? '');
      expect(lastCallUrl).toBe('/api/control-room/quality-intelligence');
    });
  });

  it('opens keyboard-accessible finding drill-down drawer and closes with Escape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createSamplePayload(),
    });

    renderWithQueryClient(<QualityIntelligenceConsole />);
    await screen.findByText('1. Overall System Quality Score');

    fireEvent.click(
      screen.getByRole('button', { name: /Inspect check failure Portal Jest Suite/i })
    );
    expect(screen.getByRole('dialog', { name: 'Finding Drill-Down Details' })).toBeInTheDocument();
    expect(
      screen.getByText('Expected 1 to equal 2 in QualityIntelligenceConsole.test.tsx')
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Finding Drill-Down Details' })
    ).not.toBeInTheDocument();
  });

  it('shows Certify Release button only when canCertify is true and submits POST certification', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createSamplePayload({
            canCertify: true,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          certification: {
            ...createSamplePayload().latestCertification,
            status: 'APPROVED',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createSamplePayload({
            canCertify: true,
          }),
      });

    renderWithQueryClient(<QualityIntelligenceConsole />);

    const certifyButton = await screen.findByRole('button', { name: 'Certify Release' });
    fireEvent.change(screen.getByLabelText('Release certification notes'), {
      target: { value: 'Verified by Control Room supervisor' },
    });
    fireEvent.click(certifyButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/control-room/quality-intelligence/certify',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(
      await screen.findByText(/Release certification updated to APPROVED/i)
    ).toBeInTheDocument();
  });

  it('allows creating the first certification when latestRun exists, latestCertification is null, and canCertify is true', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createSamplePayload({
            latestCertification: null,
            releaseCertification: null,
            canCertify: true,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          certification: {
            ...createSamplePayload().latestCertification,
            status: 'APPROVED',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createSamplePayload({
            canCertify: true,
          }),
      });

    renderWithQueryClient(<QualityIntelligenceConsole />);

    expect(
      await screen.findByText(
        'No release certification record has been created yet for this verification run.'
      )
    ).toBeInTheDocument();
    const certifyButton = screen.getByRole('button', { name: 'Certify Release' });
    fireEvent.change(screen.getByLabelText('Release certification notes'), {
      target: { value: 'Initial release certification' },
    });
    fireEvent.click(certifyButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/control-room/quality-intelligence/certify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            commitSha: SAMPLE_COMMIT,
            evidenceSha256: SAMPLE_SHA256,
            action: 'APPROVE',
            notes: 'Initial release certification',
          }),
        })
      );
    });

    expect(
      await screen.findByText(/Release certification updated to APPROVED/i)
    ).toBeInTheDocument();
  });

  it('downloads JSON and Markdown reports cleanly', async () => {
    const createObjectUrlMock = jest.fn(() => 'blob:mock-report');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrlMock,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrlMock,
      writable: true,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createSamplePayload(),
    });

    renderWithQueryClient(<QualityIntelligenceConsole />);
    await screen.findByText('1. Overall System Quality Score');

    fireEvent.click(screen.getByRole('button', { name: 'Download JSON Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download Markdown Report' }));

    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(2);
  });
});

describe('ControlRoomSubtabs', () => {
  it('renders the Quality Intelligence tab with active aria-current when selected', () => {
    render(<ControlRoomSubtabs activeTab="quality-intelligence" />);
    const link = screen.getByRole('link', { name: /Quality Intelligence/i });
    expect(link).toHaveAttribute('href', '/control-room/quality-intelligence');
    expect(link).toHaveAttribute('aria-current', 'page');
  });
});
