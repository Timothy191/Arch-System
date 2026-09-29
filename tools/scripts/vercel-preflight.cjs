#!/usr/bin/env node

/**
 * @file tools/scripts/vercel-preflight.cjs
 * @description Comprehensive automated preflight auditor for Vercel Next.js monorepo deployment.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PORTAL_DIR = path.join(ROOT_DIR, 'apps/portal');

const chalk = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let errors = 0;
let warnings = 0;

console.log(chalk.bold(chalk.blue('=======================================================')));
console.log(chalk.bold(chalk.blue('🚀 [VERCEL PREFLIGHT] Monorepo Deployment Pre-Check...')));
console.log(chalk.bold(chalk.blue('=======================================================')));

/**
 * Resolves package-manager script indirection so the gate inspects the command that will
 * actually execute. `buildCommand: "pnpm build:vercel"` names a script rather than
 * containing a build chain, so testing the literal string would report a correctly
 * targeted build as untargeted. Only a bare `pnpm <script>` / `npm run <script>` form is
 * resolved; anything with inline arguments is returned unchanged.
 */
function resolveBuildCommand(command) {
  const match = command.match(/^(?:pnpm|npm|yarn)\s+(?:run\s+)?([\w:.-]+)$/);
  if (!match) return command;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    return pkg.scripts?.[match[1]] ?? command;
  } catch {
    return command;
  }
}

// 1. Validate vercel.json
const vercelJsonPath = path.join(ROOT_DIR, 'vercel.json');
if (!fs.existsSync(vercelJsonPath)) {
  console.log(chalk.red('❌ Missing vercel.json in repository root.'));
  errors++;
} else {
  try {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    if (vercelConfig.framework !== 'nextjs') {
      console.log(
        chalk.yellow(`⚠️  vercel.json framework is '${vercelConfig.framework}', expected 'nextjs'.`)
      );
      warnings++;
    }
    const buildCommand = vercelConfig.buildCommand ?? '';
    const resolvedBuildCommand = resolveBuildCommand(buildCommand);

    if (!resolvedBuildCommand.includes('portal')) {
      console.log(
        chalk.yellow(
          `⚠️  vercel.json buildCommand should target portal (e.g. 'pnpm build --filter=portal').`
        )
      );
      warnings++;
    } else {
      console.log(
        chalk.green('✅ vercel.json verified (framework=nextjs, targeted build command).')
      );
    }
  } catch (err) {
    console.log(chalk.red(`❌ Failed to parse vercel.json: ${err.message}`));
    errors++;
  }
}

// 2. Validate .vercelignore
const vercelIgnorePath = path.join(ROOT_DIR, '.vercelignore');
if (!fs.existsSync(vercelIgnorePath)) {
  console.log(chalk.red('❌ Missing .vercelignore file in repository root.'));
  errors++;
} else {
  const ignoreContent = fs.readFileSync(vercelIgnorePath, 'utf8');
  const criticalExclusions = ['packages/eval/', 'e2e/', '.agents/', 'target/', '.turbo/'];
  const missingExclusions = criticalExclusions.filter(
    (pattern) => !ignoreContent.includes(pattern)
  );

  if (missingExclusions.length > 0) {
    console.log(
      chalk.yellow(
        `⚠️  .vercelignore is missing recommended heavy artifact patterns: ${missingExclusions.join(', ')}`
      )
    );
    warnings++;
  } else {
    console.log(
      chalk.green(
        '✅ .vercelignore verified (excludes heavy test suites, agents, and build artifacts).'
      )
    );
  }
}

// 3. Validate apps/portal/next.config.mjs
const nextConfigPath = path.join(PORTAL_DIR, 'next.config.mjs');
if (!fs.existsSync(nextConfigPath)) {
  console.log(chalk.red('❌ Missing apps/portal/next.config.mjs.'));
  errors++;
} else {
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
  if (!nextConfigContent.includes('outputFileTracingRoot')) {
    console.log(
      chalk.yellow(
        '⚠️  next.config.mjs does not declare outputFileTracingRoot (needed for monorepo NFT).'
      )
    );
    warnings++;
  }
  if (!nextConfigContent.includes('process.env.VERCEL')) {
    console.log(
      chalk.yellow('⚠️  next.config.mjs should conditionally omit standalone output on Vercel.')
    );
    warnings++;
  } else {
    console.log(
      chalk.green(
        '✅ apps/portal/next.config.mjs verified (monorepo tracing root & dynamic standalone mode).'
      )
    );
  }
}

// 4. Validate Vercel Project Linkage (.vercel/)
const vercelProjectDir = path.join(ROOT_DIR, '.vercel');
const vercelProjectJson = path.join(vercelProjectDir, 'project.json');
if (!fs.existsSync(vercelProjectJson)) {
  console.log(chalk.yellow('⚠️  .vercel/project.json not found.'));
  console.log(
    chalk.yellow(
      '   Run `npx vercel link --yes` interactively once before attempting headless CI/CD deploys.'
    )
  );
  warnings++;
} else {
  try {
    const projectData = JSON.parse(fs.readFileSync(vercelProjectJson, 'utf8'));
    console.log(
      chalk.green(
        `✅ Vercel project linkage verified (Project: ${projectData.projectId || 'configured'}).`
      )
    );
  } catch (_e) {
    console.log(chalk.yellow('⚠️  .vercel/project.json could not be parsed.'));
    warnings++;
  }
}

// 5. Environment Variable Checks
const requiredPublicVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const missingPublicVars = requiredPublicVars.filter((v) => !process.env[v]);
if (
  missingPublicVars.length > 0 &&
  !process.env.IGNORE_ENV_VALIDATION &&
  process.env.NODE_ENV === 'production'
) {
  console.log(
    chalk.yellow(
      `⚠️  Missing environment variables in current shell: ${missingPublicVars.join(', ')}`
    )
  );
  console.log(
    chalk.yellow(
      '   Ensure these are populated in Vercel Project Settings → Environment Variables.'
    )
  );
  warnings++;
} else {
  console.log(chalk.green('✅ Environment variable baseline checked.'));
}

console.log(chalk.bold(chalk.blue('=======================================================')));
if (errors > 0) {
  console.log(
    chalk.red(chalk.bold(`❌ Preflight FAILED with ${errors} error(s) and ${warnings} warning(s).`))
  );
  process.exit(1);
} else {
  console.log(
    chalk.green(
      chalk.bold(
        `✅ Preflight PASSED with ${warnings} warning(s). Monorepo is ready for Vercel deployment.`
      )
    )
  );
  process.exit(0);
}
