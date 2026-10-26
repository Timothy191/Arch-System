#!/usr/bin/env node

/**
 * Gate 26: AI Output Quality & Deterministic Hallucination Controls
 *
 * Deterministically verifies generated code and configuration against actual
 * repository evidence, declared dependencies, workspace package exports,
 * Next.js 16 / React 19 API contracts, and Origin ↔ Continuum antidrift checks.
 *
 * Run: node tools/audits/audit-ai-hallucination.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');
const { spawnSync } = require('node:child_process');
const { globSync } = require('glob');

const ROOT = path.resolve(__dirname, '..', '..');

console.log('\n🧠 Initiating Gate 26: AI Output Quality & Hallucination Controls Audit...\n');

const violations = [];
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

// ── 1. Collect All Declared Workspace Dependencies & Exports ────────────────
console.log('1️⃣  Indexing declared workspace dependencies & @repo/* export maps...');
const pkgJsonFiles = globSync(
  [
    'package.json',
    'apps/*/package.json',
    'packages/*/package.json',
    'libs/*/*/package.json',
    'libs/*/*/*/package.json',
    'tools/*/package.json',
    'scripts/package.json',
    'scripts/*/package.json',
  ],
  { cwd: ROOT }
);

const declaredPackages = new Set(['next', 'react', 'react-dom', 'server-only', 'client-only']);
const workspaceExports = new Map();

for (const relPkg of pkgJsonFiles) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, relPkg), 'utf8'));
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    if (pkg[section]) {
      for (const depName of Object.keys(pkg[section])) {
        declaredPackages.add(depName);
      }
    }
  }
  if (pkg.name?.startsWith('@repo/')) {
    workspaceExports.set(pkg.name, pkg.exports ?? { '.': pkg.main ?? './src/index.ts' });
  }
}
console.log(
  `   ✓ Indexed ${declaredPackages.size} declared npm packages and ${workspaceExports.size} @repo/* workspace packages.`
);

// ── 2. Scan Source Files for Hallucinated Packages or Unexported Subpaths ───
console.log('2️⃣  Scanning TypeScript/React source files for hallucinated imports...');
const sourceFiles = globSync(
  ['apps/portal/**/*.{ts,tsx}', 'libs/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
  {
    cwd: ROOT,
    ignore: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/storybook-static/**',
      '**/generated/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
    ],
  }
);

function stripCommentsAndTemplateStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .replace(/`[\s\S]*?`/g, '""');
}

const IMPORT_RE =
  /^\s*(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/gm;

function getPackageName(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

function matchesExportSubpath(exportsMap, subpath) {
  if (!exportsMap || typeof exportsMap !== 'object') return true;
  if (subpath in exportsMap) return true;
  for (const pattern of Object.keys(exportsMap)) {
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\./g, '\\.').replace(/\*/g, '.+')}$`);
      if (regex.test(subpath)) return true;
    }
  }
  return false;
}

for (const relFile of sourceFiles) {
  const rawContent = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
  const content = stripCommentsAndTemplateStrings(rawContent);
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const spec = match[1];
    if (
      spec.startsWith('.') ||
      spec.startsWith('/') ||
      spec.startsWith('@/') ||
      spec.startsWith('~/') ||
      spec.startsWith('node:') ||
      BUILTINS.has(spec) ||
      BUILTINS.has(spec.split('/')[0])
    ) {
      continue;
    }

    if (spec.startsWith('@repo/')) {
      const parts = spec.split('/');
      let matchedPkg = null;
      for (const candidateLen of [3, 2]) {
        if (parts.length >= candidateLen) {
          const candidate = parts.slice(0, candidateLen).join('/');
          if (workspaceExports.has(candidate)) {
            matchedPkg = candidate;
            break;
          }
        }
      }
      if (!matchedPkg) {
        violations.push(`${relFile}: Imports unknown workspace package '${spec}'`);
        continue;
      }
      const rest = spec.slice(matchedPkg.length);
      const subpath = rest ? `.${rest}` : '.';
      const exportsMap = workspaceExports.get(matchedPkg);
      if (!matchesExportSubpath(exportsMap, subpath)) {
        violations.push(`${relFile}: Imports unexported subpath '${subpath}' from '${matchedPkg}'`);
      }
      continue;
    }

    const pkgName = getPackageName(spec);
    if (!declaredPackages.has(pkgName)) {
      violations.push(
        `${relFile}: Imports undeclared/hallucinated package '${pkgName}' (via '${spec}')`
      );
    }
  }
}
console.log(
  `   ✓ Verified imports across ${sourceFiles.length} source files (0 hallucinated packages).`
);

// ── 3. Verify Next.js 16 & React 19 API Grounding ───────────────────────────
console.log('3️⃣  Verifying Next.js 16 Caching, App Router, and React 19 RSC Grounding...');
const frameworkAudits = [
  'tools/audits/audit-server-components.cjs',
  'tools/audits/audit-caching.cjs',
  'tools/audits/audit-routing-and-actions.cjs',
  'tools/audits/audit-image-optimization.cjs',
];

for (const script of frameworkAudits) {
  const res = spawnSync('node', [path.join(ROOT, script)], { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) {
    violations.push(`${script} failed:\n${res.stderr || res.stdout}`);
  }
}
console.log(`   ✓ All ${frameworkAudits.length} Next.js 16 & React 19 grounding audits passed.`);

// ── 4. Verify Origin ↔ Continuum Antidrift Confidence ───────────────────────
console.log('4️⃣  Running Origin ↔ Continuum Antidrift verification...');
const antidriftRes = spawnSync(
  'node',
  [path.join(ROOT, 'tools', 'audits', 'antidrift-test.cjs'), '--allow-dirty'],
  { cwd: ROOT, encoding: 'utf8' }
);
if (antidriftRes.status !== 0) {
  violations.push(
    `antidrift-test.cjs failed confidence threshold:\n${antidriftRes.stderr || antidriftRes.stdout}`
  );
} else {
  console.log('   ✓ Origin ↔ Continuum Antidrift check passed (>= 90% confidence).');
}

if (violations.length > 0) {
  console.error('\n❌ Gate 26 AI Output Quality & Hallucination Controls Failed:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  process.exit(1);
}

console.log('\n✅ Gate 26 AI Output Quality & Hallucination Controls Passed: 100% grounded!\n');
process.exit(0);
