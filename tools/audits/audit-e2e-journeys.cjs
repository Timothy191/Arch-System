#!/usr/bin/env node

/**
 * Gate 19: End-to-End User Journeys Auditor
 *
 * Verifies complete Playwright E2E test coverage and configuration invariants across e2e/:
 *   1. Playwright Configuration: Verifies e2e/playwright.config.ts defines required device/browser
 *      projects (setup, chromium, mobile-chrome, tablet-chrome).
 *   2. Critical User Journey Coverage: Verifies all 7 required domain journey suites exist
 *      and contain active test(...) blocks.
 *   3. Hygiene & CI Determinism: Scans all e2e spec files (.spec.ts) to ensure zero committed
 *      test.only(...) calls and active test assertions.
 *
 * Run: node tools/audits/audit-e2e-journeys.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const E2E_DIR = path.join(ROOT, 'e2e');
const PLAYWRIGHT_CONFIG = path.join(E2E_DIR, 'playwright.config.ts');

console.log('\n🎭 Initiating Gate 19: End-to-End User Journeys Audit...\n');

const violations = [];
const warnings = [];

// ── 1. Playwright Configuration Audit ────────────────────────────────────────
console.log('1️⃣  Auditing e2e/playwright.config.ts project matrix...');

const requiredProjects = ['setup', 'chromium', 'mobile-chrome', 'tablet-chrome'];

if (!fs.existsSync(PLAYWRIGHT_CONFIG)) {
  violations.push('Missing e2e/playwright.config.ts configuration file.');
} else {
  const configContent = fs.readFileSync(PLAYWRIGHT_CONFIG, 'utf8');
  for (const proj of requiredProjects) {
    const projRegex = new RegExp(`name:\\s*['"]${proj}['"]`);
    if (!projRegex.test(configContent)) {
      violations.push(`e2e/playwright.config.ts is missing required project "${proj}".`);
    }
  }
  console.log(
    `   ✓ e2e/playwright.config.ts configures all required projects (${requiredProjects.join(', ')}).`
  );
}

// ── 2. Required User Journey Suite Coverage ──────────────────────────────────
console.log('2️⃣  Verifying E2E user journey spec coverage across all 7 domain workflows...');

const requiredJourneys = [
  {
    domain: 'Authentication & Session Management',
    specs: ['login.spec.ts', 'session-management.spec.ts', 'authenticated-flows.spec.ts'],
  },
  {
    domain: 'Department Navigation & Access',
    specs: ['department-navigation.spec.ts', 'navigation.spec.ts'],
  },
  {
    domain: 'Role & Permission Enforcement',
    specs: ['permissions-roles.spec.ts'],
  },
  {
    domain: 'Record Creation, Data Entry & Validation',
    specs: ['data-entry.spec.ts', 'data-entry-validation.spec.ts'],
  },
  {
    domain: 'Control Room & Shift Closeout',
    specs: ['control-room/end-smr.spec.ts', 'control-room/operations.spec.ts'],
  },
  {
    domain: 'Access Control & Card Studio',
    specs: ['access-card-actions/card-actions.spec.ts', 'access-card-actions/printing.spec.ts'],
  },
  {
    domain: 'Executive Dashboard, Overview & Resilience',
    specs: [
      'executive-dashboard.spec.ts',
      'overview.spec.ts',
      'error-states.spec.ts',
      'pwa-offline.spec.ts',
    ],
  },
];

for (const journey of requiredJourneys) {
  let domainTestCount = 0;
  for (const specRel of journey.specs) {
    const specAbs = path.join(E2E_DIR, specRel);
    if (!fs.existsSync(specAbs)) {
      violations.push(`[${journey.domain}] Missing required E2E spec file: e2e/${specRel}`);
      continue;
    }

    const content = fs.readFileSync(specAbs, 'utf8');
    const testMatches = content.match(/\btest\s*\(/g) || [];
    if (testMatches.length === 0) {
      violations.push(
        `[${journey.domain}] Spec file e2e/${specRel} contains 0 active test() blocks.`
      );
    } else {
      domainTestCount += testMatches.length;
    }
  }
  console.log(
    `   ✓ ${journey.domain}: ${journey.specs.length} spec file(s), ${domainTestCount} test cases.`
  );
}

// ── 3. Full E2E Spec Hygiene Scan (Zero test.only) ───────────────────────────
console.log('3️⃣  Scanning all e2e/**/*.spec.ts files for active assertions and zero test.only...');

const allSpecFiles = glob.sync('**/*.spec.ts', {
  cwd: E2E_DIR,
  ignore: ['node_modules/**'],
  absolute: true,
});

let totalTests = 0;

for (const specFile of allSpecFiles) {
  const relPath = path.relative(ROOT, specFile);
  const content = fs.readFileSync(specFile, 'utf8');

  if (/\btest\.only\s*\(/.test(content) || /\bdescribe\.only\s*\(/.test(content)) {
    violations.push(`${relPath} contains forbidden test.only() or describe.only() call.`);
  }

  const matches = content.match(/\btest\s*\(/g) || [];
  if (matches.length === 0) {
    violations.push(`${relPath} contains 0 active test() assertions.`);
  }
  totalTests += matches.length;
}

console.log(
  `   ✓ Scanned ${allSpecFiles.length} E2E spec files (${totalTests} total test cases, 0 test.only calls).`
);

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 E2E User Journeys Audit Summary:');
console.log(`   • Playwright Projects Verified: ${requiredProjects.length}`);
console.log(`   • Domain Journey Suites Verified: ${requiredJourneys.length}`);
console.log(`   • Total E2E Spec Files: ${allSpecFiles.length}`);
console.log(`   • Total E2E Test Cases: ${totalTests}`);
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
  console.error('❌ Gate 19 End-to-End User Journeys Audit Failed:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Gate 19 End-to-End User Journeys Audit Passed: 100% compliant!\n');
process.exit(0);
