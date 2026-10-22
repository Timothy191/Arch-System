#!/usr/bin/env node

/**
 * @fileoverview Enforces critical security checks across the codebase to prevent vulnerabilities.
 * Usage: node tools/audits/enforce-security-checks.cjs [--ci]
 */
/**
 * Security Checks Enforcer
 *
 * Runs the regex patterns defined in tools/repo/policy/security.checks.json against
 * the codebase to prevent common vulnerabilities (eval, sql concat, secrets).
 *
 * Usage: node tools/audits/enforce-security-checks.cjs [--ci]
 */

const fs = require('node:fs');
const path = require('node:path');
let globSync;
try {
  // glob v9+ uses globSync, v8 uses glob.sync
  const glob = require('glob');
  globSync = glob.globSync || glob.sync;
} catch (_e) {
  console.error("❌ 'glob' package not found. Run pnpm install.");
  process.exit(1);
}

const POLICY_PATH = path.join(__dirname, '..', 'repo', 'policy', 'security.checks.json');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

if (!fs.existsSync(POLICY_PATH)) {
  console.error(`❌ Policy file not found: ${POLICY_PATH}`);
  console.error("Run 'pnpm policy:gen' first.");
  process.exit(1);
}

const policyData = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf-8'));
const checks = policyData.checks || [];

const isCI = process.argv.includes('--ci');
const currentEnv = isCI ? 'ci' : 'local';

let hasErrors = false;
let warningCount = 0;

console.log(`\n🛡️  Running Security Checks (Env: ${currentEnv})...\n`);

for (const check of checks) {
  if (!check.enforceAt.includes(currentEnv)) {
    continue; // Skip checks not meant for this environment
  }

  const regex = new RegExp(check.pattern, 'g');

  let filesToScan = [];
  for (const globPattern of check.paths) {
    const matched = globSync(globPattern, {
      cwd: REPO_ROOT,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.turbo/**'],
    });
    filesToScan = filesToScan.concat(matched);
  }

  // Pre-collect functions hardened via subsequent ALTER FUNCTION or catalog migration (e.g. 166 / 192)
  const hardenedFunctions = new Set();
  if (check.id === 'no-mutable-search-path') {
    for (const file of filesToScan) {
      const sqlContent = fs.readFileSync(file, 'utf-8');
      const alterRe =
        /ALTER\s+FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*SET\s+search_path/gi;
      let m;
      while ((m = alterRe.exec(sqlContent)) !== null) {
        hardenedFunctions.add(m[1].toLowerCase());
      }
      const arraySigRe = /'public\.([a-zA-Z0-9_]+)\([^']*'/gi;
      if (/ALTER\s+FUNCTION\s+%s\s+SET\s+search_path/i.test(sqlContent)) {
        while ((m = arraySigRe.exec(sqlContent)) !== null) {
          hardenedFunctions.add(m[1].toLowerCase());
        }
      }
    }
  }

  for (const file of filesToScan) {
    // Skip checking this script itself and the policy compiler
    if (
      file.endsWith('tools/audits/enforce-security-checks.cjs') ||
      file.endsWith('tools/repo/policy-compiler.cjs')
    ) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        // Exclude lines that are just comments (JS or SQL)
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('--')) {
          regex.lastIndex = 0;
          continue;
        }

        if (check.id === 'no-mutable-search-path') {
          // Inspect multi-line function header up to AS $$ / LANGUAGE or check hardenedFunctions
          const headerWindow = lines.slice(i, Math.min(lines.length, i + 25)).join(' ');
          const fnMatch = line.match(
            /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/i
          );
          const fnName = fnMatch ? fnMatch[1].toLowerCase() : null;
          if (
            /SET\s+search_path/i.test(headerWindow) ||
            (fnName && hardenedFunctions.has(fnName))
          ) {
            regex.lastIndex = 0;
            continue;
          }
        }

        const relativePath = path.relative(REPO_ROOT, file);
        const symbol = check.severity === 'error' ? '❌' : '⚠️';
        console.log(`${symbol} [${check.id}] ${check.rule}`);
        console.log(`   File: ${relativePath}:${i + 1}`);
        console.log(`   Line: ${line.trim()}\n`);

        if (check.severity === 'error') {
          hasErrors = true;
        } else {
          warningCount++;
        }
      }
      regex.lastIndex = 0; // reset regex state
    }
  }
}

if (hasErrors) {
  console.error(`\n🔴 Security audit failed! Critical vulnerabilities found.`);
  process.exit(1);
}

if (warningCount > 0) {
  console.log(`\n🟡 Security audit passed with ${warningCount} warnings.`);
} else {
  console.log(`\n✅ Security audit passed. No violations found.`);
}
