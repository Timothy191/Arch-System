/** @jest-environment node */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { QualityCheckResult, QualityScoreBreakdown } from '@repo/contract';
import { computeEvidenceSha256, evaluateReleaseCertification } from '@repo/intelligence/quality';

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '@repo/logger/server';
import { loadQualityIntelligenceSnapshot } from './evidence-loader';

const UUID_ROW = '11111111-1111-4111-8111-111111111111';
const UUID_RUN = '22222222-2222-4222-8222-222222222222';
const UUID_VERIFICATION = '33333333-3333-4333-8333-333333333333';
const UUID_EMPLOYEE = '44444444-4444-4444-8444-444444444444';
const COMMIT_START = 'abcdef1234567';
const COMMIT_END = 'c3f8a91d2b4e5f60718293a4b5c6d7e8f9012345';

const tempDirectories: string[] = [];

async function createTempArtifactsDir(): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), 'arch-qi-loader-'));
  tempDirectories.push(dirPath);
  return dirPath;
}

function buildChecks(): QualityCheckResult[] {
  return [
    {
      checkId: 'unit-tests',
      name: 'Portal Unit Suite',
      category: 'testing',
      scoringCategory: 'functional_testing',
      owner: 'control-room',
      command: 'pnpm --filter portal test',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 1200,
      skipReason: null,
      logExcerpt: 'Tests passed with Bearer secret-token-should-redact-123456',
      evidenceLinks: ['apps/portal/control-room'],
    },
  ];
}

function buildScore(): QualityScoreBreakdown {
  return {
    overallScore: 98.5,
    categoryScores: [
      {
        category: 'functional_testing',
        weight: 0.2,
        score: 100,
        verified: 1,
        failed: 0,
        skipped: 0,
        unavailable: 0,
      },
    ],
    confidencePct: 100,
    coveragePct: 82.4,
    securityRiskLevel: 'LOW',
    mandatoryFailures: 0,
    releaseBlocked: false,
  };
}

function buildRunRow(digest: string) {
  return {
    id: UUID_ROW,
    run_id: UUID_RUN,
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commit_sha: COMMIT_END,
    parent_commit_sha: COMMIT_START,
    pull_request_id: 'PR-250',
    agent_id: 'worker-qa',
    task_id: 'TASK-QI-LOADER',
    executed_at: '2026-11-19T14:55:00+00:00',
    environment: 'ci',
    mode: 'full',
    overall_status: 'PASSED',
    overall_score: '98.5',
    confidence_pct: '100',
    coverage_pct: '82.4',
    security_risk_level: 'LOW',
    mandatory_failures: '0',
    release_blocked: false,
    checks: buildChecks(),
    regressions: [
      {
        id: 'reg-info-1',
        severity: 'LOW',
        category: 'testing',
        affectedPackage: '@repo/portal',
        affectedFiles: ['apps/portal/app/(departments)/control-room/quality-intelligence/page.tsx'],
        previousResult: '0 warnings',
        currentResult: '0 warnings',
        difference: 'Stable',
        suggestedRemediation: 'None',
        evidence: ['ci://1'],
        isPreExisting: true,
      },
    ],
    score_breakdown: buildScore(),
    evidence_sha256: digest,
    created_by: UUID_EMPLOYEE,
    created_at: '2026-11-19T16:55:00+02:00',
  };
}

