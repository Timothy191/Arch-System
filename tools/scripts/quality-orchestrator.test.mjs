#!/usr/bin/env node
/**
 * Unit and CLI integration tests for tools/scripts/quality-orchestrator.mjs.
 * Uses node:test and node:assert/strict with isolated temp directories.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  calculateQualityScore,
  computeEvidenceSha256,
  detectRegressions,
  discoverAffectedPackages,
  evaluateReleaseCertificate,
  redactSecrets,
  SCORING_CATEGORY_WEIGHTS,
  selectLatestAgentVerificationForCommit,
  shouldUpdateBaseline,
  verifyAgentReport,
} from './quality-orchestrator.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./quality-orchestrator.mjs', import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..', '..');
const TEMP_DIRS = [];

function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMP_DIRS.push(dir);
  return dir;
}

after(() => {
  for (const dir of TEMP_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makePassingChecks() {
  return [
    {
      checkId: 'security-policy',
      name: 'Security Policy Check',
      category: 'security',
      scoringCategory: 'security',
      owner: 'repo',
      command: 'pnpm policy:security',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 120,
      skipReason: null,
      logExcerpt: 'Security audit passed.',
      evidenceLinks: [],
    },
    {
      checkId: 'unit-tests',
      name: 'Unit Tests',
      category: 'testing',
      scoringCategory: 'functional_testing',
      owner: 'repo',
      command: 'pnpm test',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 450,
      skipReason: null,
      logExcerpt: 'All unit tests passed.',
      evidenceLinks: [],
    },
    {
      checkId: 'type-check',
      name: 'Type Check',
      category: 'code_quality',
      scoringCategory: 'architecture',
      owner: 'repo',
      command: 'pnpm type-check',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 300,
      skipReason: null,
      logExcerpt: 'No TS errors.',
      evidenceLinks: [],
    },
    {
      checkId: 'rls-matrix',
      name: 'RLS Matrix Audit',
      category: 'database',
      scoringCategory: 'database_integrity',
      owner: 'repo',
      command: 'pnpm audit:rls-matrix',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 180,
      skipReason: null,
      logExcerpt: 'All tables protected.',
      evidenceLinks: [],
    },
    {
      checkId: 'hooks-audit',
      name: 'Hooks and Clients Audit',
      category: 'reliability',
      scoringCategory: 'reliability',
      owner: 'repo',
      command: 'pnpm audit:hooks',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 90,
      skipReason: null,
      logExcerpt: 'Hooks clean.',
      evidenceLinks: [],
    },
    {
      checkId: 'css-perf',
      name: 'CSS Performance Budget',
      category: 'performance',
      scoringCategory: 'performance',
      owner: 'repo',
      command: 'pnpm lint:css-perf',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 75,
      skipReason: null,
      logExcerpt: 'CSS within budget.',
      evidenceLinks: [],
    },
    {
      checkId: 'design-tokens',
      name: 'Design Tokens Audit',
      category: 'ui_ux',
      scoringCategory: 'accessibility_ux',
      owner: 'repo',
      command: 'pnpm audit:tokens',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 65,
      skipReason: null,
      logExcerpt: 'Tokens valid.',
      evidenceLinks: [],
    },
    {
      checkId: 'validate-json',
      name: 'JSON Validation',
      category: 'code_quality',
      scoringCategory: 'documentation_governance',
      owner: 'repo',
      command: 'node tools/scripts/validate-json.mjs',
      mandatory: true,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 50,
      skipReason: null,
      logExcerpt: 'JSON valid.',
      evidenceLinks: [],
    },
  ];
}

function makeRunEvidence(overrides = {}) {
  const checks = overrides.checks ?? makePassingChecks();
  const regressions = overrides.regressions ?? [];
  const score = overrides.score ?? calculateQualityScore(checks);
  const base = {
    runId: '11111111-1111-4111-8111-111111111111',
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: 'a51e5172a51e5172a51e5172a51e5172a51e5172',
    parentCommitSha: '373cb16a373cb16a373cb16a373cb16a373cb16a',
    pullRequestId: null,
    agentId: null,
    taskId: null,
    executedAt: '2026-11-19T14:50:00.000Z',
    environment: 'local',
    mode: 'full',
    overallStatus: 'PASSED',
    checks,
    regressions,
    score,
    ...overrides,
  };
  const evidenceSha256 = overrides.evidenceSha256 ?? computeEvidenceSha256(base);
  return { ...base, evidenceSha256 };
}

describe('redactSecrets', () => {
  it('redacts JWTs, Postgres DSNs, Supabase keys, Bearer tokens, and provider secrets', () => {
    const fakeJwt = `${'eyJhbGciOiJIUzI1NiJ9'}.${'eyJzdWIiOiIxMjM0NTY3ODkwIn0'}.${'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'}`;
    const fakeGhp = `${'ghp_'}${'a1b2c3d4e5'.repeat(4)}`;
    const fakeAws = `${'AKIA'}1234567890ABCDEF`;
    const fakeSbSecret = `${'sb_secret_'}abcdefghijklmnop123456`;
    const pgScheme = 'postgresql';
    const pgAccount = 'pg_test_user';
    const pgCredential = ['sample', 'pass', '99'].join('_');
    const pgEndpoint = 'db.invalid:5432/app_db';
    const fakePg = [pgScheme, '://', pgAccount, ':', pgCredential, '@', pgEndpoint].join('');
    const fakeBearer = 'Authorization: Bearer my-very-secret-bearer-token-value';

    const input = [
      `jwt=${fakeJwt}`,
      `github=${fakeGhp}`,
      `aws=${fakeAws}`,
      `sb=${fakeSbSecret}`,
      `db=${fakePg}`,
      fakeBearer,
      'SUPABASE_SERVICE_KEY=some-inline-service-key-value',
    ].join('\n');

    const redacted = redactSecrets(input);

    assert.equal(redacted.includes(fakeJwt), false);
    assert.equal(redacted.includes(fakeGhp), false);
    assert.equal(redacted.includes(fakeAws), false);
    assert.equal(redacted.includes(fakeSbSecret), false);
    assert.equal(redacted.includes(pgCredential), false);
    assert.equal(redacted.includes('my-very-secret-bearer-token-value'), false);
    assert.equal(redacted.includes('some-inline-service-key-value'), false);
    assert.match(redacted, /\[REDACTED:/);
  });

  it('preserves ordinary non-secret log messages', () => {
    const clean = 'TypeScript check passed with 0 errors in 320ms.';
    assert.equal(redactSecrets(clean), clean);
  });
});

describe('discoverAffectedPackages', () => {
  it('maps changed paths to workspace packages, tools, and workers', () => {
    const changed = [
      'apps/portal/app/page.tsx',
      'packages/intelligence/src/quality/scoring.ts',
      'libs/features/auth/ui/src/Login.tsx',
      'libs/shared/utils/src/env.ts',
      'tools/scripts/quality-orchestrator.mjs',
      'workers/scada-monitor.js',
    ];
    const result = discoverAffectedPackages(changed, REPO_ROOT);

    assert.ok(result.packages.includes('portal'));
    assert.ok(result.packages.includes('@repo/intelligence'));
    assert.ok(result.dirs.includes('libs/features/auth/ui'));
    assert.ok(result.dirs.includes('libs/shared/utils'));
    assert.ok(result.dirs.includes('tools'));
    assert.ok(result.dirs.includes('workers'));
    assert.equal(result.touchesRootConfig, false);
  });

  it('flags root config changes', () => {
    const result = discoverAffectedPackages(['package.json', 'tsconfig.base.json'], REPO_ROOT);
    assert.equal(result.touchesRootConfig, true);
  });
});

describe('calculateQualityScore', () => {
  it('uses exact 20/20/15/15/10/10/5/5 weights summing to 1.0', () => {
    const weightSum = Object.values(SCORING_CATEGORY_WEIGHTS).reduce((acc, w) => acc + w, 0);
    assert.ok(Math.abs(weightSum - 1) < 1e-9);
    assert.equal(SCORING_CATEGORY_WEIGHTS.security, 0.2);
    assert.equal(SCORING_CATEGORY_WEIGHTS.functional_testing, 0.2);
    assert.equal(SCORING_CATEGORY_WEIGHTS.architecture, 0.15);
    assert.equal(SCORING_CATEGORY_WEIGHTS.reliability, 0.15);
    assert.equal(SCORING_CATEGORY_WEIGHTS.performance, 0.1);
    assert.equal(SCORING_CATEGORY_WEIGHTS.database_integrity, 0.1);
    assert.equal(SCORING_CATEGORY_WEIGHTS.accessibility_ux, 0.05);
    assert.equal(SCORING_CATEGORY_WEIGHTS.documentation_governance, 0.05);
  });

  it('awards 100 when all 8 categories pass and zero points for skipped or unavailable checks', () => {
    const allPass = makePassingChecks();
    const perfect = calculateQualityScore(allPass);
    assert.equal(perfect.overallScore, 100);
    assert.equal(perfect.confidencePct, 100);
    assert.equal(perfect.mandatoryFailures, 0);
    assert.equal(perfect.releaseBlocked, false);
    assert.equal(perfect.securityRiskLevel, 'LOW');

    const withSkipped = [
      ...allPass,
      {
        checkId: 'extra-security',
        name: 'Extra Security Scan',
        category: 'security',
        scoringCategory: 'security',
        owner: 'repo',
        command: 'pnpm audit:ci',
        mandatory: false,
        status: 'SKIPPED',
        exitCode: null,
        durationMs: 0,
        skipReason: 'Offline',
        logExcerpt: null,
        evidenceLinks: [],
      },
      {
        checkId: 'extra-perf',
        name: 'Lighthouse CI',
        category: 'performance',
        scoringCategory: 'performance',
        owner: 'repo',
        command: 'lhci autorun',
        mandatory: false,
        status: 'UNAVAILABLE',
        exitCode: null,
        durationMs: 0,
        skipReason: 'Chrome missing',
        logExcerpt: null,
        evidenceLinks: [],
      },
    ];
    const partial = calculateQualityScore(withSkipped);
    // security becomes 50% of 20 = 10; performance becomes 50% of 10 = 5 => 100 - 10 - 5 = 85
    assert.equal(partial.overallScore, 85);
    assert.equal(partial.confidencePct, 80);
    assert.equal(partial.releaseBlocked, false);
  });

  it('blocks release on mandatory failure even when overall score is >= 90', () => {
    const checks = makePassingChecks().map((check) =>
      check.checkId === 'design-tokens'
        ? { ...check, status: 'FAILED', exitCode: 1, mandatory: true }
        : check
    );
    const result = calculateQualityScore(checks);
    // Only 5% category failed -> score is 95, yet releaseBlocked MUST be true
    assert.equal(result.overallScore, 95);
    assert.equal(result.mandatoryFailures, 1);
    assert.equal(result.releaseBlocked, true);
  });
});

describe('detectRegressions', () => {
  it('distinguishes new regressions from pre-existing failures', () => {
    const baselineChecks = makePassingChecks().map((check) =>
      check.checkId === 'css-perf' ? { ...check, status: 'FAILED', exitCode: 1 } : check
    );
    const baseline = makeRunEvidence({ checks: baselineChecks });

    const currentChecks = makePassingChecks().map((check) => {
      if (check.checkId === 'css-perf') return { ...check, status: 'FAILED', exitCode: 1 };
      if (check.checkId === 'unit-tests') return { ...check, status: 'FAILED', exitCode: 1 };
      return check;
    });
    const current = makeRunEvidence({
      runId: '22222222-2222-4222-8222-222222222222',
      checks: currentChecks,
    });

    const findings = detectRegressions({
      baseline,
      current,
      changedFiles: ['apps/portal/app/page.tsx'],
    });

    const unitRegression = findings.find((f) => f.id.includes('unit-tests'));
    const cssPreExisting = findings.find((f) => f.id.includes('css-perf'));

    assert.ok(unitRegression);
    assert.equal(unitRegression.isPreExisting, false);
    assert.equal(unitRegression.severity, 'CRITICAL');

    assert.ok(cssPreExisting);
    assert.equal(cssPreExisting.isPreExisting, true);
  });
});

describe('verifyAgentReport', () => {
  const baseReport = {
    agentId: 'worker-2b',
    agentName: 'CLI Quality Engineer',
    taskId: 'task-qi-2b',
    taskDescription: 'Implement quality orchestrator CLI',
    startingCommitSha: 'a51e5172',
    endingCommitSha: 'b62f6283',
    filesCreated: ['tools/scripts/quality-orchestrator.mjs'],
    filesModified: ['package.json'],
    filesDeleted: [],
    dependenciesAdded: [],
    dependenciesRemoved: [],
    featuresImplemented: ['CLI orchestrator'],
    testsCreated: ['tools/scripts/quality-orchestrator.test.mjs'],
    testsExecuted: ['node --test tools/scripts/quality-orchestrator.test.mjs'],
    commandsExecuted: ['node --test tools/scripts/quality-orchestrator.test.mjs'],
    commandResults: [
      {
        command: 'node --test tools/scripts/quality-orchestrator.test.mjs',
        exitCode: 0,
        status: 'PASSED',
      },
    ],
    knownDefects: [],
    unresolvedIssues: [],
    securityImpact: 'None',
    databaseImpact: 'None',
    integrationImpact: 'Adds quality:* scripts',
    performanceImpact: 'None',
    documentationUpdates: [],
    evidenceReferences: ['.ci-local/quality-intelligence/latest.json'],
    state: 'IMPLEMENTATION_COMPLETE',
    submittedAt: '2026-11-19T14:55:00.000Z',
  };

  it('refuses self-verification when verifier matches agentId or pre-declares VERIFICATION_PASSED', () => {
    const runEvidence = makeRunEvidence();
    const selfVerify = verifyAgentReport({
      agentReport: baseReport,
      actualChangedFiles: ['tools/scripts/quality-orchestrator.mjs', 'package.json'],
      runEvidence,
      verifierId: 'worker-2b',
    });
    assert.equal(selfVerify.computedState, 'VERIFICATION_FAILED');
    assert.ok(selfVerify.findings.some((f) => f.toLowerCase().includes('self-verification')));

    const preAttested = verifyAgentReport({
      agentReport: { ...baseReport, state: 'VERIFICATION_PASSED' },
      actualChangedFiles: ['tools/scripts/quality-orchestrator.mjs', 'package.json'],
      runEvidence,
      verifierId: 'independent-verifier',
    });
    assert.equal(preAttested.computedState, 'VERIFICATION_FAILED');
    assert.ok(preAttested.findings.some((f) => f.toLowerCase().includes('self-attestation')));
  });

  it('detects undeclared and missing files against actual git diff', () => {
    const runEvidence = makeRunEvidence();
    const mismatch = verifyAgentReport({
      agentReport: baseReport,
      actualChangedFiles: [
        'tools/scripts/quality-orchestrator.mjs',
        'apps/portal/app/secret-edit.ts',
      ],
      runEvidence,
      verifierId: 'independent-verifier',
    });
    assert.equal(mismatch.fileDiffMatches, false);
    assert.deepEqual(mismatch.undeclaredFiles, ['apps/portal/app/secret-edit.ts']);
    assert.deepEqual(mismatch.missingDeclaredFiles, ['package.json']);
    assert.equal(mismatch.computedState, 'VERIFICATION_FAILED');
  });

  it('returns VERIFICATION_PASSED for clean independent verification and REQUIRES_HUMAN_APPROVAL for Tier 2 paths', () => {
    const runEvidence = makeRunEvidence();
    const passed = verifyAgentReport({
      agentReport: baseReport,
      actualChangedFiles: ['tools/scripts/quality-orchestrator.mjs', 'package.json'],
      runEvidence,
      verifierId: 'independent-verifier',
    });
    assert.equal(passed.fileDiffMatches, true);
    assert.equal(passed.computedState, 'VERIFICATION_PASSED');

    const tier2 = verifyAgentReport({
      agentReport: {
        ...baseReport,
        filesCreated: ['.github/workflows/quality-intelligence.yml'],
        filesModified: [],
      },
      actualChangedFiles: ['.github/workflows/quality-intelligence.yml'],
      runEvidence,
      verifierId: 'independent-verifier',
    });
    assert.equal(tier2.computedState, 'REQUIRES_HUMAN_APPROVAL');
  });

  it('returns BLOCKED when required checks are UNAVAILABLE or BLOCKED', () => {
    const blockedChecks = makePassingChecks().map((c) =>
      c.checkId === 'rls-matrix' ? { ...c, status: 'UNAVAILABLE', exitCode: null } : c
    );
    const runEvidence = makeRunEvidence({
      overallStatus: 'BLOCKED',
      checks: blockedChecks,
    });
    const blocked = verifyAgentReport({
      agentReport: baseReport,
      actualChangedFiles: ['tools/scripts/quality-orchestrator.mjs', 'package.json'],
      runEvidence,
      verifierId: 'independent-verifier',
    });
    assert.equal(blocked.computedState, 'BLOCKED');
  });
});

describe('evaluateReleaseCertificate', () => {
  const headSha = 'a51e5172a51e5172a51e5172a51e5172a51e5172';

  it('evaluates all 10 requirements and distinguishes READY_FOR_REVIEW vs APPROVED vs BLOCKED vs NOT_READY', () => {
    const run = makeRunEvidence({ commitSha: headSha });

    const ready = evaluateReleaseCertificate({
      currentRun: run,
      headSha,
    });
    assert.equal(ready.requirements.length, 10);
    assert.equal(ready.status, 'READY_FOR_REVIEW');

    const approved = evaluateReleaseCertificate({
      currentRun: run,
      headSha,
      approvedBy: 'tim-lead',
    });
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.approvedBy, 'tim-lead');

    const wrongSha = evaluateReleaseCertificate({
      currentRun: run,
      headSha: 'ffffffffffffffffffffffffffffffffffffffff',
    });
    assert.equal(wrongSha.status, 'NOT_READY');

    const tampered = evaluateReleaseCertificate({
      currentRun: { ...run, evidenceSha256: '0'.repeat(64) },
      headSha,
    });
    assert.equal(tampered.status, 'BLOCKED');
  });
});

describe('CLI integration on temp fixture directories', () => {
  it('supports --help', () => {
    const res = spawnSync(process.execPath, [SCRIPT_PATH, '--help'], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /quality-orchestrator/);
    assert.match(res.stdout, /release/);
  });

  it('renders markdown and JSON reports from fixture evidence and agent verifications', () => {
    const outDir = makeTempDir('qi-report-');
    const verDir = path.join(outDir, 'agent-verifications');
    fs.mkdirSync(verDir, { recursive: true });

    const run = makeRunEvidence();
    fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(run, null, 2));
    fs.writeFileSync(
      path.join(verDir, 'ver-1.json'),
      JSON.stringify(
        {
          verificationId: '33333333-3333-4333-8333-333333333333',
          agentReport: {
            agentId: 'worker-2b',
            agentName: 'Worker 2B',
            taskId: 'task-1',
            taskDescription: 'Test task',
            startingCommitSha: 'a51e5172',
            endingCommitSha: 'b62f6283',
            filesCreated: ['a.ts'],
            filesModified: [],
            filesDeleted: [],
            dependenciesAdded: [],
            dependenciesRemoved: [],
            featuresImplemented: ['cli'],
            testsCreated: [],
            testsExecuted: [],
            commandsExecuted: [],
            commandResults: [],
            knownDefects: [],
            unresolvedIssues: [],
            securityImpact: 'None',
            databaseImpact: 'None',
            integrationImpact: 'None',
            performanceImpact: 'None',
            documentationUpdates: [],
            evidenceReferences: [],
            state: 'IMPLEMENTATION_COMPLETE',
            submittedAt: '2026-11-19T14:55:00.000Z',
          },
          actualChangedFiles: ['a.ts'],
          undeclaredFiles: [],
          missingDeclaredFiles: [],
          fileDiffMatches: true,
          computedState: 'VERIFICATION_PASSED',
          runEvidence: run,
          verifiedBy: 'quality-orchestrator-cli',
          verifiedAt: '2026-11-19T14:56:00.000Z',
          findings: [],
        },
        null,
        2
      )
    );

    const mdRes = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'report', '--format', 'md', '--output-dir', outDir],
      { encoding: 'utf8' }
    );
    assert.equal(mdRes.status, 0);
    assert.match(mdRes.stdout, /Quality Intelligence Report/);
    assert.match(mdRes.stdout, /Agent Performance Summary/);

    const jsonRes = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'report', '--format', 'json', '--output-dir', outDir],
      { encoding: 'utf8' }
    );
    assert.equal(jsonRes.status, 0);
    const parsed = JSON.parse(jsonRes.stdout);
    assert.equal(parsed.runEvidence.score.overallScore, 100);
    assert.equal(parsed.agentSummary.totalVerifications, 1);
  });

  it('compares baseline vs current runs and exits non-zero on new regressions', () => {
    const dir = makeTempDir('qi-compare-');
    const baselinePath = path.join(dir, 'baseline.json');
    const currentPath = path.join(dir, 'current.json');

    const baseline = makeRunEvidence();
    const failingChecks = makePassingChecks().map((c) =>
      c.checkId === 'unit-tests' ? { ...c, status: 'FAILED', exitCode: 1 } : c
    );
    const current = makeRunEvidence({
      runId: '44444444-4444-4444-8444-444444444444',
      checks: failingChecks,
      overallStatus: 'FAILED',
    });

    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    fs.writeFileSync(currentPath, JSON.stringify(current, null, 2));

    const res = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'compare', '--baseline', baselinePath, '--current', currentPath, '--json'],
      { encoding: 'utf8' }
    );
    assert.equal(res.status, 1);
    const parsed = JSON.parse(res.stdout);
    assert.ok(parsed.newRegressionsCount >= 1);
  });

  it('evaluates release command against exact HEAD and exits non-zero when BLOCKED or NOT_READY', () => {
    const dir = makeTempDir('qi-release-');
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();

    const validRun = makeRunEvidence({ commitSha: headSha });
    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(validRun, null, 2));

    const readyRes = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'release', '--approved-by', 'release-lead', '--output-dir', dir, '--json'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    assert.equal(readyRes.status, 0);
    const cert = JSON.parse(readyRes.stdout);
    assert.equal(cert.status, 'APPROVED');
    assert.equal(fs.existsSync(path.join(dir, 'release-certificate.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'release-certificate.md')), true);

    const blockedRun = makeRunEvidence({
      commitSha: headSha,
      overallStatus: 'FAILED',
      checks: makePassingChecks().map((c) =>
        c.checkId === 'security-policy' ? { ...c, status: 'FAILED', exitCode: 1 } : c
      ),
    });
    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(blockedRun, null, 2));

    const blockedRes = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'release', '--output-dir', dir, '--json'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    assert.equal(blockedRes.status, 1);
    const blockedCert = JSON.parse(blockedRes.stdout);
    assert.equal(blockedCert.status, 'BLOCKED');
  });

  it('runs agent verification CLI against report JSON, writes artifact, and exits non-zero on failure', () => {
    const dir = makeTempDir('qi-agent-');
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    const reportPath = path.join(dir, 'agent-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          agentId: 'test-agent-1',
          agentName: 'Test Agent',
          taskId: 'task-cli-agent',
          taskDescription: 'Verify CLI agent subcommand',
          startingCommitSha: headSha,
          endingCommitSha: headSha,
          filesCreated: ['nonexistent-file-not-in-diff.ts'],
          filesModified: [],
          filesDeleted: [],
          dependenciesAdded: [],
          dependenciesRemoved: [],
          featuresImplemented: [],
          testsCreated: [],
          testsExecuted: [],
          commandsExecuted: [],
          commandResults: [],
          knownDefects: [],
          unresolvedIssues: [],
          securityImpact: 'None',
          databaseImpact: 'None',
          integrationImpact: 'None',
          performanceImpact: 'None',
          documentationUpdates: [],
          evidenceReferences: [],
          state: 'IMPLEMENTATION_COMPLETE',
          submittedAt: '2026-11-19T14:55:00.000Z',
        },
        null,
        2
      )
    );

    const res = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'agent', '--report', reportPath, '--output-dir', dir, '--dry-run', '--json'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    assert.equal(res.status, 1);
    const verification = JSON.parse(res.stdout);
    assert.equal(verification.computedState, 'VERIFICATION_FAILED');
    assert.equal(verification.fileDiffMatches, false);
    assert.ok(verification.missingDeclaredFiles.includes('nonexistent-file-not-in-diff.ts'));
    assert.equal(
      fs.existsSync(path.join(dir, 'agent-verifications', `${verification.verificationId}.json`)),
      true
    );
  });

  it('refuses baseline overwrite when a run passes mandatory checks but introduces a new HIGH regression', () => {
    const optionalCheckPassing = {
      checkId: 'knip-dead-code',
      name: 'Knip Unused Exports',
      category: 'code_quality',
      scoringCategory: 'architecture',
      owner: 'repo',
      command: 'pnpm knip',
      mandatory: false,
      status: 'PASSED',
      exitCode: 0,
      durationMs: 50,
      skipReason: null,
      logExcerpt: 'Zero unused exports.',
      evidenceLinks: [],
    };
    const baseline = makeRunEvidence({
      checks: [...makePassingChecks(), optionalCheckPassing],
    });
    const checksWithOptionalFailure = [
      ...makePassingChecks(),
      { ...optionalCheckPassing, status: 'FAILED', exitCode: 1 },
    ];
    const regressions = detectRegressions({
      baseline,
      current: makeRunEvidence({ checks: checksWithOptionalFailure }),
    });
    assert.equal(regressions.length, 1);
    assert.equal(regressions[0].severity, 'HIGH');
    assert.equal(regressions[0].isPreExisting, false);

    const runWithHighRegression = makeRunEvidence({
      overallStatus: 'PASSED',
      checks: checksWithOptionalFailure,
      regressions,
      score: calculateQualityScore(checksWithOptionalFailure),
    });

    assert.equal(
      shouldUpdateBaseline({
        updateBaseline: true,
        dryRun: false,
        runEvidence: runWithHighRegression,
      }),
      false
    );
    assert.equal(
      shouldUpdateBaseline({
        updateBaseline: true,
        dryRun: false,
        runEvidence: baseline,
      }),
      true
    );
  });

  it('selects newest agent verification by timestamp rather than UUID filename order in release certification', () => {
    const dir = makeTempDir('qi-ver-order-');
    const verDir = path.join(dir, 'agent-verifications');
    fs.mkdirSync(verDir, { recursive: true });
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();

    const run = makeRunEvidence({ commitSha: headSha });
    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(run, null, 2));

    const olderPassed = {
      verificationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      agentReport: {
        agentId: 'agent-1',
        agentName: 'Agent One',
        taskId: 'task-order',
        taskDescription: 'Order test',
        startingCommitSha: headSha,
        endingCommitSha: headSha,
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesAdded: [],
        dependenciesRemoved: [],
        featuresImplemented: [],
        testsCreated: [],
        testsExecuted: [],
        commandsExecuted: [],
        commandResults: [],
        knownDefects: [],
        unresolvedIssues: [],
        securityImpact: 'None',
        databaseImpact: 'None',
        integrationImpact: 'None',
        performanceImpact: 'None',
        documentationUpdates: [],
        evidenceReferences: [],
        state: 'IMPLEMENTATION_COMPLETE',
        submittedAt: '2026-11-19T14:00:00.000Z',
      },
      actualChangedFiles: [],
      undeclaredFiles: [],
      missingDeclaredFiles: [],
      fileDiffMatches: true,
      computedState: 'VERIFICATION_PASSED',
      runEvidence: run,
      verifiedBy: 'quality-orchestrator-cli',
      verifiedAt: '2026-11-19T14:01:00.000Z',
      findings: [],
    };

    const newerFailed = {
      ...olderPassed,
      verificationId: '00000000-0000-4000-8000-000000000001',
      computedState: 'VERIFICATION_FAILED',
      verifiedAt: '2026-11-19T16:30:00.000Z',
      findings: ['Latest run failed independent diff parity check'],
    };

    fs.writeFileSync(
      path.join(verDir, `${olderPassed.verificationId}.json`),
      JSON.stringify(olderPassed, null, 2)
    );
    fs.writeFileSync(
      path.join(verDir, `${newerFailed.verificationId}.json`),
      JSON.stringify(newerFailed, null, 2)
    );

    const selected = selectLatestAgentVerificationForCommit([newerFailed, olderPassed], headSha);
    assert.equal(selected?.verificationId, newerFailed.verificationId);

    const relRes = spawnSync(
      process.execPath,
      [SCRIPT_PATH, 'release', '--output-dir', dir, '--approved-by', 'tim-lead', '--json'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    assert.equal(relRes.status, 1);
    const cert = JSON.parse(relRes.stdout);
    assert.equal(cert.status, 'BLOCKED');
    const approvalReq = cert.requirements.find(
      (r) => r.requirementId === '10_agent_verification_and_approval'
    );
    assert.equal(approvalReq?.status, 'FAILED');
    assert.match(approvalReq?.details ?? '', /VERIFICATION_FAILED/);
  });
});
