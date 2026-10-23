#!/usr/bin/env node

/**
 * Next.js 16 & React 19 Server Components, Boundaries & Taint Auditor
 *
 * Enforces React 19 & Next.js 16 Server/Client boundary invariants across apps/portal,
 * packages/ui, and feature UI libraries:
 *   1. Taint, Compiler & Logging Config: apps/portal/next.config.mjs must enable
 *      experimental.taint, reactCompiler, and logging options.
 *   2. Directive Semantics: Verifies that "use server" is NOT mistakenly placed on React
 *      components, and that 'use client' components are NEVER declared async.
 *   3. Hook & Context Isolation: Verifies that any file using useState, useEffect, useReducer,
 *      useLayoutEffect, useActionState, useOptimistic, or createContext has 'use client'.
 *   4. SWR Prohibition: Ensures no module imports 'swr' (TanStack Query + RSC is mandatory).
 *   5. Defense-in-Depth Layout Guards: Verifies independent role/slug checks in
 *      app/admin/layout.tsx and app/(departments)/[department]/layout.tsx.
 *   6. Global CSS Single Entry: Global CSS / Tailwind must only be imported in root entrypoints.
 *
 * Run: node tools/audits/audit-server-components.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const PORTAL_APP = path.join(ROOT, 'apps', 'portal');
const PORTAL_APP_ROUTES = path.join(PORTAL_APP, 'app');
const NEXT_CONFIG = path.join(PORTAL_APP, 'next.config.mjs');
const ADMIN_LAYOUT = path.join(PORTAL_APP_ROUTES, 'admin', 'layout.tsx');
const DEPT_LAYOUT = path.join(PORTAL_APP_ROUTES, '(departments)', '[department]', 'layout.tsx');

console.log('\n⚡ Initiating React 19 Server Components & Boundary Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;

// ── 1. Next.js Config Taint, React Compiler & Logging Audit ─────────────────
console.log('1️⃣  Auditing apps/portal/next.config.mjs for experimental.taint & reactCompiler...');

if (!fs.existsSync(NEXT_CONFIG)) {
  violations.push('apps/portal/next.config.mjs does not exist.');
} else {
  const configContent = fs.readFileSync(NEXT_CONFIG, 'utf8');

  if (!configContent.includes('taint: true')) {
    violations.push(
      'apps/portal/next.config.mjs must enable experimental.taint: true for React 19 secret isolation.'
    );
  }

  if (!configContent.includes('reactCompiler: true')) {
    warnings.push('apps/portal/next.config.mjs is recommended to enable reactCompiler: true.');
  }

  if (!configContent.includes('logging:')) {
    warnings.push(
      'apps/portal/next.config.mjs is recommended to configure logging options for development fetches/warnings.'
    );
  }
}

// ── 2. Directive Semantics, Async Client Ban, SWR Ban & Hook Isolation ──────
console.log(
  '2️⃣  Auditing Server/Client component directives, React 19 hook boundaries, and SWR ban...'
);

const tsxFiles = glob.sync(
  '{apps/portal/{app,components,features},packages/ui/src,libs/features/**/ui/src}/**/*.{ts,tsx}',
  {
    cwd: ROOT,
    ignore: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
    ],
    absolute: true,
  }
);

filesScanned += tsxFiles.length;

for (const file of tsxFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  const isClient = /^\s*['"]use client['"]/m.test(content);
  const isServer = /^\s*['"]use server['"]/m.test(content);

  // Check 1: "use server" on component definition (e.g. export default function ComponentName)
  if (isServer && /export\s+default\s+(?:async\s+)?function\s+[A-Z]/.test(content)) {
    violations.push(
      `${relPath} - Contains "use server" at file level with a default component export. "use server" is for Server Functions / Actions, NOT Server Components (which have no directive).`
    );
  }

  // Check 2: Client Components must NEVER be async functions
  if (isClient && /export\s+(?:default\s+)?async\s+function\s+[A-Z]/.test(content)) {
    violations.push(
      `${relPath} - Declares an async Client Component ('use client'). Client Components cannot be async functions; fetch data in a Server Component, unwrap a Promise with React 19 use(), or use TanStack Query.`
    );
  }

  // Check 3: SWR is prohibited across the monorepo
  if (/from\s+['"]swr(?:\/.*)?['"]/.test(content)) {
    violations.push(
      `${relPath} - Imports prohibited package 'swr'. Use React Server Components or @tanstack/react-query instead.`
    );
  }

  // Check 4: Client-only hooks without 'use client'
  if (!isClient) {
    if (
      content.includes('useState(') ||
      content.includes('useEffect(') ||
      content.includes('useReducer(') ||
      content.includes('useLayoutEffect(') ||
      content.includes('useActionState(') ||
      content.includes('useOptimistic(')
    ) {
      violations.push(
        `${relPath} - Uses React state/lifecycle hooks (useState/useEffect/useReducer/useActionState/useOptimistic) but lacks the 'use client' directive.`
      );
    }

    if (content.includes('createContext(') || content.includes('createContext<')) {
      violations.push(
        `${relPath} - Calls createContext() in a Server Component. Context must be created in a 'use client' module.`
      );
    }
  }

  // Check 5: Global CSS import in nested routes
  if (
    relPath.startsWith('apps/portal/app/') &&
    (path.basename(file) !== 'layout.tsx' || file.includes('(departments)'))
  ) {
    if (content.includes('globals.css') || content.includes('/global.css')) {
      warnings.push(
        `${relPath} - Imports global CSS outside root layout. Global styles should be imported exclusively in root app/layout.tsx to preserve predictable cascade order.`
      );
    }
  }
}

// ── 3. Defense-in-Depth Layout Guards Audit ─────────────────────────────────
console.log('3️⃣  Auditing independent RBAC and department slug guards in App Router layouts...');

if (!fs.existsSync(ADMIN_LAYOUT)) {
  violations.push('Missing apps/portal/app/admin/layout.tsx for independent admin role gating.');
} else {
  const adminLayoutContent = fs.readFileSync(ADMIN_LAYOUT, 'utf8');
  if (
    !adminLayoutContent.includes('createServerSupabaseClient') ||
    !adminLayoutContent.includes("'admin'")
  ) {
    violations.push(
      'apps/portal/app/admin/layout.tsx must independently re-verify the admin role via createServerSupabaseClient() in addition to proxy.ts.'
    );
  }
}

if (!fs.existsSync(DEPT_LAYOUT)) {
  violations.push(
    'Missing apps/portal/app/(departments)/[department]/layout.tsx for department slug validation.'
  );
} else {
  const deptLayoutContent = fs.readFileSync(DEPT_LAYOUT, 'utf8');
  if (!deptLayoutContent.includes('DEPARTMENTS') || !deptLayoutContent.includes('notFound()')) {
    violations.push(
      'apps/portal/app/(departments)/[department]/layout.tsx must validate the department slug against DEPARTMENTS and call notFound() on mismatch.'
    );
  }
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 React Server Components & Boundary Audit Summary:');
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
  console.error('❌ Server Components Audit Failed with Violations:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ React Server Components & Boundary Audit Passed: 100% compliant!\n');
process.exit(0);
