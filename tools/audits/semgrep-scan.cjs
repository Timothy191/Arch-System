#!/usr/bin/env node
/**
 * Gate: Semgrep SAST scan for TS/JS/React/Next.js
 * Wraps semgrep CLI; skips gracefully if binary not installed.
 * Supports --update-baseline to regenerate sast-baseline.json.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = path.join(__dirname, 'semgrep.yml');
const BASELINE = path.join(__dirname, 'sast-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const check = spawnSync('semgrep', ['--version'], { stdio: 'pipe' });
if (check.error || check.status !== 0) {
  console.log('⚠️  semgrep not installed — skipping SAST scan.');
  console.log('   Install: pipx install semgrep  OR  brew install semgrep');
  process.exit(0);
}

console.log('\n🔍 Running Semgrep SAST scan...\n');

const result = spawnSync(
  'semgrep',
  [
    'scan',
    '--config',
    'p/typescript',
    '--config',
    'p/react',
    '--config',
    'p/nextjs',
    '--config',
    'p/owasp-top-ten',
    '--config',
    CONFIG,
    '--json',
    '--quiet',
    '--exclude',
    'node_modules',
    '--exclude',
    '.next',
    '--exclude',
    'dist',
    '--exclude',
    '*.test.*',
    '--exclude',
    '*.spec.*',
    ROOT,
  ],
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
);

let findings = [];
try {
  const parsed = JSON.parse(result.stdout || '{}');
  findings = parsed.results || [];
} catch {
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

const fingerprints = findings.map((f) => ({
  check_id: f.check_id,
  path: f.path,
  line: f.start?.line,
  message: f.extra?.message || '',
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
  console.log(`✅ Baseline updated: ${fingerprints.length} findings written to ${BASELINE}`);
  console.log('   Review findings before committing — fix real issues, do not just baseline them.');
  process.exit(0);
}

let baseline = { findings: [] };
if (fs.existsSync(BASELINE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
}
const baselineKeys = new Set(
  (baseline.findings || []).map((f) => `${f.check_id}|${f.path}|${f.line}`)
);

const newFindings = fingerprints.filter(
  (f) => !baselineKeys.has(`${f.check_id}|${f.path}|${f.line}`)
);

console.log(`   Total findings: ${findings.length}`);
console.log(`   Baseline findings: ${baselineKeys.size}`);
console.log(`   NEW findings: ${newFindings.length}\n`);

if (newFindings.length > 0) {
  console.error('❌ New Semgrep findings (not in baseline):');
  for (const f of newFindings.slice(0, 50)) {
    console.error(`   ${f.path}:${f.line} — ${f.check_id}: ${f.message}`);
  }
  if (newFindings.length > 50) console.error(`   ... and ${newFindings.length - 50} more`);
  console.error('\n   To update baseline after review: pnpm audit:sast -- --update-baseline');
  process.exit(1);
}

console.log('✅ Semgrep SAST scan passed (no new findings).\n');
process.exit(0);
