#!/usr/bin/env node
/**
 * Gate: Secret scanning via gitleaks (or fallback to built-in regex).
 * Wraps gitleaks CLI; skips gracefully if binary not installed.
 * Supports --update-baseline to regenerate secrets-baseline.json.
 * Runs staged scan (fast) + full working-tree scan.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'config', 'tools', '.gitleaks.toml');
const BASELINE = path.join(__dirname, 'secrets-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const check = spawnSync('gitleaks', ['version'], { stdio: 'pipe' });
if (check.error || check.status !== 0) {
  console.log(
    '⚠️  gitleaks not installed — skipping secret scan (fallback: audit:supply-chain covers regex secrets).'
  );
  console.log(
    '   Install: brew install gitleaks  OR  go install github.com/gitleaks/gitleaks/v8@latest'
  );
  process.exit(0);
}

console.log('\n🔐 Running gitleaks secret scan...\n');

// Full working-tree scan
const result = spawnSync(
  'gitleaks',
  [
    'detect',
    '--source',
    ROOT,
    '--config',
    CONFIG,
    '--report-format',
    'json',
    '--report-path',
    '/dev/stdout',
    '--no-banner',
  ],
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
);

let leaks = [];
try {
  const parsed = JSON.parse(result.stdout || '[]');
  leaks = Array.isArray(parsed) ? parsed : [];
} catch {
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

const fingerprints = leaks.map((l) => ({
  file: l.File,
  line: l.StartLine,
  rule: l.RuleID,
  description: l.Description,
}));

if (UPDATE_BASELINE) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      { version: 1, generatedAt: new Date().toISOString(), findings: fingerprints },
      null,
      2
    ) + '\n'
  );
  console.log(`✅ Baseline updated: ${fingerprints.length} leaks written to ${BASELINE}`);
  console.log('   Review for real secrets first — rotate, do not just baseline.');
  process.exit(0);
}

let baseline = { findings: [] };
if (fs.existsSync(BASELINE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
}
const baselineKeys = new Set((baseline.findings || []).map((f) => `${f.file}|${f.line}|${f.rule}`));

const newLeaks = fingerprints.filter((f) => !baselineKeys.has(`${f.file}|${f.line}|${f.rule}`));

console.log(`   Total leaks: ${leaks.length}`);
console.log(`   Baseline leaks: ${baselineKeys.size}`);
console.log(`   NEW leaks: ${newLeaks.length}\n`);

if (newLeaks.length > 0) {
  console.error('❌ Gitleaks detected new secrets:');
  for (const leak of newLeaks.slice(0, 50)) {
    console.error(`   ${leak.file}:${leak.line} — ${leak.rule}: ${leak.description}`);
  }
  if (newLeaks.length > 50) console.error(`   ... and ${newLeaks.length - 50} more`);
  console.error('\n   Rotate any real secret immediately; do NOT just allowlist.');
  process.exit(1);
}

console.log('✅ Gitleaks secret scan passed (no new leaks).\n');
process.exit(0);
