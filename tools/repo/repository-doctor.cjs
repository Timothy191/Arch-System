#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'turbo.json',
  'apps/portal/package.json',
  'apps/portal/next.config.mjs',
];

const failures = [];
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
}

if (failures.length === 0) {
  const rootPackage = readJson('package.json');
  const portalPackage = readJson('apps/portal/package.json');
  const turbo = readJson('turbo.json');

  if (rootPackage.packageManager !== 'pnpm@9.15.9') {
    failures.push(
      `Root packageManager must be pnpm@9.15.9 (found ${rootPackage.packageManager ?? 'unset'}).`
    );
  }
  if (!rootPackage.engines?.node?.includes('24')) {
    failures.push('Root engines.node must include Node.js 24 support.');
  }
  if (!portalPackage.scripts?.build?.includes('next build')) {
    failures.push('apps/portal build script must invoke next build.');
  }
  if (!portalPackage.scripts?.dev?.includes('--webpack')) {
    failures.push(
      'apps/portal dev script must explicitly use webpack for the supported local workflow.'
    );
  }
  for (const dependency of ['^build', 'codegen']) {
    if (!turbo.tasks?.build?.dependsOn?.includes(dependency)) {
      failures.push(`turbo.json build task must depend on ${dependency}.`);
    }
  }
  if (!turbo.tasks?.build?.outputs?.includes('.next/**')) {
    failures.push('turbo.json build task must cache .next output.');
  }
}

if (failures.length > 0) {
  console.error('Repository doctor failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Repository doctor passed: workspace, portal, and Turbo foundations are consistent.');