function buildReportRow() {
  return {
    id: UUID_ROW,
    verification_id: UUID_VERIFICATION,
    agent_id: 'worker-qa',
    agent_name: 'Quality Evidence Worker',
    task_id: 'TASK-QI-LOADER',
    task_description: 'Verify evidence loader coverage',
    starting_commit_sha: COMMIT_START,
    ending_commit_sha: COMMIT_END,
    declared_state: 'IMPLEMENTATION_COMPLETE',
    computed_state: 'VERIFICATION_PASSED',
    file_diff_matches: true,
    actual_changed_files: ['apps/portal/lib/quality-intelligence/evidence-loader.ts'],
    undeclared_files: [],
    missing_declared_files: [],
    agent_report: {
      agentId: 'worker-qa',
      agentName: 'Quality Evidence Worker',
      taskId: 'TASK-QI-LOADER',
      taskDescription: 'Verify evidence loader coverage',
      startingCommitSha: COMMIT_START,
      endingCommitSha: COMMIT_END,
      filesCreated: [],
      filesModified: ['apps/portal/lib/quality-intelligence/evidence-loader.ts'],
      filesDeleted: [],
      dependenciesAdded: [],
      dependenciesRemoved: [],
      featuresImplemented: ['Loader tests'],
      testsCreated: ['evidence-loader.test.ts'],
      testsExecuted: ['evidence-loader.test.ts'],
      commandsExecuted: ['pnpm --filter portal test'],
      commandResults: [
        {
          command: 'pnpm --filter portal test',
          exitCode: 0,
          durationMs: 900,
          status: 'PASSED',
          summary: 'Passed',
        },
      ],
      knownDefects: [],
      unresolvedIssues: [],
      securityImpact: 'None',
      databaseImpact: 'None',
      integrationImpact: 'None',
      performanceImpact: 'None',
      documentationUpdates: [],
      evidenceReferences: ['.ci-local/quality-intelligence/latest.json'],
      state: 'IMPLEMENTATION_COMPLETE',
      submittedAt: '2026-11-19T16:50:00+02:00',
    },
    findings: [],
    evidence_run_id: UUID_RUN,
    verified_by: 'quality-intelligence-engine',
    verified_at: '2026-11-19T14:56:00+00:00',
    submitted_at: '2026-11-19T16:50:00+02:00',
    created_by: UUID_EMPLOYEE,
    created_at: '2026-11-19T14:56:00+00:00',
  };
}

function buildCertificationRow() {
  return {
    id: UUID_ROW,
    commit_sha: COMMIT_END,
    branch: 'feature/quality-intelligence-engine',
    release_status: 'APPROVED',
    overall_score: '98.5',
    requirements: [
      {
        requirementId: 'code_quality_gates',
        name: 'Required code quality gates pass',
        category: 'code_quality',
        mandatory: true,
        status: 'PASSED',
        details: 'Verified',
        evidenceRef: UUID_RUN,
      },
    ],
    blockers: [],
    evidence_run_id: UUID_RUN,
    certified_at: '2026-11-19T14:58:00+00:00',
    approved_by: UUID_EMPLOYEE,
    approved_at: '2026-11-19T16:59:00+02:00',
    notes: 'Verified under PostgREST offset formatting',
    created_by: UUID_EMPLOYEE,
    created_at: '2026-11-19T14:58:00+00:00',
    updated_at: '2026-11-19T16:59:00+02:00',
  };
}

interface MockTableResponse {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
}

function buildMockSupabase(responses: Record<string, MockTableResponse>) {
  return {
    from: (tableName: string) => ({
      select: () => ({
        order: () => ({
          limit: async () =>
            responses[tableName] ?? {
              data: [],
              error: null,
            },
        }),
      }),
    }),
  } as never;
}

