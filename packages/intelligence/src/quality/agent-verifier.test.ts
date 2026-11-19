import type {
  AgentCompletionReport,
  QualityCheckResult,
  QualityRunEvidence,
  RegressionFinding,
} from '@repo/contract';
import {
  calculateAgentPerformance,
  computeEvidenceDigest,
  verifyAgentCompletion,
} from './agent-verifier';
import { calculateQualityScore } from './scoring-engine';

const BASE_COMMIT = '1111111111111111111111111111111111111111';
const END_COMMIT = '2222222222222222222222222222222222222222';
const VALID_DIGEST = 'b'.repeat(64);

function makeReport(overrides?: Partial<AgentCompletionReport>): AgentCompletionReport {
  return {
    agentId: 'worker-2a',
    agentName: 'Core Quality Engine Agent',
    taskId: 'task-quality-engine',
    taskDescription: 'Implement quality scoring and verification engines',
    startingCommitSha: BASE_COMMIT,
    endingCommitSha: END_COMMIT,
    filesCreated: ['packages/intelligence/src/quality/scoring-engine.ts'],
    filesModified: ['packages/intelligence/src/index.ts'],
    filesDeleted: [],
    dependenciesAdded: [],
    dependenciesRemoved: [],
    featuresImplemented: ['Quality score calculation'],
    testsCreated: ['packages/intelligence/src/quality/scoring-engine.test.ts'],
    testsExecuted: ['pnpm --filter @repo/intelligence test'],
    commandsExecuted: ['pnpm --filter @repo/intelligence test'],
    commandResults: [
      { command: 'pnpm --filter @repo/intelligence test', exitCode: 0, durationMs: 300 },
    ],
    knownDefects: [],
    unresolvedIssues: [],
    securityImpact: 'none',
    databaseImpact: 'none',
    integrationImpact: 'none',
    performanceImpact: 'none',
    documentationUpdates: ['AGENT_TRACER.md'],
    evidenceReferences: ['.ci-local/agent-verify-evidence.json'],
    state: 'IMPLEMENTATION_COMPLETE',
    submittedAt: '2026-11-19T14:30:00Z',
    ...overrides,
  };
}

function makeEvidence(options?: {
  readonly checks?: readonly QualityCheckResult[];
  readonly regressions?: readonly RegressionFinding[];
  readonly evidenceSha256?: string;
}): QualityRunEvidence {
  const checks = options?.checks ?? [
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
      durationMs: 1200,
      skipReason: null,
      logExcerpt: null,
      evidenceLinks: ['https://ci.local/type-check'],
    },
  ];

  return {
    runId: '00000000-0000-4000-8000-000000000010',
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: END_COMMIT,
    parentCommitSha: BASE_COMMIT,
    pullRequestId: null,
    agentId: 'worker-2a',
    taskId: 'task-quality-engine',
    executedAt: '2026-11-19T14:35:00Z',
    environment: 'ci',
    mode: 'pr',
    overallStatus: checks.some((c) => c.status === 'FAILED') ? 'FAILED' : 'PASSED',
    checks: [...checks],
    regressions: [...(options?.regressions ?? [])],
    score: calculateQualityScore(checks),
    evidenceSha256: options?.evidenceSha256 ?? VALID_DIGEST,
  };
}

describe('computeEvidenceDigest', () => {
  it('produces identical SHA-256 hex digests regardless of key insertion order', () => {
    const first = computeEvidenceDigest({ b: 2, a: { y: true, x: 'ok' } });
    const second = computeEvidenceDigest({ a: { x: 'ok', y: true }, b: 2 });

    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });
});

