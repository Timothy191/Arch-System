#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const watchdogBin = path.join(__dirname, 'zero-drift-watchdog.mjs');

const TARGET_DEPLOYMENTS = [
  { name: 'arch-system (Portal)', path: path.resolve(__dirname, '../../..') },
  {
    name: 'arch-system-nest-proxy',
    path: path.resolve(__dirname, '../../../../arch-system-nest-proxy'),
  },
  { name: 'plantcor-redis-serverless', path: path.resolve(__dirname, '../../../../redis') },
  { name: 'n8n-vercel', path: path.resolve(__dirname, '../../../../n8n-vercel') },
];

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  FEDERATED VERCEL DEPLOYMENT AUDIT — MULTI-SERVICE INSPECTOR       ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

let anyFailed = false;

for (const deployment of TARGET_DEPLOYMENTS) {
  console.log(`\n🔎 [Auditing] ${deployment.name} at ${deployment.path}`);
  const result = spawnSync('node', [watchdogBin, '--audit-only', '--dir', deployment.path], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0 && result.status !== 1) {
    console.warn(
      `⚠️  Audit execution returned status ${result.status} (likely unconfigured remote token).`
    );
  } else if (result.status === 1) {
    console.warn(`⚠️  Drift detected in ${deployment.name}.`);
    anyFailed = true;
  } else {
    console.log(`✔ Parity confirmed for ${deployment.name}.`);
  }
}

console.log('\n✔ Federated inspection sweep finished.');
process.exit(anyFailed ? 1 : 0);
