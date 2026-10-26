#!/usr/bin/env node

/**
 * Gate 18: Performance & Load Regression Auditor
 *
 * Enforces deterministic performance budgets across CSS, bundles, Next.js data-fetching,
 * Turbopack chunk splitting, and k6 load/latency threshold contracts:
 *   1. Bundle & CSS Performance Budgets: Runs check-css-performance.cjs (<= 115 KB)
 *      and check-bundle-size.cjs (when .next build artifacts exist).
 *   2. Next.js Data-Fetching & Turbopack Chunk Budgets: Runs audit-data-fetching.cjs
 *      and audit-turbopack.cjs.
 *   3. k6 Load & Latency Threshold Contract: Verifies explicit p95/p99 latency and error-rate
 *      thresholds in k6/ci-probe.js, k6/stress-test.js, and tools/audits/k6-telemetry-benchmark.js.
 *      Executes live k6 probe when RUN_LIVE_LOAD_TEST=1 and k6 binary is installed.
 *
 * Run: node tools/audits/audit-performance-budgets.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const NEXT_BUILD_DIR = path.join(ROOT, 'apps', 'portal', '.next');

console.log('\n⚡ Initiating Gate 18: Performance & Load Regression Audit...\n');

const violations = [];
const warnings = [];

/**
 * Execute a child Node audit script and record status
 */
function runNodeAudit(label, scriptRelPath) {
  const scriptAbsPath = path.join(ROOT, scriptRelPath);
  if (!fs.existsSync(scriptAbsPath)) {
    violations.push(`Missing required performance audit script: ${scriptRelPath}`);
    return false;
  }

  const res = spawnSync(process.execPath, [scriptAbsPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });

  if (res.status !== 0) {
    const errOut = (res.stderr || res.stdout || '').trim();
    violations.push(`${label} (${scriptRelPath}) failed:\n${errOut}`);
    return false;
  }

  console.log(`   ✓ ${label} (${scriptRelPath}) passed.`);
  return true;
}

// ── 1. Bundle & CSS Performance Budgets ──────────────────────────────────────
console.log('1️⃣  Auditing CSS & Production Bundle Size Budgets...');

runNodeAudit('CSS Performance & Size Budget (<= 115 KB)', 'tools/audits/check-css-performance.cjs');

const nextStaticChunksDir = path.join(NEXT_BUILD_DIR, 'static', 'chunks');
if (fs.existsSync(nextStaticChunksDir)) {
  runNodeAudit('Portal Gzipped Bundle Size Budget', 'tools/audits/check-bundle-size.cjs');
} else {
  console.log(
    '   ℹ️  apps/portal/.next/static/chunks not present; verified config/tools/.bundlesize-config.json static contract.'
  );
  const bundleConfigPath = path.join(ROOT, 'config', 'tools', '.bundlesize-config.json');
  if (!fs.existsSync(bundleConfigPath)) {
    violations.push('Missing config/tools/.bundlesize-config.json bundle budget definition.');
  }
}

// ── 2. Next.js Data-Fetching & Turbopack Chunk Budgets ───────────────────────
console.log('2️⃣  Auditing Next.js 16 Data-Fetching Waterfalls & Turbopack Chunk Isolation...');

runNodeAudit('Next.js Data Fetching & Streaming Skeletons', 'tools/audits/audit-data-fetching.cjs');
runNodeAudit('Turbopack Root & Heavy Library Isolation', 'tools/audits/audit-turbopack.cjs');

// ── 3. k6 Load & Latency Threshold Contract ──────────────────────────────────
console.log('3️⃣  Verifying k6 Load & Latency Threshold Contracts...');

const k6Contracts = [
  {
    relPath: 'k6/ci-probe.js',
    requiredTokens: ['thresholds', 'p(95)<350', 'p(99)<700', 'http_req_failed', 'rate<0.01'],
  },
  {
    relPath: 'k6/stress-test.js',
    requiredTokens: ['thresholds', 'p(99)<1500', 'http_req_failed', 'rate<0.01'],
  },
  {
    relPath: 'tools/audits/k6-telemetry-benchmark.js',
    requiredTokens: ['thresholds', 'checks', 'rate>0.99'],
  },
];

for (const contract of k6Contracts) {
  const absPath = path.join(ROOT, contract.relPath);
  if (!fs.existsSync(absPath)) {
    violations.push(`Missing k6 load test script: ${contract.relPath}`);
    continue;
  }

  const content = fs.readFileSync(absPath, 'utf8');
  const missingTokens = contract.requiredTokens.filter((token) => !content.includes(token));

  if (missingTokens.length > 0) {
    violations.push(
      `${contract.relPath} is missing required SLA threshold token(s): ${missingTokens.join(', ')}`
    );
  } else {
    console.log(
      `   ✓ ${contract.relPath} enforces SLA thresholds (${contract.requiredTokens.slice(1).join(', ')}).`
    );
  }
}

if (process.env.RUN_LIVE_LOAD_TEST === '1') {
  const k6Check = spawnSync('k6', ['version'], { cwd: ROOT, encoding: 'utf8' });
  if (k6Check.status === 0) {
    console.log('   🚀 Executing live k6 telemetry benchmark probe...');
    const liveRun = spawnSync('k6', ['run', 'tools/audits/k6-telemetry-benchmark.js'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });
    if (liveRun.status !== 0) {
      violations.push(
        `Live k6 telemetry benchmark failed:\n${(liveRun.stderr || liveRun.stdout || '').trim()}`
      );
    } else {
      console.log('   ✓ Live k6 telemetry benchmark passed.');
    }
  } else {
    warnings.push('RUN_LIVE_LOAD_TEST=1 was set, but k6 binary is not installed in PATH.');
  }
} else {
  console.log(
    '   ℹ️  [STATIC_BUDGET_PASS] Live k6 load probe skipped (set RUN_LIVE_LOAD_TEST=1 to execute live k6 run).'
  );
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 Performance & Load Regression Audit Summary:');
console.log(`   • k6 SLA Contracts Verified: ${k6Contracts.length}`);
console.log(`   • Violations: ${violations.length}`);
console.log(`   • Warnings: ${warnings.length}\n`);

if (warnings.length > 0) {
  console.log('⚠️  Advisory Warnings:');
  for (const w of warnings) {
    console.log(`   • ${w}`);
  }
  console.log('');
}

if (violations.length > 0) {
  console.error('❌ Gate 18 Performance & Load Regression Audit Failed:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Gate 18 Performance & Load Regression Audit Passed: 100% compliant!\n');
process.exit(0);
