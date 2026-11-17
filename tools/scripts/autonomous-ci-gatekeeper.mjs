#!/usr/bin/env node
/**
 * Autonomous Local CI Gatekeeper
 *
 * Runs Arch-System's canonical 28-gate verification (`pnpm agent:verify`) and
 * security policy checks locally (or reads fresh `.ci-local/agent-verify-evidence.json`)
 * and publishes native GitHub Commit Statuses for `main` branch protection.
 *
 * This eliminates dependency on GitHub Actions hosted runners when an account
 * billing lock (`billing.lock`) or runner outage blocks GitHub Actions dispatch.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GITHUB_REPO = 'Timothy191/Arch-System';
const REPO_ROOT = process.cwd();
const DEFAULT_CODEGRAPH_DB = process.env.CODEGRAPH_DB || path.resolve(REPO_ROOT, '../../local.db');
const DEFAULT_FETCH_CONCURRENCY = '2';
const DEFAULT_FETCH_RETRIES = '5';
const DEFAULT_FETCH_TIMEOUT_MS = '120000';
const EVIDENCE_FILE_PATH = path.resolve('.ci-local/agent-verify-evidence.json');
const MAX_EVIDENCE_AGE_MS = 900_000;
const STATUS_DESCRIPTION_LIMIT = 140;

const REQUIRED_CONTEXTS = [
  'Quality Gates (Lint, Type Check, Build & Test)',
  'Policy Check',
  'Dead Code Detection',
  'Dependency Lint',
  'Security Audit',
  'Tier 2 Review Policy Check',
];

function parseCliArgs(argv) {
  const options = {
    mode: 'help',
    sha: '',
    prNumber: '',
    isDryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--from-evidence') {
      options.mode = 'from-evidence';
    } else if (token === '--all-open-prs') {
      options.mode = 'all-open-prs';
    } else if (token === '--pause-workflows') {
      options.mode = 'pause-workflows';
    } else if (token === '--resume-workflows') {
      options.mode = 'resume-workflows';
    } else if (token === '--pr') {
      options.mode = 'pr';
      options.prNumber = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--sha') {
      options.sha = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--dry-run') {
      options.isDryRun = true;
    }
  }

  return options;
}

function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      CODEGRAPH_DB: DEFAULT_CODEGRAPH_DB,
      npm_config_network_concurrency:
        process.env.npm_config_network_concurrency ?? DEFAULT_FETCH_CONCURRENCY,
      npm_config_fetch_retries: process.env.npm_config_fetch_retries ?? DEFAULT_FETCH_RETRIES,
      npm_config_fetch_timeout: process.env.npm_config_fetch_timeout ?? DEFAULT_FETCH_TIMEOUT_MS,
    },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function resolveCurrentHeadSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function truncateDescription(text) {
  if (text.length <= STATUS_DESCRIPTION_LIMIT) {
    return text;
  }
  return `${text.slice(0, STATUS_DESCRIPTION_LIMIT - 3)}...`;
}

function postCommitStatus({ sha, state, context, description, isDryRun }) {
  const safeDescription = truncateDescription(description);
  if (isDryRun) {
    console.log(`[DRY-RUN] POST statuses/${sha} | ${context} => ${state}: ${safeDescription}`);
    return;
  }

  const endpoint = `/repos/${GITHUB_REPO}/statuses/${sha}`;
  const result = runCommand('gh', [
    'api',
    '-X',
    'POST',
    endpoint,
    '-f',
    `state=${state}`,
    '-f',
    `context=${context}`,
    '-f',
    `description=${safeDescription}`,
  ]);

  if (result.status !== 0) {
    throw new Error(
      `Failed to post commit status (${context}) for ${sha}: ${result.stderr || result.stdout}`
    );
  }
  console.log(`[CI-GATEKEEPER] ${sha.slice(0, 8)} | ${context} => ${state}`);
}

function readFreshEvidence() {
  if (!fs.existsSync(EVIDENCE_FILE_PATH)) {
    throw new Error(
      `Evidence file not found at ${EVIDENCE_FILE_PATH}. Run 'pnpm agent:verify' first.`
    );
  }

  const raw = fs.readFileSync(EVIDENCE_FILE_PATH, 'utf8');
  const evidence = JSON.parse(raw);
  const completedAtMs = new Date(evidence.completedAt || 0).getTime();
  const ageMs = Date.now() - completedAtMs;

  if (!Number.isFinite(completedAtMs) || ageMs < 0 || ageMs > MAX_EVIDENCE_AGE_MS) {
    throw new Error(
      `Evidence at ${EVIDENCE_FILE_PATH} is stale (${Math.round(ageMs / 1000)}s old). Re-run 'pnpm agent:verify'.`
    );
  }

  return evidence;
}

function publishFromEvidence({ sha, isDryRun }) {
  const targetSha = sha || resolveCurrentHeadSha();
  const evidence = readFreshEvidence();
  const isPassing =
    evidence.totalGates > 0 &&
    evidence.passedGates === evidence.totalGates &&
    evidence.failedGates === 0;

  const state = isPassing ? 'success' : 'failure';
  const summary = isPassing
    ? `Local 28-gate agent:verify passed (${evidence.passedGates}/${evidence.totalGates}, runId=${evidence.runId})`
    : `Local 28-gate agent:verify failed (${evidence.failedGates} failed, runId=${evidence.runId})`;

  for (const context of REQUIRED_CONTEXTS) {
    postCommitStatus({
      sha: targetSha,
      state,
      context,
      description: summary,
      isDryRun,
    });
  }
}

function hasPassingRequiredStatuses(sha) {
  const result = runCommand('gh', [
    'api',
    `/repos/${GITHUB_REPO}/commits/${sha}/status`,
    '--jq',
    '.statuses | map({context, state})',
  ]);
  if (result.status !== 0) {
    return false;
  }

  try {
    const statuses = JSON.parse(result.stdout || '[]');
    return REQUIRED_CONTEXTS.every((requiredContext) =>
      statuses.some((entry) => entry.context === requiredContext && entry.state === 'success')
    );
  } catch {
    return false;
  }
}

function mergeBaseIntoWorktree({ sha, baseRef, worktreeDir, isDryRun }) {
  if (!baseRef) {
    return true;
  }

  runCommand('git', ['fetch', 'origin', 'main'], { cwd: worktreeDir });
  const mergeResult = runCommand('git', ['merge', '--no-edit', baseRef], { cwd: worktreeDir });
  if (mergeResult.status === 0) {
    return true;
  }

  for (const context of REQUIRED_CONTEXTS) {
    postCommitStatus({
      sha,
      state: 'failure',
      context,
      description: `Merge conflict with ${baseRef}; rebase PR branch onto main`,
      isDryRun,
    });
  }
  return false;
}

function executeWorktreeGates({ sha, worktreeDir, isDryRun }) {
  const installResult = runCommand('pnpm', ['install', '--frozen-lockfile'], {
    cwd: worktreeDir,
  });
  if (installResult.status !== 0) {
    throw new Error(`pnpm install failed in worktree: ${installResult.stderr.slice(-400)}`);
  }

  const verifyResult = runCommand('bash', ['tools/scripts/agent-verify.sh'], {
    cwd: worktreeDir,
  });
  const securityResult = runCommand('pnpm', ['policy:security', '--ci'], { cwd: worktreeDir });
  const isSuccess = verifyResult.status === 0 && securityResult.status === 0;
  const state = isSuccess ? 'success' : 'failure';
  const description = isSuccess
    ? 'Local 28-gate agent:verify + policy:security passed'
    : 'Local 28-gate agent:verify or policy:security failed';

  for (const context of REQUIRED_CONTEXTS) {
    postCommitStatus({ sha, state, context, description, isDryRun });
  }
}

function verifyShaInWorktree({ sha, baseRef = '', isDryRun }) {
  if (hasPassingRequiredStatuses(sha)) {
    console.log(
      `[CI-GATEKEEPER] ${sha.slice(0, 8)} already has passing local statuses — skipping.`
    );
    return;
  }

  for (const context of REQUIRED_CONTEXTS) {
    postCommitStatus({
      sha,
      state: 'pending',
      context,
      description: 'Running local 28-gate verification in isolated worktree...',
      isDryRun,
    });
  }

  const worktreeDir = path.join(os.tmpdir(), `arch-ci-gatekeeper-${sha.slice(0, 8)}`);
  if (fs.existsSync(worktreeDir)) {
    runCommand('git', ['worktree', 'remove', '--force', worktreeDir]);
  }

  const addResult = runCommand('git', ['worktree', 'add', '--detach', worktreeDir, sha]);
  if (addResult.status !== 0) {
    throw new Error(`Failed to create worktree for ${sha}: ${addResult.stderr}`);
  }

  try {
    const canVerify = mergeBaseIntoWorktree({ sha, baseRef, worktreeDir, isDryRun });
    if (!canVerify) {
      return;
    }
    executeWorktreeGates({ sha, worktreeDir, isDryRun });
  } finally {
    runCommand('git', ['worktree', 'remove', '--force', worktreeDir]);
  }
}

function runForPr({ prNumber, isDryRun }) {
  const result = runCommand('gh', [
    'pr',
    'view',
    String(prNumber),
    '--json',
    'headRefOid,headRefName,title',
  ]);
  if (result.status !== 0) {
    throw new Error(`Could not inspect PR #${prNumber}: ${result.stderr}`);
  }
  const pr = JSON.parse(result.stdout);
  console.log(
    `[CI-GATEKEEPER] Verifying PR #${prNumber} (${pr.headRefName} @ ${pr.headRefOid.slice(0, 8)})`
  );
  runCommand('git', ['fetch', 'origin', pr.headRefName]);
  verifyShaInWorktree({ sha: pr.headRefOid, baseRef: 'origin/main', isDryRun });
}

function runForAllOpenPrs({ isDryRun }) {
  const result = runCommand('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'number,headRefOid,headRefName,isDraft',
  ]);
  if (result.status !== 0) {
    throw new Error(`Failed to list open PRs: ${result.stderr}`);
  }

  const pullRequests = JSON.parse(result.stdout || '[]');
  for (const pr of pullRequests) {
    if (pr.isDraft) {
      console.log(`[CI-GATEKEEPER] Skipping draft PR #${pr.number} (${pr.headRefName})`);
      continue;
    }
    runCommand('git', ['fetch', 'origin', pr.headRefName]);
    verifyShaInWorktree({ sha: pr.headRefOid, baseRef: 'origin/main', isDryRun });
  }
}

function setRepoWorkflowsState({ shouldEnable, isDryRun }) {
  const targetCurrentState = shouldEnable ? 'disabled_manually' : 'active';
  const subcommand = shouldEnable ? 'enable' : 'disable';
  const listResult = runCommand('gh', [
    'api',
    `/repos/${GITHUB_REPO}/actions/workflows?per_page=100`,
    '--jq',
    `.workflows[] | select(.state == "${targetCurrentState}" and (.path | startswith(".github/workflows/"))) | "\\(.id)|\\(.name)"`,
  ]);
  if (listResult.status !== 0) {
    throw new Error(`Failed to list workflows: ${listResult.stderr}`);
  }

  const lines = listResult.stdout.split('\n').filter(Boolean);
  for (const line of lines) {
    const [workflowId, workflowName] = line.split('|');
    if (isDryRun) {
      console.log(`[DRY-RUN] gh workflow ${subcommand} ${workflowId} (${workflowName})`);
      continue;
    }
    const toggleResult = runCommand('gh', ['workflow', subcommand, String(workflowId)]);
    if (toggleResult.status !== 0) {
      throw new Error(`Failed to ${subcommand} ${workflowName}: ${toggleResult.stderr}`);
    }
    console.log(`[CI-GATEKEEPER] ${subcommand}d workflow: ${workflowName}`);
  }
}

function printHelp() {
  console.log(`Autonomous Local CI Gatekeeper (${GITHUB_REPO})

Usage:
  pnpm ci:gatekeeper --from-evidence [--sha <sha>] [--dry-run]
  pnpm ci:gatekeeper --pr <number> [--dry-run]
  pnpm ci:gatekeeper --all-open-prs [--dry-run]
  pnpm ci:gatekeeper --pause-workflows [--dry-run]
  pnpm ci:gatekeeper --resume-workflows [--dry-run]
`);
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const handlers = {
    'from-evidence': () => publishFromEvidence({ sha: options.sha, isDryRun: options.isDryRun }),
    'all-open-prs': () => runForAllOpenPrs({ isDryRun: options.isDryRun }),
    'pause-workflows': () =>
      setRepoWorkflowsState({ shouldEnable: false, isDryRun: options.isDryRun }),
    'resume-workflows': () =>
      setRepoWorkflowsState({ shouldEnable: true, isDryRun: options.isDryRun }),
    pr: () =>
      options.prNumber
        ? runForPr({ prNumber: options.prNumber, isDryRun: options.isDryRun })
        : printHelp(),
    help: () => printHelp(),
  };
  const handler = handlers[options.mode] ?? printHelp;
  handler();
}

main();
