#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath =
  process.env.FEDERATION_WATCHDOG_CONFIG ||
  path.resolve(__dirname, '../../../../tools/federation-watchdog/config/federation.json');

let config;
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error(`❌ Failed to load federation watchdog config from ${configPath}:`, err.message);
  process.exit(2);
}

const workspaceRoot = config?.workspaceRoot || path.resolve(__dirname, '../../../..');
const watchdogBin = config?.watchdogBin
  ? path.isAbsolute(config.watchdogBin)
    ? config.watchdogBin
    : path.resolve(workspaceRoot, config.watchdogBin)
  : path.join(__dirname, 'zero-drift-watchdog.mjs');

const deployments = config?.deployments || [
  { name: 'arch-system (Portal)', path: path.resolve(__dirname, '../../..') },
];

if (deployments.length === 0) {
  console.warn('⚠️  No deployments configured in federation watchdog config.');
  process.exit(0);
}

const isJson = process.argv.includes('--json');
const isFix = process.argv.includes('--fix');
const isAllowDirty =
  process.argv.includes('--allow-dirty') || process.argv.includes('--ignore-dirty');

if (!isJson) {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  FEDERATED VERCEL DEPLOYMENT AUDIT — MULTI-SERVICE INSPECTOR       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  console.log(`Workspace root: ${workspaceRoot}`);
  console.log(`Watchdog bin:   ${watchdogBin}\n`);
}

let anyFailed = false;
const results = [];

for (const deployment of deployments) {
  const targetPath = path.resolve(workspaceRoot, deployment.path);
  if (!isJson) {
    console.log(`\n🔎 [Auditing] ${deployment.name} at ${targetPath}`);
  }

  if (!fs.existsSync(targetPath)) {
    if (!isJson) console.error(`❌ Project directory not found: ${targetPath}`);
    results.push({ name: deployment.name, path: targetPath, status: 2, error: 'DIR_NOT_FOUND' });
    anyFailed = true;
    continue;
  }

  if (!fs.existsSync(watchdogBin)) {
    if (!isJson) console.error(`❌ Watchdog binary not found: ${watchdogBin}`);
    results.push({
      name: deployment.name,
      path: targetPath,
      status: 2,
      error: 'WATCHDOG_BIN_NOT_FOUND',
    });
    anyFailed = true;
    continue;
  }

  const watchdogArgs = [watchdogBin, isFix ? '--fix' : '--audit-only', '--dir', targetPath];
  if (isAllowDirty) watchdogArgs.push('--allow-dirty');
  if (isJson) watchdogArgs.push('--json');

  const result = spawnSync('node', watchdogArgs, {
    stdio: isJson ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
    cwd: workspaceRoot,
    encoding: 'utf8',
  });

  if (isJson) {
    let parsedReport = null;
    try {
      parsedReport = JSON.parse(result.stdout || '{}');
    } catch {}
    results.push({
      name: deployment.name,
      path: targetPath,
      exitCode: result.status,
      report: parsedReport,
    });
  }

  if (result.status !== 0) {
    anyFailed = true;
    if (!isJson) {
      if (result.status === 1) {
        console.warn(`⚠️  Drift detected in ${deployment.name}.`);
      } else {
        console.error(
          `❌ Audit execution failed with exit code ${result.status} for ${deployment.name}.`
        );
      }
    }
  } else if (!isJson) {
    console.log(`✔ Parity confirmed for ${deployment.name}.`);
  }
}

if (isJson) {
  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        workspaceRoot,
        allParity: !anyFailed,
        deployments: results,
      },
      null,
      2
    )
  );
} else {
  console.log('\n✔ Federated inspection sweep finished.');
}

process.exit(anyFailed ? 1 : 0);
