#!/usr/bin/env node
'use strict';

/**
 * @file tools/scripts/pre-commit-guards.cjs
 * @description Runtime-agnostic pre-commit guard mirroring .qoder/hooks/
 * path protection and SQL migration linting across all agents and shells.
 */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function getStagedFiles() {
  try {
    const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^\.\//, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isProtectedEnvFile(relPath) {
  if (relPath.endsWith('.example')) return false;
  const base = path.basename(relPath);
  return base === '.env' || base.startsWith('.env.');
}

function isBadTracerPath(relPath) {
  if (relPath === 'AGENT_TRACER.md') return false;
  const upper = path.basename(relPath).toUpperCase();
  if (upper.includes(`TRACER${'R'}`)) return true;
  if (upper === 'AGENTS_TRACER.MD' || upper === 'AGENTS-TRACER.MD') return true;
  if (relPath.endsWith('/AGENT_TRACER.md') || relPath.endsWith('/AGENTS_TRACER.md')) return true;
  return false;
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log('✅ [PRE-COMMIT GUARDS] No staged files to audit.');
    return;
  }

  const violations = [];
  const migrationsToLint = [];

  for (const relPath of stagedFiles) {
    if (isProtectedEnvFile(relPath)) {
      violations.push(
        `Blocked staged env file "${relPath}". Never commit real .env files; update *.example instead.`
      );
    }
    if (relPath.startsWith('packages/supabase/migrations/')) {
      violations.push(
        `Blocked symlinked path "${relPath}". Edit packages/database/migrations/ instead.`
      );
    }
    if (isBadTracerPath(relPath)) {
      violations.push(
        `Blocked non-canonical tracer path "${relPath}". Append entries only to root AGENT_TRACER.md.`
      );
    }
    if (
      relPath.startsWith('packages/database/migrations/') &&
      relPath.endsWith('.sql') &&
      fs.existsSync(path.join(ROOT, relPath))
    ) {
      migrationsToLint.push(relPath);
    }
  }

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`❌ [PRE-COMMIT GUARD] ${v}`);
    }
    process.exit(1);
  }

  const lintScript = path.join(ROOT, 'packages', 'database', 'scripts', 'lint-migrations.mjs');
  if (migrationsToLint.length > 0 && fs.existsSync(lintScript)) {
    for (const migrationRel of migrationsToLint) {
      console.log(`🗄️  [PRE-COMMIT GUARD] Linting staged migration: ${migrationRel}`);
      const res = spawnSync('node', [lintScript, migrationRel], {
        cwd: ROOT,
        stdio: 'inherit',
      });
      if (res.status !== 0) {
        console.error(`❌ [PRE-COMMIT GUARD] Migration lint failed for ${migrationRel}`);
        process.exit(res.status || 1);
      }
    }
  }

  console.log(`✅ [PRE-COMMIT GUARDS] Verified ${stagedFiles.length} staged file(s).`);
}

main();
