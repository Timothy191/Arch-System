#!/usr/bin/env node
/**
 * Coverage Ratchet — prevents coverage regression in CI.
 *
 * Reads the current coverage from Jest's coverage-summary.json and compares
 * against the baseline in .ci-local/coverage-baseline.json. Fails if any
 * metric drops below the baseline.
 *
 * Usage: node tools/scripts/coverage-ratchet.cjs [--update-baseline]
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(ROOT, '.ci-local', 'coverage-baseline.json');
const COVERAGE_PATH = path.join(ROOT, 'apps/portal/coverage', 'coverage-summary.json');
const UPDATE = process.argv.includes('--update-baseline');

let current = null;
try {
  const raw = fs.readFileSync(COVERAGE_PATH, 'utf8');
  const summary = JSON.parse(raw);
  current = summary.total;
} catch {
  console.log('⚠️  No coverage summary found at', COVERAGE_PATH);
  console.log('   Run: pnpm --filter portal test -- --coverage');
  process.exit(0); // non-blocking if no coverage data
}

if (!current) {
  console.log('⚠️  Coverage data incomplete — skipping ratchet check.');
  process.exit(0);
}

const metrics = ['lines', 'statements', 'functions', 'branches'];
const currentPercentages = {};
for (const m of metrics) {
  currentPercentages[m] = current[m]?.pct ?? 0;
}

if (UPDATE || !fs.existsSync(BASELINE_PATH)) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(currentPercentages, null, 2));
  console.log('✅ Coverage baseline updated:', JSON.stringify(currentPercentages));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
let failed = false;
for (const m of metrics) {
  const base = baseline[m] ?? 0;
  const curr = currentPercentages[m];
  const delta = curr - base;
  const status = delta >= 0 ? '✅' : '❌';
  console.log(
    `${status} ${m}: ${curr}% (baseline: ${base}%, delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)`
  );
  if (curr < base) failed = true;
}

if (failed) {
  console.error('\n❌ Coverage ratchet FAILED — coverage decreased below baseline.');
  console.error('   Run with --update-baseline only if the decrease is intentional and approved.');
  process.exit(1);
}

console.log('\n✅ Coverage ratchet PASSED — no regression detected.');
PY;
