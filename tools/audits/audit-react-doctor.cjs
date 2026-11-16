#!/usr/bin/env node

/**
 * @file tools/audits/audit-react-doctor.cjs
 * @description React Doctor Diagnostic & Health Score Auditor for React 19 + Next.js 16.
 * Adapted from millionco/react-doctor diagnostic categories for Arch-System:
 *   1. react-19/no-forward-ref (ERROR)
 *   2. nextjs-rsc/no-async-client-component (ERROR)
 *   3. nextjs-rsc/no-server-import-in-client (ERROR)
 *   4. state-effects/no-swr (ERROR)
 *   5. security/no-eval-or-unguarded-html (ERROR)
 *   6. performance-and-keys/advisories (ADVISORY: useEffect fetch, array-index keys, direct DOM)
 *
 * Flags:
 *   --score          Print only numeric 0-100 health score
 *   --json           Print structured JSON diagnostic payload
 *   --json-compact   Print minified JSON payload (with --json)
 *   --check          Default CI gate mode (exit 1 on errors, 0 otherwise)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');

const ROOT = path.resolve(__dirname, '..', '..');
const SCORE_ONLY = process.argv.includes('--score');
const JSON_OUTPUT = process.argv.includes('--json');
const JSON_COMPACT = process.argv.includes('--json-compact');

const SCAN_GLOB =
  '{apps/portal/{app,components,features,hooks},packages/ui/src,libs/features/**/ui/src,libs/shared/hooks/src}/**/*.{ts,tsx}';
