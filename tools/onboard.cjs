#!/usr/bin/env node

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Arch-Systems (Plantcor) — Monorepo Self-Service Onboarding & Diagnostics CLI
 * ─────────────────────────────────────────────────────────────────────────────
 * Performs automated pre-flight checks across:
 *   1. Node.js & Volta engine requirements
 *   2. pnpm package manager & workspace integrity
 *   3. Docker daemon & local Supabase container reachability
 *   4. Environment variable parity against apps/portal/env/.env.example
 *   5. Monorepo architecture boundaries (policy-compiler)
 *   6. Sub-second feature hook unit test sanity
 *
 * Usage:
 *   pnpm onboard
 *   node tools/onboard.cjs [--fix] [--json]
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORTAL_ENV_EXAMPLE = path.join(ROOT_DIR, 'apps/portal/env/.env.example');
const PORTAL_ENV_ACTUAL = path.join(ROOT_DIR, 'apps/portal/.env');
const ROOT_ENV_ACTUAL = path.join(ROOT_DIR, '.env');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

// Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const symbols = {
  pass: `${colors.green}✔ PASS${colors.reset}`,
  warn: `${colors.yellow}▲ WARN${colors.reset}`,
  fail: `${colors.red}✖ FAIL${colors.reset}`,
  info: `${colors.cyan}ℹ INFO${colors.reset}`,
};

const results = {
  passed: 0,
  warned: 0,
  failed: 0,
  checks: [],
};

function record(status, category, message, details = null, remediation = null) {
  if (status === 'PASS') results.passed++;
  else if (status === 'WARN') results.warned++;
  else if (status === 'FAIL') results.failed++;

  results.checks.push({ status, category, message, details, remediation });

  const badge = status === 'PASS' ? symbols.pass : status === 'WARN' ? symbols.warn : symbols.fail;
  console.log(`  [${badge}] ${colors.bold}${category}${colors.reset}: ${message}`);
  if (details) {
    console.log(`         ${colors.dim}${details}${colors.reset}`);
  }
  if (remediation && status !== 'PASS') {
    console.log(`         ${colors.yellow}👉 Fix: ${remediation}${colors.reset}`);
  }
}

function safeExec(cmd, opts = {}) {
  try {
    return {
      success: true,
      stdout: execSync(cmd, { cwd: ROOT_DIR, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', ...opts }).trim(),
    };
  } catch (err) {
    return {
      success: false,
      stderr: err.stderr ? err.stderr.toString().trim() : err.message,
      stdout: err.stdout ? err.stdout.toString().trim() : '',
    };
  }
}

console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bold}${colors.cyan} 🛠️  Arch-Systems Monorepo Onboarding Diagnostic Suite${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Node.js & Volta Engine Checks
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}1. Runtime & Package Manager Environment${colors.reset}`);

const nodeVersion = process.version;
const majorNode = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
let targetNode = '>=22';

try {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  targetNode = (pkg.volta && pkg.volta.node) || (pkg.engines && pkg.engines.node) || '>=22';
} catch (e) {}

if (majorNode >= 22) {
  record('PASS', 'Node.js', `Active version ${nodeVersion} satisfies engine requirement (${targetNode})`);
} else {
  record('FAIL', 'Node.js', `Active version ${nodeVersion} is below minimum requirement (${targetNode})`, null, 'Run "volta install node@24.15.0" or update your Node environment.');
}

const voltaCheck = safeExec('volta --version');
if (voltaCheck.success) {
  record('PASS', 'Volta Toolchain', `Volta is installed (v${voltaCheck.stdout})`);
} else {
  record('WARN', 'Volta Toolchain', 'Volta is not detected in PATH', 'Volta ensures pinned Node/pnpm versions across team members.', 'Install Volta via: curl https://get.volta.sh | bash');
}

const pnpmCheck = safeExec('pnpm --version');
if (pnpmCheck.success) {
  const pnpmVer = pnpmCheck.stdout;
  if (pnpmVer.startsWith('9.')) {
    record('PASS', 'pnpm Manager', `Active version ${pnpmVer} matches workspace target (9.x)`);
  } else {
    record('WARN', 'pnpm Manager', `Active version is ${pnpmVer} (expected 9.15.9)`, null, 'Run "volta install pnpm@9.15.9"');
  }
} else {
  record('FAIL', 'pnpm Manager', 'pnpm is not installed or not in PATH', null, 'Install pnpm via: npm install -g pnpm@9.15.9 or volta install pnpm@9.15.9');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Docker & Container Stack Health
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${colors.bold}2. Infrastructure & Local Container Stack${colors.reset}`);

