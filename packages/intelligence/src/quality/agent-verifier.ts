import { createHash, randomUUID } from 'node:crypto';
import type {
  AgentCompletionReport,
  AgentCompletionState,
  AgentPerformanceMetrics,
  AgentVerificationReport,
  QualityRunEvidence,
} from '@repo/contract';

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;
const ZERO_SHA256 = '0'.repeat(64);
const PERCENT_SCALE = 100;
const ROUNDING_PRECISION = 100;
const TRIVIAL_IMPACT_VALUES = new Set(['', 'none', 'none.', 'n/a', 'na', 'no impact', 'nil']);
const SENSITIVE_FILE_PATTERN =
  /(?:packages\/database\/migrations\/|rls|auth|proxy\.ts|security|secret|permission)/i;
const FAST_VERIFICATION_BASELINE_MS = 30_000;
const SLOW_VERIFICATION_CEILING_MS = 300_000;
const DEFECT_PENALTY_POINTS = 15;
const REGRESSION_PENALTY_POINTS = 20;
const SECURITY_PENALTY_POINTS = 25;

export interface VerifyAgentCompletionOptions {
  readonly agentReport: AgentCompletionReport;
  readonly actualChangedFiles: readonly string[];
  readonly runEvidence: QualityRunEvidence;
  readonly verifierId: string;
  readonly verifiedAt?: string;
}

export interface CalculateAgentPerformanceOptions {
  readonly agentId: string;
  readonly agentName: string;
  readonly verifications: readonly AgentVerificationReport[];
}

function roundPct(value: number): number {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(PERCENT_SCALE, roundPct(value)));
}

