#!/usr/bin/env node
'use strict';

/**
 * @file tools/scripts/test-coverage-ratchet.cjs
 * @description Enforces a higher test coverage threshold on changed or newly
 * added apps/portal runtime files without breaking the legacy global floor.
 *
 * Usage:
 *   node tools/scripts/test-coverage-ratchet.cjs [--base=origin/main] [--threshold=70]
 */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORTAL_PREFIX = 'apps/portal/';
const ELIGIBLE_DIR_RE = /^apps\/portal\/(?:lib|features|app|components|hooks|server)\//;
const SOURCE_EXT_RE = /\.(?:ts|tsx)$/;
const EXCLUDED_FILE_RE = /\.(?:test|spec|stories|generated|d)\.(?:ts|tsx)$/;

function parseArgs(argv) {
  let baseRef = 'origin/main';
  let threshold = 70;
  for (const token of argv) {
    if (token.startsWith('--base=')) {
      baseRef = token.slice('--base='.length);
    } else if (token.startsWith('--threshold=')) {
      const parsed = Number.parseInt(token.slice('--threshold='.length), 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
        threshold = parsed;
      }
    }
  }
  return { baseRef, threshold };
}

function runGitLines(args) {
  try {
    const out = execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function refExists(ref) {
  const res = spawnSync('git', ['rev-parse', '--verify', ref], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return res.status === 0;
}

function collectChangedPortalFiles(baseRef) {
  const candidates = new Set();
  const resolvedBase = refExists(baseRef) ? baseRef : refExists('HEAD~1') ? 'HEAD~1' : '';
  if (resolvedBase) {
    for (const file of runGitLines(['diff', '--name-only', `${resolvedBase}...HEAD`])) {
      candidates.add(file);
    }
  }
  for (const file of runGitLines(['diff', '--name-only'])) {
    candidates.add(file);
  }
  for (const file of runGitLines(['diff', '--cached', '--name-only'])) {
    candidates.add(file);
  }
  for (const file of runGitLines(['ls-files', '--others', '--exclude-standard'])) {
    candidates.add(file);
  }

  return Array.from(candidates)
    .filter((relPath) => ELIGIBLE_DIR_RE.test(relPath))
    .filter((relPath) => SOURCE_EXT_RE.test(relPath))
    .filter((relPath) => !EXCLUDED_FILE_RE.test(relPath))
    .filter((relPath) => fs.existsSync(path.join(ROOT, relPath)))
    .map((relPath) => relPath.slice(PORTAL_PREFIX.length))
    .sort();
}

function main() {
  const { baseRef, threshold } = parseArgs(process.argv.slice(2));
  const changedFiles = collectChangedPortalFiles(baseRef);

  if (changedFiles.length === 0) {
    console.log('⏭  No changed apps/portal runtime files — coverage ratchet skipped (PASS).');
    process.exit(0);
  }

  console.log(
    `🧪 [COVERAGE RATCHET] Enforcing >= ${threshold}% lines/statements on ${changedFiles.length} changed portal file(s):`
  );
  for (const file of changedFiles) {
    console.log(`   • ${file}`);
  }

  const thresholdJson = JSON.stringify({
    global: {
      lines: threshold,
      statements: threshold,
    },
  });

  const jestArgs = [
    '--filter',
    'portal',
    'exec',
    'jest',
    '--coverage',
    '--runInBand',
    '--findRelatedTests',
    ...changedFiles,
    ...changedFiles.map((file) => `--collectCoverageFrom=${file}`),
    `--coverageThreshold=${thresholdJson}`,
  ];

  const res = spawnSync('pnpm', jestArgs, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  process.exit(res.status ?? 1);
}

main();