const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/*.d.ts',
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/*.stories.{ts,tsx}',
];

const ALLOWLISTED_HTML_FILES = new Set(['apps/portal/components/SpeculationRules.tsx']);
const MAX_SCORE = 100;
const ERROR_PENALTY = 12;
const MAX_ADVISORY_PENALTY = 8;
const ADVISORY_WEIGHT = 0.25;

function findLineNumber(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return 1;
}

function addDiagnostic(bucket, options) {
  bucket.push({
    rule: options.rule,
    severity: options.severity,
    file: options.file,
    line: options.line,
    message: options.message,
  });
}

function scanFile(absPath, errors, advisories) {
  const relPath = path.relative(ROOT, absPath).split(path.sep).join('/');
  const content = fs.readFileSync(absPath, 'utf8');
  const isClient = /^\s*['"]use client['"]/m.test(content);

  // 1. React 19: avoid forwardRef in new components (apps/*, libs/* = blocking error;
  // legacy primitives in packages/ui/src/components/* = tracked advisory)
  const forwardRefRe = /\b(?:React\.)?forwardRef\s*(?:<|\()/;
  if (forwardRefRe.test(content)) {
    const isLegacyUiWrapper = relPath.startsWith('packages/ui/src/components/');
    addDiagnostic(isLegacyUiWrapper ? advisories : errors, {
      rule: isLegacyUiWrapper ? 'react-19/legacy-ui-forward-ref' : 'react-19/no-forward-ref',
      severity: isLegacyUiWrapper ? 'advisory' : 'error',
      file: relPath,
      line: findLineNumber(content, forwardRefRe),
      message: 'Use React 19 ref-as-prop instead of forwardRef().',
    });
  }

  // 2. Next.js RSC: async Client Component prohibited
  const asyncClientRe = /export\s+(?:default\s+)?async\s+function\s+[A-Z]/;
  if (isClient && asyncClientRe.test(content)) {
    addDiagnostic(errors, {
      rule: 'nextjs-rsc/no-async-client-component',
      severity: 'error',
      file: relPath,
      line: findLineNumber(content, asyncClientRe),
      message: "Client Component ('use client') must not be declared async.",
    });
  }

  // 3. Next.js RSC: server-only modules imported inside 'use client'
  const serverImportRe =
    /from\s+['"](?:@repo\/supabase\/server|@repo\/supabase\/service-role|@repo\/database|next\/headers)['"]/;
  if (isClient && serverImportRe.test(content)) {
    addDiagnostic(errors, {
      rule: 'nextjs-rsc/no-server-import-in-client',
      severity: 'error',
      file: relPath,
      line: findLineNumber(content, serverImportRe),
      message: "Server-only module imported inside 'use client' boundary.",
    });
  }

  // 4. State/Data Fetching SSoT: prohibit SWR
  const swrImportRe = /from\s+['"]swr(?:\/.*)?['"]/;
  if (swrImportRe.test(content)) {
    addDiagnostic(errors, {
      rule: 'state-effects/no-swr',
      severity: 'error',
      file: relPath,
      line: findLineNumber(content, swrImportRe),
      message: 'Import of prohibited package swr; use RSC or @tanstack/react-query.',
    });
  }

  // 5. Security: eval() or unguarded dangerouslySetInnerHTML
  const evalRe = /\beval\s*\(/;
  if (evalRe.test(content)) {
    addDiagnostic(errors, {
      rule: 'security/no-eval-or-unguarded-html',
      severity: 'error',
      file: relPath,
      line: findLineNumber(content, evalRe),
      message: 'Dynamic eval() execution is prohibited.',
    });
  }

  const htmlRe = /dangerouslySetInnerHTML/;
  if (htmlRe.test(content) && !ALLOWLISTED_HTML_FILES.has(relPath)) {
    addDiagnostic(errors, {
      rule: 'security/no-eval-or-unguarded-html',
      severity: 'error',
      file: relPath,
      line: findLineNumber(content, htmlRe),
      message: 'Unguarded dangerouslySetInnerHTML usage outside CSP-nonced allowlist.',
    });
  }

  // 6. Advisories: useEffect fetch(), array-index keys, direct DOM selectors
  const effectFetchRe = /useEffect\s*\([\s\S]{0,400}?\bfetch\s*\(/;
  if (effectFetchRe.test(content)) {
    addDiagnostic(advisories, {
      rule: 'performance-and-keys/no-fetch-in-use-effect',
      severity: 'advisory',
      file: relPath,
      line: findLineNumber(content, /\bfetch\s*\(/),
      message: 'Prefer RSC data fetching or TanStack Query over fetch() inside useEffect.',
    });
  }

  const indexKeyRe = /key=\{(?:index|idx|i)\}/;
  if (indexKeyRe.test(content)) {
    addDiagnostic(advisories, {
      rule: 'performance-and-keys/no-array-index-key',
      severity: 'advisory',
      file: relPath,
      line: findLineNumber(content, indexKeyRe),
      message: 'Avoid unstable array index keys in dynamic JSX lists.',
    });
  }

  const directDomRe = /document\.(?:getElementById|querySelector)\b/;
  if (directDomRe.test(content)) {
    addDiagnostic(advisories, {
      rule: 'performance-and-keys/prefer-react-refs',
      severity: 'advisory',
      file: relPath,
      line: findLineNumber(content, directDomRe),
      message: 'Prefer React refs over imperative document.getElementById/querySelector.',
    });
  }
}

function computeScore(errorCount, advisoryCount) {
  const errorPenalty = errorCount * ERROR_PENALTY;
  const advisoryPenalty = Math.min(
    MAX_ADVISORY_PENALTY,
    Math.ceil(advisoryCount * ADVISORY_WEIGHT)
  );
  return Math.max(0, MAX_SCORE - errorPenalty - advisoryPenalty);
}

function maybeRunExternalReactDoctor() {
  if (process.env.REACT_DOCTOR_EXTERNAL !== '1') return null;
  const result = spawnSync('npx', ['--no-install', 'react-doctor@latest', '--score'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (result.status !== 0) return null;
  const parsed = Number.parseInt(String(result.stdout || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function main() {
  const files = globSync(SCAN_GLOB, {
    cwd: ROOT,
    ignore: IGNORE_GLOBS,
    absolute: true,
  }).sort();

  const errors = [];
  const advisories = [];

  for (const file of files) {
    scanFile(file, errors, advisories);
  }

  const score = computeScore(errors.length, advisories.length);
  const externalScore = maybeRunExternalReactDoctor();

  if (SCORE_ONLY) {
    process.stdout.write(`${score}\n`);
    process.exit(errors.length > 0 ? 1 : 0);
  }

  if (JSON_OUTPUT) {
    const payload = {
      tool: 'react-doctor-arch-audit',
      scannedFiles: files.length,
      score,
      externalScore,
      errorCount: errors.length,
      advisoryCount: advisories.length,
      passed: errors.length === 0,
      diagnostics: [...errors, ...advisories],
    };
    const serialized = JSON_COMPACT ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
    process.stdout.write(`${serialized}\n`);
    process.exit(errors.length > 0 ? 1 : 0);
  }

  console.log('\n🩺 Initiating React Doctor Diagnostic Audit (React 19 + Next.js 16)...\n');
  console.log(`   • Scanned Files: ${files.length}`);
  console.log(`   • Health Score:  ${score}/100`);
  if (externalScore !== null) {
    console.log(`   • External CLI:  ${externalScore}/100`);
  }
  console.log(`   • Blocking Errors: ${errors.length}`);
  console.log(`   • Advisories:      ${advisories.length}\n`);

  if (advisories.length > 0) {
    console.log('⚠️  Non-Blocking Advisories (tracked in Health Score):');
    for (const adv of advisories.slice(0, 15)) {
      console.log(`   • [${adv.rule}] ${adv.file}:${adv.line} — ${adv.message}`);
    }
    if (advisories.length > 15) {
      console.log(
        `   ... and ${advisories.length - 15} more advisory item(s) (--json for full list).`
      );
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.error('❌ React Doctor Audit FAILED with blocking errors:');
    for (const err of errors) {
      console.error(`   • [${err.rule}] ${err.file}:${err.line} — ${err.message}`);
    }
    console.log('');
    process.exit(1);
  }

  console.log(`✅ React Doctor Audit PASSED (Health Score: ${score}/100, 0 blocking errors).\n`);
  process.exit(0);
}

main();
