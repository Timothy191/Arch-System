import type {
  CheckStatus,
  GateCategory,
  QualityCheckResult,
  QualityRunEvidence,
  ScoringCategory,
} from '@repo/contract';
import { computeEvidenceSha256, evaluateReleaseCertification } from './release-certifier';
import { calculateQualityScore } from './scoring-engine';

const COMMIT_SHA = '3333333333333333333333333333333333333333';

function makeCheck(overrides: {
  readonly checkId: string;
  readonly category: GateCategory;
  readonly scoringCategory: ScoringCategory;
  readonly status?: CheckStatus;
  readonly mandatory?: boolean;
}): QualityCheckResult {
  return {
    checkId: overrides.checkId,
    name: overrides.checkId,
    category: overrides.category,
    scoringCategory: overrides.scoringCategory,
    owner: 'platform-core',
    command: `pnpm ${overrides.checkId}`,
    mandatory: overrides.mandatory ?? true,
    status: overrides.status ?? 'PASSED',
    exitCode: overrides.status === 'FAILED' ? 1 : 0,
    durationMs: 400,
    skipReason: null,
    logExcerpt: null,
    evidenceLinks: ['https://ci.local/log'],
  };
}

function makePassingChecks(): readonly QualityCheckResult[] {
  return [
    makeCheck({ checkId: 'type-check', category: 'code_quality', scoringCategory: 'architecture' }),
    makeCheck({
      checkId: 'unit-tests',
      category: 'testing',
      scoringCategory: 'functional_testing',
    }),
    makeCheck({ checkId: 'supply-chain', category: 'security', scoringCategory: 'security' }),
    makeCheck({
      checkId: 'db-migrations',
      category: 'database',
      scoringCategory: 'database_integrity',
    }),
    makeCheck({
      checkId: 'policy-check',
      category: 'architecture',
      scoringCategory: 'architecture',
    }),
    makeCheck({
      checkId: 'observability',
      category: 'reliability',
      scoringCategory: 'reliability',
    }),
    makeCheck({
      checkId: 'vercel-preflight',
      category: 'infrastructure',
      scoringCategory: 'reliability',
    }),
    makeCheck({ checkId: 'perf-budgets', category: 'performance', scoringCategory: 'performance' }),
    makeCheck({ checkId: 'audit-tokens', category: 'ui_ux', scoringCategory: 'accessibility_ux' }),
    makeCheck({
      checkId: 'md-lint',
      category: 'agent_governance',
      scoringCategory: 'documentation_governance',
    }),
  ];
}

function makeEvidence(overrides?: Partial<QualityRunEvidence>): QualityRunEvidence {
  const checks = overrides?.checks ?? [...makePassingChecks()];
  const baseEvidence: Omit<QualityRunEvidence, 'evidenceSha256'> = {
    runId: '00000000-0000-4000-8000-000000000099',
    repository: 'Timothy191/Arch-System',
    branch: 'main',
    commitSha: overrides?.commitSha ?? COMMIT_SHA,
    parentCommitSha: null,
    pullRequestId: null,
    agentId: null,
    taskId: null,
    executedAt: overrides?.executedAt ?? '2026-11-19T14:40:00.000Z',
    environment: 'ci',
    mode: 'release',
    overallStatus:
      overrides?.overallStatus ?? (checks.some((c) => c.status === 'FAILED') ? 'FAILED' : 'PASSED'),
    checks,
    regressions: overrides?.regressions ?? [],
    score: overrides?.score ?? calculateQualityScore(checks),
  };
  return {
    ...baseEvidence,
    ...overrides,
    evidenceSha256: overrides?.evidenceSha256 ?? computeEvidenceSha256(baseEvidence),
  };
}

