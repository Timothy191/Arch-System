#!/usr/bin/env node

/**
 * @file tools/scripts/prune-vercel-deployments.mjs
 * @description Safely prunes obsolete Vercel deployments (errors, canceled, superseded previews,
 * and old superseded production builds) to resolve Deployment Storage limits while preserving
 * active production deployments and aliases.
 */

import { execSync } from 'node:child_process';

const TEAM_ID = 'team_9puAfgXPqVuwIBENr1LmhCxO';
const DRY_RUN =
  process.argv.includes('--dry-run') ||
  (!process.argv.includes('--execute') && !process.argv.includes('--yes'));

function runVercelApi(endpoint) {
  try {
    const raw = execSync(`vercel api "${endpoint}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error querying Vercel API ${endpoint}:`, err.message);
    throw err;
  }
}

async function fetchAllDeployments() {
  let allDeployments = [];
  let nextTimestamp = null;
  let page = 1;

  console.log('🔍 Fetching all deployments across team...');
  while (true) {
    const url = `/v6/deployments?teamId=${TEAM_ID}&limit=100${nextTimestamp ? `&until=${nextTimestamp}` : ''}`;
    const res = runVercelApi(url);
    const deployments = res.deployments || [];
    if (deployments.length === 0) break;

    allDeployments.push(...deployments);
    console.log(
      `  Page ${page}: fetched ${deployments.length} deployments (total so far: ${allDeployments.length})`
    );

    if (res.pagination && res.pagination.next && res.pagination.next !== nextTimestamp) {
      nextTimestamp = res.pagination.next;
      page++;
    } else {
      break;
    }
  }

  return allDeployments;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 Vercel Deployment Storage Safety Pruner');
  console.log(
    `Mode: ${DRY_RUN ? 'DRY-RUN (Pass --execute to delete)' : 'EXECUTE (Pruning active)'}`
  );
  console.log('====================================================\n');

  const deployments = await fetchAllDeployments();
  console.log(`\nTotal deployments retrieved: ${deployments.length}`);

  // Group deployments by project
  const byProject = {};
  for (const dep of deployments) {
    const proj = dep.name;
    if (!byProject[proj]) byProject[proj] = [];
    byProject[proj].push(dep);
  }

  const toDelete = [];
  const protectedDeployments = [];

  for (const [project, list] of Object.entries(byProject)) {
    // Sort descending by creation time (most recent first)
    list.sort((a, b) => b.createdAt - a.createdAt);

    let activeProductionFound = false;
    let keepPreviewCount = 0;

    for (const dep of list) {
      const isProduction = dep.target === 'production';
      const isReady = dep.state === 'READY';
      const isErrorOrCanceled = dep.state === 'ERROR' || dep.state === 'CANCELED';

      if (isErrorOrCanceled) {
        toDelete.push({ ...dep, reason: `Failed state: ${dep.state}` });
        continue;
      }

      if (isProduction && isReady && !activeProductionFound) {
        // Protect latest production deployment
        activeProductionFound = true;
        protectedDeployments.push({ ...dep, reason: 'Active Production' });
        continue;
      }

      // Keep up to 1 latest successful preview deployment per project
      if (!isProduction && isReady && keepPreviewCount < 1) {
        keepPreviewCount++;
        protectedDeployments.push({ ...dep, reason: 'Latest Preview' });
        continue;
      }

      // All older deployments are candidate for pruning
      toDelete.push({
        ...dep,
        reason: isProduction ? 'Superseded Production build' : 'Stale Preview build',
      });
    }
  }

  console.log('\n📊 Deployment Analysis:');
  console.log(`- Protected (Keep intact): ${protectedDeployments.length}`);
  for (const p of protectedDeployments) {
    console.log(`  🛡️  [${p.name}] ${p.url} (${p.reason}, ${new Date(p.createdAt).toISOString()})`);
  }

  console.log(`\n- Candidates for Removal: ${toDelete.length}`);
  const summaryByReason = {};
  for (const d of toDelete) {
    summaryByReason[d.reason] = (summaryByReason[d.reason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(summaryByReason)) {
    console.log(`  🗑️  ${reason}: ${count}`);
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN complete. No deployments were deleted.');
    console.log('Run with --execute to perform safe deletion.');
    return;
  }

  console.log('\n⚡ Starting safe deletion in batches...');
  const BATCH_SIZE = 15;
  let deletedCount = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const ids = batch.map((d) => d.uid).join(' ');
    console.log(
      `\nDeleting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toDelete.length / BATCH_SIZE)} (${batch.length} items)...`
    );

    try {
      execSync(`vercel rm ${ids} --safe --yes`, {
        stdio: 'inherit',
      });
      deletedCount += batch.length;
    } catch (err) {
      console.warn(
        `Warning: Some items in batch may have had active aliases or failed: ${err.message}`
      );
    }
  }

  console.log(`\n✅ Pruning finished! Attempted removal of ${toDelete.length} deployments.`);
}

main().catch((err) => {
  console.error('Fatal error during pruning:', err);
  process.exit(1);
});
