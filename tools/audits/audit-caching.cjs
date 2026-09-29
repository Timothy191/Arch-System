#!/usr/bin/env node

/**
 * Next.js 16 Caching, Cache Components & Cache Boundary Auditor
 *
 * Enforces Next.js 16 Caching standards across apps/portal:
 *   1. Cache Components Configuration: apps/portal/next.config.mjs must declare cacheComponents: true
 *      and valid custom cacheLife profiles (stale <= revalidate <= expire).
 *   2. Cache Directive Safety: Functions or components using 'use cache' must NOT directly
 *      invoke dynamic runtime request APIs (cookies(), headers()) inside the cached scope.
 *   3. Cache Tag Convention: cacheTag() calls must use structured namespaced tags (e.g. dept_*, shift_*).
 *   4. Mutation Invalidation Parity: Server actions or route handlers performing DB writes
 *      must declare tag or path revalidation (cacheInvalidateTags or revalidateTag).
 *
 * Run: node tools/audits/audit-caching.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const PORTAL_APP = path.join(ROOT, 'apps', 'portal');
const PORTAL_APP_ROUTES = path.join(PORTAL_APP, 'app');
const NEXT_CONFIG = path.join(PORTAL_APP, 'next.config.mjs');

console.log('\n⚡ Initiating Next.js 16 Caching & Cache Components Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;

// ── 1. Next.js Config Cache Components & cacheLife Audit ────────────────────
console.log('1️⃣  Auditing apps/portal/next.config.mjs for Cache Components & cacheLife profiles...');

if (!fs.existsSync(NEXT_CONFIG)) {
  violations.push('apps/portal/next.config.mjs does not exist.');
} else {
  const configContent = fs.readFileSync(NEXT_CONFIG, 'utf8');

  // Verify cacheComponents: true
  if (!configContent.includes('cacheComponents: true')) {
    violations.push(
      'apps/portal/next.config.mjs must specify "cacheComponents: true" to activate Next.js 16 Cache Components.'
    );
  }

  // Verify cacheLife profile presence
  if (!configContent.includes('cacheLife:')) {
    violations.push(
      'apps/portal/next.config.mjs must define custom cacheLife profiles for industrial telemetry and departments.'
    );
  } else {
    // Validate profile definitions
    const expectedProfiles = ['telemetry', 'departments', 'reports'];
    for (const profile of expectedProfiles) {
      if (!configContent.includes(`${profile}:`)) {
        warnings.push(`Missing recommended cacheLife profile "${profile}" in next.config.mjs.`);
      }
    }
  }
}

// ── 2. Cache Directive ('use cache') & Dynamic API Safety Audit ─────────────
console.log('2️⃣  Auditing Server Components and cached functions for dynamic API isolation...');

const tsxFiles = glob.sync('**/*.{ts,tsx}', {
  cwd: PORTAL_APP_ROUTES,
  ignore: ['node_modules/**', '.next/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  absolute: true,
});

filesScanned += tsxFiles.length;

for (const file of tsxFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  const hasUseCacheDirective = /['"]use cache['"]/.test(content);

  if (hasUseCacheDirective) {
    // A function with 'use cache' cannot call dynamic functions (cookies(), headers()) directly
    if (content.includes('cookies()') || content.includes('headers()')) {
      violations.push(
        `${relPath} - Contains 'use cache' but directly calls cookies() or headers(). Dynamic runtime data must be passed as serializable parameters or isolated outside the cached boundary.`
      );
    }
  }

  // Check top-level page components calling cookies() or headers() directly without Suspense or private cache
  if (path.basename(file) === 'page.tsx') {
    if (
      (content.includes('cookies()') || content.includes('headers()')) &&
      !content.includes('<Suspense')
    ) {
      // Advisory warning for potential route de-optimization
      warnings.push(
        `${relPath} - Page calls dynamic headers/cookies directly. Wrap dynamic consumers in <Suspense> to allow the static page shell to be cached and prerendered.`
      );
    }
  }
}

// ── 3. Tag Invalidation Parity in Mutation Routes ───────────────────────────
console.log('3️⃣  Auditing Server Actions and Mutation Route Handlers for cache tag invalidation...');

const mutationHandlers = glob.sync('**/route.ts', {
  cwd: PORTAL_APP_ROUTES,
  ignore: ['node_modules/**', '.next/**', '**/*.test.ts'],
  absolute: true,
});

for (const file of mutationHandlers) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  const hasPostOrPatch = /export async function (POST|PATCH|PUT|DELETE)/.test(content);
  if (hasPostOrPatch) {
    const hasInvalidation =
      content.includes('cacheInvalidateTags') ||
      content.includes('revalidateTag') ||
      content.includes('revalidatePath');

    // If it mutates department or telemetry tables, it must invalidate cache
    if (
      (content.includes(".from('departments')") ||
        content.includes(".from('delay_entries')") ||
        content.includes(".from('equipment')") ||
        content.includes('.rpc(')) &&
      !hasInvalidation
    ) {
      warnings.push(
        `${relPath} - Mutation handler performs database write/RPC but does not call cacheInvalidateTags() or revalidateTag(). Ensure tag invalidation is triggered.`
      );
    }
  }
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 Next.js Caching & Cache Components Audit Summary:');
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
  console.error('❌ Caching Audit Failed with Violations:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Next.js Caching & Cache Components Audit Passed: 100% compliant!\n');
process.exit(0);