describe('evaluateReleaseCertification', () => {
  it('evaluates all 10 mandatory requirements and returns READY_FOR_REVIEW without approval', () => {
    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence(),
      certifiedAt: '2026-11-19T14:45:00Z',
    });

    expect(certification.requirements).toHaveLength(10);
    expect(certification.overallScore).toBe(100);
    expect(certification.status).toBe('READY_FOR_REVIEW');
    expect(certification.blockers).toEqual([]);
  });

  it('returns APPROVED when all 9 technical requirements pass and authorized approval is recorded', () => {
    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence(),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
      notes: 'Verified release candidate',
      certifiedAt: '2026-11-19T14:46:30Z',
    });

    expect(certification.status).toBe('APPROVED');
    expect(certification.blockers).toEqual([]);
    expect(certification.approvedBy).toBe('tim@arch-system.io');
  });

  it('returns BLOCKED when any technical requirement fails regardless of high overall score', () => {
    const checks = makePassingChecks().map((check) =>
      check.checkId === 'vercel-preflight'
        ? { ...check, status: 'FAILED' as const, exitCode: 1 }
        : check
    );

    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({ checks }),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(certification.overallScore).toBeGreaterThanOrEqual(90);
    expect(certification.status).toBe('BLOCKED');
    expect(certification.blockers.some((b) => b.includes('Deployment preflight passes'))).toBe(
      true
    );
  });

  it('returns BLOCKED on unacceptable new HIGH/CRITICAL regressions even if pre-existing failures are allowed', () => {
    const withPreExistingOnly = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({
        regressions: [
          {
            id: 'pre-existing:knip',
            severity: 'HIGH',
            category: 'code_quality',
            affectedPackage: '@repo/portal',
            affectedFiles: [],
            previousResult: 'FAILED',
            currentResult: 'FAILED',
            difference: 'Still failing',
            suggestedRemediation: 'Track',
            evidence: ['ci://1'],
            isPreExisting: true,
          },
        ],
      }),
    });

    expect(withPreExistingOnly.status).toBe('READY_FOR_REVIEW');

    const withNewRegression = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({
        regressions: [
          {
            id: 'regression:rls',
            severity: 'HIGH',
            category: 'database',
            affectedPackage: '@repo/database',
            affectedFiles: [],
            previousResult: 'PASSED',
            currentResult: 'FAILED',
            difference: 'New regression',
            suggestedRemediation: 'Fix RLS',
            evidence: ['ci://2'],
            isPreExisting: false,
          },
        ],
      }),
    });

    expect(withNewRegression.status).toBe('BLOCKED');
  });

  it('returns BLOCKED when required evidence digest is invalid', () => {
    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({ evidenceSha256: '0'.repeat(64) }),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(certification.status).toBe('BLOCKED');
    expect(certification.blockers.some((b) => b.includes('Required evidence is available'))).toBe(
      true
    );
  });

  it('returns BLOCKED when a mandatory check is SKIPPED even if another check in the category PASSED', () => {
    const checks: QualityCheckResult[] = [
      ...makePassingChecks(),
      makeCheck({
        checkId: 'biome-lint',
        category: 'code_quality',
        scoringCategory: 'architecture',
        status: 'SKIPPED',
        mandatory: true,
      }),
    ];

    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({ checks }),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(certification.status).toBe('BLOCKED');
    const codeQualityReq = certification.requirements.find(
      (req) => req.requirementId === 'code_quality_gates'
    );
    expect(codeQualityReq?.status).toBe('SKIPPED');
    expect(codeQualityReq?.details).toContain('biome-lint');
  });

  it('allows optional SKIPPED checks when all mandatory checks in the category PASSED', () => {
    const checks: QualityCheckResult[] = [
      ...makePassingChecks(),
      makeCheck({
        checkId: 'live-e2e-suite',
        category: 'testing',
        scoringCategory: 'functional_testing',
        status: 'SKIPPED',
        mandatory: false,
      }),
    ];

    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({ checks }),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(certification.status).toBe('APPROVED');
  });

  it('returns BLOCKED when a 64-char evidenceSha256 digest is fabricated or stale', () => {
    const fabricatedDigestCertification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: makeEvidence({ evidenceSha256: 'c'.repeat(64) }),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(fabricatedDigestCertification.status).toBe('BLOCKED');
    expect(
      fabricatedDigestCertification.blockers.some((b) =>
        b.includes('does not match computed manifest digest')
      )
    ).toBe(true);

    const validRun = makeEvidence();
    const staleExpectedCertification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: validRun,
      expectedEvidenceSha256: 'd'.repeat(64),
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(staleExpectedCertification.status).toBe('BLOCKED');
    expect(
      staleExpectedCertification.blockers.some((b) =>
        b.includes('does not match the verification run being certified')
      )
    ).toBe(true);
  });

  it('verifies canonical evidence digest across PostgREST TIMESTAMPTZ offset representation', () => {
    const canonicalRun = makeEvidence({ executedAt: '2026-11-19T14:40:00.000Z' });
    const postgrestRun = {
      ...canonicalRun,
      executedAt: '2026-11-19T16:40:00+02:00',
    };

    const certification = evaluateReleaseCertification({
      commitSha: COMMIT_SHA,
      runEvidence: postgrestRun,
      hasAuthorizedApproval: true,
      approvedBy: 'tim@arch-system.io',
      approvedAt: '2026-11-19T14:46:00Z',
    });

    expect(certification.status).toBe('APPROVED');
  });
});
