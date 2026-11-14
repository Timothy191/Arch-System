#!/usr/bin/env node
/**
 * @file tools/scripts/ci-reindex-diff.cjs
 * @description Incremental/diff-aware CodeGraph refresh.
 * Checks if tracked or untracked TS/TSX files changed relative to HEAD;
 * if so, runs `pnpm ci:reindex && pnpm ci:snapshot` to keep CodeGraph in sync.
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function main() {
  const diffOutput = execSync('git status --porcelain -- "*.ts" "*.tsx" "*.js" "*.cjs"', {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();

  if (!diffOutput) {
    console.log('✅ No pending TS/TSX/JS changes detected; checking drift only...');
    execSync('pnpm audit:code-intelligence', { cwd: ROOT, stdio: 'inherit' });
    return;
  }

  console.log('🔄 Pending code changes detected — refreshing CodeGraph index & snapshot...');
  execSync('pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence', {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

main();
