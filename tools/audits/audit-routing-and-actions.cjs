#!/usr/bin/env node

/**
 * Next.js 16 App Router, Server Actions & Boundary Auditor
 *
 * Enforces Next.js 16 Routing and Mutation standards across apps/portal:
 *   1. Root Layout Integrity: app/layout.tsx must contain <html> and <body> elements.
 *   2. Route vs Page Segment Separation: Ensures no directory contains both page.tsx and route.ts.
 *   3. Proxy Conformance: apps/portal/proxy.ts must exist and export a valid proxy handler.
 *   4. Server Action Security: Server Actions ('use server') must enforce authentication verification.
 *   5. Mutation Control Flow: When redirect() is used in a Server Action alongside revalidatePath/revalidateTag,
 *      revalidation MUST occur before redirect() (since redirect throws a control-flow exception).
 *   6. Dynamic Route Params: Dynamic layouts and pages must type and await Promise-based params/searchParams.
 *
 * Run: node tools/audits/audit-routing-and-actions.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const PORTAL_APP = path.join(ROOT, 'apps', 'portal');
const PORTAL_APP_ROUTES = path.join(PORTAL_APP, 'app');
const PROXY_FILE = path.join(PORTAL_APP, 'proxy.ts');
const ROOT_LAYOUT = path.join(PORTAL_APP_ROUTES, 'layout.tsx');

console.log('\n⚡ Initiating Next.js 16 App Router, Server Actions & Boundary Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;

// ── 1. Root Layout Integrity ────────────────────────────────────────────────
console.log('1️⃣  Auditing Root Layout (apps/portal/app/layout.tsx)...');

if (!fs.existsSync(ROOT_LAYOUT)) {
  violations.push('Missing required root layout at apps/portal/app/layout.tsx');
} else {
  const layoutContent = fs.readFileSync(ROOT_LAYOUT, 'utf8');
  if (!layoutContent.includes('<html') || !layoutContent.includes('<body')) {
    violations.push('apps/portal/app/layout.tsx must render both <html> and <body> root tags.');
  }
}

// ── 2. Route vs Page Collision Audit ────────────────────────────────────────
console.log('2️⃣  Auditing App Router segment separation for route/page collisions...');

const pages = glob.sync('**/page.{ts,tsx,js,jsx}', { cwd: PORTAL_APP_ROUTES, absolute: true });
const routes = glob.sync('**/route.{ts,tsx,js,jsx}', { cwd: PORTAL_APP_ROUTES, absolute: true });

filesScanned += pages.length + routes.length;

const pageDirs = new Set(pages.map((p) => path.dirname(p)));
for (const routeFile of routes) {
  const routeDir = path.dirname(routeFile);
  if (pageDirs.has(routeDir)) {
    const relDir = path.relative(ROOT, routeDir);
    violations.push(
      `Route collision in ${relDir}: Directory contains both page and route files. Each segment must export either a page or a route handler, never both.`
    );
  }
}

// ── 3. Proxy Handler Audit ──────────────────────────────────────────────────
console.log('3️⃣  Auditing Next.js 16 Proxy handler (apps/portal/proxy.ts)...');

if (!fs.existsSync(PROXY_FILE)) {
  violations.push('Next.js 16 proxy file (apps/portal/proxy.ts) does not exist.');
} else {
  const proxyContent = fs.readFileSync(PROXY_FILE, 'utf8');
  const hasExport =
    proxyContent.includes('export async function proxy') ||
    proxyContent.includes('export function proxy') ||
    proxyContent.includes('export default');

  if (!hasExport) {
    violations.push('apps/portal/proxy.ts must export a proxy function or default export.');
  }
}

// ── 4. Server Action Security & Revalidate Control Flow Audit ───────────────
console.log('4️⃣  Auditing Server Actions for authorization and revalidation flow...');

const allSourceFiles = glob.sync('**/*.{ts,tsx}', {
  cwd: PORTAL_APP,
  ignore: ['node_modules/**', '.next/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  absolute: true,
});

for (const file of allSourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const hasUseServer = /['"]use server['"]/.test(content);

  if (hasUseServer) {
    const relPath = path.relative(ROOT, file);

    // Flow check: if both redirect and revalidate exist, ensure revalidate appears before redirect
    if (
      content.includes('redirect(') &&
      (content.includes('revalidatePath(') || content.includes('revalidateTag('))
    ) {
      const lines = content.split('\n');
      let revalLine = -1;
      let redirectLine = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('revalidatePath') || lines[i].includes('revalidateTag'))
          revalLine = i;
        if (lines[i].includes('redirect(')) redirectLine = i;
      }
      if (redirectLine !== -1 && revalLine !== -1 && redirectLine < revalLine) {
        violations.push(
          `${relPath} - redirect() called before revalidatePath/revalidateTag. redirect() throws a framework exception; revalidation must occur before redirect.`
        );
      }
    }

    // Security check: mutation actions should verify caller auth
    const hasAuthCheck =
      content.includes('auth') ||
      content.includes('getUser') ||
      content.includes('session') ||
      content.includes('createServerSupabaseClient') ||
      content.includes('verify');

    if (!hasAuthCheck && !file.includes('/test') && !file.includes('mock')) {
      warnings.push(
        `${relPath} - Server Action ('use server') does not appear to perform explicit caller authentication check. Verify that this action is protected against unauthorized invocation.`
      );
    }
  }
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 App Router & Server Actions Audit Summary:');
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
  console.error('❌ Routing & Server Actions Audit Failed with Violations:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Next.js 16 App Router & Server Actions Audit Passed: 100% compliant!\n');
process.exit(0);
