import type {
  CategoryScore,
  QualityCheckResult,
  QualityScoreBreakdown,
  ScoringCategory,
  Severity,
} from '@repo/contract';

const PERCENT_SCALE = 100;
const ROUNDING_PRECISION = 100;
const CRITICAL_SECURITY_FAILURE_THRESHOLD = 2;

export const SCORING_CATEGORY_WEIGHTS: Readonly<Record<ScoringCategory, number>> = {
  security: 0.2,
  functional_testing: 0.2,
  architecture: 0.15,
  reliability: 0.15,
  performance: 0.1,
  database_integrity: 0.1,
  accessibility_ux: 0.05,
  documentation_governance: 0.05,
};

export const ALL_SCORING_CATEGORIES: readonly ScoringCategory[] = [
  'security',
  'functional_testing',
  'architecture',
  'reliability',
  'performance',
  'database_integrity',
  'accessibility_ux',
  'documentation_governance',
];

function roundPct(value: number): number {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function buildCategoryScore(
  category: ScoringCategory,
  checks: readonly QualityCheckResult[]
): CategoryScore {
  const categoryChecks = checks.filter((check) => check.scoringCategory === category);
  let verified = 0;
  let failed = 0;
  let skipped = 0;
  let unavailable = 0;

  for (const check of categoryChecks) {
    if (check.status === 'PASSED') {
      verified += 1;
    } else if (check.status === 'FAILED') {
      failed += 1;
    } else if (check.status === 'SKIPPED') {
      skipped += 1;
    } else {
      unavailable += 1;
    }
  }

  const totalCount = categoryChecks.length;
  const score = totalCount === 0 ? 0 : roundPct((verified / totalCount) * PERCENT_SCALE);

  return {
    category,
    weight: SCORING_CATEGORY_WEIGHTS[category],
    score,
    verified,
    failed,
    skipped,
    unavailable,
  };
}

function computeSecurityRiskLevel(checks: readonly QualityCheckResult[]): Severity {
  const securityChecks = checks.filter(
    (check) => check.scoringCategory === 'security' || check.category === 'security'
  );

  if (securityChecks.length === 0) {
    return 'HIGH';
  }

  const failedChecks = securityChecks.filter((check) => check.status === 'FAILED');
  const hasMandatoryFailure = failedChecks.some((check) => check.mandatory);

  if (hasMandatoryFailure || failedChecks.length >= CRITICAL_SECURITY_FAILURE_THRESHOLD) {
    return 'CRITICAL';
  }

  if (failedChecks.length > 0) {
    return 'HIGH';
  }

  const verifiedCount = securityChecks.filter((check) => check.status === 'PASSED').length;
  if (verifiedCount === 0) {
    return 'HIGH';
  }

  if (verifiedCount < securityChecks.length) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Computes weighted quality scores, confidence, coverage, security risk, and
 * release-blocking state strictly from verified check evidence.
 */
export function calculateQualityScore(
  checks: readonly QualityCheckResult[]
): QualityScoreBreakdown {
  const categoryScores = ALL_SCORING_CATEGORIES.map((category) =>
    buildCategoryScore(category, checks)
  );

  const weightedSum = categoryScores.reduce(
    (sum, categoryScore) => sum + categoryScore.score * categoryScore.weight,
    0
  );
  const overallScore = roundPct(weightedSum);

  const totalChecks = checks.length;
  const totalVerified = categoryScores.reduce((sum, item) => sum + item.verified, 0);
  const confidencePct =
    totalChecks === 0 ? 0 : roundPct((totalVerified / totalChecks) * PERCENT_SCALE);

  const categoriesWithVerified = categoryScores.filter((item) => item.verified >= 1).length;
  const coveragePct = roundPct(
    (categoriesWithVerified / ALL_SCORING_CATEGORIES.length) * PERCENT_SCALE
  );

  const securityRiskLevel = computeSecurityRiskLevel(checks);
  const mandatoryFailures = checks.filter(
    (check) => check.mandatory && check.status === 'FAILED'
  ).length;
  const failedSecurityChecks = checks.filter(
    (check) =>
      (check.scoringCategory === 'security' || check.category === 'security') &&
      check.status === 'FAILED'
  ).length;

  return {
    overallScore,
    categoryScores,
    confidencePct,
    coveragePct,
    securityRiskLevel,
    mandatoryFailures,
    releaseBlocked: mandatoryFailures > 0 || failedSecurityChecks > 0,
  };
}
