#!/usr/bin/env node
/**
 * @file tools/scripts/biome-parse-guard.cjs
 * @description Pre-commit / pre-push guard that detects Biome parse errors
 *              and blocks unsafe autofixes. Runs in O(files) via JSON reporter.
 *              Returns non-zero on any parse-category diagnostic.
 */

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function runBiomeParseCheck(targetFiles) {
  const args = ['check', '--reporter=json', '--colors=off', ...targetFiles];
  const result = spawnSync('pnpm', ['biome', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16, // 16MB
    timeout: 120000,
  });

  if (result.error) {
    console.error(`[BIOME PARSE GUARD] Spawn failed: ${result.error.message}`);
    return { parseErrors: [{ file: 'spawn', message: result.error.message }], raw: '' };
  }

  const jsonOut = result.stdout || '';
  const jsonStart = jsonOut.indexOf('{');
  if (jsonStart === -1) {
    console.error('[BIOME PARSE GUARD] No JSON in output');
    console.error('STDOUT:', result.stdout?.slice(0, 500));
    console.error('STDERR:', result.stderr?.slice(0, 500));
    return {
      parseErrors: [{ file: 'no-json', message: 'Biome JSON reporter missing' }],
      raw: jsonOut,
    };
  }

  let diagnostics = [];
  try {
    const parsed = JSON.parse(jsonOut.slice(jsonStart));
    diagnostics = parsed.diagnostics || [];
  } catch (e) {
    console.error('[BIOME PARSE GUARD] JSON parse failed:', e.message);
    return { parseErrors: [{ file: 'json-parse', message: e.message }], raw: jsonOut };
  }

  const parseErrors = diagnostics
    .filter((d) => d.category === 'parse' && d.severity === 'error')
    .map((d) => ({
      file: d.location?.path || 'unknown',
      line: d.location?.start?.line,
      column: d.location?.start?.column,
      message: d.message,
    }));

  return { parseErrors, raw: jsonOut };
}

function getStagedOrAllFiles() {
  // Explicit file paths passed as args bypass git discovery.
  const explicit = process.argv.slice(2).filter((a) => !a.startsWith('--') && fs.existsSync(a));
  if (explicit.length > 0) return explicit.map((p) => path.resolve(ROOT, p));

  // Pre-commit / pre-push: staged files; bare invocation in CI: all tracked files
  const isStaged =
    process.env.GIT_HOOK === 'pre-commit' ||
    process.argv.includes('--staged') ||
    process.argv.includes('--pre-push');
  try {
    const args = isStaged
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACM']
      : ['ls-files', '*.ts', '*.tsx', '*.js', '*.jsx'];
    const out = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    if (out.error) return [];
    return out.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l && (l.endsWith('.ts') || l.endsWith('.tsx') || l.endsWith('.js') || l.endsWith('.jsx'))
      );
  } catch {
    return [];
  }
}

function attemptGitRestore(filePath) {
  const rel = path.relative(ROOT, filePath);
  console.log(`[BIOME PARSE GUARD] Attempting git restore for: ${rel}`);
  const result = spawnSync('git', ['checkout', 'HEAD', '--', rel], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status === 0) {
    console.log(`[BIOME PARSE GUARD] ✅ Restored ${rel} from HEAD`);
    return true;
  }
  console.error(`[BIOME PARSE GUARD] ❌ Git restore failed for ${rel}:`, result.stderr);
  return false;
}

function main() {
  const files = getStagedOrAllFiles();
  if (files.length === 0) {
    console.log('[BIOME PARSE GUARD] No TS/JS/JSX files to check.');
    process.exit(0);
  }

  console.log(`[BIOME PARSE GUARD] Checking ${files.length} file(s) for parse errors...`);
  const { parseErrors } = runBiomeParseCheck(files);

  if (parseErrors.length > 0) {
    console.error('\n❌ [BIOME PARSE GUARD] Parse errors detected:');
    for (const err of parseErrors) {
      const loc = err.line ? `:${err.line}:${err.column}` : '';
      console.error(`  ${err.file}${loc} — ${err.message}`);
    }

    // Only auto-remediate in CI / pre-push, NOT in pre-commit (prevents silent overwrite)
    const isInteractive = process.env.CI !== 'true' && process.argv.includes('--staged');
    if (!isInteractive) {
      console.log('\n🔧 [BIOME PARSE GUARD] Attempting autonomous remediation (git restore)...');
      let restored = 0;
      for (const err of parseErrors) {
        if (fs.existsSync(path.join(ROOT, err.file))) {
          if (attemptGitRestore(path.join(ROOT, err.file))) restored++;
        }
      }
      if (restored > 0) {
        console.log(`\n✅ [BIOME PARSE GUARD] Restored ${restored} file(s). Re-running check...`);
        const recheck = runBiomeParseCheck(files);
        if (recheck.parseErrors.length === 0) {
          console.log('✅ [BIOME PARSE GUARD] Parse errors resolved after remediation.');
          process.exit(0);
        }
      }
    } else {
      console.log('\n💡 [BIOME PARSE GUARD] Fix manually, then stage and commit.');
    }

    process.exit(1);
  }

  console.log('✅ [BIOME PARSE GUARD] No parse errors.');
  process.exit(0);
}

main();
