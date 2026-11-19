import type {
  GateCategory,
  QualityCheckResult,
  QualityRunEvidence,
  RegressionFinding,
  ScoringCategory,
  Severity,
} from '@repo/contract';

const DEFAULT_DURATION_REGRESSION_PCT = 35;
const MIN_DURATION_REGRESSION_DELTA_MS = 2000;
const CATEGORY_SCORE_DROP_THRESHOLD = 5;
const OVERALL_SCORE_DROP_THRESHOLD = 3;
const CRITICAL_OVERALL_SCORE_DROP = 10;
const PERCENT_MULTIPLIER = 100;

export interface DetectRegressionsOptions {
  readonly baseline: QualityRunEvidence | null;
  readonly current: QualityRunEvidence;
  readonly durationRegressionPct?: number;
}

const SCORING_TO_GATE_CATEGORY: Readonly<Record<ScoringCategory, GateCategory>> = {
  security: 'security',
  functional_testing: 'testing',
  architecture: 'architecture',
  reliability: 'reliability',
  performance: 'performance',
  database_integrity: 'database',
  accessibility_ux: 'ui_ux',
  documentation_governance: 'agent_governance',
};

function resolveAffectedPackage(check: QualityCheckResult): string {
  const filterMatch = /--filter\s+([^\s]+)/.exec(check.command);
  if (filterMatch?.[1]) {
    return filterMatch[1];
  }
  return check.owner;
}

function classifyFailureSeverity(check: QualityCheckResult): Severity {
  if (check.category === 'security' || check.category === 'database' || check.mandatory) {
    return 'CRITICAL';
  }
  return 'HIGH';
}

function classifyPreExistingSeverity(check: QualityCheckResult): Severity {
  if (check.category === 'security' || check.category === 'database' || check.mandatory) {
    return 'HIGH';
  }
  return 'MEDIUM';
}

function buildStatusRegression(
  baselineCheck: QualityCheckResult,
  currentCheck: QualityCheckResult
): RegressionFinding | null {
  if (baselineCheck.status === 'PASSED' && currentCheck.status === 'FAILED') {
    return {
      id: `regression:${currentCheck.checkId}`,
      severity: classifyFailureSeverity(currentCheck),
      category: currentCheck.category,
      affectedPackage: resolveAffectedPackage(currentCheck),
      affectedFiles: [],
      previousResult: 'PASSED',
      currentResult: 'FAILED',
      difference: `Check "${currentCheck.name}" regressed from PASSED to FAILED (exitCode=${currentCheck.exitCode ?? 'null'}).`,
      suggestedRemediation: `Run "${currentCheck.command}" locally, inspect the failing output, and fix the regression before merging.`,
      evidence:
        currentCheck.evidenceLinks.length > 0 ? currentCheck.evidenceLinks : [currentCheck.checkId],
      isPreExisting: false,
    };
  }

  if (baselineCheck.status === 'FAILED' && currentCheck.status === 'FAILED') {
    return {
      id: `pre-existing:${currentCheck.checkId}`,
      severity: classifyPreExistingSeverity(currentCheck),
      category: currentCheck.category,
      affectedPackage: resolveAffectedPackage(currentCheck),
      affectedFiles: [],
      previousResult: 'FAILED',
      currentResult: 'FAILED',
      difference: `Pre-existing failure in "${currentCheck.name}" remains FAILED compared to baseline.`,
      suggestedRemediation: `Track and remediate pre-existing failure in "${currentCheck.command}".`,
      evidence:
        currentCheck.evidenceLinks.length > 0 ? currentCheck.evidenceLinks : [currentCheck.checkId],
      isPreExisting: true,
    };
  }

  return null;
}

