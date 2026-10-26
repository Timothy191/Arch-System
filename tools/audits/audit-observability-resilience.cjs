#!/usr/bin/env node

/**
 * Gate 21: Production Observability & Resilience Auditor
 *
 * Verifies health/readiness/liveness probes, Prometheus metrics endpoints, OpenTelemetry
 * tracing instrumentation, Redis graceful degradation, and executes fault-injection tests:
 *   1. Health, Liveness, Warmup & Metrics Route Handlers: Verifies existence and handler exports
 *      of /api/health, /api/health/live, /api/health/warmup, /api/health/redis, and /api/metrics.
 *   2. OpenTelemetry & Structured Logger Instrumentation: Verifies apps/portal/lib/observability/tracing.ts
 *      and @repo/logger structured logging exports.
 *   3. Redis Capability Fallback & Proxy Timeout Resilience: Verifies sendSafe/detectCapabilities
 *      in packages/redis/src/raw.ts and SESSION_READ_BUDGET_MS timeout race in apps/portal/server/proxy.ts.
 *   4. Fault-Injection & Observability Unit Tests: Executes Jest unit tests for health and metrics routes.
 *
 * Run: node tools/audits/audit-observability-resilience.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

console.log('\n📡 Initiating Gate 21: Production Observability & Resilience Audit...\n');

const violations = [];
const warnings = [];

// ── 1. Health, Liveness, Readiness & Prometheus Metrics Endpoints ────────────
console.log('1️⃣  Auditing Health, Liveness, Warmup, Redis & Prometheus Metrics Route Handlers...');

const requiredRoutes = [
  'apps/portal/app/api/health/route.ts',
  'apps/portal/app/api/health/live/route.ts',
  'apps/portal/app/api/health/warmup/route.ts',
  'apps/portal/app/api/health/redis/route.ts',
  'apps/portal/app/api/metrics/route.ts',
];

for (const routeRel of requiredRoutes) {
  const routeAbs = path.join(ROOT, routeRel);
  if (!fs.existsSync(routeAbs)) {
    violations.push(`Missing required observability endpoint: ${routeRel}`);
    continue;
  }

  const content = fs.readFileSync(routeAbs, 'utf8');
  if (!/export\s+(async\s+)?function\s+GET\b/.test(content)) {
    violations.push(`${routeRel} does not export a GET route handler.`);
  }
}

console.log(
  `   ✓ Verified all ${requiredRoutes.length} health, liveness, warmup & metrics route handlers.`
);

// ── 2. OpenTelemetry Tracing & @repo/logger Instrumentation ──────────────────
console.log('2️⃣  Auditing OpenTelemetry tracing & @repo/logger structured logging...');

const tracingPath = path.join(ROOT, 'apps/portal/lib/observability/tracing.ts');
if (!fs.existsSync(tracingPath)) {
  violations.push(
    'Missing OpenTelemetry instrumentation helper: apps/portal/lib/observability/tracing.ts'
  );
} else {
  const tracingContent = fs.readFileSync(tracingPath, 'utf8');
  const requiredTracingSymbols = ['@opentelemetry/api', 'withAsyncSpan', 'SpanStatusCode'];
  for (const sym of requiredTracingSymbols) {
    if (!tracingContent.includes(sym)) {
      violations.push(
        `apps/portal/lib/observability/tracing.ts is missing required OpenTelemetry symbol "${sym}".`
      );
    }
  }
}

const loggerIndexPath = path.join(ROOT, 'packages/logger/src/index.ts');
if (!fs.existsSync(loggerIndexPath)) {
  violations.push('Missing @repo/logger entry point: packages/logger/src/index.ts');
} else {
  const loggerContent = fs.readFileSync(loggerIndexPath, 'utf8');
  if (!loggerContent.includes('createLogger') || !loggerContent.includes('serverLogger')) {
    violations.push('packages/logger/src/index.ts must export createLogger and serverLogger.');
  }
}

console.log('   ✓ Verified OpenTelemetry tracing spans and @repo/logger structured logger.');

// ── 3. Redis Capability Fallback & Proxy Session Timeout Resilience ──────────
console.log('3️⃣  Auditing Redis graceful degradation & middleware timeout budgets...');

const redisRawPath = path.join(ROOT, 'packages/redis/src/raw.ts');
if (!fs.existsSync(redisRawPath)) {
  violations.push('Missing Redis transport layer: packages/redis/src/raw.ts');
} else {
  const rawContent = fs.readFileSync(redisRawPath, 'utf8');
  for (const fnName of [
    'export async function sendSafe',
    'export async function detectCapabilities',
  ]) {
    if (!rawContent.includes(fnName)) {
      violations.push(
        `packages/redis/src/raw.ts is missing required resilience function "${fnName}".`
      );
    }
  }
}

const proxyServerPath = path.join(ROOT, 'apps/portal/server/proxy.ts');
if (!fs.existsSync(proxyServerPath)) {
  violations.push('Missing portal server proxy: apps/portal/server/proxy.ts');
} else {
  const proxyContent = fs.readFileSync(proxyServerPath, 'utf8');
  if (!proxyContent.includes('SESSION_READ_BUDGET_MS') || !proxyContent.includes('Promise.race')) {
    violations.push(
      'apps/portal/server/proxy.ts must enforce SESSION_READ_BUDGET_MS with Promise.race fallback to database.'
    );
  }
}

console.log(
  '   ✓ Verified Redis sendSafe/detectCapabilities fallback and proxy SESSION_READ_BUDGET_MS timeout race.'
);

// ── 4. Fault-Injection & Observability Unit Tests ────────────────────────────
console.log('4️⃣  Executing fault-injection & observability Jest unit tests...');

const jestRun = spawnSync(
  'pnpm',
  [
    '--filter',
    'portal',
    'test',
    '--',
    'app/api/health/route.test.ts',
    'app/api/metrics/route.test.ts',
  ],
  {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 45000,
  }
);

if (jestRun.status !== 0) {
  const errOutput = (jestRun.stderr || jestRun.stdout || '').trim();
  violations.push(`Observability unit tests failed:\n${errOutput}`);
} else {
  console.log('   ✓ Jest health & metrics fault-injection unit tests passed.');
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 Observability & Resilience Audit Summary:');
console.log(`   • Probe & Metrics Routes Verified: ${requiredRoutes.length}`);
console.log(`   • Fault-Injection Test Suites Passed: ${jestRun.status === 0 ? 2 : 0}/2`);
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
  console.error('❌ Gate 21 Production Observability & Resilience Audit Failed:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Gate 21 Production Observability & Resilience Audit Passed: 100% compliant!\n');
process.exit(0);
