import { createHash } from 'node:crypto';
import type {
  CheckStatus,
  GateCategory,
  QualityCheckResult,
  QualityRunEvidence,
  ReleaseCertification,
  ReleaseRequirementResult,
  ReleaseStatus,
} from '@repo/contract';

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;
const ZERO_SHA256 = '0'.repeat(64);
const DIGEST_PREVIEW_CHARS = 12;

function canonicalizeJson(inputNode: unknown): string {
  if (inputNode === null || typeof inputNode !== 'object') {
    return JSON.stringify(inputNode);
  }
  if (Array.isArray(inputNode)) {
    return `[${inputNode.map((element) => canonicalizeJson(element)).join(',')}]`;
  }
  const record = inputNode as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`);
  return `{${entries.join(',')}}`;
}

export function computeEvidenceSha256(
  runEvidence: Omit<QualityRunEvidence, 'evidenceSha256'> & {
    readonly evidenceSha256?: string;
  }
): string {
  const { evidenceSha256: _ignored, ...evidencePayload } = runEvidence;
  return createHash('sha256').update(canonicalizeJson(evidencePayload)).digest('hex');
}

export interface EvaluateReleaseCertificationOptions {
  readonly commitSha: string;
  readonly runEvidence: QualityRunEvidence;
  readonly expectedEvidenceSha256?: string | null;
  readonly hasAuthorizedApproval?: boolean;
  readonly approvedBy?: string | null;
  readonly approvedAt?: string | null;
  readonly notes?: string | null;
  readonly certifiedAt?: string;
}

interface CategoryRequirementSpec {
  readonly requirementId: string;
  readonly name: string;
  readonly category: GateCategory;
  readonly failOnOptionalFailure?: boolean;
  readonly predicate?: (check: QualityCheckResult) => boolean;
}

function evaluateCategoryRequirement(
  spec: CategoryRequirementSpec,
  runEvidence: QualityRunEvidence
): ReleaseRequirementResult {
  const predicate =
    spec.predicate ?? ((check: QualityCheckResult) => check.category === spec.category);
  const matchingChecks = runEvidence.checks.filter(predicate);
  const evidenceRef = runEvidence.runId;

  if (matchingChecks.length === 0) {
    return {
      requirementId: spec.requirementId,
      name: spec.name,
      category: spec.category,
      mandatory: true,
      status: 'UNAVAILABLE',
      details: `No verification checks executed for ${spec.category}.`,
      evidenceRef,
    };
  }

  const failingChecks = matchingChecks.filter(
    (check) => check.status === 'FAILED' && (spec.failOnOptionalFailure || check.mandatory)
  );
  if (failingChecks.length > 0) {
    return {
      requirementId: spec.requirementId,
      name: spec.name,
      category: spec.category,
      mandatory: true,
      status: 'FAILED',
      details: `Failed checks: ${failingChecks.map((check) => check.checkId).join(', ')}.`,
      evidenceRef,
    };
  }

  const incompleteMandatory = matchingChecks.filter(
    (check) => check.mandatory && check.status !== 'PASSED'
  );
  if (incompleteMandatory.length > 0) {
    const hasBlockedOrUnavailable = incompleteMandatory.some(
      (check) => check.status === 'BLOCKED' || check.status === 'UNAVAILABLE'
    );
    return {
      requirementId: spec.requirementId,
      name: spec.name,
      category: spec.category,
      mandatory: true,
      status: hasBlockedOrUnavailable ? 'BLOCKED' : 'SKIPPED',
      details: `${hasBlockedOrUnavailable ? 'Blocked/unavailable' : 'Skipped'} mandatory checks: ${incompleteMandatory.map((check) => check.checkId).join(', ')}.`,
      evidenceRef,
    };
  }

  const passedCount = matchingChecks.filter((check) => check.status === 'PASSED').length;
  if (passedCount === 0) {
    return {
      requirementId: spec.requirementId,
      name: spec.name,
      category: spec.category,
      mandatory: true,
      status: 'UNAVAILABLE',
      details: `Zero verified passing checks recorded for ${spec.category}.`,
      evidenceRef,
    };
  }

  return {
    requirementId: spec.requirementId,
    name: spec.name,
    category: spec.category,
    mandatory: true,
    status: 'PASSED',
    details: `${passedCount}/${matchingChecks.length} checks verified.`,
    evidenceRef,
  };
}

function evaluateSecurityRequirement(runEvidence: QualityRunEvidence): ReleaseRequirementResult {
  const baseResult = evaluateCategoryRequirement(
    {
      requirementId: 'security_findings',
      name: 'No unresolved critical security findings',
      category: 'security',
      failOnOptionalFailure: true,
      predicate: (check) => check.category === 'security' || check.scoringCategory === 'security',
    },
    runEvidence
  );

  if (baseResult.status !== 'PASSED') {
    return baseResult;
  }

  const criticalSecurityRegressions = runEvidence.regressions.filter(
    (regression) =>
      !regression.isPreExisting &&
      regression.category === 'security' &&
      (regression.severity === 'CRITICAL' || regression.severity === 'HIGH')
  );

  if (
    runEvidence.score.securityRiskLevel === 'CRITICAL' ||
    criticalSecurityRegressions.length > 0
  ) {
    return {
      requirementId: 'security_findings',
      name: 'No unresolved critical security findings',
      category: 'security',
      mandatory: true,
      status: 'FAILED',
      details: `Security risk level is ${runEvidence.score.securityRiskLevel} with ${criticalSecurityRegressions.length} unresolved critical/high security regressions.`,
      evidenceRef: runEvidence.runId,
    };
  }

  return baseResult;
}

function evaluateRegressionRequirement(runEvidence: QualityRunEvidence): ReleaseRequirementResult {
  const unacceptableRegressions = runEvidence.regressions.filter(
    (regression) =>
      !regression.isPreExisting &&
      (regression.severity === 'CRITICAL' || regression.severity === 'HIGH')
  );

  if (unacceptableRegressions.length > 0) {
    return {
      requirementId: 'regression_clearance',
      name: 'No unacceptable regressions exist',
      category: 'testing',
      mandatory: true,
      status: 'FAILED',
      details: `Detected ${unacceptableRegressions.length} new CRITICAL/HIGH regressions: ${unacceptableRegressions.map((r) => r.id).join(', ')}.`,
      evidenceRef: runEvidence.runId,
    };
  }

  return {
    requirementId: 'regression_clearance',
    name: 'No unacceptable regressions exist',
    category: 'testing',
    mandatory: true,
    status: 'PASSED',
    details: 'Zero unacceptable new regressions detected against baseline.',
    evidenceRef: runEvidence.runId,
  };
}

function verifyEvidenceManifestDigest(runEvidence: QualityRunEvidence): boolean {
  const normalizedProvided = runEvidence.evidenceSha256.trim().toLowerCase();
  if (!SHA256_HEX_REGEX.test(normalizedProvided) || normalizedProvided === ZERO_SHA256) {
    return false;
  }
  if (computeEvidenceSha256(runEvidence) === normalizedProvided) {
    return true;
  }
  const parsedExecutedAt = new Date(runEvidence.executedAt);
  if (Number.isNaN(parsedExecutedAt.getTime())) {
    return false;
  }
  const normalizedTimestampEvidence: QualityRunEvidence = {
    ...runEvidence,
    executedAt: parsedExecutedAt.toISOString(),
  };
  return computeEvidenceSha256(normalizedTimestampEvidence) === normalizedProvided;
}

function evaluateEvidenceRequirement(
  runEvidence: QualityRunEvidence,
  expectedEvidenceSha256?: string | null
): ReleaseRequirementResult {
  const normalizedDigest = runEvidence.evidenceSha256.trim().toLowerCase();
  const hasDigestFormat =
    SHA256_HEX_REGEX.test(normalizedDigest) && normalizedDigest !== ZERO_SHA256;
  const verifiedCount = runEvidence.checks.filter((check) => check.status === 'PASSED').length;

  if (!hasDigestFormat || runEvidence.checks.length === 0 || verifiedCount === 0) {
    return {
      requirementId: 'evidence_availability',
      name: 'Required evidence is available',
      category: 'agent_governance',
      mandatory: true,
      status: 'UNAVAILABLE',
      details: 'Missing valid SHA-256 evidence digest or verified check execution records.',
      evidenceRef: runEvidence.runId,
    };
  }

  if (
    expectedEvidenceSha256 &&
    (!SHA256_HEX_REGEX.test(expectedEvidenceSha256) ||
      expectedEvidenceSha256.trim().toLowerCase() !== normalizedDigest)
  ) {
    return {
      requirementId: 'evidence_availability',
      name: 'Required evidence is available',
      category: 'agent_governance',
      mandatory: true,
      status: 'FAILED',
      details:
        'Provided evidence SHA-256 digest does not match the verification run being certified.',
      evidenceRef: runEvidence.runId,
    };
  }

  if (!verifyEvidenceManifestDigest(runEvidence)) {
    return {
      requirementId: 'evidence_availability',
      name: 'Required evidence is available',
      category: 'agent_governance',
      mandatory: true,
      status: 'FAILED',
      details: `Evidence digest ${normalizedDigest.slice(0, DIGEST_PREVIEW_CHARS)} does not match computed manifest digest.`,
      evidenceRef: runEvidence.runId,
    };
  }

  return {
    requirementId: 'evidence_availability',
    name: 'Required evidence is available',
    category: 'agent_governance',
    mandatory: true,
    status: 'PASSED',
    details: `Evidence digest ${normalizedDigest.slice(0, DIGEST_PREVIEW_CHARS)} verified with ${verifiedCount} passing checks.`,
    evidenceRef: runEvidence.runId,
  };
}

function evaluateApprovalRequirement(
  options: EvaluateReleaseCertificationOptions
): ReleaseRequirementResult {
  const isApproved = Boolean(
    options.hasAuthorizedApproval &&
      options.approvedBy &&
      options.approvedBy.trim().length > 0 &&
      options.approvedAt
  );

  const status: CheckStatus = isApproved ? 'PASSED' : 'SKIPPED';
  return {
    requirementId: 'authorized_approval',
    name: 'Authorized approval is recorded',
    category: 'agent_governance',
    mandatory: true,
    status,
    details: isApproved
      ? `Approved by ${options.approvedBy} at ${options.approvedAt}.`
      : 'Pending authorized human release approval.',
    evidenceRef: options.runEvidence.runId,
  };
}

/**
 * Evaluates all 10 mandatory release certification requirements and determines
 * whether a candidate commit is BLOCKED, READY_FOR_REVIEW, or APPROVED.
 */
export function evaluateReleaseCertification(
  options: EvaluateReleaseCertificationOptions
): ReleaseCertification {
  const { commitSha, runEvidence } = options;
  const certifiedAt = options.certifiedAt ?? new Date().toISOString();

  const technicalRequirements: readonly ReleaseRequirementResult[] = [
    evaluateCategoryRequirement(
      {
        requirementId: 'code_quality_gates',
        name: 'Required code quality gates pass',
        category: 'code_quality',
      },
      runEvidence
    ),
    evaluateCategoryRequirement(
      {
        requirementId: 'required_tests',
        name: 'Required tests pass',
        category: 'testing',
      },
      runEvidence
    ),
    evaluateSecurityRequirement(runEvidence),
    evaluateCategoryRequirement(
      {
        requirementId: 'database_migrations',
        name: 'Database migrations are verified',
        category: 'database',
        predicate: (check) =>
          check.category === 'database' || check.scoringCategory === 'database_integrity',
      },
      runEvidence
    ),
    evaluateCategoryRequirement(
      {
        requirementId: 'architecture_checks',
        name: 'Architecture checks pass',
        category: 'architecture',
      },
      runEvidence
    ),
    evaluateCategoryRequirement(
      {
        requirementId: 'integration_health',
        name: 'Required integrations are healthy',
        category: 'reliability',
        failOnOptionalFailure: true,
      },
      runEvidence
    ),
    evaluateRegressionRequirement(runEvidence),
    evaluateCategoryRequirement(
      {
        requirementId: 'deployment_preflight',
        name: 'Deployment preflight passes',
        category: 'infrastructure',
      },
      runEvidence
    ),
    evaluateEvidenceRequirement(runEvidence, options.expectedEvidenceSha256),
  ];

  const approvalRequirement = evaluateApprovalRequirement(options);
  const requirements = [...technicalRequirements, approvalRequirement];

  const failedTechnical = technicalRequirements.filter(
    (requirement) => requirement.status !== 'PASSED'
  );
  const blockers = failedTechnical.map(
    (requirement) =>
      `${requirement.name} [${requirement.status}]: ${requirement.details ?? 'Requirement not satisfied.'}`
  );

  let status: ReleaseStatus;
  if (failedTechnical.length > 0) {
    status = 'BLOCKED';
  } else if (approvalRequirement.status !== 'PASSED') {
    status = 'READY_FOR_REVIEW';
  } else {
    status = 'APPROVED';
  }

  return {
    commitSha,
    status,
    requirements,
    overallScore: runEvidence.score.overallScore,
    blockers,
    evidenceRunId: runEvidence.runId,
    certifiedAt,
    approvedBy: options.approvedBy ?? null,
    approvedAt: options.approvedAt ?? null,
    notes: options.notes ?? null,
  };
}
