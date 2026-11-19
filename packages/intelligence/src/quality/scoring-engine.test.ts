import type {
  CheckStatus,
  GateCategory,
  QualityCheckResult,
  ScoringCategory,
} from '@repo/contract';
import {
  ALL_SCORING_CATEGORIES,
  calculateQualityScore,
  SCORING_CATEGORY_WEIGHTS,
} from './scoring-engine';

function makeCheck(overrides: {
  readonly checkId: string;
  readonly category?: GateCategory;
  readonly scoringCategory: ScoringCategory;
  readonly status?: CheckStatus;
  readonly mandatory?: boolean;
}): QualityCheckResult {
  return {
    checkId: overrides.checkId,
    name: overrides.checkId,
    category: overrides.category ?? 'code_quality',
    scoringCategory: overrides.scoringCategory,
    owner: 'platform-core',
    command: `pnpm ${overrides.checkId}`,
    mandatory: overrides.mandatory ?? true,
    status: overrides.status ?? 'PASSED',
    exitCode: overrides.status === 'FAILED' ? 1 : 0,
    durationMs: 250,
    skipReason: null,
    logExcerpt: null,
    evidenceLinks: ['https://ci.local/log/1'],
  };
}

describe('calculateQualityScore', () => {
  it('has category weights summing exactly to 1.0 (100%)', () => {
    const totalWeight = ALL_SCORING_CATEGORIES.reduce(
      (sum, category) => sum + SCORING_CATEGORY_WEIGHTS[category],
      0
    );
    expect(totalWeight).toBeCloseTo(1.0, 6);
  });

  it('scores 100 with 100% confidence and coverage when all 8 categories pass', () => {
    const checks: readonly QualityCheckResult[] = [
      makeCheck({ checkId: 'sec', category: 'security', scoringCategory: 'security' }),
      makeCheck({ checkId: 'test', category: 'testing', scoringCategory: 'functional_testing' }),
      makeCheck({ checkId: 'arch', category: 'architecture', scoringCategory: 'architecture' }),
      makeCheck({ checkId: 'rel', category: 'reliability', scoringCategory: 'reliability' }),
      makeCheck({ checkId: 'perf', category: 'performance', scoringCategory: 'performance' }),
      makeCheck({ checkId: 'db', category: 'database', scoringCategory: 'database_integrity' }),
      makeCheck({ checkId: 'ux', category: 'ui_ux', scoringCategory: 'accessibility_ux' }),
      makeCheck({
        checkId: 'docs',
        category: 'agent_governance',
        scoringCategory: 'documentation_governance',
      }),
    ];

    const breakdown = calculateQualityScore(checks);

    expect(breakdown.overallScore).toBe(100);
    expect(breakdown.confidencePct).toBe(100);
    expect(breakdown.coveragePct).toBe(100);
    expect(breakdown.securityRiskLevel).toBe('LOW');
    expect(breakdown.mandatoryFailures).toBe(0);
    expect(breakdown.releaseBlocked).toBe(false);
  });

  it('never awards points for SKIPPED, UNAVAILABLE, BLOCKED, or missing evidence', () => {
    const checks: readonly QualityCheckResult[] = [
      makeCheck({
        checkId: 'sec-1',
        category: 'security',
        scoringCategory: 'security',
        status: 'PASSED',
      }),
      makeCheck({
        checkId: 'sec-2',
        category: 'security',
        scoringCategory: 'security',
        status: 'SKIPPED',
      }),
      makeCheck({
        checkId: 'test-1',
        category: 'testing',
        scoringCategory: 'functional_testing',
        status: 'UNAVAILABLE',
      }),
      makeCheck({
        checkId: 'arch-1',
        category: 'architecture',
        scoringCategory: 'architecture',
        status: 'BLOCKED',
      }),
    ];

    const breakdown = calculateQualityScore(checks);
    const securityCategory = breakdown.categoryScores.find((c) => c.category === 'security');
    const testingCategory = breakdown.categoryScores.find(
      (c) => c.category === 'functional_testing'
    );
    const missingCategory = breakdown.categoryScores.find((c) => c.category === 'performance');

    expect(securityCategory?.score).toBe(50);
    expect(testingCategory?.score).toBe(0);
    expect(missingCategory?.score).toBe(0);
    expect(breakdown.overallScore).toBe(10); // only security: 50 * 0.20 = 10
    expect(breakdown.confidencePct).toBe(25); // 1 verified / 4 total
    expect(breakdown.coveragePct).toBe(12.5); // 1 category with >=1 verified / 8
    expect(breakdown.securityRiskLevel).toBe('MEDIUM');
  });

  it('returns zero scores and HIGH security risk when no checks are provided', () => {
    const breakdown = calculateQualityScore([]);

    expect(breakdown.overallScore).toBe(0);
    expect(breakdown.confidencePct).toBe(0);
    expect(breakdown.coveragePct).toBe(0);
    expect(breakdown.securityRiskLevel).toBe('HIGH');
    expect(breakdown.releaseBlocked).toBe(false);
  });

  it('blocks release on any failed security or mandatory check even when overallScore >= 90', () => {
    const checks: readonly QualityCheckResult[] = [
      makeCheck({
        checkId: 'sec-pass',
        category: 'security',
        scoringCategory: 'security',
        status: 'PASSED',
      }),
      makeCheck({
        checkId: 'sec-fail',
        category: 'security',
        scoringCategory: 'security',
        status: 'FAILED',
        mandatory: false,
      }),
      makeCheck({ checkId: 'test', category: 'testing', scoringCategory: 'functional_testing' }),
      makeCheck({ checkId: 'arch', category: 'architecture', scoringCategory: 'architecture' }),
      makeCheck({ checkId: 'rel', category: 'reliability', scoringCategory: 'reliability' }),
      makeCheck({ checkId: 'perf', category: 'performance', scoringCategory: 'performance' }),
      makeCheck({ checkId: 'db', category: 'database', scoringCategory: 'database_integrity' }),
      makeCheck({ checkId: 'ux', category: 'ui_ux', scoringCategory: 'accessibility_ux' }),
      makeCheck({
        checkId: 'docs',
        category: 'agent_governance',
        scoringCategory: 'documentation_governance',
      }),
    ];

    const breakdown = calculateQualityScore(checks);

    expect(breakdown.overallScore).toBe(90);
    expect(breakdown.securityRiskLevel).toBe('HIGH');
    expect(breakdown.mandatoryFailures).toBe(0);
    expect(breakdown.releaseBlocked).toBe(true);
  });

  it('marks securityRiskLevel CRITICAL and releaseBlocked true on mandatory security failure', () => {
    const checks: readonly QualityCheckResult[] = [
      makeCheck({
        checkId: 'sec-crit',
        category: 'security',
        scoringCategory: 'security',
        status: 'FAILED',
        mandatory: true,
      }),
    ];

    const breakdown = calculateQualityScore(checks);

    expect(breakdown.securityRiskLevel).toBe('CRITICAL');
    expect(breakdown.mandatoryFailures).toBe(1);
    expect(breakdown.releaseBlocked).toBe(true);
  });
});
