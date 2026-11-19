#!/usr/bin/env node
/**
 * Quality Intelligence CLI Orchestrator for Arch-System.
 *
 * Pure Node 24 ESM implementation with zero external dependencies and zero
 * runtime database/Supabase imports.
 *
 * Subcommands:
 *   run      Execute scoped or full quality verification and persist SHA-256 evidence
 *   changed  Alias for `run --mode changed`
 *   full     Alias for `run --mode full`
 *   agent    Independently verify an agent completion report against real git diffs & checks
 *   report   Render Markdown or JSON report from latest run & agent verifications
 *   compare  Compare two evidence runs and distinguish new vs pre-existing regressions
 *   release  Evaluate 10 mandatory release requirements for exact HEAD SHA (never deploys)
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const DEFAULT_OUTPUT_DIR_REL = '.ci-local/quality-intelligence';

const MAX_LOG_EXCERPT_CHARS = 8000;
const MIN_COMPOSITE_SCORE_FOR_RELEASE = 90;
const SCORE_DROP_REGRESSION_THRESHOLD = 5;
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

export const SCORING_CATEGORY_WEIGHTS = Object.freeze({
  security: 0.2,
  functional_testing: 0.2,
  architecture: 0.15,
  reliability: 0.15,
  performance: 0.1,
  database_integrity: 0.1,
  accessibility_ux: 0.05,
  documentation_governance: 0.05,
});

export const TIER2_SENSITIVE_PREFIXES = Object.freeze([
  'libs/features/auth/',
  'packages/database/migrations/',
  'packages/database/',
  'packages/supabase/',
  'apps/portal/proxy.ts',
  'apps/portal/server/proxy.ts',
  '.github/workflows/',
  'tools/repo/policy-compiler.cjs',
  'infra/',
]);

const ROOT_CONFIG_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'biome.json',
]);

const CRITICAL_SECURITY_CHECK_IDS = new Set([
  'security-policy',
  'supply-chain',
  'auth-matrix',
  'rls-matrix',
  'skill-spector',
]);

const SECRET_REDACTION_PATTERNS = Object.freeze([
  {
    label: 'JWT',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    label: 'SUPABASE_KEY',
    regex: /\b(?:sb_secret|sb_service|sb_anon|sbp)_[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    label: 'POSTGRES_DSN',
    regex: /postgres(?:ql)?:\/\/([^:\s/@]+):([^@\s/]+)@/gi,
    replacer: (_match, user) => `postgresql://${user}:[REDACTED:POSTGRES_DSN]@`,
  },
  {
    label: 'BEARER_TOKEN',
    regex: /(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi,
    replacer: (_match, prefix) => `${prefix}[REDACTED:BEARER_TOKEN]`,
  },
  {
    label: 'GITHUB_TOKEN',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    label: 'AWS_ACCESS_KEY',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    label: 'API_KEY',
    regex: /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    label: 'ENV_SECRET',
    regex:
      /\b([A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|SERVICE_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*(["']?)([^\s"'\n]{6,})\2/gi,
    replacer: (_match, keyName, quote) => `${keyName}=${quote}[REDACTED:ENV_SECRET]${quote}`,
  },
]);

/**
 * Redacts credentials, tokens, JWTs, and database passwords from logs before persistence.
 */
export function redactSecrets(inputText) {
  if (typeof inputText !== 'string' || inputText.length === 0) {
    return '';
  }

  let redacted = inputText;
  for (const rule of SECRET_REDACTION_PATTERNS) {
    if (typeof rule.replacer === 'function') {
      redacted = redacted.replace(rule.regex, rule.replacer);
    } else {
      redacted = redacted.replace(rule.regex, `[REDACTED:${rule.label}]`);
    }
  }
  return redacted;
}

/**
 * Canonicalizes JSON keys recursively for deterministic SHA-256 hashing.
 */
export function canonicalizeJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  const sortedKeys = Object.keys(value).sort();
  const entries = sortedKeys
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

export function computeSha256(content) {
  const serialized = typeof content === 'string' ? content : canonicalizeJson(content);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export function computeEvidenceSha256(evidence) {
  const { evidenceSha256: _ignored, ...rest } = evidence;
  return computeSha256(rest);
}

function readPackageName(packageDir) {
  const pkgPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof parsed.name === 'string' ? parsed.name : null;
  } catch {
    return null;
  }
}

/**
 * Maps changed file paths to workspace packages, directories, and impact flags.
 */