function canonicalSerialize(payload: unknown): string {
  if (payload === null || typeof payload !== 'object') {
    return JSON.stringify(payload) ?? 'null';
  }

  if (payload instanceof Date) {
    return JSON.stringify(payload.toISOString());
  }

  if (Array.isArray(payload)) {
    return `[${payload.map((item) => canonicalSerialize(item)).join(',')}]`;
  }

  const record = payload as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`);

  return `{${entries.join(',')}}`;
}

/**
 * Computes a deterministic SHA-256 hex digest for structured evidence payloads
 * regardless of object key insertion order.
 */
export function computeEvidenceDigest(payload: unknown): string {
  const serialized = canonicalSerialize(payload);
  return createHash('sha256').update(serialized).digest('hex');
}

function isValidEvidenceDigest(digest: string): boolean {
  return SHA256_HEX_REGEX.test(digest) && digest !== ZERO_SHA256;
}

function isNonTrivialImpact(impactText: string): boolean {
  const normalized = impactText.trim().toLowerCase();
  return !TRIVIAL_IMPACT_VALUES.has(normalized);
}

function uniqueSorted(items: readonly string[]): string[] {
  return [...new Set(items)].sort();
}

function resolveComputedState(options: {
  readonly hasBlockedMandatory: boolean;
  readonly hasHardFailure: boolean;
  readonly requiresHumanReview: boolean;
}): AgentCompletionState {
  if (options.hasBlockedMandatory) {
    return 'BLOCKED';
  }
  if (options.hasHardFailure) {
    return 'VERIFICATION_FAILED';
  }
  if (options.requiresHumanReview) {
    return 'REQUIRES_HUMAN_APPROVAL';
  }
  return 'VERIFICATION_PASSED';
}

/**
 * Independently verifies an agent completion report against the actual Git
 * changed-file diff, verification run evidence, and security/database impact.
 */
export function verifyAgentCompletion(
  options: VerifyAgentCompletionOptions
): AgentVerificationReport {
  const { agentReport, actualChangedFiles, runEvidence, verifierId } = options;
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();

  const declaredFiles = uniqueSorted([
    ...agentReport.filesCreated,
    ...agentReport.filesModified,
    ...agentReport.filesDeleted,
  ]);
  const actualSet = new Set(actualChangedFiles);
  const declaredSet = new Set(declaredFiles);

  const undeclaredFiles = uniqueSorted(actualChangedFiles.filter((file) => !declaredSet.has(file)));
  const missingDeclaredFiles = uniqueSorted(declaredFiles.filter((file) => !actualSet.has(file)));
  const fileDiffMatches = undeclaredFiles.length === 0 && missingDeclaredFiles.length === 0;

  const findings: string[] = [];

  if (verifierId.trim() === agentReport.agentId.trim()) {
    findings.push(
      'Independent verification violation: verifierId cannot match the reporting agentId.'
    );
  }
  if (agentReport.state === 'VERIFICATION_PASSED') {
    findings.push(
      'Self-claimed VERIFICATION_PASSED status ignored; independent verification is mandatory.'
    );
  }
  if (undeclaredFiles.length > 0) {
    findings.push(`Undeclared modified files in Git diff: ${undeclaredFiles.join(', ')}`);
  }
  if (missingDeclaredFiles.length > 0) {
    findings.push(`Declared files absent from actual Git diff: ${missingDeclaredFiles.join(', ')}`);
  }

  const mandatoryChecks = runEvidence.checks.filter((check) => check.mandatory);
  const blockedMandatory = mandatoryChecks.filter(
    (check) => check.status === 'BLOCKED' || check.status === 'UNAVAILABLE'
  );
  const failedMandatory = mandatoryChecks.filter((check) => check.status === 'FAILED');
  const failedOptional = runEvidence.checks.filter(
    (check) => !check.mandatory && check.status === 'FAILED'
  );

  for (const check of blockedMandatory) {
    findings.push(`Mandatory check "${check.checkId}" is ${check.status}.`);
  }
  for (const check of failedMandatory) {
    findings.push(`Mandatory check "${check.checkId}" FAILED.`);
  }
  for (const check of failedOptional) {
    findings.push(`Non-mandatory check "${check.checkId}" FAILED and requires review.`);
  }

  const criticalNewRegressions = runEvidence.regressions.filter(
    (regression) => !regression.isPreExisting && regression.severity === 'CRITICAL'
  );
  const nonCriticalNewRegressions = runEvidence.regressions.filter(
    (regression) => !regression.isPreExisting && regression.severity !== 'CRITICAL'
  );

  for (const regression of criticalNewRegressions) {
    findings.push(`Critical new regression detected (${regression.id}): ${regression.difference}`);
  }
  for (const regression of nonCriticalNewRegressions) {
    findings.push(
      `Non-critical regression (${regression.severity}) requires review: ${regression.difference}`
    );
  }

  const hasValidDigest = isValidEvidenceDigest(runEvidence.evidenceSha256);
  if (!hasValidDigest) {
    findings.push('Verification run evidence has an invalid or missing SHA-256 digest.');
  }
  if (runEvidence.checks.length === 0) {
    findings.push('Verification run evidence contains zero executed checks.');
  }

  const hasNonTrivialSecurity = isNonTrivialImpact(agentReport.securityImpact);
  const hasNonTrivialDatabase = isNonTrivialImpact(agentReport.databaseImpact);
  const touchesSensitiveFiles = actualChangedFiles.some((file) =>
    SENSITIVE_FILE_PATTERN.test(file)
  );

  if (hasNonTrivialSecurity) {
    findings.push(`Non-trivial security impact declared: ${agentReport.securityImpact}`);
  }
  if (hasNonTrivialDatabase) {
    findings.push(`Non-trivial database impact declared: ${agentReport.databaseImpact}`);
  }
  if (touchesSensitiveFiles) {
    findings.push('Actual diff modifies security, auth, or database migration files.');
  }
  if (agentReport.knownDefects.length > 0) {
    findings.push(`Known defects reported: ${agentReport.knownDefects.join('; ')}`);
  }
  if (agentReport.unresolvedIssues.length > 0) {
    findings.push(`Unresolved issues reported: ${agentReport.unresolvedIssues.join('; ')}`);
  }

  const hasBlockedMandatory =
    blockedMandatory.length > 0 ||
    runEvidence.overallStatus === 'BLOCKED' ||
    runEvidence.overallStatus === 'UNAVAILABLE';

  const hasHardFailure =
    verifierId.trim() === agentReport.agentId.trim() ||
    failedMandatory.length > 0 ||
    undeclaredFiles.length > 0 ||
    missingDeclaredFiles.length > 0 ||
    criticalNewRegressions.length > 0 ||
    !hasValidDigest ||
    runEvidence.checks.length === 0;

  const requiresHumanReview =
    hasNonTrivialSecurity ||
    hasNonTrivialDatabase ||
    touchesSensitiveFiles ||
    failedOptional.length > 0 ||
    nonCriticalNewRegressions.length > 0 ||
    agentReport.knownDefects.length > 0 ||
    agentReport.unresolvedIssues.length > 0;

  const computedState = resolveComputedState({
    hasBlockedMandatory,
    hasHardFailure,
    requiresHumanReview,
  });

  return {
    verificationId: randomUUID(),
    agentReport,
    actualChangedFiles: uniqueSorted(actualChangedFiles),
    undeclaredFiles,
    missingDeclaredFiles,
    fileDiffMatches,
    computedState,
    runEvidence,
    verifiedBy: verifierId,
    verifiedAt,
    findings,
  };
}

function computeSpeedScore(avgDurationMs: number): number {
  if (avgDurationMs <= FAST_VERIFICATION_BASELINE_MS) {
    return PERCENT_SCALE;
  }
  if (avgDurationMs >= SLOW_VERIFICATION_CEILING_MS) {
    return 0;
  }
  const span = SLOW_VERIFICATION_CEILING_MS - FAST_VERIFICATION_BASELINE_MS;
  const elapsedAboveBaseline = avgDurationMs - FAST_VERIFICATION_BASELINE_MS;
  return clampPct((1 - elapsedAboveBaseline / span) * PERCENT_SCALE);
}

/**
 * Aggregates agent performance across independent verification reports without
 * using lines-of-code volume metrics.
 */
export function calculateAgentPerformance(
  options: CalculateAgentPerformanceOptions
): AgentPerformanceMetrics {
  const { agentId, agentName, verifications } = options;
  const tasksCompleted = verifications.length;

  if (tasksCompleted === 0) {
    return {
      agentId,
      agentName,
      tasksCompleted: 0,
      tasksIndependentlyVerified: 0,
      firstPassVerificationSuccessCount: 0,
      firstPassSuccessRate: 0,
      defectsIntroduced: 0,
      regressionsIntroduced: 0,
      reopenedTasks: 0,
      testCoverageContribution: 0,
      securityFindingsIntroduced: 0,
      avgVerificationDurationMs: 0,
      unresolvedBlockers: 0,
      documentationCompletenessPct: 0,
      evidenceCompletenessPct: 0,
      speedScore: 0,
      correctnessScore: 0,
      verificationQualityScore: 0,
      regressionRate: 0,
    };
  }

  let tasksIndependentlyVerified = 0;
  let firstPassVerificationSuccessCount = 0;
  let defectsIntroduced = 0;
  let regressionsIntroduced = 0;
  let tasksWithNewRegressions = 0;
  let reopenedTasks = 0;
  let tasksWithTests = 0;
  let securityFindingsIntroduced = 0;
  let totalVerificationDurationMs = 0;
  let unresolvedBlockers = 0;
  let tasksWithDocs = 0;
  let tasksWithCompleteEvidence = 0;
  let matchingDiffCount = 0;

  for (const verification of verifications) {
    if (verification.verifiedBy !== verification.agentReport.agentId) {
      tasksIndependentlyVerified += 1;
    }
    if (verification.computedState === 'VERIFICATION_PASSED') {
      firstPassVerificationSuccessCount += 1;
    }
    if (
      verification.computedState === 'VERIFICATION_FAILED' ||
      verification.computedState === 'BLOCKED'
    ) {
      reopenedTasks += 1;
    }
    if (verification.computedState === 'BLOCKED') {
      unresolvedBlockers += 1;
    }
    if (verification.fileDiffMatches) {
      matchingDiffCount += 1;
    }

    const report = verification.agentReport;
    defectsIntroduced += report.knownDefects.length + report.unresolvedIssues.length;

    const newRegressions = verification.runEvidence.regressions.filter(
      (regression) => !regression.isPreExisting
    );
    regressionsIntroduced += newRegressions.length;
    if (newRegressions.length > 0) {
      tasksWithNewRegressions += 1;
    }

    const failedSecurityChecks = verification.runEvidence.checks.filter(
      (check) =>
        (check.category === 'security' || check.scoringCategory === 'security') &&
        check.status === 'FAILED'
    ).length;
    const newSecurityRegressions = newRegressions.filter(
      (regression) => regression.category === 'security'
    ).length;
    securityFindingsIntroduced += failedSecurityChecks + newSecurityRegressions;

    const hasTestEvidence =
      report.testsCreated.length > 0 ||
      verification.runEvidence.checks.some(
        (check) => check.category === 'testing' && check.status === 'PASSED'
      );
    if (hasTestEvidence) {
      tasksWithTests += 1;
    }

    const hasDocUpdates =
      report.documentationUpdates.length > 0 || report.featuresImplemented.length > 0;
    if (hasDocUpdates) {
      tasksWithDocs += 1;
    }

    const hasCompleteEvidence =
      verification.fileDiffMatches &&
      verification.runEvidence.checks.length > 0 &&
      report.commandResults.length > 0 &&
      isValidEvidenceDigest(verification.runEvidence.evidenceSha256);
    if (hasCompleteEvidence) {
      tasksWithCompleteEvidence += 1;
    }

    const runDurationMs = verification.runEvidence.checks.reduce(
      (sum, check) => sum + check.durationMs,
      0
    );
    totalVerificationDurationMs += runDurationMs;
  }

  const firstPassSuccessRate = clampPct(
    (firstPassVerificationSuccessCount / tasksCompleted) * PERCENT_SCALE
  );
  const testCoverageContribution = clampPct((tasksWithTests / tasksCompleted) * PERCENT_SCALE);
  const avgVerificationDurationMs = roundPct(totalVerificationDurationMs / tasksCompleted);
  const documentationCompletenessPct = clampPct((tasksWithDocs / tasksCompleted) * PERCENT_SCALE);
  const evidenceCompletenessPct = clampPct(
    (tasksWithCompleteEvidence / tasksCompleted) * PERCENT_SCALE
  );
  const diffAccuracyPct = clampPct((matchingDiffCount / tasksCompleted) * PERCENT_SCALE);
  const independentRatioPct = clampPct(
    (tasksIndependentlyVerified / tasksCompleted) * PERCENT_SCALE
  );
  const regressionRate = clampPct((tasksWithNewRegressions / tasksCompleted) * PERCENT_SCALE);

  const speedScore = computeSpeedScore(avgVerificationDurationMs);
  const correctnessScore = clampPct(
    firstPassSuccessRate -
      (defectsIntroduced / tasksCompleted) * DEFECT_PENALTY_POINTS -
      (regressionsIntroduced / tasksCompleted) * REGRESSION_PENALTY_POINTS -
      (securityFindingsIntroduced / tasksCompleted) * SECURITY_PENALTY_POINTS
  );
  const verificationQualityScore = clampPct(
    (evidenceCompletenessPct +
      diffAccuracyPct +
      independentRatioPct +
      documentationCompletenessPct) /
      4
  );

  return {
    agentId,
    agentName,
    tasksCompleted,
    tasksIndependentlyVerified,
    firstPassVerificationSuccessCount,
    firstPassSuccessRate,
    defectsIntroduced,
    regressionsIntroduced,
    reopenedTasks,
    testCoverageContribution,
    securityFindingsIntroduced,
    avgVerificationDurationMs,
    unresolvedBlockers,
    documentationCompletenessPct,
    evidenceCompletenessPct,
    speedScore,
    correctnessScore,
    verificationQualityScore,
    regressionRate,
  };
}