function buildDurationRegression(options: {
  readonly baselineCheck: QualityCheckResult;
  readonly currentCheck: QualityCheckResult;
  readonly thresholdPct: number;
}): RegressionFinding | null {
  const { baselineCheck, currentCheck, thresholdPct } = options;
  if (baselineCheck.durationMs <= 0 || currentCheck.durationMs <= baselineCheck.durationMs) {
    return null;
  }

  const deltaMs = currentCheck.durationMs - baselineCheck.durationMs;
  const pctIncrease = (deltaMs / baselineCheck.durationMs) * PERCENT_MULTIPLIER;

  if (pctIncrease <= thresholdPct || deltaMs <= MIN_DURATION_REGRESSION_DELTA_MS) {
    return null;
  }

  return {
    id: `duration-regression:${currentCheck.checkId}`,
    severity: 'MEDIUM',
    category: 'performance',
    affectedPackage: resolveAffectedPackage(currentCheck),
    affectedFiles: [],
    previousResult: `${baselineCheck.durationMs}ms`,
    currentResult: `${currentCheck.durationMs}ms`,
    difference: `Duration of "${currentCheck.name}" increased by +${Math.round(pctIncrease)}% (+${Math.round(deltaMs)}ms).`,
    suggestedRemediation: `Profile "${currentCheck.command}" for newly introduced slow steps or uncached work.`,
    evidence:
      currentCheck.evidenceLinks.length > 0 ? currentCheck.evidenceLinks : [currentCheck.checkId],
    isPreExisting: false,
  };
}

function detectScoreDropRegressions(
  baseline: QualityRunEvidence,
  current: QualityRunEvidence
): readonly RegressionFinding[] {
  const findings: RegressionFinding[] = [];

  const overallDrop = baseline.score.overallScore - current.score.overallScore;
  if (overallDrop >= OVERALL_SCORE_DROP_THRESHOLD) {
    findings.push({
      id: 'score-regression:overall',
      severity: overallDrop >= CRITICAL_OVERALL_SCORE_DROP ? 'CRITICAL' : 'HIGH',
      category: 'code_quality',
      affectedPackage: current.repository,
      affectedFiles: [],
      previousResult: `${baseline.score.overallScore}`,
      currentResult: `${current.score.overallScore}`,
      difference: `Overall quality score dropped by ${overallDrop.toFixed(2)} points (${baseline.score.overallScore} -> ${current.score.overallScore}).`,
      suggestedRemediation:
        'Review newly failing or skipped checks contributing to the overall quality score decline.',
      evidence: [baseline.runId, current.runId],
      isPreExisting: false,
    });
  }

  const currentByCategory = new Map(
    current.score.categoryScores.map((score) => [score.category, score])
  );

  for (const baseCategory of baseline.score.categoryScores) {
    const currCategory = currentByCategory.get(baseCategory.category);
    if (!currCategory) {
      continue;
    }

    const categoryDrop = baseCategory.score - currCategory.score;
    if (categoryDrop >= CATEGORY_SCORE_DROP_THRESHOLD) {
      const severity: Severity =
        baseCategory.category === 'security' || baseCategory.category === 'database_integrity'
          ? 'CRITICAL'
          : 'HIGH';
      findings.push({
        id: `score-regression:${baseCategory.category}`,
        severity,
        category: SCORING_TO_GATE_CATEGORY[baseCategory.category],
        affectedPackage: current.repository,
        affectedFiles: [],
        previousResult: `${baseCategory.score}`,
        currentResult: `${currCategory.score}`,
        difference: `Category "${baseCategory.category}" score dropped by ${categoryDrop.toFixed(2)} points (${baseCategory.score} -> ${currCategory.score}).`,
        suggestedRemediation: `Restore verification coverage and passing checks in category "${baseCategory.category}".`,
        evidence: [baseline.runId, current.runId],
        isPreExisting: false,
      });
    }
  }

  return findings;
}

/**
 * Compares the current quality verification run against a baseline run to
 * separate newly introduced regressions from pre-existing failures.
 */
export function detectRegressions(options: DetectRegressionsOptions): readonly RegressionFinding[] {
  const { baseline, current, durationRegressionPct = DEFAULT_DURATION_REGRESSION_PCT } = options;

  if (baseline === null) {
    return [];
  }

  const baselineByCheckId = new Map(baseline.checks.map((check) => [check.checkId, check]));
  const findings: RegressionFinding[] = [];

  for (const currentCheck of current.checks) {
    const baselineCheck = baselineByCheckId.get(currentCheck.checkId);
    if (!baselineCheck) {
      continue;
    }

    const statusFinding = buildStatusRegression(baselineCheck, currentCheck);
    if (statusFinding) {
      findings.push(statusFinding);
    }

    const durationFinding = buildDurationRegression({
      baselineCheck,
      currentCheck,
      thresholdPct: durationRegressionPct,
    });
    if (durationFinding) {
      findings.push(durationFinding);
    }
  }

  const scoreDropFindings = detectScoreDropRegressions(baseline, current);
  return [...findings, ...scoreDropFindings];
}
