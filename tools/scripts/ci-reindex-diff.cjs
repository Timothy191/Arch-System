#!/usr/bin/env node
/**
 * @file tools/scripts/ci-reindex-diff.cjs
 * @description Incremental/diff-aware CodeGraph refresh.
 * Checks if tracked or untracked TS/TSX files changed relative to HEAD;
 * if so, runs `pnpm ci:reindex && pnpm ci:snapshot` to keep CodeGraph in sync.
 */

const fs = require('node:fs');
const os = require('node:os');
const { execSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const GRAPHIFY_BIN = path.join(os.homedir(), '.local', 'bin', 'graphify');

function syncSecondarySubstrates() {
  if (fs.existsSync(GRAPHIFY_BIN)) {
    console.log('🕸️  Refreshing Graphify knowledge graph (incremental AST)...');
    execSync(`${GRAPHIFY_BIN} update .`, { cwd: ROOT, stdio: 'inherit' });
  }
  console.log('🧠 Syncing RuFlo Swarm vector memory...');
  execSync('node tools/scripts/sync-vector-memory.mjs', { cwd: ROOT, stdio: 'inherit' });
}

function main() {
  const diffOutput = execSync(
    'git status --porcelain -- "*.ts" "*.tsx" "*.js" "*.cjs" "*.sql" "*.tf" "*.hcl"',
    {
      cwd: ROOT,
      encoding: 'utf8',
    }
  ).trim();

  if (!diffOutput) {
    console.log('✅ No pending TS/TSX/JS/SQL/TF changes detected; checking drift only...');
    execSync('pnpm audit:code-intelligence', { cwd: ROOT, stdio: 'inherit' });
    return;
  }

  console.log(
    '🔄 Pending code changes detected — refreshing CodeGraph, Graphify & Vector Memory...'
  );
  execSync('pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  syncSecondarySubstrates();
}

main();