describe('loadQualityIntelligenceSnapshot', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await Promise.all(
      tempDirectories.splice(0).map((dirPath) => rm(dirPath, { recursive: true, force: true }))
    );
  });

  it('loads Supabase rows with PostgREST TIMESTAMPTZ offsets, redacts secrets, and applies filters', async () => {
    const checks = buildChecks();
    const score = buildScore();
    const evidenceBase = {
      runId: UUID_RUN,
      repository: 'Timothy191/Arch-System',
      branch: 'feature/quality-intelligence-engine',
      commitSha: COMMIT_END,
      parentCommitSha: COMMIT_START,
      pullRequestId: 'PR-250',
      agentId: 'worker-qa',
      taskId: 'TASK-QI-LOADER',
      executedAt: '2026-11-19T14:55:00.000Z',
      environment: 'ci',
      mode: 'full',
      overallStatus: 'PASSED' as const,
      checks,
      regressions: buildRunRow('0'.repeat(64)).regressions,
      score,
    };
    const digest = computeEvidenceSha256(evidenceBase);

    const supabase = buildMockSupabase({
      quality_verification_runs: { data: [buildRunRow(digest)], error: null },
      agent_work_reports: { data: [buildReportRow()], error: null },
      quality_release_certifications: { data: [buildCertificationRow()], error: null },
    });

    const snapshot = await loadQualityIntelligenceSnapshot({
      supabase,
      filters: {
        agent: 'worker-qa',
        department: 'control-room',
        pkg: '@repo/portal',
        branch: 'quality-intelligence',
        commit: 'c3f8a91d',
        pr: '#PR-250',
        severity: 'LOW',
        date: '2026-11-19',
        status: 'PASSED',
      },
    });

    expect(snapshot.source).toBe('supabase');
    expect(snapshot.runs).toHaveLength(1);
    expect(snapshot.latestRun?.runId).toBe(UUID_RUN);
    expect(snapshot.latestRun?.checks[0]?.logExcerpt).toContain('Bearer [REDACTED]');
    expect(snapshot.latestRun?.checks[0]?.logExcerpt).not.toContain(
      'secret-token-should-redact-123456'
    );
    expect(snapshot.agentReports).toHaveLength(1);
    expect(snapshot.agentPerformance).toHaveLength(1);
    expect(snapshot.agentPerformance[0]?.firstPassSuccessRate).toBe(100);
    // Certification filters exclude APPROVED when status='PASSED'
    expect(snapshot.certifications).toHaveLength(0);

    const approvalSnapshot = await loadQualityIntelligenceSnapshot({
      supabase,
      filters: {
        branch: 'quality-intelligence',
        commit: 'c3f8a91d',
        status: 'APPROVED',
      },
    });
    expect(approvalSnapshot.certifications).toHaveLength(1);
    expect(approvalSnapshot.latestCertification?.status).toBe('APPROVED');
  });

  it('falls back gracefully to local .ci-local artifacts when DB tables are not migrated (42P01)', async () => {
    const emptyRoot = await createTempArtifactsDir();
    const qualityDir = path.join(emptyRoot, 'quality-intelligence');
    const runsDir = path.join(qualityDir, 'runs');
    const agentsDir = path.join(qualityDir, 'agent-verifications');
    await mkdir(runsDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });

    const baseRun = {
      runId: UUID_RUN,
      repository: 'Timothy191/Arch-System',
      branch: 'feature/quality-intelligence-engine',
      commitSha: COMMIT_END,
      parentCommitSha: COMMIT_START,
      pullRequestId: 'PR-250',
      agentId: 'worker-qa',
      taskId: 'TASK-QI-LOADER',
      executedAt: '2026-11-19T14:55:00.000Z',
      environment: 'local',
      mode: 'full',
      overallStatus: 'PASSED' as const,
      checks: buildChecks(),
      regressions: [],
      score: buildScore(),
    };
    const runEvidence = {
      ...baseRun,
      evidenceSha256: computeEvidenceSha256(baseRun),
    };

    const reportRow = buildReportRow();
    const verificationArtifact = {
      verificationId: UUID_VERIFICATION,
      agentReport: {
        ...reportRow.agent_report,
        submittedAt: '2026-11-19T14:50:00.000Z',
      },
      actualChangedFiles: reportRow.actual_changed_files,
      undeclaredFiles: [],
      missingDeclaredFiles: [],
      fileDiffMatches: true,
      computedState: 'VERIFICATION_PASSED',
      runEvidence,
      verifiedBy: 'quality-intelligence-engine',
      verifiedAt: '2026-11-19T14:56:00.000Z',
      findings: [],
    };

    const certRow = buildCertificationRow();
    const certArtifact = {
      commitSha: COMMIT_END,
      status: 'APPROVED',
      requirements: certRow.requirements,
      overallScore: 98.5,
      blockers: [],
      evidenceRunId: UUID_RUN,
      certifiedAt: '2026-11-19T14:58:00.000Z',
      approvedBy: 'tim-lead',
      approvedAt: '2026-11-19T14:59:00.000Z',
      notes: 'Local artifact verified',
    };

    const verifyEvidenceArtifact = {
      runId: 'av-run-1',
      startedAt: '2026-11-19T14:50:00.000Z',
      completedAt: '2026-11-19T14:55:00.000Z',
      gitTreeHash: 'a'.repeat(40),
      totalGates: 28,
      passedGates: 28,
      failedGates: 0,
      empiricalCoveragePct: 82.4,
      readinessClassification: 'STATIC_CONTRACT_AND_INTEGRATION_VERIFIED',
      gates: [
        {
          id: 1,
          name: 'Type Check',
          command: 'pnpm type-check',
          policy: 'mandatory',
          status: 'PASSED',
          exitCode: 0,
          durationMs: 1000,
          outputSha256: 'b'.repeat(64),
        },
      ],
    };

    await Promise.all([
      writeFile(path.join(qualityDir, 'latest.json'), JSON.stringify(runEvidence)),
      writeFile(path.join(runsDir, `${UUID_RUN}.json`), JSON.stringify(runEvidence)),
      writeFile(
        path.join(agentsDir, `${UUID_VERIFICATION}.json`),
        JSON.stringify(verificationArtifact)
      ),
      writeFile(path.join(qualityDir, 'release-certificate.json'), JSON.stringify(certArtifact)),
      writeFile(
        path.join(emptyRoot, 'agent-verify-evidence.json'),
        JSON.stringify(verifyEvidenceArtifact)
      ),
    ]);

    const supabase = buildMockSupabase({
      quality_verification_runs: {
        data: null,
        error: {
          code: '42P01',
          message: 'relation "public.quality_verification_runs" does not exist',
        },
      },
      agent_work_reports: {
        data: null,
        error: { code: 'PGRST205', message: 'Could not find the table in schema cache' },
      },
      quality_release_certifications: {
        data: null,
        error: {
          code: '42P01',
          message: 'relation "public.quality_release_certifications" does not exist',
        },
      },
    });

    const snapshot = await loadQualityIntelligenceSnapshot({
      supabase,
      artifactsRootDir: emptyRoot,
    });

    expect(snapshot.source).toBe('local_artifacts');
    expect(snapshot.runs).toHaveLength(1);
    expect(snapshot.agentReports).toHaveLength(1);
    expect(snapshot.certifications).toHaveLength(1);
    expect(snapshot.agentVerifyEvidence?.totalGates).toBe(28);
    expect(snapshot.unavailableReasons).toContain(
      'Quality intelligence database tables are not migrated yet (42P01).'
    );
  });

  it('returns honest empty state when DB queries fail or return empty and no local artifacts exist', async () => {
    const emptyDir = await createTempArtifactsDir();
    const supabase = buildMockSupabase({
      quality_verification_runs: {
        data: null,
        error: { code: 'XX000', message: 'connection timeout' },
      },
      agent_work_reports: {
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      },
      quality_release_certifications: { data: [], error: null },
    });

    const snapshot = await loadQualityIntelligenceSnapshot({
      supabase,
      artifactsRootDir: emptyDir,
    });

    expect(snapshot.source).toBe('none');
    expect(snapshot.latestRun).toBeNull();
    expect(snapshot.runs).toEqual([]);
    expect(snapshot.unavailableReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Database query failed for quality_verification_runs'),
        expect.stringContaining('agent_work_reports is not migrated yet'),
        expect.stringContaining('No local verified quality intelligence artifacts found'),
      ])
    );
    expect(jest.mocked(logger.warn)).toHaveBeenCalledTimes(1);
  });

  it('preserves CLI-redacted evidence digest integrity when loading local artifacts for certification', async () => {
    const artifactsDir = await createTempArtifactsDir();
    const qualityDir = path.join(artifactsDir, 'quality-intelligence');
    await mkdir(qualityDir, { recursive: true });

    const cliRedactedChecks: QualityCheckResult[] = [
      {
        checkId: 'type-check',
        name: 'Type Check',
        category: 'code_quality',
        scoringCategory: 'architecture',
        owner: 'platform-core',
        command: 'pnpm type-check',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 400,
        skipReason: null,
        logExcerpt: 'db=postgresql://postgres:[REDACTED:POSTGRES_DSN]@db.invalid:5432/postgres',
        evidenceLinks: [],
      },
      {
        checkId: 'unit-tests',
        name: 'Unit Tests',
        category: 'testing',
        scoringCategory: 'functional_testing',
        owner: 'platform-core',
        command: 'pnpm test',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 500,
        skipReason: null,
        logExcerpt: 'Authorization: Bearer [REDACTED:BEARER_TOKEN]',
        evidenceLinks: [],
      },
      {
        checkId: 'security-policy',
        name: 'Security Policy',
        category: 'security',
        scoringCategory: 'security',
        owner: 'security-team',
        command: 'pnpm audit:auth-matrix',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 300,
        skipReason: null,
        logExcerpt: 'SUPABASE_SERVICE_KEY="[REDACTED:ENV_SECRET]"',
        evidenceLinks: [],
      },
      {
        checkId: 'db-migrations',
        name: 'Database Migrations',
        category: 'database',
        scoringCategory: 'database_integrity',
        owner: 'database-team',
        command: 'pnpm lint:migrations',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 350,
        skipReason: null,
        logExcerpt: 'API_KEY=[REDACTED:API_KEY]',
        evidenceLinks: [],
      },
      {
        checkId: 'policy-check',
        name: 'Policy Check',
        category: 'architecture',
        scoringCategory: 'architecture',
        owner: 'platform-core',
        command: 'pnpm policy:check',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 250,
        skipReason: null,
        logExcerpt: null,
        evidenceLinks: [],
      },
      {
        checkId: 'observability',
        name: 'Observability Check',
        category: 'reliability',
        scoringCategory: 'reliability',
        owner: 'platform-core',
        command: 'pnpm audit:hooks',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 200,
        skipReason: null,
        logExcerpt: null,
        evidenceLinks: [],
      },
      {
        checkId: 'vercel-preflight',
        name: 'Vercel Preflight',
        category: 'infrastructure',
        scoringCategory: 'reliability',
        owner: 'devops-release',
        command: 'node tools/scripts/vercel-preflight.cjs',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 180,
        skipReason: null,
        logExcerpt: null,
        evidenceLinks: [],
      },
    ];

    const baseRun = {
      runId: UUID_RUN,
      repository: 'Timothy191/Arch-System',
      branch: 'feature/quality-intelligence-engine',
      commitSha: COMMIT_END,
      parentCommitSha: COMMIT_START,
      pullRequestId: null,
      agentId: null,
      taskId: null,
      executedAt: '2026-11-19T14:55:00.000Z',
      environment: 'local',
      mode: 'release',
      overallStatus: 'PASSED' as const,
      checks: cliRedactedChecks,
      regressions: [],
      score: buildScore(),
    };
    const sealedRun = {
      ...baseRun,
      evidenceSha256: computeEvidenceSha256(baseRun),
    };

    await writeFile(path.join(qualityDir, 'latest.json'), JSON.stringify(sealedRun));

    const snapshot = await loadQualityIntelligenceSnapshot({ artifactsRootDir: artifactsDir });
    expect(snapshot.source).toBe('local_artifacts');
    expect(snapshot.latestRun).not.toBeNull();
    expect(snapshot.latestRun?.checks[0]?.logExcerpt).toContain('[REDACTED:POSTGRES_DSN]');
    expect(snapshot.latestRun?.checks[2]?.logExcerpt).toContain('[REDACTED:ENV_SECRET]');

    if (!snapshot.latestRun) {
      throw new Error('Expected latestRun to be loaded from local artifacts');
    }

    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_END,
      runEvidence: snapshot.latestRun,
      expectedEvidenceSha256: snapshot.latestRun.evidenceSha256,
      hasAuthorizedApproval: true,
      approvedBy: 'tim-lead',
      approvedAt: '2026-11-19T15:00:00.000Z',
    });

    expect(certification.status).toBe('APPROVED');
    expect(certification.blockers).toEqual([]);
  });
});
