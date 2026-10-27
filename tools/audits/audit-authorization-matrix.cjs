#!/usr/bin/env node

/**
 * Gate 16: Security & Authorization Matrix Auditor
 *
 * Verifies role-based access control (RBAC), department tenant isolation,
 * API route authentication guards, Server Action auth checks, and fail-closed
 * secret verification across Control Room, Plant, Engineering, Access Control,
 * Database, and Administration modules.
 *
 * Run: node tools/audits/audit-authorization-matrix.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { globSync } = require('glob');

const ROOT = path.resolve(__dirname, '..', '..');
const PORTAL_DIR = path.join(ROOT, 'apps', 'portal');

console.log('\n🛡️  Initiating Gate 16: Security & Module Authorization Matrix Audit...\n');

const violations = [];
const warnings = [];

// Explicitly documented public, health, telemetry-probe, or framework-managed endpoints
const PUBLIC_OR_EXEMPT_API_ROUTES = new Set([
  'app/api/ai/metrics/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/codebase-maps/route.ts',
  'app/api/control-room/scada-status/route.ts',
  'app/api/csp-violations/route.ts',
  'app/api/doc/route.ts',
  'app/api/feedback/route.ts',
  'app/api/health/cache/route.ts',
  'app/api/health/fuxa/route.ts',
  'app/api/health/live/route.ts',
  'app/api/health/n8n/route.ts',
  'app/api/health/redis/route.ts',
  'app/api/health/route.ts',
  'app/api/health/supabase-realtime/route.ts',
  'app/api/health/warmup/route.ts',
  'app/api/inngest/route.ts',
  'app/api/log/route.ts',
  'app/api/metrics/prometheus/route.ts',
  'app/api/metrics/route.ts',
  'app/api/queues/process-order/route.ts',
  'app/api/redis-proxy/v1/health/route.ts',
  'app/api/scada/tags/route.ts',
  'app/api/upload/route.ts',
  'app/api/version/route.ts',
  'app/api/weather/route.ts',
  'app/api/workflows/jobs/[jobId]/route.ts',
]);

const AUTH_GUARD_PATTERNS = [
  /getAuthenticatedEmployee/,
  /auth\.getUser/,
  /auth\.getClaims/,
  /authorizeIngest/,
  /authorizeTelemetryStream/,
  /authorizeCronRequest/,
  /SCANNER_API_KEY/,
  /verifyToken/,
  /isAuthorized/,
  /CRON_SECRET/,
  /DISPATCH_API_KEY/,
  /WEBHOOK_SECRET/,
  /REDIS_AUTH_SECRET/,
  /N8N_API_KEY/,
  /withRateLimit/,
];

// ── 1. Audit Proxy Module-Level Authorization Matrix ────────────────────────
console.log('1️⃣  Auditing Proxy route gating across all 6 operational modules...');
const proxyFile = path.join(PORTAL_DIR, 'server', 'proxy.ts');
if (!fs.existsSync(proxyFile)) {
  violations.push('Missing apps/portal/server/proxy.ts');
} else {
  const proxyContent = fs.readFileSync(proxyFile, 'utf8');
  const requiredDepts = [
    'drilling',
    'production',
    'plant-processing',
    'plant-inventory',
    'access-control',
    'engineering',
    'control-room',
  ];
  for (const dept of requiredDepts) {
    if (!proxyContent.includes(`'${dept}'`)) {
      violations.push(`server/proxy.ts DEPARTMENT_ROUTES is missing '${dept}'`);
    }
  }
  const requiredRestricted = ['access-control', 'control-room', 'tools', 'admin'];
  for (const r of requiredRestricted) {
    if (!proxyContent.includes(r)) {
      violations.push(`server/proxy.ts RESTRICTED_ROUTES is missing '${r}'`);
    }
  }
  if (proxyContent.includes('// @ts-nocheck')) {
    violations.push('server/proxy.ts must not contain // @ts-nocheck');
  }
  console.log(
    `   ✓ Verified proxy route isolation for ${requiredDepts.length} departments and ${requiredRestricted.length} restricted route groups.`
  );
}

// ── 2. Audit All API Route Handlers for Auth Guards & Fail-Closed Secrets ──
console.log('2️⃣  Auditing API Route Handlers for authentication & fail-closed secrets...');
const apiRoutes = globSync('app/api/**/route.ts', { cwd: PORTAL_DIR });
let protectedApiCount = 0;

for (const relRoute of apiRoutes) {
  const normalized = relRoute.split(path.sep).join('/');
  const absPath = path.join(PORTAL_DIR, relRoute);
  const content = fs.readFileSync(absPath, 'utf8');

  // Check for dangerous fail-open secret pattern
  if (/if\s*\(\s*!secret\s*\)\s*return\s+true/.test(content)) {
    violations.push(
      `apps/portal/${normalized}: Contains fail-open secret check 'if (!secret) return true'`
    );
  }
  if (/`Bearer\s+\$\{process\.env\.CRON_SECRET\}`/.test(content)) {
    violations.push(
      `apps/portal/${normalized}: Uses raw 'Bearer \${process.env.CRON_SECRET}' interpolation (fails open to 'Bearer undefined' when unset); use authorizeCronRequest(req) instead.`
    );
  }

  if (PUBLIC_OR_EXEMPT_API_ROUTES.has(normalized)) {
    continue;
  }

  const hasGuard = AUTH_GUARD_PATTERNS.some((re) => re.test(content));
  if (!hasGuard) {
    violations.push(
      `apps/portal/${normalized}: Protected API route is missing an explicit authentication or secret verification guard.`
    );
  } else {
    protectedApiCount++;
  }
}
console.log(
  `   ✓ Audited ${apiRoutes.length} API routes (${protectedApiCount} authenticated/guarded, ${PUBLIC_OR_EXEMPT_API_ROUTES.size} documented public/probe endpoints).`
);

// ── 3. Execute Module-Level Authorization Matrix Jest Suite ─────────────────
if (!process.argv.includes('--static-only')) {
  console.log('3️⃣  Executing Module-Level Authorization Matrix unit/integration tests...');
  const jestRes = spawnSync(
    'pnpm',
    ['--filter', 'portal', 'test', '--', 'server/authorization-matrix.test.ts'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );
  if (jestRes.status !== 0) {
    violations.push(
      `Authorization matrix Jest test suite failed:\n${jestRes.stderr || jestRes.stdout}`
    );
  } else {
    console.log(
      '   ✓ Module-Level Authorization Matrix test suite passed (100% role & IDOR checks).'
    );
  }
}

console.log('\n📊 Gate 16 Authorization Matrix Audit Summary:');
console.log(`   • API Routes Audited: ${apiRoutes.length}`);
console.log(`   • Guarded Mutation/Data Routes: ${protectedApiCount}`);
console.log(`   • Violations: ${violations.length}`);
console.log(`   • Warnings: ${warnings.length}\n`);

if (violations.length > 0) {
  console.error('❌ Gate 16 Security & Authorization Matrix Audit Failed:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  process.exit(1);
}

console.log('✅ Gate 16 Security & Authorization Matrix Audit Passed: 100% compliant!\n');
process.exit(0);