describe('verifyAgentCompletion', () => {
  it('never trusts self-claimed VERIFICATION_PASSED when undeclared files exist', () => {
    const report = makeReport({ state: 'VERIFICATION_PASSED' });
    const result = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: [
        'packages/intelligence/src/quality/scoring-engine.ts',
        'packages/intelligence/src/index.ts',
        'apps/portal/next.config.mjs',
      ],
      runEvidence: makeEvidence(),
      verifierId: 'independent-verifier-1',
      verifiedAt: '2026-11-19T14:40:00Z',
    });

    expect(result.fileDiffMatches).toBe(false);
    expect(result.undeclaredFiles).toEqual(['apps/portal/next.config.mjs']);
    expect(result.computedState).toBe('VERIFICATION_FAILED');
  });

  it('flags missingDeclaredFiles when claimed files are absent from Git diff', () => {
    const report = makeReport();
    const result = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: ['packages/intelligence/src/index.ts'],
      runEvidence: makeEvidence(),
      verifierId: 'independent-verifier-1',
    });

    expect(result.fileDiffMatches).toBe(false);
    expect(result.missingDeclaredFiles).toEqual([
      'packages/intelligence/src/quality/scoring-engine.ts',
    ]);
    expect(result.computedState).toBe('VERIFICATION_FAILED');
  });

  it('returns BLOCKED when a mandatory check is BLOCKED or UNAVAILABLE', () => {
    const report = makeReport();
    const result = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: [
        'packages/intelligence/src/quality/scoring-engine.ts',
        'packages/intelligence/src/index.ts',
      ],
      runEvidence: makeEvidence({
        checks: [
          {
            checkId: 'db-tests',
            name: 'DB Tests',
            category: 'database',
            scoringCategory: 'database_integrity',
            owner: 'database-team',
            command: 'pnpm --filter @repo/database test',
            mandatory: true,
            status: 'UNAVAILABLE',
            exitCode: null,
            durationMs: 0,
            skipReason: 'DB offline',
            logExcerpt: null,
            evidenceLinks: [],
          },
        ],
      }),
      verifierId: 'independent-verifier-1',
    });

    expect(result.computedState).toBe('BLOCKED');
  });

  it('returns REQUIRES_HUMAN_APPROVAL for non-trivial security or database impact', () => {
    const report = makeReport({
      databaseImpact: 'Added RLS policy on quality_verification_runs',
    });
    const result = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: [
        'packages/intelligence/src/quality/scoring-engine.ts',
        'packages/intelligence/src/index.ts',
      ],
      runEvidence: makeEvidence(),
      verifierId: 'independent-verifier-1',
    });

    expect(result.fileDiffMatches).toBe(true);
    expect(result.computedState).toBe('REQUIRES_HUMAN_APPROVAL');
  });

  it('returns VERIFICATION_PASSED only when diff matches, mandatory checks pass, and no critical issues exist', () => {
    const report = makeReport({ state: 'IMPLEMENTATION_COMPLETE' });
    const result = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: [
        'packages/intelligence/src/quality/scoring-engine.ts',
        'packages/intelligence/src/index.ts',
      ],
      runEvidence: makeEvidence(),
      verifierId: 'independent-verifier-1',
    });

    expect(result.fileDiffMatches).toBe(true);
    expect(result.computedState).toBe('VERIFICATION_PASSED');
  });

  it('rejects self-verification when verifierId matches agentId', () => {
    const report = makeReport({ agentId: 'worker-2a' });
    const result = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: [
        'packages/intelligence/src/quality/scoring-engine.ts',
        'packages/intelligence/src/index.ts',
      ],
      runEvidence: makeEvidence(),
      verifierId: 'worker-2a',
    });

    expect(result.computedState).toBe('VERIFICATION_FAILED');
  });
});

describe('calculateAgentPerformance', () => {
  it('computes speed, correctness, verification quality, and regression rate without LOC', () => {
    const report = makeReport();
    const passVerification = verifyAgentCompletion({
      agentReport: report,
      actualChangedFiles: [
        'packages/intelligence/src/quality/scoring-engine.ts',
        'packages/intelligence/src/index.ts',
      ],
      runEvidence: makeEvidence(),
      verifierId: 'independent-verifier-1',
    });

    const failVerification = verifyAgentCompletion({
      agentReport: makeReport({ knownDefects: ['Broken edge case'] }),
      actualChangedFiles: ['packages/intelligence/src/index.ts'],
      runEvidence: makeEvidence({
        regressions: [
          {
            id: 'reg-1',
            severity: 'CRITICAL',
            category: 'testing',
            affectedPackage: '@repo/intelligence',
            affectedFiles: ['packages/intelligence/src/index.ts'],
            previousResult: 'PASSED',
            currentResult: 'FAILED',
            difference: 'Test failed',
            suggestedRemediation: 'Fix test',
            evidence: ['ci://1'],
            isPreExisting: false,
          },
        ],
      }),
      verifierId: 'independent-verifier-1',
    });

    const metrics = calculateAgentPerformance({
      agentId: 'worker-2a',
      agentName: 'Core Quality Engine Agent',
      verifications: [passVerification, failVerification],
    });

    expect(metrics.tasksCompleted).toBe(2);
    expect(metrics.tasksIndependentlyVerified).toBe(2);
    expect(metrics.firstPassVerificationSuccessCount).toBe(1);
    expect(metrics.firstPassSuccessRate).toBe(50);
    expect(metrics.defectsIntroduced).toBe(1);
    expect(metrics.regressionsIntroduced).toBe(1);
    expect(metrics.regressionRate).toBe(50);
    expect(metrics.speedScore).toBe(100);
    expect(metrics.correctnessScore).toBeLessThan(50);
    expect(metrics.verificationQualityScore).toBe(75);
  });
});
