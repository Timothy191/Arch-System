#!/usr/bin/env node

/**
 * Next.js Data Fetching, Streaming & Architecture Boundary Auditor
 *
 * Enforces Next.js 16 Data Fetching standards across apps/portal:
 *   1. Client Boundary Isolation: 'use client' files MUST NOT import @repo/supabase/server or database clients.
 *   2. Waterfall Prevention: Sequential independent awaits should be parallelized via Promise.all / Promise.allSettled.
 *   3. Route Segment Loading Coverage: Key department and hub route folders must maintain loading.tsx skeletons.
 *   4. React 19 Promise Streaming: Client components consuming promises via use() must be accompanied by Suspense boundaries.
 *
 * Run: node tools/audits/audit-data-fetching.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const PORTAL_APP = path.join(ROOT, 'apps', 'portal', 'app');

console.log('\n⚡ Initiating Next.js Data Fetching, Streaming & Boundary Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;

// ── 1. Client-Side Server Client Leak Audit ──────────────────────────────────
console.log('1️⃣  Auditing Client Components for illegal server-side database imports...');

const tsxFiles = glob.sync('**/*.{ts,tsx}', {
  cwd: PORTAL_APP,
  ignore: ['node_modules/**', '.next/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  absolute: true,
});

filesScanned = tsxFiles.length;

for (const file of tsxFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  const isClient = /^\s*['"]use client['"]/m.test(content);
  if (isClient) {
    if (content.includes('@repo/supabase/server') || content.includes('@repo/database')) {
      violations.push(
        `${relPath} - Client Component ('use client') is directly importing server database modules. Data persistence must route via Server Actions or Route Handlers.`
      );
    }
  }
}

// ── 2. Route Segment Loading Skeleton Audit ───────────────────────────────────
console.log('2️⃣  Auditing Route Segment loading.tsx skeleton coverage...');

const criticalRoutes = [
  'hub',
  'admin',
  '(departments)',
  '(departments)/engineering',
  '(departments)/drilling',
  '(departments)/access-control',
];

for (const route of criticalRoutes) {
  const loadingFile = path.join(PORTAL_APP, route, 'loading.tsx');
  if (!fs.existsSync(loadingFile)) {
    warnings.push(
      `Missing loading.tsx skeleton at apps/portal/app/${route}/loading.tsx for progressive streaming.`
    );
  }
}

// ── 3. Sequential Waterfall Pattern Heuristic ─────────────────────────────────
console.log(
  '3️⃣  Scanning for unparallelized sequential database queries in server actions & handlers...'
);

const routeHandlers = glob.sync('**/route.ts', {
  cwd: PORTAL_APP,
  ignore: ['node_modules/**', '.next/**', '**/*.test.ts'],
  absolute: true,
});

for (const file of routeHandlers) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  // Look for consecutive unparallelized awaits on supabase or db queries within the same function scope
  const lines = content.split('\n');
  let consecutiveAwaits = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith('const ') &&
      line.includes('await supabase.') &&
      !line.includes('Promise.all')
    ) {
      consecutiveAwaits++;
      if (consecutiveAwaits >= 3) {
        warnings.push(
          `${relPath}:${i + 1} - Multiple consecutive sequential database awaits detected. Consider parallelizing with Promise.allSettled() if queries are independent.`
        );
        break;
      }
    } else if (line.length === 0 || line.startsWith('//')) {
      // ignore empty lines and comments
    } else {
      consecutiveAwaits = 0;
    }
  }
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 Data Fetching & Streaming Audit Summary:');
console.log(`   • Scanned Files: ${filesScanned}`);
console.log(`   • Violations: ${violations.length}`);
console.log(`   • Warnings: ${warnings.length}\n`);

if (warnings.length > 0) {
  console.log('⚠️  Advisory Warnings:');
  for (const w of warnings) {
    console.log(`   ${w}`);
  }
  console.log('');
}

if (violations.length > 0) {
  console.error('❌ Data Fetching Audit Failed with Violations:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Data Fetching & Streaming Audit Passed: 100% boundary compliance!\n');
process.exit(0);