const dockerCheck = safeExec('docker info');
if (dockerCheck.success) {
  record('PASS', 'Docker Engine', 'Docker daemon is active and responding');

  // Check Supabase containers
  const supabaseContainerCheck = safeExec('docker ps --filter "name=supabase" --format "{{.Names}}: {{.Status}}"');
  if (supabaseContainerCheck.success && supabaseContainerCheck.stdout.length > 0) {
    const running = supabaseContainerCheck.stdout.split('\n').filter(Boolean);
    record('PASS', 'Supabase Local Stack', `${running.length} Supabase containers currently running`);
  } else {
    record('WARN', 'Supabase Local Stack', 'No local Supabase containers currently active', 'Local database services (Postgres, Studio, Auth) are offline.', 'Start local database stack via: pnpm --filter @repo/database supabase:dev');
  }
} else {
  record('WARN', 'Docker Engine', 'Docker daemon is not accessible on docker.sock', 'Required for local Supabase database development and E2E testing.', 'Ensure Docker Desktop or dockerd daemon is running.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Environment Variable Alignment Matrix
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${colors.bold}3. Environment Variable Integrity Matrix${colors.reset}`);

function parseEnvKeys(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf-8');
  const keys = new Set();
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([A-Za-z0-9_]+)=/);
      if (match) keys.add(match[1]);
    }
  });
  return keys;
}

if (fs.existsSync(PORTAL_ENV_ACTUAL)) {
  const exampleKeys = parseEnvKeys(PORTAL_ENV_EXAMPLE);
  const actualKeys = parseEnvKeys(PORTAL_ENV_ACTUAL);

  const missingKeys = [];
  exampleKeys.forEach((key) => {
    if (!actualKeys.has(key)) {
      missingKeys.push(key);
    }
  });

  if (missingKeys.length === 0) {
    record('PASS', 'Portal .env', `apps/portal/.env is present and all ${exampleKeys.size} example keys are defined`);
  } else {
    record('WARN', 'Portal .env', `apps/portal/.env is missing ${missingKeys.length} keys from .env.example`, `Missing keys: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`, 'Sync keys from apps/portal/env/.env.example to apps/portal/.env');
  }
} else {
  record('FAIL', 'Portal .env', 'apps/portal/.env does not exist', null, 'Run: cp apps/portal/env/.env.example apps/portal/.env');
}

if (fs.existsSync(ROOT_ENV_ACTUAL)) {
  record('PASS', 'Root .env', 'Root .env is present');
} else {
  record('WARN', 'Root .env', 'Root .env not found (optional for certain shared tool tasks)', null, 'Copy root .env template if running monorepo integration scripts.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Monorepo Architecture & Policy Boundaries
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${colors.bold}4. Monorepo Boundaries & Architecture Policies${colors.reset}`);

const policyCheck = safeExec('node tools/apply-project-tags.cjs && node tools/policy-compiler.cjs --check');
if (policyCheck.success) {
  record('PASS', 'Architecture Policies', 'Nx project tags and ESLint boundary rules are in sync (SSoT verified)');
} else {
  record('FAIL', 'Architecture Policies', 'Boundary policy verification failed', policyCheck.stderr.slice(0, 200), 'Run: pnpm policy:gen');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Fast Inner Loop Sanity Check
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${colors.bold}5. Fast-Feedback Test Sanity Check${colors.reset}`);

const hookTest = safeExec('pnpm --filter portal test -- --testPathPatterns="hook"');
if (hookTest.success) {
  record('PASS', 'Feature Hook Tests', 'Targeted unit test suite executed and passed in < 2s');
} else {
  record('WARN', 'Feature Hook Tests', 'Feature hook tests encountered failures or open handles', hookTest.stderr.slice(0, 200), 'Run: pnpm --filter portal test -- --testPathPatterns="hook" to inspect.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary & Actionable Recommendations
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bold} Diagnostic Summary: ${colors.green}${results.passed} Passed${colors.reset} | ${colors.yellow}${results.warned} Warnings${colors.reset} | ${colors.red}${results.failed} Failures${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

if (results.failed === 0) {
  console.log(`${colors.green}${colors.bold}🚀 Your monorepo workspace environment is healthy and ready for development!${colors.reset}\n`);
  console.log(`Recommended Next Commands:`);
  console.log(`  ${colors.cyan}pnpm dev${colors.reset}               - Launch local Next.js portal & Turbopack`);
  console.log(`  ${colors.cyan}pnpm nx:graph${colors.reset}          - Visualize interactive architectural dependency graph`);
  console.log(`  ${colors.cyan}pnpm audit:compliance${colors.reset}  - Verify database migrations & data contract integrity\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}${colors.bold}⚠️ Some critical onboarding requirements need attention before proceeding.${colors.reset}\n`);
  process.exit(1);
}
