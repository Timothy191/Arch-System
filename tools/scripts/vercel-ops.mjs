#!/usr/bin/env node

/**
 * @file tools/scripts/vercel-ops.mjs
 * @description Advanced Vercel Operations Toolkit for Arch-System:
 * - Prebuilt local builds & zero-source deployments (vercel build + vercel deploy --prebuilt)
 * - Tag-based edge CDN cache invalidation (vercel cache invalidate --tag)
 * - Autonomous review comments auditing (vercel comments list)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const command = process.argv[2];
const extraArgs = process.argv.slice(3);

const chalk = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function runVercel(args) {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`\n⚡ [VERCEL OPS] Running: pnpm dlx vercel ${args.join(' ')}`));
    const child = spawn('pnpm', ['dlx', 'vercel', ...args], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env },
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with status code ${code}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  switch (command) {
    case 'build': {
      const isProd = extraArgs.includes('--prod') || extraArgs.includes('--production');
      console.log(
        chalk.bold(
          chalk.blue(
            `🛠️  [BUILD LOCAL] Simulating Vercel ${isProd ? 'PRODUCTION' : 'PREVIEW'} Build...`
          )
        )
      );
      const buildFlags = ['build', '--yes'];
      if (isProd) buildFlags.push('--prod');
      await runVercel(buildFlags);
      console.log(
        chalk.green('✅ Local Vercel prebuilt build completed successfully in .vercel/output.')
      );
      break;
    }

    case 'deploy-prebuilt': {
      const isProd = extraArgs.includes('--prod') || extraArgs.includes('--production');
      console.log(
        chalk.bold(
          chalk.blue(
            `🚀 [DEPLOY PREBUILT] Deploying prebuilt artifacts to ${isProd ? 'PRODUCTION' : 'PREVIEW'}...`
          )
        )
      );
      const deployFlags = ['deploy', '--prebuilt', '--yes'];
      if (isProd) deployFlags.push('--prod');
      await runVercel(deployFlags);
      console.log(chalk.green('✅ Prebuilt deployment initiated successfully.'));
      break;
    }

    case 'invalidate': {
      const tagIndex = extraArgs.findIndex((a) => a === '--tag');
      const tag = tagIndex !== -1 ? extraArgs[tagIndex + 1] : extraArgs[0];
      if (!tag) {
        console.error(
          chalk.red(
            '❌ Missing required tag argument. Example: node vercel-ops.mjs invalidate --tag telemetry'
          )
        );
        process.exit(1);
      }
      console.log(chalk.bold(chalk.blue(`🔄 [CACHE] Invalidating edge cache for tag: ${tag}...`)));
      await runVercel(['cache', 'invalidate', '--tag', tag]);
      console.log(chalk.green(`✅ Cache tag '${tag}' invalidated on Vercel Global Edge CDN.`));
      break;
    }

    case 'purge': {
      console.log(
        chalk.bold(chalk.blue('🧹 [CACHE] Purging CDN and Data cache for current project...'))
      );
      await runVercel(['cache', 'purge', '--yes']);
      console.log(chalk.green('✅ Project edge cache purged successfully.'));
      break;
    }

    case 'comments': {
      console.log(
        chalk.bold(
          chalk.blue('💬 [COMMENTS] Inspecting unresolved Vercel Toolbar review threads...')
        )
      );
      await runVercel(['comments', 'list', ...extraArgs]);
      break;
    }

    case 'prune': {
      console.log(
        chalk.bold(chalk.blue('🧹 [PRUNE] Executing safe Vercel deployment storage pruner...'))
      );
      const isDryRun = extraArgs.includes('--dry-run');
      const prunerPath = path.resolve(ROOT_DIR, '../tools/scripts/prune-vercel-deployments.mjs');
      const prunerArgs = [prunerPath];
      if (isDryRun) prunerArgs.push('--dry-run');
      else prunerArgs.push('--execute');

      const pruner = spawn('node', prunerArgs, { stdio: 'inherit' });
      await new Promise((resolve, reject) => {
        pruner.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Pruner exited with code ${code}`));
        });
        pruner.on('error', reject);
      });
      break;
    }

    default:
      console.log(
        chalk.bold(
          chalk.yellow(`
Usage: node tools/scripts/vercel-ops.mjs <command> [options]

Commands:
  build [--prod]             Simulate Vercel cloud build locally into .vercel/output
  deploy-prebuilt [--prod]   Deploy prebuilt artifacts directly without rebuilding
  invalidate --tag <tag>     Invalidate specific Next.js 16 cache tag on Vercel CDN
  purge                      Purge full CDN and Data cache
  comments [--json]          List and review Vercel Toolbar comments
  prune [--dry-run]          Prune obsolete deployments and reclaim Vercel storage
`)
        )
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red(`\n❌ [VERCEL OPS ERROR] ${err.message}`));
  process.exit(1);
});
