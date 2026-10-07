#!/usr/bin/env node

/**
 * @file tools/scripts/clean-stale-branch-aliases.mjs
 * @description Removes stale Git preview branch aliases (dependabot, bolt, jules)
 * to release Vercel retention exemptions, then safely deletes the obsolete preview deployments.
 */

import { execSync } from 'node:child_process';

const TEAM_ID = 'team_9puAfgXPqVuwIBENr1LmhCxO';

// Strictly protected production domains that MUST NEVER be removed
const PROTECTED_DOMAINS = new Set([
  'arch-system-theta.vercel.app',
  'arch-system.vercel.app',
  'n8n-vercel-alpha.vercel.app',
  'n8n-vercel.vercel.app',
  'arch-system-nest-proxy.vercel.app',
  'plantcor-redis-serverless.vercel.app',
  'archbase.vercel.app',
]);

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

async function main() {
  console.log('====================================================');
  console.log('🧹 Vercel Stale Branch Aliases & Deployments Cleaner');
  console.log('====================================================\n');

  console.log('🔍 Fetching all team aliases...');
  const rawAliases = run(`vercel api "/v4/aliases?teamId=${TEAM_ID}&limit=100"`);
  const aliasData = JSON.parse(rawAliases);
  const aliases = aliasData.aliases || [];

  console.log(`Retrieved ${aliases.length} total aliases.`);

  // Also fetch active production deployments to protect them
  const rawProjects = run(`vercel api "/v9/projects?teamId=${TEAM_ID}"`);
  const projectsData = JSON.parse(rawProjects);
  const protectedDeployments = new Set();

  for (const proj of projectsData.projects || []) {
    if (proj.targets && proj.targets.production && proj.targets.production.id) {
      protectedDeployments.add(proj.targets.production.id);
      console.log(
        `🛡️  Active Production for [${proj.name}]: ${proj.targets.production.id} (${proj.targets.production.url})`
      );
    }
  }

  const aliasesToRemove = [];
  const candidateDeployments = new Set();

  for (const a of aliases) {
    const isDomainProtected = PROTECTED_DOMAINS.has(a.alias);
    const pointsToProduction = protectedDeployments.has(a.deploymentId);

    // If it is a production alias or points to current live production deployment, protect it
    if (isDomainProtected || pointsToProduction) {
      console.log(`  🛡️  KEEPING PROTECTED: ${a.alias} -> ${a.deploymentId}`);
      continue;
    }

    // It is a stale preview branch alias
    aliasesToRemove.push(a);
    if (a.deploymentId) {
      candidateDeployments.add(a.deploymentId);
    }
  }

  console.log(`\nFound ${aliasesToRemove.length} stale preview branch aliases to remove:`);
  for (const a of aliasesToRemove) {
    console.log(`  🗑️  ${a.alias} (Deployment: ${a.deploymentId})`);
  }

  if (aliasesToRemove.length === 0) {
    console.log('No stale aliases to remove!');
    return;
  }

  console.log('\n⚡ Removing stale aliases from Vercel...');
  for (const a of aliasesToRemove) {
    process.stdout.write(`  Removing alias: ${a.alias}... `);
    try {
      run(`vercel alias rm ${a.alias} --yes`);
      console.log('✅ OK');
    } catch (err) {
      console.log(`⚠️  Error or already removed: ${err.message}`);
    }
  }

  console.log('\n⚡ Now pruning unaliased obsolete preview deployments...');
  for (const depId of candidateDeployments) {
    if (protectedDeployments.has(depId)) continue;
    process.stdout.write(`  Removing deployment: ${depId}... `);
    try {
      run(`vercel rm ${depId} --safe --yes`);
      console.log('✅ Deleted');
    } catch (err) {
      console.log(`⚠️  Skipped/Active: ${err.message.split('\n')[0]}`);
    }
  }

  console.log('\n🎉 Stale branch alias cleanup complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
