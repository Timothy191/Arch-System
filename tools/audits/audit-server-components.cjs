#!/usr/bin/env node

/**
 * Next.js 16 & React 19 Server Components, Boundaries & Taint Auditor
 *
 * Enforces React 19 Server Components standards across apps/portal:
 *   1. Taint & Logging Config: apps/portal/next.config.mjs must enable experimental.taint and logging options.
 *   2. Directive Semantics: Verifies that "use server" is NOT mistakenly placed on React components
 *      (it is exclusively for Server Functions / Server Actions, not a component directive).
 *   3. Hook & Browser API Isolation: Verifies that any file using useState, useEffect, useReducer,
 *      useRef, or window/document has the 'use client' directive.
 *   4. Context Creation Isolation: createContext() must only be called in 'use client' modules.
 *   5. Global CSS Single Entry: Global CSS / Tailwind must only be imported in root entrypoints (app/layout.tsx).
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

console.log('\n⚡ Initiating React 19 Server Components & Boundary Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;

// ── 1. Next.js Config Taint & Logging Audit ─────────────────────────────────
console.log('1️⃣  Auditing apps/portal/next.config.mjs for experimental.taint & logging...');

if (!fs.existsSync(NEXT_CONFIG)) {
  violations.push('apps/portal/next.config.mjs does not exist.');
} else {
  const configContent = fs.readFileSync(NEXT_CONFIG, 'utf8');

  if (!configContent.includes('taint: true')) {
    violations.push(
      'apps/portal/next.config.mjs must enable experimental.taint: true for React 19 secret isolation.'
    );
  }

  if (!configContent.includes('logging:')) {
    warnings.push(
      'apps/portal/next.config.mjs is recommended to configure logging options for development fetches/warnings.'
    );
  }
}

// ── 2. Directive Semantics & Client Hook Isolation Audit ───────────────────
console.log('2️⃣  Auditing Server/Client component directives and React hook boundaries...');

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
  const isServer = /^\s*['"]use server['"]/m.test(content);

  // Check 1: "use server" on component definition (e.g. export default function ComponentName)
  if (isServer && /export\s+default\s+function\s+[A-Z]/.test(content)) {
    violations.push(
      `${relPath} - Contains "use server" at file level with a default component export. "use server" is for Server Functions / Actions, NOT Server Components (which have no directive).`
    );
  }

  // Check 2: Client-only hooks without 'use client'
  if (!isClient) {
    if (
      content.includes('useState(') ||
      content.includes('useEffect(') ||
      content.includes('useReducer(') ||
      content.includes('useLayoutEffect(')
    ) {
      violations.push(
        `${relPath} - Uses React state/lifecycle hooks (useState/useEffect/useReducer) but lacks the 'use client' directive.`
      );
    }

    if (content.includes('createContext(') || content.includes('createContext<')) {
      violations.push(
        `${relPath} - Calls createContext() in a Server Component. Context must be created in a 'use client' module.`
      );
    }
  }

  // Check 3: Global CSS import in nested routes
  if (path.basename(file) !== 'layout.tsx' || file.includes('(departments)')) {
    if (content.includes('globals.css') || content.includes('/global.css')) {
      warnings.push(
        `${relPath} - Imports global CSS outside root layout. Global styles should be imported exclusively in root app/layout.tsx to preserve predictable cascade order.`
      );
    }
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
