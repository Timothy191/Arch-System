#!/usr/bin/env node

/**
 * Next.js 16 Turbopack & Lazy Loading Architecture Auditor
 *
 * Enforces Next.js 16 Turbopack & Bundling invariants across apps/portal:
 *   1. Monorepo Filesystem Root: apps/portal/next.config.mjs must declare turbopack.root pointing to workspaceRoot.
 *   2. Server Component SSR Isolation: 'ssr: false' inside next/dynamic() MUST NOT be called in Server Components.
 *   3. Magic Comments Compliance: Prohibits unsupported 'webpackOptional: true' in dynamic imports (must use 'turbopackOptional: true').
 *   4. Heavy Library Chunk Budget: Verifies that heavy libraries (@react-pdf/renderer, exceljs, @xyflow/react)
 *      are isolated via dynamic imports or modular subpaths rather than synchronously bundled into root layouts.
 *
 * Run: node tools/audits/audit-turbopack.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const PORTAL_APP = path.join(ROOT, 'apps', 'portal');
const PORTAL_APP_ROUTES = path.join(PORTAL_APP, 'app');
const NEXT_CONFIG = path.join(PORTAL_APP, 'next.config.mjs');

console.log('\n⚡ Initiating Next.js 16 Turbopack & Lazy Loading Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;

// ── 1. Monorepo Filesystem Root Audit ───────────────────────────────────────
console.log('1️⃣  Auditing apps/portal/next.config.mjs for turbopack.root...');

if (!fs.existsSync(NEXT_CONFIG)) {
  violations.push('apps/portal/next.config.mjs does not exist.');
} else {
  const configContent = fs.readFileSync(NEXT_CONFIG, 'utf8');

  if (!configContent.includes('turbopack:') || !configContent.includes('root:')) {
    violations.push(
      'apps/portal/next.config.mjs must specify "turbopack: { root: workspaceRoot }" for pnpm monorepo workspace resolution.'
    );
  }

  if (!configContent.includes('outputFileTracingRoot:')) {
    violations.push(
      'apps/portal/next.config.mjs must specify "outputFileTracingRoot: workspaceRoot" for standalone output tracing.'
    );
  }
}

// ── 2. Server Component vs Client Component ssr: false Audit ────────────────
console.log('2️⃣  Auditing dynamic imports for illegal ssr: false in Server Components...');

const tsxFiles = glob.sync('**/*.{ts,tsx}', {
  cwd: PORTAL_APP_ROUTES,
  ignore: ['node_modules/**', '.next/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  absolute: true,
});

filesScanned += tsxFiles.length;

for (const file of tsxFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  const isClient = /^\s*['"]use client['"]/m.test(content);
  const hasDynamic = content.includes('dynamic(');

  if (hasDynamic && !isClient) {
    // If it's a Server Component, check if ssr: false is used
    if (/ssr:\s*false/.test(content)) {
      violations.push(
        `${relPath} - Server Component contains "ssr: false" in dynamic import. 'ssr: false' is only supported in Client Components ('use client'). Move to a client component wrapper or remove 'ssr: false'.`
      );
    }
  }

  // ── 3. Magic Comments Audit ────────────────────────────────────────────────
  if (content.includes('webpackOptional: true') || content.includes('webpackOptional:true')) {
    violations.push(
      `${relPath} - Uses unsupported 'webpackOptional: true' magic comment. In Turbopack, use 'turbopackOptional: true'.`
    );
  }
}

// ── 4. Heavy Module Root Bundling Audit ─────────────────────────────────────
console.log('4️⃣  Scanning root layouts for synchronous heavy library imports...');

const rootLayout = path.join(PORTAL_APP_ROUTES, 'layout.tsx');
if (fs.existsSync(rootLayout)) {
  const layoutContent = fs.readFileSync(rootLayout, 'utf8');
  const heavyLibs = ['@react-pdf/renderer', 'exceljs', '@xyflow/react', 'swagger-ui-react'];

  for (const lib of heavyLibs) {
    const syncImportRegex = new RegExp(`^import\\s+.*\\s+from\\s+['"]${lib}['"]`, 'm');
    if (syncImportRegex.test(layoutContent)) {
      violations.push(
        `apps/portal/app/layout.tsx synchronously imports heavy library "${lib}". This balloons the shared root bundle. Load on-demand using next/dynamic or dynamic import().`
      );
    }
  }
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 Turbopack & Lazy Loading Audit Summary:');
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
  console.error('❌ Turbopack Audit Failed with Violations:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Turbopack & Lazy Loading Audit Passed: 100% compliant!\n');
process.exit(0);