export function discoverAffectedPackages(changedFiles, repoRoot = DEFAULT_REPO_ROOT) {
  const packageNames = new Set();
  const dirs = new Set();
  let touchesRootConfig = false;
  let touchesDatabase = false;
  let touchesWorkflows = false;
  let touchesAuthOrSecurity = false;

  for (const rawPath of changedFiles) {
    const filePath = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!filePath) continue;

    if (ROOT_CONFIG_FILES.has(filePath)) {
      touchesRootConfig = true;
    }
    if (filePath.startsWith('packages/database/') || filePath.includes('/migrations/')) {
      touchesDatabase = true;
    }
    if (filePath.startsWith('.github/workflows/')) {
      touchesWorkflows = true;
    }
    if (TIER2_SENSITIVE_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
      touchesAuthOrSecurity = true;
    }

    const parts = filePath.split('/');
    let matchedDir = null;

    if (parts[0] === 'apps' && parts.length >= 2) {
      matchedDir = `${parts[0]}/${parts[1]}`;
    } else if (parts[0] === 'packages' && parts.length >= 2) {
      matchedDir = `${parts[0]}/${parts[1]}`;
    } else if (parts[0] === 'libs' && parts[1] === 'features' && parts.length >= 4) {
      matchedDir = `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}`;
    } else if (parts[0] === 'libs' && parts[1] === 'shared' && parts.length >= 3) {
      matchedDir = `${parts[0]}/${parts[1]}/${parts[2]}`;
    } else if (parts[0] === 'tools' || parts[0] === 'workers' || parts[0] === 'scripts') {
      matchedDir = parts[0];
    }

    if (matchedDir) {
      dirs.add(matchedDir);
      const pkgName = readPackageName(path.join(repoRoot, matchedDir));
      if (pkgName) {
        packageNames.add(pkgName);
      }
    }
  }

  return {
    packages: Array.from(packageNames).sort(),
    dirs: Array.from(dirs).sort(),
    touchesRootConfig,
    touchesDatabase,
    touchesWorkflows,
    touchesAuthOrSecurity,
  };
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function computeSecurityRiskLevel(checks) {
  const securityChecks = checks.filter(
    (c) => c.scoringCategory === 'security' || c.scoringCategory === 'database_integrity'
  );
  if (securityChecks.length === 0) {
    return 'MEDIUM';
  }

  const hasCriticalFailure = securityChecks.some(
    (c) =>
      (c.status === 'FAILED' || c.status === 'BLOCKED') &&
      CRITICAL_SECURITY_CHECK_IDS.has(c.checkId)
  );
  if (hasCriticalFailure) {
    return 'CRITICAL';
  }

  const hasAnySecurityFailure = securityChecks.some(
    (c) => c.status === 'FAILED' || c.status === 'BLOCKED'
  );
  if (hasAnySecurityFailure) {
    return 'HIGH';
  }

  const hasUnverifiedSecurity = securityChecks.some(
    (c) => c.status === 'SKIPPED' || c.status === 'UNAVAILABLE'
  );
  if (hasUnverifiedSecurity) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function readCodeCoveragePct(repoRoot) {
  if (!repoRoot) return null;
  const summaryPath = path.join(repoRoot, 'apps/portal/coverage/coverage-summary.json');
  if (!fs.existsSync(summaryPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const pct = parsed?.total?.lines?.pct;
    return typeof pct === 'number' && Number.isFinite(pct) ? roundToTwo(pct) : null;
  } catch {
    return null;
  }
}

/**
 * Computes the exact 8-category weighted quality score (20/20/15/15/10/10/5/5 = 100%).
 * Skipped, unavailable, blocked, and failed checks earn 0 points.
 */
export function calculateQualityScore(checks, options = {}) {
  const categoryBuckets = new Map();
  for (const category of Object.keys(SCORING_CATEGORY_WEIGHTS)) {
    categoryBuckets.set(category, {
      verified: 0,
      failed: 0,
      skipped: 0,
      unavailable: 0,
    });
  }

  let mandatoryFailures = 0;
  let mandatoryUnverified = 0;
  let executedCount = 0;

  for (const check of checks) {
    const bucket = categoryBuckets.get(check.scoringCategory);
    if (!bucket) continue;

    if (check.status === 'PASSED') {
      bucket.verified += 1;
      executedCount += 1;
    } else if (check.status === 'FAILED') {
      bucket.failed += 1;
      executedCount += 1;
      if (check.mandatory) mandatoryFailures += 1;
    } else if (check.status === 'BLOCKED') {
      bucket.failed += 1;
      if (check.mandatory) mandatoryFailures += 1;
    } else if (check.status === 'UNAVAILABLE') {
      bucket.unavailable += 1;
      if (check.mandatory) mandatoryUnverified += 1;
    } else {
      bucket.skipped += 1;
      if (check.mandatory) mandatoryUnverified += 1;
    }
  }

  const categoryScores = [];
  let weightedSum = 0;
  let categoriesWithPass = 0;

  for (const [category, weight] of Object.entries(SCORING_CATEGORY_WEIGHTS)) {
    const counts = categoryBuckets.get(category);
    const total = counts.verified + counts.failed + counts.skipped + counts.unavailable;
    const score = total === 0 ? 0 : roundToTwo((counts.verified / total) * 100);
    if (counts.verified > 0 && counts.failed === 0) {
      categoriesWithPass += 1;
    }
    weightedSum += score * weight;
    categoryScores.push({
      category,
      weight,
      score,
      verified: counts.verified,
      failed: counts.failed,
      skipped: counts.skipped,
      unavailable: counts.unavailable,
    });
  }

  const overallScore = roundToTwo(weightedSum);
  const confidencePct = checks.length === 0 ? 0 : roundToTwo((executedCount / checks.length) * 100);
  const measuredCoverage = readCodeCoveragePct(options.repoRoot);
  const coveragePct =
    measuredCoverage !== null
      ? measuredCoverage
      : roundToTwo((categoriesWithPass / Object.keys(SCORING_CATEGORY_WEIGHTS).length) * 100);
  const securityRiskLevel = computeSecurityRiskLevel(checks);
  const releaseBlocked =
    checks.length === 0 ||
    mandatoryFailures > 0 ||
    mandatoryUnverified > 0 ||
    securityRiskLevel === 'CRITICAL' ||
    securityRiskLevel === 'HIGH';

  return {
    overallScore,
    categoryScores,
    confidencePct,
    coveragePct,
    securityRiskLevel,
    mandatoryFailures,
    releaseBlocked,
  };
}

/**
 * Compares current run evidence against a baseline run and classifies new vs pre-existing failures.
 */
export function detectRegressions({ baseline, current, changedFiles = [] }) {
  if (!baseline || !current) {
    return [];
  }

  const baselineMap = new Map((baseline.checks ?? []).map((check) => [check.checkId, check]));
  const affected = discoverAffectedPackages(changedFiles);
  const affectedPkgLabel = affected.packages[0] ?? affected.dirs[0] ?? 'monorepo';
  const findings = [];

  for (const currentCheck of current.checks ?? []) {
    const prevCheck = baselineMap.get(currentCheck.checkId);
    const currentIsFail = currentCheck.status === 'FAILED' || currentCheck.status === 'BLOCKED';
    if (!currentIsFail) continue;

    if (prevCheck && prevCheck.status === 'PASSED') {
      const severity =
        currentCheck.mandatory ||
        currentCheck.scoringCategory === 'security' ||
        currentCheck.scoringCategory === 'database_integrity'
          ? 'CRITICAL'
          : 'HIGH';
      findings.push({
        id: `reg-new-${currentCheck.checkId}`,
        severity,
        category: currentCheck.category,
        affectedPackage: affectedPkgLabel,
        affectedFiles: changedFiles.slice(0, 25),
        previousResult: `${prevCheck.status} (exit ${prevCheck.exitCode ?? 0})`,
        currentResult: `${currentCheck.status} (exit ${currentCheck.exitCode ?? 1})`,
        difference: `Check '${currentCheck.name}' regressed from PASSED to ${currentCheck.status}.`,
        suggestedRemediation: `Run '${currentCheck.command}' locally and fix reported failures.`,
        evidence: currentCheck.evidenceLinks ?? [],
        isPreExisting: false,
      });
    } else if (prevCheck && (prevCheck.status === 'FAILED' || prevCheck.status === 'BLOCKED')) {
      findings.push({
        id: `reg-pre-${currentCheck.checkId}`,
        severity: 'MEDIUM',
        category: currentCheck.category,
        affectedPackage: affectedPkgLabel,
        affectedFiles: changedFiles.slice(0, 25),
        previousResult: `${prevCheck.status} (exit ${prevCheck.exitCode ?? 1})`,
        currentResult: `${currentCheck.status} (exit ${currentCheck.exitCode ?? 1})`,
        difference: `Check '${currentCheck.name}' was already failing in baseline (${prevCheck.status}).`,
        suggestedRemediation: `Track pre-existing failure for '${currentCheck.command}' separately from this change.`,
        evidence: currentCheck.evidenceLinks ?? [],
        isPreExisting: true,
      });
    } else if (!prevCheck) {
      findings.push({
        id: `reg-new-${currentCheck.checkId}`,
        severity: currentCheck.mandatory ? 'HIGH' : 'MEDIUM',
        category: currentCheck.category,
        affectedPackage: affectedPkgLabel,
        affectedFiles: changedFiles.slice(0, 25),
        previousResult: 'NOT_PRESENT',
        currentResult: `${currentCheck.status} (exit ${currentCheck.exitCode ?? 1})`,
        difference: `Newly evaluated check '${currentCheck.name}' returned ${currentCheck.status}.`,
        suggestedRemediation: `Run '${currentCheck.command}' and resolve the failure.`,
        evidence: currentCheck.evidenceLinks ?? [],
        isPreExisting: false,
      });
    }
  }

  const prevScore = baseline.score?.overallScore ?? 0;
  const currScore = current.score?.overallScore ?? 0;
  if (prevScore - currScore >= SCORE_DROP_REGRESSION_THRESHOLD && findings.length === 0) {
    findings.push({
      id: 'reg-score-drop',
      severity: 'HIGH',
      category: 'code_quality',
      affectedPackage: affectedPkgLabel,
      affectedFiles: changedFiles.slice(0, 25),
      previousResult: `overallScore=${prevScore}`,
      currentResult: `overallScore=${currScore}`,
      difference: `Composite quality score dropped by ${roundToTwo(prevScore - currScore)} points.`,
      suggestedRemediation: 'Inspect skipped, unavailable, or degraded checks in current run.',
      evidence: [],
      isPreExisting: false,
    });
  }

  return findings;
}

function normalizePathList(items) {
  if (!Array.isArray(items)) return [];
  const unique = new Set(
    items
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
  );
  return Array.from(unique).sort();
}

/**
 * Independently verifies an agent completion report against real git diffs and gate execution.
 * Refuses self-verification and computes the 8-state completion machine.
 */
export function verifyAgentReport({
  agentReport,
  actualChangedFiles,
  runEvidence,
  verifierId = 'quality-orchestrator-cli',
  verifiedAt = new Date().toISOString(),
  verificationId = crypto.randomUUID(),
}) {
  const findings = [];
  let hasHardFailure = false;
  let hasBlocker = false;

  if (!agentReport || typeof agentReport !== 'object') {
    hasHardFailure = true;
    findings.push('Agent completion report is missing or invalid JSON.');
  }

  const requiredStringFields = [
    'agentId',
    'agentName',
    'taskId',
    'taskDescription',
    'startingCommitSha',
    'endingCommitSha',
    'state',
    'submittedAt',
  ];

  for (const field of requiredStringFields) {
    if (
      !agentReport ||
      typeof agentReport[field] !== 'string' ||
      agentReport[field].trim().length === 0
    ) {
      hasHardFailure = true;
      findings.push(`Missing required agent report field: ${field}`);
    }
  }

  const normalizedVerifier = String(verifierId || '').trim();
  if (
    !normalizedVerifier ||
    normalizedVerifier === agentReport?.agentId ||
    normalizedVerifier === agentReport?.agentName
  ) {
    hasHardFailure = true;
    findings.push(
      `Self-verification refused: verifier '${normalizedVerifier}' cannot match agentId/agentName.`
    );
  }

  if (agentReport?.state === 'VERIFICATION_PASSED') {
    hasHardFailure = true;
    findings.push(
      'Self-attestation refused: agent report cannot pre-declare state VERIFICATION_PASSED.'
    );
  }

  const declaredFiles = normalizePathList([
    ...(agentReport?.filesCreated ?? []),
    ...(agentReport?.filesModified ?? []),
    ...(agentReport?.filesDeleted ?? []),
  ]);
  const actualFiles = normalizePathList(actualChangedFiles);

  const declaredSet = new Set(declaredFiles);
  const actualSet = new Set(actualFiles);

  const undeclaredFiles = actualFiles.filter((file) => !declaredSet.has(file));
  const missingDeclaredFiles = declaredFiles.filter((file) => !actualSet.has(file));
  const fileDiffMatches = undeclaredFiles.length === 0 && missingDeclaredFiles.length === 0;

  if (undeclaredFiles.length > 0) {
    hasHardFailure = true;
    findings.push(
      `Undeclared files modified in git diff (${undeclaredFiles.length}): ${undeclaredFiles.join(', ')}`
    );
  }
  if (missingDeclaredFiles.length > 0) {
    hasHardFailure = true;
    findings.push(
      `Declared files absent from git diff (${missingDeclaredFiles.length}): ${missingDeclaredFiles.join(', ')}`
    );
  }

  const checks = runEvidence?.checks ?? [];
  if (checks.length === 0) {
    hasBlocker = true;
    findings.push('No verification checks were executed.');
  }

  const failedChecks = checks.filter((c) => c.status === 'FAILED');
  const blockedOrUnavailable = checks.filter(
    (c) => c.status === 'BLOCKED' || c.status === 'UNAVAILABLE'
  );
  const skippedMandatory = checks.filter((c) => c.mandatory && c.status === 'SKIPPED');

  if (failedChecks.length > 0) {
    hasHardFailure = true;
    findings.push(`Verification checks failed: ${failedChecks.map((c) => c.checkId).join(', ')}`);
  }
  if (blockedOrUnavailable.length > 0) {
    hasBlocker = true;
    findings.push(
      `Verification checks blocked or unavailable: ${blockedOrUnavailable.map((c) => c.checkId).join(', ')}`
    );
  }
  if (skippedMandatory.length > 0) {
    hasBlocker = true;
    findings.push(
      `Mandatory verification checks were skipped: ${skippedMandatory.map((c) => c.checkId).join(', ')}`
    );
  }

  const newCriticalRegressions = (runEvidence?.regressions ?? []).filter(
    (r) => !r.isPreExisting && (r.severity === 'CRITICAL' || r.severity === 'HIGH')
  );
  if (newCriticalRegressions.length > 0) {
    hasHardFailure = true;
    findings.push(
      `New regressions detected: ${newCriticalRegressions.map((r) => r.id).join(', ')}`
    );
  }

  const touchesTier2 = actualFiles.some((file) =>
    TIER2_SENSITIVE_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
  const hasKnownIssues =
    (agentReport?.knownDefects?.length ?? 0) > 0 ||
    (agentReport?.unresolvedIssues?.length ?? 0) > 0;

  let computedState = 'VERIFICATION_PASSED';
  if (hasHardFailure) {
    computedState = 'VERIFICATION_FAILED';
  } else if (hasBlocker) {
    computedState = 'BLOCKED';
  } else if (touchesTier2 || hasKnownIssues) {
    computedState = 'REQUIRES_HUMAN_APPROVAL';
    if (touchesTier2) {
      findings.push('Changes touch Tier 2 sensitive paths requiring explicit human approval.');
    }
    if (hasKnownIssues) {
      findings.push('Agent report lists known defects or unresolved issues requiring review.');
    }
  }

  return {
    verificationId,
    agentReport,
    actualChangedFiles: actualFiles,
    undeclaredFiles,
    missingDeclaredFiles,
    fileDiffMatches,
    computedState,
    runEvidence,
    verifiedBy: normalizedVerifier || 'quality-orchestrator-cli',
    verifiedAt,
    findings,
  };
}

function evaluateCategoryChecks(checks, matcher) {
  const matched = checks.filter(matcher);
  if (matched.length === 0) {
    return { status: 'UNAVAILABLE', details: 'No matching checks executed in this run.' };
  }
  const failed = matched.filter((c) => c.status === 'FAILED');
  if (failed.length > 0) {
    return {
      status: 'FAILED',
      details: `Failed checks: ${failed.map((c) => c.checkId).join(', ')}`,
    };
  }
  const blocked = matched.filter((c) => c.status === 'BLOCKED' || c.status === 'UNAVAILABLE');
  if (blocked.length > 0) {
    return {
      status: 'BLOCKED',
      details: `Blocked/unavailable checks: ${blocked.map((c) => c.checkId).join(', ')}`,
    };
  }
  const skipped = matched.filter((c) => c.status === 'SKIPPED');
  if (skipped.length > 0) {
    return {
      status: 'SKIPPED',
      details: `Skipped checks: ${skipped.map((c) => c.checkId).join(', ')}`,
    };
  }
  return {
    status: 'PASSED',
    details: `${matched.length} check(s) passed.`,
  };
}

function shaMatches(runSha, headSha) {
  if (!runSha || !headSha) return false;
  const a = runSha.toLowerCase();
  const b = headSha.toLowerCase();
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function parseVerificationTimestampMs(verification) {
  const candidates = [
    verification?.verifiedAt,
    verification?.runEvidence?.executedAt,
    verification?.agentReport?.submittedAt,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const parsedMs = Date.parse(candidate);
      if (!Number.isNaN(parsedMs)) {
        return parsedMs;
      }
    }
  }
  return 0;
}

/**
 * Selects the newest agent verification matching a commit by parsed timestamp
 * rather than arbitrary filesystem or UUID ordering.
 */
export function selectLatestAgentVerificationForCommit(agentVerifications, headSha) {
  const matching = (agentVerifications ?? []).filter((verification) =>
    shaMatches(
      verification?.runEvidence?.commitSha ?? verification?.agentReport?.endingCommitSha,
      headSha
    )
  );
  if (matching.length === 0) {
    return null;
  }
  const ordered = matching
    .map((verification, index) => ({
      verification,
      index,
      timestampMs: parseVerificationTimestampMs(verification),
    }))
    .sort((a, b) => {
      if (b.timestampMs !== a.timestampMs) {
        return b.timestampMs - a.timestampMs;
      }
      return b.index - a.index;
    });
  return ordered[0].verification;
}

/**
 * Evaluates all 10 mandatory release requirements for an exact HEAD commit SHA.
 */
export function evaluateReleaseCertificate({
  currentRun,
  headSha,
  baselineRun = null,
  agentVerifications = [],
  approvedBy = null,
  notes = null,
  certifiedAt = new Date().toISOString(),
}) {
  const checks = currentRun?.checks ?? [];
  const score = currentRun?.score ?? calculateQualityScore(checks);
  const evidenceRunId = currentRun?.runId ?? '00000000-0000-4000-8000-000000000000';
  const evidenceRef = currentRun ? `run:${currentRun.runId}` : 'none';

  const req1Status = !currentRun
    ? 'UNAVAILABLE'
    : score.mandatoryFailures > 0
      ? 'FAILED'
      : score.releaseBlocked || score.overallScore < MIN_COMPOSITE_SCORE_FOR_RELEASE
        ? 'FAILED'
        : 'PASSED';

  const req2Status = !currentRun
    ? 'UNAVAILABLE'
    : shaMatches(currentRun.commitSha, headSha)
      ? 'PASSED'
      : 'FAILED';

  const buildCheck = evaluateCategoryChecks(
    checks,
    (c) =>
      c.checkId === 'type-check' ||
      c.checkId === 'affected-type-check' ||
      c.checkId === 'portal-build' ||
      c.checkId === 'vercel-preflight'
  );

  const testCheck = evaluateCategoryChecks(
    checks,
    (c) => c.scoringCategory === 'functional_testing'
  );

  const secCheck = evaluateCategoryChecks(checks, (c) => c.scoringCategory === 'security');
  const securityReqStatus =
    secCheck.status === 'PASSED' &&
    (score.securityRiskLevel === 'CRITICAL' || score.securityRiskLevel === 'HIGH')
      ? 'FAILED'
      : secCheck.status;

  const dbCheck = evaluateCategoryChecks(checks, (c) => c.scoringCategory === 'database_integrity');

  const computedRegressions =
    currentRun && baselineRun
      ? detectRegressions({ baseline: baselineRun, current: currentRun })
      : (currentRun?.regressions ?? []);
  const blockingRegressions = computedRegressions.filter(
    (r) => !r.isPreExisting && (r.severity === 'CRITICAL' || r.severity === 'HIGH')
  );
  const regressionStatus = !currentRun
    ? 'UNAVAILABLE'
    : blockingRegressions.length > 0
      ? 'FAILED'
      : 'PASSED';

  const perfUxCheck = evaluateCategoryChecks(
    checks,
    (c) => c.scoringCategory === 'performance' || c.scoringCategory === 'accessibility_ux'
  );

  const expectedDigest = currentRun ? computeEvidenceSha256(currentRun) : null;
  const evidenceIntegrityStatus = !currentRun
    ? 'UNAVAILABLE'
    : typeof currentRun.evidenceSha256 === 'string' && currentRun.evidenceSha256 === expectedDigest
      ? 'PASSED'
      : 'FAILED';

  const latestVerification = selectLatestAgentVerificationForCommit(agentVerifications, headSha);

  let agentApprovalStatus = 'PASSED';
  let agentApprovalDetails = 'No unverified agent work attached; awaiting or holding human review.';
  if (latestVerification) {
    if (latestVerification.computedState === 'VERIFICATION_PASSED') {
      agentApprovalStatus = 'PASSED';
      agentApprovalDetails = `Independent verification passed (${latestVerification.verificationId}).`;
    } else if (latestVerification.computedState === 'REQUIRES_HUMAN_APPROVAL') {
      agentApprovalStatus = approvedBy ? 'PASSED' : 'BLOCKED';
      agentApprovalDetails = approvedBy
        ? `Human approval recorded by ${approvedBy} for Tier 2 / flagged agent verification.`
        : 'Agent verification requires explicit --approved-by human approval.';
    } else {
      agentApprovalStatus = 'FAILED';
      agentApprovalDetails = `Agent verification state is ${latestVerification.computedState}.`;
    }
  } else if (currentRun?.agentId) {
    agentApprovalStatus = 'FAILED';
    agentApprovalDetails = `Run references agentId '${currentRun.agentId}' without an independent agent verification record.`;
  }

  const requirements = [
    {
      requirementId: '1_composite_score_floor',
      name: 'Composite Quality Score >= 90 & Zero Mandatory Failures',
      category: 'code_quality',
      mandatory: true,
      status: req1Status,
      details: `overallScore=${score.overallScore}, mandatoryFailures=${score.mandatoryFailures}, releaseBlocked=${score.releaseBlocked}`,
      evidenceRef,
    },
    {
      requirementId: '2_commit_sha_parity',
      name: 'Evidence Commit SHA Matches Exact HEAD',
      category: 'architecture',
      mandatory: true,
      status: req2Status,
      details: currentRun
        ? `runSha=${currentRun.commitSha}, headSha=${headSha}`
        : 'No quality run found for HEAD.',
      evidenceRef,
    },
    {
      requirementId: '3_build_and_type_safety',
      name: 'Clean Type Safety, Build & Infrastructure Preflight',
      category: 'infrastructure',
      mandatory: true,
      status: buildCheck.status,
      details: buildCheck.details,
      evidenceRef,
    },
    {
      requirementId: '4_tests_and_eval_execution',
      name: 'Functional & Unit Test Suites Passed Without Stubs',
      category: 'testing',
      mandatory: true,
      status: testCheck.status,
      details: testCheck.details,
      evidenceRef,
    },
    {
      requirementId: '5_security_and_rbac_parity',
      name: 'Security, Supply Chain & Authorization Matrix Passed',
      category: 'security',
      mandatory: true,
      status: securityReqStatus,
      details: `${secCheck.details} (securityRiskLevel=${score.securityRiskLevel})`,
      evidenceRef,
    },
    {
      requirementId: '6_database_and_rls_integrity',
      name: 'Database Migration Drift, Lint & RLS Matrix Integrity',
      category: 'database',
      mandatory: true,
      status: dbCheck.status,
      details: dbCheck.details,
      evidenceRef,
    },
    {
      requirementId: '7_regression_clearance',
      name: 'Zero New Critical or High Regressions vs Baseline',
      category: 'reliability',
      mandatory: true,
      status: regressionStatus,
      details: `${blockingRegressions.length} blocking new regression(s).`,
      evidenceRef,
    },
    {
      requirementId: '8_behavioral_and_performance_budgets',
      name: 'Performance Budgets, Design Tokens & Accessibility Passed',
      category: 'performance',
      mandatory: true,
      status: perfUxCheck.status,
      details: perfUxCheck.details,
      evidenceRef,
    },
    {
      requirementId: '9_append_only_evidence_integrity',
      name: 'SHA-256 Evidence Manifest Digest Verified',
      category: 'reliability',
      mandatory: true,
      status: evidenceIntegrityStatus,
      details:
        evidenceIntegrityStatus === 'PASSED'
          ? `Verified SHA-256 ${currentRun.evidenceSha256}`
          : 'Evidence SHA-256 missing or mismatched.',
      evidenceRef,
    },
    {
      requirementId: '10_agent_verification_and_approval',
      name: 'Independent Agent Verification & Human Sign-Off',
      category: 'agent_governance',
      mandatory: true,
      status: agentApprovalStatus,
      details: agentApprovalDetails,
      evidenceRef,
    },
  ];

  const blockers = requirements
    .filter((req) => req.status !== 'PASSED')
    .map((req) => `[${req.status}] ${req.name}: ${req.details ?? ''}`);

  const hasHardFailOrTamper = requirements.some(
    (req) =>
      req.status === 'FAILED' ||
      (req.requirementId === '10_agent_verification_and_approval' && req.status === 'BLOCKED')
  );
  const hasIncompleteExecution = requirements.some(
    (req) => req.status === 'UNAVAILABLE' || req.status === 'SKIPPED' || req.status === 'BLOCKED'
  );

  let status = 'NOT_READY';
  if (hasHardFailOrTamper) {
    // Commit SHA mismatch with otherwise unexecuted/stale run is NOT_READY unless evidence is tampered
    if (
      req2Status === 'FAILED' &&
      evidenceIntegrityStatus === 'PASSED' &&
      blockingRegressions.length === 0 &&
      score.mandatoryFailures === 0
    ) {
      status = 'NOT_READY';
    } else {
      status = 'BLOCKED';
    }
  } else if (hasIncompleteExecution) {
    status = currentRun ? 'BLOCKED' : 'NOT_READY';
    if (
      checks.some((c) => c.status === 'SKIPPED' || c.status === 'UNAVAILABLE') &&
      score.mandatoryFailures === 0
    ) {
      status = 'NOT_READY';
    }
  } else {
    status = approvedBy ? 'APPROVED' : 'READY_FOR_REVIEW';
  }

  return {
    commitSha: headSha,
    status,
    requirements,
    overallScore: score.overallScore,
    blockers,
    evidenceRunId,
    certifiedAt,
    approvedBy: approvedBy ?? null,
    approvedAt: approvedBy && status === 'APPROVED' ? certifiedAt : null,
    notes: notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Git & Command Execution Helpers
// ---------------------------------------------------------------------------

function runGit(args, repoRoot) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, HUSKY: '0' },
    maxBuffer: 16 * 1024 * 1024,
  });
}

function getHeadSha(repoRoot) {
  const res = runGit(['rev-parse', 'HEAD'], repoRoot);
  return res.status === 0 ? res.stdout.trim() : '0000000000000000000000000000000000000000';
}

function getParentSha(repoRoot) {
  const res = runGit(['rev-parse', 'HEAD~1'], repoRoot);
  return res.status === 0 ? res.stdout.trim() : null;
}

function getBranchName(repoRoot) {
  const envBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
  if (envBranch) return envBranch;
  const res = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  return res.status === 0 ? res.stdout.trim() : 'unknown';
}

function getChangedFiles(repoRoot, baseRef = 'main') {
  const files = new Set();

  const mergeBaseRes = runGit(['merge-base', baseRef, 'HEAD'], repoRoot);
  const diffBase =
    mergeBaseRes.status === 0
      ? mergeBaseRes.stdout.trim()
      : runGit(['rev-parse', '--verify', baseRef], repoRoot).status === 0
        ? baseRef
        : 'HEAD~1';

  const branchDiff = runGit(['diff', '--name-only', `${diffBase}...HEAD`], repoRoot);
  if (branchDiff.status === 0) {
    for (const line of branchDiff.stdout.split('\n')) {
      if (line.trim()) files.add(line.trim());
    }
  }

  for (const args of [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    const res = runGit(args, repoRoot);
    if (res.status === 0) {
      for (const line of res.stdout.split('\n')) {
        if (line.trim()) files.add(line.trim());
      }
    }
  }

  return Array.from(files).sort();
}

function getDiffBetweenCommits(repoRoot, startSha, endSha) {
  const startValid =
    runGit(['rev-parse', '--verify', `${startSha}^{commit}`], repoRoot).status === 0;
  const endValid = runGit(['rev-parse', '--verify', `${endSha}^{commit}`], repoRoot).status === 0;
  if (!startValid || !endValid) {
    return null;
  }

  const files = new Set();
  const committed = runGit(['diff', '--name-only', `${startSha}..${endSha}`], repoRoot);
  if (committed.status === 0) {
    for (const line of committed.stdout.split('\n')) {
      if (line.trim()) files.add(line.trim());
    }
  }

  const headSha = getHeadSha(repoRoot);
  if (shaMatches(endSha, headSha)) {
    for (const args of [
      ['diff', '--name-only'],
      ['diff', '--cached', '--name-only'],
      ['ls-files', '--others', '--exclude-standard'],
    ]) {
      const res = runGit(args, repoRoot);
      if (res.status === 0) {
        for (const line of res.stdout.split('\n')) {
          if (line.trim()) files.add(line.trim());
        }
      }
    }
  }

  return Array.from(files).sort();
}

function commandExists(binary) {
  return spawnSync('which', [binary], { stdio: 'ignore' }).status === 0;
}

function executeCheckDefinition(def, { repoRoot, dryRun, evidenceDirRel }) {
  if (dryRun) {
    return {
      checkId: def.checkId,
      name: def.name,
      category: def.category,
      scoringCategory: def.scoringCategory,
      owner: 'repo',
      command: def.commandDisplay,
      mandatory: def.mandatory,
      status: 'SKIPPED',
      exitCode: null,
      durationMs: 0,
      skipReason: 'Dry-run mode (--dry-run): command planned but not executed.',
      logExcerpt: null,
      evidenceLinks: [evidenceDirRel],
    };
  }

  if (typeof def.precondition === 'function') {
    const blockedReason = def.precondition(repoRoot);
    if (blockedReason) {
      return {
        checkId: def.checkId,
        name: def.name,
        category: def.category,
        scoringCategory: def.scoringCategory,
        owner: 'repo',
        command: def.commandDisplay,
        mandatory: def.mandatory,
        status: 'UNAVAILABLE',
        exitCode: null,
        durationMs: 0,
        skipReason: blockedReason,
        logExcerpt: null,
        evidenceLinks: [evidenceDirRel],
      };
    }
  }

  if (!commandExists(def.bin)) {
    return {
      checkId: def.checkId,
      name: def.name,
      category: def.category,
      scoringCategory: def.scoringCategory,
      owner: 'repo',
      command: def.commandDisplay,
      mandatory: def.mandatory,
      status: 'UNAVAILABLE',
      exitCode: null,
      durationMs: 0,
      skipReason: `Required executable '${def.bin}' not available on PATH.`,
      logExcerpt: null,
      evidenceLinks: [evidenceDirRel],
    };
  }

  const startedAt = Date.now();
  const res = spawnSync(def.bin, def.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      CI: process.env.CI ?? 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  const durationMs = Math.max(0, Date.now() - startedAt);
  const rawOutput = `${res.stdout ?? ''}\n${res.stderr ?? ''}`.trim();
  const redacted = redactSecrets(rawOutput);
  const excerpt =
    redacted.length > MAX_LOG_EXCERPT_CHARS
      ? redacted.slice(redacted.length - MAX_LOG_EXCERPT_CHARS)
      : redacted;

  const timedOut = res.error?.code === 'ETIMEDOUT';
  const status = timedOut ? 'BLOCKED' : res.status === 0 ? 'PASSED' : 'FAILED';

  return {
    checkId: def.checkId,
    name: def.name,
    category: def.category,
    scoringCategory: def.scoringCategory,
    owner: 'repo',
    command: def.commandDisplay,
    mandatory: def.mandatory,
    status,
    exitCode: typeof res.status === 'number' ? res.status : 1,
    durationMs,
    skipReason: timedOut ? `Timed out after ${COMMAND_TIMEOUT_MS}ms` : null,
    logExcerpt: excerpt || null,
    evidenceLinks: [evidenceDirRel],
  };
}

function buildCheckPlan({ mode, affected, changedFiles, baseRef, repoRoot }) {
  const isFull = mode === 'full' || mode === 'release';
  const changedSourceFiles = changedFiles.filter(
    (f) => /\.(js|mjs|cjs|ts|tsx|jsx|json)$/.test(f) && fs.existsSync(path.join(repoRoot, f))
  );

  const plan = [
    {
      checkId: 'security-policy',
      name: 'Security Policy Checks',
      category: 'security',
      scoringCategory: 'security',
      bin: 'pnpm',
      args: ['policy:security', '--ci'],
      commandDisplay: 'pnpm policy:security --ci',
      mandatory: true,
    },
    {
      checkId: 'supply-chain',
      name: 'Supply-Chain & Secret Audit',
      category: 'security',
      scoringCategory: 'security',
      bin: 'pnpm',
      args: ['audit:supply-chain'],
      commandDisplay: 'pnpm audit:supply-chain',
      mandatory: true,
    },
    {
      checkId: 'auth-matrix',
      name: 'Authorization Matrix Audit',
      category: 'security',
      scoringCategory: 'security',
      bin: 'node',
      args: ['tools/audits/audit-authorization-matrix.cjs', '--static-only'],
      commandDisplay: 'node tools/audits/audit-authorization-matrix.cjs --static-only',
      mandatory: true,
    },
    {
      checkId: 'skill-spector',
      name: 'Agent Skill Security (SkillSpector)',
      category: 'agent_governance',
      scoringCategory: 'security',
      bin: 'bash',
      args: ['tools/audits/skill-spector.sh'],
      commandDisplay: 'bash tools/audits/skill-spector.sh',
      mandatory: true,
    },
    {
      checkId: 'policy-check',
      name: 'Architectural Boundary Policy',
      category: 'architecture',
      scoringCategory: 'architecture',
      bin: 'pnpm',
      args: ['policy:check'],
      commandDisplay: 'pnpm policy:check',
      mandatory: true,
    },
    {
      checkId: 'cycles',
      name: 'Circular Dependency Check',
      category: 'architecture',
      scoringCategory: 'architecture',
      bin: 'pnpm',
      args: ['cycles'],
      commandDisplay: 'pnpm cycles',
      mandatory: true,
    },
    {
      checkId: 'contract-drift',
      name: 'Contract-to-DB Drift Audit',
      category: 'architecture',
      scoringCategory: 'architecture',
      bin: 'pnpm',
      args: ['audit:drift'],
      commandDisplay: 'pnpm audit:drift',
      mandatory: true,
    },
    {
      checkId: 'lint-biome',
      name: isFull ? 'Workspace Biome Lint CI' : 'Changed-Files Biome Check',
      category: 'code_quality',
      scoringCategory: 'architecture',
      bin: 'pnpm',
      args:
        isFull || changedSourceFiles.length === 0 || affected.touchesRootConfig
          ? ['turbo', 'run', '//#lint:ci']
          : ['biome', 'check', ...changedSourceFiles],
      commandDisplay:
        isFull || changedSourceFiles.length === 0 || affected.touchesRootConfig
          ? 'pnpm turbo run //#lint:ci'
          : `pnpm biome check ${changedSourceFiles.join(' ')}`,
      mandatory: true,
    },
    {
      checkId: 'type-check',
      name: isFull ? 'Workspace Type Check' : 'Affected Type Check',
      category: 'code_quality',
      scoringCategory: 'architecture',
      bin: 'pnpm',
      args:
        isFull || affected.touchesRootConfig || affected.packages.length === 0
          ? ['type-check']
          : ['turbo', 'run', 'type-check', ...affected.packages.map((pkg) => `--filter=${pkg}`)],
      commandDisplay:
        isFull || affected.touchesRootConfig || affected.packages.length === 0
          ? 'pnpm type-check'
          : `pnpm turbo run type-check ${affected.packages.map((p) => `--filter=${p}`).join(' ')}`,
      mandatory: true,
    },
  ];

  if (!isFull && affected.packages.length > 0 && !affected.touchesRootConfig) {
    plan.push({
      checkId: 'affected-tests',
      name: 'Affected Package Tests',
      category: 'testing',
      scoringCategory: 'functional_testing',
      bin: 'pnpm',
      args: [
        'turbo',
        'run',
        'test',
        ...affected.packages.map((pkg) => `--filter=${pkg}`),
        '--',
        '--passWithNoTests',
      ],
      commandDisplay: `pnpm turbo run test ${affected.packages.map((p) => `--filter=${p}`).join(' ')} -- --passWithNoTests`,
      mandatory: true,
    });
  } else if (!isFull && changedFiles.includes('tools/scripts/quality-orchestrator.mjs')) {
    plan.push({
      checkId: 'orchestrator-tests',
      name: 'Quality Orchestrator Unit Tests',
      category: 'testing',
      scoringCategory: 'functional_testing',
      bin: 'node',
      args: ['--test', 'tools/scripts/quality-orchestrator.test.mjs'],
      commandDisplay: 'node --test tools/scripts/quality-orchestrator.test.mjs',
      mandatory: true,
    });
  } else {
    plan.push({
      checkId: 'unit-tests',
      name: 'Workspace Unit Tests',
      category: 'testing',
      scoringCategory: 'functional_testing',
      bin: 'pnpm',
      args: ['test'],
      commandDisplay: 'pnpm test',
      mandatory: true,
    });
  }

  plan.push(
    {
      checkId: 'migration-drift',
      name: 'Database Migration Drift & Rollback Check',
      category: 'database',
      scoringCategory: 'database_integrity',
      bin: 'pnpm',
      args: ['--filter', '@repo/database', 'check-migrations'],
      commandDisplay: 'pnpm --filter @repo/database check-migrations',
      mandatory: true,
    },
    {
      checkId: 'migration-lint',
      name: 'Database Migration RLS Lint',
      category: 'database',
      scoringCategory: 'database_integrity',
      bin: 'node',
      args: ['packages/database/scripts/lint-migrations.mjs', '--all', '--no-squawk'],
      commandDisplay: 'node packages/database/scripts/lint-migrations.mjs --all --no-squawk',
      mandatory: true,
    },
    {
      checkId: 'rls-matrix',
      name: 'Database RLS Matrix Audit',
      category: 'database',
      scoringCategory: 'database_integrity',
      bin: 'pnpm',
      args: ['audit:rls-matrix'],
      commandDisplay: 'pnpm audit:rls-matrix',
      mandatory: true,
    },
    {
      checkId: 'database-tests',
      name: 'Database Security & RLS Test Suite',
      category: 'database',
      scoringCategory: 'database_integrity',
      bin: 'pnpm',
      args: ['--filter', '@repo/database', 'test'],
      commandDisplay: 'pnpm --filter @repo/database test',
      mandatory: true,
    },
    {
      checkId: 'hooks-and-clients',
      name: 'Client Hooks & SSR Safety Audit',
      category: 'reliability',
      scoringCategory: 'reliability',
      bin: 'pnpm',
      args: ['audit:hooks'],
      commandDisplay: 'pnpm audit:hooks',
      mandatory: true,
    },
    {
      checkId: 'vercel-preflight',
      name: 'Vercel Monorepo Preflight',
      category: 'infrastructure',
      scoringCategory: 'reliability',
      bin: 'node',
      args: ['tools/scripts/vercel-preflight.cjs'],
      commandDisplay: 'node tools/scripts/vercel-preflight.cjs',
      mandatory: isFull,
    },
    {
      checkId: 'css-performance',
      name: 'CSS Performance Budget',
      category: 'performance',
      scoringCategory: 'performance',
      bin: 'pnpm',
      args: ['lint:css-perf'],
      commandDisplay: 'pnpm lint:css-perf',
      mandatory: true,
    },
    {
      checkId: 'design-tokens',
      name: 'OKLCH Light-Mode Design Tokens Audit',
      category: 'ui_ux',
      scoringCategory: 'accessibility_ux',
      bin: 'pnpm',
      args: ['audit:tokens'],
      commandDisplay: 'pnpm audit:tokens',
      mandatory: true,
    },
    {
      checkId: 'tailwind-usage',
      name: 'Tailwind Utility Composition Audit',
      category: 'ui_ux',
      scoringCategory: 'accessibility_ux',
      bin: 'pnpm',
      args: ['audit:tailwind'],
      commandDisplay: 'pnpm audit:tailwind',
      mandatory: true,
    },
    {
      checkId: 'html-meta-check',
      name: 'HTML Meta Tags Check',
      category: 'ui_ux',
      scoringCategory: 'accessibility_ux',
      bin: 'pnpm',
      args: ['html:check'],
      commandDisplay: 'pnpm html:check',
      mandatory: true,
    },
    {
      checkId: 'validate-json',
      name: 'Workspace JSON/JSONC Validation',
      category: 'code_quality',
      scoringCategory: 'documentation_governance',
      bin: 'node',
      args: ['tools/scripts/validate-json.mjs'],
      commandDisplay: 'node tools/scripts/validate-json.mjs',
      mandatory: true,
    },
    {
      checkId: 'agentic-content',
      name: 'Agent Governance & SSOT Audit',
      category: 'agent_governance',
      scoringCategory: 'documentation_governance',
      bin: 'node',
      args: ['tools/audits/audit-agentic-content.cjs', '--check'],
      commandDisplay: 'node tools/audits/audit-agentic-content.cjs --check',
      mandatory: true,
    }
  );

  if (isFull) {
    plan.push(
      {
        checkId: 'portal-build',
        name: 'Next.js Portal Production Build',
        category: 'infrastructure',
        scoringCategory: 'architecture',
        bin: 'pnpm',
        args: ['--filter', 'portal', 'build'],
        commandDisplay: 'pnpm --filter portal build',
        mandatory: mode === 'release',
      },
      {
        checkId: 'deps-lint',
        name: 'Workspace Dependency Syncpack Lint',
        category: 'architecture',
        scoringCategory: 'architecture',
        bin: 'pnpm',
        args: ['deps:lint'],
        commandDisplay: 'pnpm deps:lint',
        mandatory: true,
      },
      {
        checkId: 'knip',
        name: 'Dead Code & Unused Exports (Knip)',
        category: 'code_quality',
        scoringCategory: 'architecture',
        bin: 'pnpm',
        args: ['knip'],
        commandDisplay: 'pnpm knip',
        mandatory: false,
      },
      {
        checkId: 'observability-resilience',
        name: 'Observability & Resilience Audit',
        category: 'reliability',
        scoringCategory: 'reliability',
        bin: 'pnpm',
        args: ['audit:resilience'],
        commandDisplay: 'pnpm audit:resilience',
        mandatory: false,
      },
      {
        checkId: 'perf-budgets',
        name: 'Performance Budgets Audit',
        category: 'performance',
        scoringCategory: 'performance',
        bin: 'pnpm',
        args: ['audit:perf-budgets'],
        commandDisplay: 'pnpm audit:perf-budgets',
        mandatory: false,
      },
      {
        checkId: 'bundle-size',
        name: 'Portal Bundle Size Check',
        category: 'performance',
        scoringCategory: 'performance',
        bin: 'pnpm',
        args: ['bundlesize'],
        commandDisplay: 'pnpm bundlesize',
        mandatory: false,
        precondition: (root) =>
          fs.existsSync(path.join(root, 'apps/portal/.next'))
            ? null
            : 'apps/portal/.next build output is not present; run portal build first.',
      },
      {
        checkId: 'e2e-journeys',
        name: 'E2E Journey Coverage Audit',
        category: 'testing',
        scoringCategory: 'functional_testing',
        bin: 'pnpm',
        args: ['audit:e2e-journeys'],
        commandDisplay: 'pnpm audit:e2e-journeys',
        mandatory: false,
      },
      {
        checkId: 'lint-styles',
        name: 'Stylelint CSS Token Check',
        category: 'ui_ux',
        scoringCategory: 'accessibility_ux',
        bin: 'pnpm',
        args: ['lint:styles'],
        commandDisplay: 'pnpm lint:styles',
        mandatory: true,
      },
      {
        checkId: 'md-lint',
        name: 'Markdownlint Documentation Check',
        category: 'code_quality',
        scoringCategory: 'documentation_governance',
        bin: 'pnpm',
        args: ['md:lint'],
        commandDisplay: 'pnpm md:lint',
        mandatory: true,
      },
      {
        checkId: 'lint-spelling',
        name: 'CSpell Technical Spelling Check',
        category: 'code_quality',
        scoringCategory: 'documentation_governance',
        bin: 'pnpm',
        args: ['lint:spelling'],
        commandDisplay: 'pnpm lint:spelling',
        mandatory: false,
      }
    );
  }

  return { plan, baseRef };
}

// ---------------------------------------------------------------------------
// Persistence & Reporting
// ---------------------------------------------------------------------------

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function summarizeAgentVerifications(verificationsDir) {
  if (!fs.existsSync(verificationsDir)) {
    return {
      totalVerifications: 0,
      passedCount: 0,
      failedCount: 0,
      blockedCount: 0,
      humanApprovalCount: 0,
      firstPassSuccessRate: 0,
      fileDiffMatchRate: 0,
      recent: [],
    };
  }

  const files = fs
    .readdirSync(verificationsDir)
    .filter((file) => file.endsWith('.json'))
    .sort();

  const records = [];
  for (const file of files) {
    const parsed = readJsonIfExists(path.join(verificationsDir, file));
    if (parsed?.verificationId) {
      records.push(parsed);
    }
  }
  records.sort((a, b) => parseVerificationTimestampMs(a) - parseVerificationTimestampMs(b));

  const total = records.length;
  const passedCount = records.filter((r) => r.computedState === 'VERIFICATION_PASSED').length;
  const failedCount = records.filter((r) => r.computedState === 'VERIFICATION_FAILED').length;
  const blockedCount = records.filter((r) => r.computedState === 'BLOCKED').length;
  const humanApprovalCount = records.filter(
    (r) => r.computedState === 'REQUIRES_HUMAN_APPROVAL'
  ).length;
  const diffMatches = records.filter((r) => r.fileDiffMatches === true).length;

  return {
    totalVerifications: total,
    passedCount,
    failedCount,
    blockedCount,
    humanApprovalCount,
    firstPassSuccessRate: total === 0 ? 0 : roundToTwo((passedCount / total) * 100),
    fileDiffMatchRate: total === 0 ? 0 : roundToTwo((diffMatches / total) * 100),
    recent: records.slice(-10).map((r) => ({
      verificationId: r.verificationId,
      agentId: r.agentReport?.agentId ?? 'unknown',
      taskId: r.agentReport?.taskId ?? 'unknown',
      computedState: r.computedState,
      fileDiffMatches: r.fileDiffMatches,
      verifiedAt: r.verifiedAt,
    })),
  };
}

export function renderMarkdownReport({
  runEvidence,
  agentSummary = null,
  releaseCertificate = null,
}) {
  const lines = [
    '# Quality Intelligence Report',
    '',
    `- **Run ID:** \`${runEvidence.runId}\``,
    `- **Repository:** \`${runEvidence.repository}\``,
    `- **Branch:** \`${runEvidence.branch}\``,
    `- **Commit SHA:** \`${runEvidence.commitSha}\``,
    `- **Mode:** \`${runEvidence.mode}\` (${runEvidence.environment})`,
    `- **Executed At:** \`${runEvidence.executedAt}\``,
    `- **Overall Status:** \`${runEvidence.overallStatus}\``,
    `- **Composite Score:** **${runEvidence.score.overallScore}/100**`,
    `- **Confidence:** ${runEvidence.score.confidencePct}% | **Coverage:** ${runEvidence.score.coveragePct}% | **Security Risk:** \`${runEvidence.score.securityRiskLevel}\` | **Release Blocked:** \`${runEvidence.score.releaseBlocked}\``,
    `- **Evidence SHA-256:** \`${runEvidence.evidenceSha256}\``,
    '',
    '## Category Breakdown',
    '',
    '| Category | Weight | Score | Verified | Failed | Skipped | Unavailable |',
    '| :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
  ];

  for (const cat of runEvidence.score.categoryScores) {
    lines.push(
      `| \`${cat.category}\` | ${Math.round(cat.weight * 100)}% | ${cat.score} | ${cat.verified} | ${cat.failed} | ${cat.skipped} | ${cat.unavailable} |`
    );
  }

  lines.push(
    '',
    '## Gate Execution Results',
    '',
    '| Check ID | Mandatory | Status | Exit | Duration (ms) | Notes |',
    '| :--- | :---: | :---: | :---: | :---: | :--- |'
  );

  for (const check of runEvidence.checks) {
    const notes = check.skipReason ? check.skipReason : check.status === 'FAILED' ? 'Failed' : 'OK';
    lines.push(
      `| \`${check.checkId}\` | ${check.mandatory ? 'Yes' : 'No'} | \`${check.status}\` | ${check.exitCode ?? '—'} | ${check.durationMs} | ${notes.replace(/\|/g, '/')} |`
    );
  }

  if ((runEvidence.regressions ?? []).length > 0) {
    lines.push('', '## Regression Findings', '');
    for (const reg of runEvidence.regressions) {
      const origin = reg.isPreExisting ? 'PRE-EXISTING' : 'NEW';
      lines.push(
        `- **[${reg.severity}] (${origin})** \`${reg.id}\`: ${reg.difference} (${reg.previousResult} -> ${reg.currentResult})`
      );
    }
  }

  if (agentSummary && agentSummary.totalVerifications > 0) {
    lines.push(
      '',
      '## Agent Performance Summary',
      '',
      `- **Total Verifications:** ${agentSummary.totalVerifications}`,
      `- **Passed:** ${agentSummary.passedCount} | **Failed:** ${agentSummary.failedCount} | **Blocked:** ${agentSummary.blockedCount} | **Human Approval:** ${agentSummary.humanApprovalCount}`,
      `- **First-Pass Success Rate:** ${agentSummary.firstPassSuccessRate}% | **File-Diff Match Rate:** ${agentSummary.fileDiffMatchRate}%`
    );
  }

  if (releaseCertificate) {
    lines.push(
      '',
      '## Release Certification Summary',
      '',
      `- **Status:** \`${releaseCertificate.status}\``,
      `- **Commit SHA:** \`${releaseCertificate.commitSha}\``,
      `- **Certified At:** \`${releaseCertificate.certifiedAt}\``
    );
    if (releaseCertificate.approvedBy) {
      lines.push(`- **Approved By:** \`${releaseCertificate.approvedBy}\``);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function renderReleaseCertificateMarkdown(cert) {
  const lines = [
    '# Quality Intelligence Release Certificate',
    '',
    `- **Status:** \`${cert.status}\``,
    `- **Commit SHA:** \`${cert.commitSha}\``,
    `- **Evidence Run ID:** \`${cert.evidenceRunId}\``,
    `- **Overall Score:** **${cert.overallScore}/100**`,
    `- **Certified At:** \`${cert.certifiedAt}\``,
    `- **Approved By:** ${cert.approvedBy ? `\`${cert.approvedBy}\`` : '_Pending_'}`,
    '',
    '## 10 Mandatory Release Requirements',
    '',
    '| # | Requirement | Status | Details |',
    '| :---: | :--- | :---: | :--- |',
  ];

  cert.requirements.forEach((req, idx) => {
    lines.push(
      `| ${idx + 1} | ${req.name} | \`${req.status}\` | ${(req.details ?? '').replace(/\|/g, '/')} |`
    );
  });

  if (cert.blockers.length > 0) {
    lines.push('', '## Blockers', '');
    for (const blocker of cert.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Ensures baseline.json is never overwritten when mandatory checks fail or when
 * new CRITICAL/HIGH regressions exist against the current baseline.
 */
export function shouldUpdateBaseline({ updateBaseline, dryRun, runEvidence }) {
  if (!updateBaseline || dryRun || !runEvidence) {
    return false;
  }
  if (
    runEvidence.overallStatus !== 'PASSED' ||
    (runEvidence.score?.mandatoryFailures ?? 0) > 0 ||
    runEvidence.score?.releaseBlocked
  ) {
    return false;
  }
  const hasBlockingNewRegression = (runEvidence.regressions ?? []).some(
    (reg) => !reg.isPreExisting && (reg.severity === 'CRITICAL' || reg.severity === 'HIGH')
  );
  return !hasBlockingNewRegression;
}

function executeQualityRun({
  repoRoot,
  outputDir,
  mode,
  baseRef,
  dryRun,
  updateBaseline,
  agentId = null,
  taskId = null,
}) {
  const runsDir = path.join(outputDir, 'runs');
  fs.mkdirSync(runsDir, { recursive: true });

  const changedFiles = getChangedFiles(repoRoot, baseRef);
  const affected = discoverAffectedPackages(changedFiles, repoRoot);
  const { plan } = buildCheckPlan({ mode, affected, changedFiles, baseRef, repoRoot });

  const evidenceDirRel = path.relative(repoRoot, outputDir) || DEFAULT_OUTPUT_DIR_REL;
  const checks = plan.map((def) =>
    executeCheckDefinition(def, { repoRoot, dryRun, evidenceDirRel })
  );

  const score = calculateQualityScore(checks, { repoRoot });
  const baselinePath = path.join(outputDir, 'baseline.json');
  const baseline = readJsonIfExists(baselinePath);

  const runId = crypto.randomUUID();
  const commitSha = getHeadSha(repoRoot);
  const parentCommitSha = getParentSha(repoRoot);
  const branch = getBranchName(repoRoot);

  let overallStatus = 'PASSED';
  if (dryRun) {
    overallStatus = 'SKIPPED';
  } else if (checks.some((c) => c.mandatory && c.status === 'FAILED')) {
    overallStatus = 'FAILED';
  } else if (
    checks.some((c) => c.mandatory && (c.status === 'BLOCKED' || c.status === 'UNAVAILABLE'))
  ) {
    overallStatus = 'BLOCKED';
  }

  const draftEvidence = {
    runId,
    repository: process.env.GITHUB_REPOSITORY || 'Timothy191/Arch-System',
    branch,
    commitSha,
    parentCommitSha,
    pullRequestId: process.env.PR_NUMBER || null,
    agentId,
    taskId,
    executedAt: new Date().toISOString(),
    environment: process.env.CI ? 'ci' : 'local',
    mode,
    overallStatus,
    checks,
    regressions: [],
    score,
  };

  draftEvidence.regressions = detectRegressions({
    baseline,
    current: draftEvidence,
    changedFiles,
  });

  const evidenceSha256 = computeEvidenceSha256(draftEvidence);
  const runEvidence = { ...draftEvidence, evidenceSha256 };

  const runFilePath = path.join(runsDir, `${runId}.json`);
  fs.writeFileSync(runFilePath, `${JSON.stringify(runEvidence, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDir, 'latest.json'),
    `${JSON.stringify(runEvidence, null, 2)}\n`
  );

  const agentSummary = summarizeAgentVerifications(path.join(outputDir, 'agent-verifications'));
  fs.writeFileSync(
    path.join(outputDir, 'latest-report.md'),
    renderMarkdownReport({ runEvidence, agentSummary })
  );

  if (shouldUpdateBaseline({ updateBaseline, dryRun, runEvidence })) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(runEvidence, null, 2)}\n`);
  }

  return { runEvidence, changedFiles, affected, runFilePath };
}

// ---------------------------------------------------------------------------
// CLI Entrypoint
// ---------------------------------------------------------------------------

const HELP_TEXT = `quality-orchestrator - Arch-System Quality Intelligence CLI

Usage:
  node tools/scripts/quality-orchestrator.mjs <subcommand> [options]

Subcommands:
  run      [--mode changed|pr|full|release] [--base <ref>] [--json] [--output-dir <dir>] [--dry-run] [--update-baseline]
  changed  [--base main] [--json] [--output-dir <dir>] [--dry-run]
  full     [--base main] [--json] [--output-dir <dir>] [--dry-run] [--update-baseline]
  agent    --report <path> [--base main] [--verifier <id>] [--output-dir <dir>] [--dry-run] [--json]
  report   [--format md|json] [--input <path>] [--output-dir <dir>]
  compare  [--baseline <path>] [--current <path>] [--output-dir <dir>] [--json]
  release  [--approved-by <name>] [--notes <text>] [--input <path>] [--output-dir <dir>] [--json]
`;

function resolveOutputDir(rawDir, repoRoot) {
  if (!rawDir) return path.join(repoRoot, DEFAULT_OUTPUT_DIR_REL);
  return path.isAbsolute(rawDir) ? rawDir : path.resolve(repoRoot, rawDir);
}

function main() {
  const cliArgs = process.argv.slice(2).filter((token) => token !== '--');
  const subcommand = cliArgs[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  const parsed = parseArgs({
    args: cliArgs.slice(1),
    allowPositionals: true,
    options: {
      mode: { type: 'string', default: 'changed' },
      base: { type: 'string', default: 'main' },
      json: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'update-baseline': { type: 'boolean', default: false },
      'output-dir': { type: 'string' },
      report: { type: 'string' },
      verifier: { type: 'string', default: 'quality-orchestrator-cli' },
      format: { type: 'string', default: 'md' },
      input: { type: 'string' },
      baseline: { type: 'string' },
      current: { type: 'string' },
      'approved-by': { type: 'string' },
      notes: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  const repoRoot = DEFAULT_REPO_ROOT;
  const outputDir = resolveOutputDir(parsed.values['output-dir'], repoRoot);

  if (subcommand === 'run' || subcommand === 'changed' || subcommand === 'full') {
    const mode = subcommand === 'run' ? parsed.values.mode : subcommand;
    const { runEvidence, runFilePath } = executeQualityRun({
      repoRoot,
      outputDir,
      mode,
      baseRef: parsed.values.base,
      dryRun: parsed.values['dry-run'],
      updateBaseline: parsed.values['update-baseline'],
    });

    if (parsed.values.json) {
      process.stdout.write(`${JSON.stringify(runEvidence, null, 2)}\n`);
    } else {
      process.stdout.write(
        `Quality run ${runEvidence.runId} (${mode}) -> ${runEvidence.overallStatus} | score=${runEvidence.score.overallScore}/100 | evidence=${runFilePath}\n`
      );
    }

    if (
      !parsed.values['dry-run'] &&
      (runEvidence.overallStatus === 'FAILED' || runEvidence.overallStatus === 'BLOCKED')
    ) {
      return 1;
    }
    return 0;
  }

  if (subcommand === 'agent') {
    const reportPathRaw = parsed.values.report;
    if (!reportPathRaw) {
      process.stderr.write('Error: --report <path-to-agent-report.json> is required.\n');
      return 1;
    }
    const reportPath = path.isAbsolute(reportPathRaw)
      ? reportPathRaw
      : path.resolve(repoRoot, reportPathRaw);
    const agentReport = readJsonIfExists(reportPath);
    if (!agentReport) {
      process.stderr.write(`Error: Unable to read valid JSON agent report at ${reportPath}\n`);
      return 1;
    }

    const { runEvidence } = executeQualityRun({
      repoRoot,
      outputDir,
      mode: 'changed',
      baseRef: parsed.values.base,
      dryRun: parsed.values['dry-run'],
      updateBaseline: false,
      agentId: agentReport.agentId ?? null,
      taskId: agentReport.taskId ?? null,
    });

    const actualDiff =
      agentReport.startingCommitSha && agentReport.endingCommitSha
        ? getDiffBetweenCommits(
            repoRoot,
            agentReport.startingCommitSha,
            agentReport.endingCommitSha
          )
        : null;
    const actualChangedFiles = actualDiff ?? getChangedFiles(repoRoot, parsed.values.base);

    const verification = verifyAgentReport({
      agentReport,
      actualChangedFiles,
      runEvidence,
      verifierId: parsed.values.verifier,
    });

    const verificationsDir = path.join(outputDir, 'agent-verifications');
    fs.mkdirSync(verificationsDir, { recursive: true });
    const verFile = path.join(verificationsDir, `${verification.verificationId}.json`);
    fs.writeFileSync(verFile, `${JSON.stringify(verification, null, 2)}\n`);

    if (parsed.values.json) {
      process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
    } else {
      process.stdout.write(
        `Agent verification ${verification.verificationId}: ${verification.computedState} (diffMatches=${verification.fileDiffMatches})\n`
      );
      for (const finding of verification.findings) {
        process.stdout.write(`  - ${finding}\n`);
      }
    }

    return verification.computedState === 'VERIFICATION_FAILED' ||
      verification.computedState === 'BLOCKED'
      ? 1
      : 0;
  }

  if (subcommand === 'report') {
    const inputPath = parsed.values.input
      ? path.resolve(repoRoot, parsed.values.input)
      : path.join(outputDir, 'latest.json');
    const runEvidence = readJsonIfExists(inputPath);
    if (!runEvidence) {
      process.stderr.write(`Error: No quality run evidence found at ${inputPath}\n`);
      return 1;
    }
    const agentSummary = summarizeAgentVerifications(path.join(outputDir, 'agent-verifications'));
    const releaseCertificate = readJsonIfExists(path.join(outputDir, 'release-certificate.json'));

    if (parsed.values.format === 'json') {
      process.stdout.write(
        `${JSON.stringify({ runEvidence, agentSummary, releaseCertificate }, null, 2)}\n`
      );
    } else {
      process.stdout.write(renderMarkdownReport({ runEvidence, agentSummary, releaseCertificate }));
    }
    return 0;
  }

  if (subcommand === 'compare') {
    const baselinePath = parsed.values.baseline
      ? path.resolve(repoRoot, parsed.values.baseline)
      : path.join(outputDir, 'baseline.json');
    const currentPath = parsed.values.current
      ? path.resolve(repoRoot, parsed.values.current)
      : path.join(outputDir, 'latest.json');

    const currentRun = readJsonIfExists(currentPath);
    if (!currentRun) {
      process.stderr.write(`Error: Current evidence run not found at ${currentPath}\n`);
      return 1;
    }
    const baselineRun = readJsonIfExists(baselinePath);
    const findings = detectRegressions({ baseline: baselineRun, current: currentRun });
    const newRegressions = findings.filter((f) => !f.isPreExisting);
    const preExistingFailures = findings.filter((f) => f.isPreExisting);
    const blockingNewCount = newRegressions.filter(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    ).length;

    const summary = {
      baselinePresent: Boolean(baselineRun),
      baselineRunId: baselineRun?.runId ?? null,
      currentRunId: currentRun.runId,
      newRegressionsCount: newRegressions.length,
      preExistingFailuresCount: preExistingFailures.length,
      blockingNewCount,
      findings,
    };

    if (parsed.values.json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      process.stdout.write(
        `Compare ${summary.baselineRunId ?? 'none'} -> ${summary.currentRunId}: ${summary.newRegressionsCount} new regression(s), ${summary.preExistingFailuresCount} pre-existing failure(s).\n`
      );
      for (const f of findings) {
        process.stdout.write(
          `  - [${f.severity}] (${f.isPreExisting ? 'PRE-EXISTING' : 'NEW'}) ${f.id}: ${f.difference}\n`
        );
      }
    }

    return blockingNewCount > 0 ? 1 : 0;
  }

  if (subcommand === 'release') {
    fs.mkdirSync(outputDir, { recursive: true });
    const inputPath = parsed.values.input
      ? path.resolve(repoRoot, parsed.values.input)
      : path.join(outputDir, 'latest.json');
    const currentRun = readJsonIfExists(inputPath);
    const baselineRun = readJsonIfExists(path.join(outputDir, 'baseline.json'));
    const verificationsDir = path.join(outputDir, 'agent-verifications');
    const agentVerifications = fs.existsSync(verificationsDir)
      ? fs
          .readdirSync(verificationsDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => readJsonIfExists(path.join(verificationsDir, f)))
          .filter(Boolean)
          .sort((a, b) => parseVerificationTimestampMs(a) - parseVerificationTimestampMs(b))
      : [];

    const headSha = getHeadSha(repoRoot);
    const cert = evaluateReleaseCertificate({
      currentRun,
      headSha,
      baselineRun,
      agentVerifications,
      approvedBy: parsed.values['approved-by'] ?? null,
      notes: parsed.values.notes ?? null,
    });

    const certJsonPath = path.join(outputDir, 'release-certificate.json');
    const certMdPath = path.join(outputDir, 'release-certificate.md');
    fs.writeFileSync(certJsonPath, `${JSON.stringify(cert, null, 2)}\n`);
    fs.writeFileSync(certMdPath, renderReleaseCertificateMarkdown(cert));

    if (parsed.values.json) {
      process.stdout.write(`${JSON.stringify(cert, null, 2)}\n`);
    } else {
      process.stdout.write(
        `Release certificate for ${cert.commitSha}: ${cert.status} (score=${cert.overallScore}/100, blockers=${cert.blockers.length}) -> ${certJsonPath}\n`
      );
    }

    return cert.status === 'BLOCKED' || cert.status === 'NOT_READY' ? 1 : 0;
  }

  process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
  process.stdout.write(HELP_TEXT);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const exitCode = main();
  process.exit(exitCode);
}
