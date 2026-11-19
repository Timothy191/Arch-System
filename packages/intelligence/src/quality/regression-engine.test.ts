import type {
  CheckStatus,
  GateCategory,
  QualityCheckResult,
  QualityRunEvidence,
  ScoringCategory,
} from '@repo/contract';
import { detectRegressions } from './regression-engine';
import { calculateQualityScore } from './scoring-engine';

const SAMPLE_SHA_BASE = '1111111111111111111111111111111111111111';
const SAMPLE_SHA_CURR = '2222222222222222222222222222222222222222';
const SAMPLE_DIGEST = 'a'.repeat(64);

function makeCheck(overrides: {
  readonly checkId: string;
  readonly category?: GateCategory;
  readonly scoringCategory?: ScoringCategory;
  readonly status?: CheckStatus;
  readonly mandatory?: boolean;
  readonly durationMs?: number;
  readonly command?: string;
}): QualityCheckResult {
  return {
    checkId: overrides.checkId,
    name: overrides.checkId,
    category: overrides.category ?? 'testing',
    scoringCategory: overrides.scoringCategory ?? 'functional_testing',
    owner: 'platform-core',
    command: overrides.command ?? `pnpm ${overrides.checkId}`,
    mandatory: overrides.mandatory ?? true,
    status: overrides.status ?? 'PASSED',
    exitCode: overrides.status === 'FAILED' ? 1 : 0,
    durationMs: overrides.durationMs ?? 500,
    skipReason: null,
    logExcerpt: null,
    evidenceLinks: ['https://ci.local/run/1'],
  };
}

function makeEvidence(options: {
  readonly runId: string;
  readonly commitSha: string;
  readonly checks: readonly QualityCheckResult[];
}): QualityRunEvidence {
  return {
    runId: options.runId,
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: options.commitSha,
    parentCommitSha: null,
    pullRequestId: null,
    agentId: null,
    taskId: null,
    executedAt: '2026-11-19T14:00:00Z',
    environment: 'ci',
    mode: 'pr',
    overallStatus: options.checks.some((c) => c.status === 'FAILED') ? 'FAILED' : 'PASSED',
    checks: [...options.checks],
    regressions: [],
    score: calculateQualityScore(options.checks),
    evidenceSha256: SAMPLE_DIGEST,
  };
}

describe('detectRegressions', () => {
  it('returns empty findings when no baseline run is available', () => {
    const current = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000002',
      commitSha: SAMPLE_SHA_CURR,
      checks: [makeCheck({ checkId: 'unit-tests', status: 'FAILED' })],
    });

    expect(detectRegressions({ baseline: null, current })).toEqual([]);
  });

  it('flags PASSED -> FAILED as a new regression with CRITICAL severity for mandatory/security checks', () => {
    const baseline = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000001',
      commitSha: SAMPLE_SHA_BASE,
      checks: [
        makeCheck({
          checkId: 'db-tests',
          category: 'database',
          scoringCategory: 'database_integrity',
          command: 'pnpm --filter @repo/database test',
          status: 'PASSED',
        }),
        makeCheck({
          checkId: 'knip',
          category: 'code_quality',
          scoringCategory: 'architecture',
          mandatory: false,
          status: 'PASSED',
        }),
      ],
    });
    const current = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000002',
      commitSha: SAMPLE_SHA_CURR,
      checks: [
        makeCheck({
          checkId: 'db-tests',
          category: 'database',
          scoringCategory: 'database_integrity',
          command: 'pnpm --filter @repo/database test',
          status: 'FAILED',
        }),
        makeCheck({
          checkId: 'knip',
          category: 'code_quality',
          scoringCategory: 'architecture',
          mandatory: false,
          status: 'FAILED',
        }),
      ],
    });

    const findings = detectRegressions({ baseline, current });
    const dbRegression = findings.find((f) => f.id === 'regression:db-tests');
    const knipRegression = findings.find((f) => f.id === 'regression:knip');

    expect(dbRegression?.isPreExisting).toBe(false);
    expect(dbRegression?.severity).toBe('CRITICAL');
    expect(dbRegression?.affectedPackage).toBe('@repo/database');
    expect(knipRegression?.isPreExisting).toBe(false);
    expect(knipRegression?.severity).toBe('HIGH');
  });

  it('preserves FAILED -> FAILED as pre-existing without misclassifying as new', () => {
    const baseline = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000001',
      commitSha: SAMPLE_SHA_BASE,
      checks: [makeCheck({ checkId: 'legacy-lint', status: 'FAILED' })],
    });
    const current = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000002',
      commitSha: SAMPLE_SHA_CURR,
      checks: [makeCheck({ checkId: 'legacy-lint', status: 'FAILED' })],
    });

    const findings = detectRegressions({ baseline, current });

    expect(findings.length).toBe(1);
    expect(findings[0]?.isPreExisting).toBe(true);
    expect(findings[0]?.previousResult).toBe('FAILED');
    expect(findings[0]?.currentResult).toBe('FAILED');
  });

  it('detects significant duration and score-drop regressions', () => {
    const baseline = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000001',
      commitSha: SAMPLE_SHA_BASE,
      checks: [
        makeCheck({
          checkId: 'build-portal',
          category: 'performance',
          scoringCategory: 'performance',
          durationMs: 4000,
          status: 'PASSED',
        }),
        makeCheck({
          checkId: 'unit-tests',
          category: 'testing',
          scoringCategory: 'functional_testing',
          durationMs: 1000,
          status: 'PASSED',
        }),
      ],
    });
    const current = makeEvidence({
      runId: '00000000-0000-4000-8000-000000000002',
      commitSha: SAMPLE_SHA_CURR,
      checks: [
        makeCheck({
          checkId: 'build-portal',
          category: 'performance',
          scoringCategory: 'performance',
          durationMs: 8500,
          status: 'PASSED',
        }),
        makeCheck({
          checkId: 'unit-tests',
          category: 'testing',
          scoringCategory: 'functional_testing',
          durationMs: 1100,
          status: 'SKIPPED',
        }),
      ],
    });

    const findings = detectRegressions({ baseline, current });

    expect(findings.some((f) => f.id === 'duration-regression:build-portal')).toBe(true);
    expect(findings.some((f) => f.id === 'score-regression:overall')).toBe(true);
    expect(findings.some((f) => f.id === 'score-regression:functional_testing')).toBe(true);
  });
});
