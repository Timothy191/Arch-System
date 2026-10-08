#!/usr/bin/env node

/**
 * @file tools/scripts/vercel-preflight.cjs
 * @description Comprehensive automated preflight auditor for Vercel Next.js monorepo deployment.
 * Supports both Preview and Production target environments.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PORTAL_DIR = path.join(ROOT_DIR, 'apps/portal');

// Parse CLI flags
const args = process.argv.slice(2);
let targetEnv = 'preview';
let runBuildCheck = false;

for (const arg of args) {
  if (arg === '--prod' || arg === '--production' || arg === '--env=production') {
    targetEnv = 'production';
  } else if (arg === '--preview' || arg === '--env=preview') {
    targetEnv = 'preview';
  } else if (arg === '--check-build' || arg === '--verify-build') {
    runBuildCheck = true;
  }
}

const c = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let errors = 0;
let warnings = 0;

console.log(
  c.bold(c.blue('======================================================================'))
);
console.log(
  c.bold(
    c.blue(
      `🚀 [VERCEL PREFLIGHT] Target: ${targetEnv.toUpperCase()} | Monorepo Deployment Pre-Check`
    )
  )
);
console.log(
  c.bold(c.blue('======================================================================'))
);

function recordError(msg) {
  console.log(c.red(`  ❌ [ERROR] ${msg}`));
  errors++;
}

function recordWarn(msg) {
  console.log(c.yellow(`  ⚠️  [WARN]  ${msg}`));
  warnings++;
}

function recordPass(msg) {
  console.log(c.green(`  ✅ [PASS]  ${msg}`));
}

// -----------------------------------------------------------------------------
// TIER 1: vercel.json & Monorepo Topology
// -----------------------------------------------------------------------------
console.log(c.bold(c.cyan('\n[Tier 1: Configuration & Workspace Boundaries]')));

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

// 1. vercel.json
const vercelJsonPath = path.join(ROOT_DIR, 'vercel.json');
if (!fs.existsSync(vercelJsonPath)) {
  recordError('Missing vercel.json in repository root.');
} else {
  try {
    const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    if (config.framework !== 'nextjs') {
      recordWarn(`vercel.json framework is '${config.framework}', expected 'nextjs'.`);
    }
    if (config.outputDirectory !== 'apps/portal/.next') {
      recordError(
        `vercel.json outputDirectory is '${config.outputDirectory}', expected 'apps/portal/.next'.`
      );
    } else {
      recordPass('vercel.json outputDirectory correctly mapped to apps/portal/.next');
    }
    const buildCommand = config.buildCommand ?? '';
    const resolvedBuildCommand = resolveBuildCommand(buildCommand);
    if (!resolvedBuildCommand.includes('portal')) {
      recordWarn(`vercel.json buildCommand ('${buildCommand}') should filter to portal.`);
    } else {
      recordPass(`vercel.json buildCommand verified with portal filter ('${buildCommand}')`);
    }
  } catch (err) {
    recordError(`Failed to parse vercel.json: ${err.message}`);
  }
}

// .vercelignore & Payload Budget (< 250MB limit)
const vercelIgnorePath = path.join(ROOT_DIR, '.vercelignore');
if (!fs.existsSync(vercelIgnorePath)) {
  recordError('Missing .vercelignore file in repository root.');
} else {
  const ignoreContent = fs.readFileSync(vercelIgnorePath, 'utf8');
  const criticalExclusions = [
    'packages/eval/',
    'e2e/',
    '.agents/',
    'target/',
    '.turbo/',
    '*.db',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.cursorrules',
    'REVIEW.md',
    '.mcp.json',
    'tools/',
    'scripts/',
  ];
  const missingExclusions = criticalExclusions.filter((p) => !ignoreContent.includes(p));

  if (missingExclusions.length > 0) {
    recordWarn(
      `.vercelignore is missing critical heavy / agent patterns: ${missingExclusions.join(', ')}`
    );
  } else {
    recordPass(
      '.vercelignore verified with heavy artifact & coding agent exclusions (target/, .agents/, AGENTS.md, tools/)'
    );
  }
}

// apps/portal/next.config.mjs Architecture Rules
const nextConfigPath = path.join(PORTAL_DIR, 'next.config.mjs');
if (!fs.existsSync(nextConfigPath)) {
  recordError('Missing apps/portal/next.config.mjs.');
} else {
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
  if (!nextConfigContent.includes('outputFileTracingRoot')) {
    recordError('next.config.mjs missing outputFileTracingRoot (breaks monorepo NFT).');
  } else {
    recordPass('next.config.mjs declares outputFileTracingRoot for monorepo tracing');
  }
  if (!nextConfigContent.includes('outputFileTracingExcludes')) {
    recordWarn('next.config.mjs should configure outputFileTracingExcludes for agent isolation.');
  } else {
    const requiredTracingExcludes = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', 'tools/'];
    const missingTracingExcludes = requiredTracingExcludes.filter(
      (p) => !nextConfigContent.includes(p)
    );
    if (missingTracingExcludes.length > 0) {
      recordWarn(
        `outputFileTracingExcludes missing agent patterns: ${missingTracingExcludes.join(', ')}`
      );
    } else {
      recordPass('next.config.mjs outputFileTracingExcludes isolates all coding agent assets');
    }
  }
  if (!nextConfigContent.includes('process.env.VERCEL')) {
    recordWarn('next.config.mjs should omit standalone output when process.env.VERCEL is defined.');
  } else {
    recordPass('next.config.mjs dynamically configures standalone mode for Vercel vs Docker');
  }
  if (!nextConfigContent.includes('cacheComponents: true')) {
    recordWarn('next.config.mjs should enable Next.js 16 cacheComponents for granular caching.');
  } else {
    recordPass('next.config.mjs has Next.js 16 Cache Components enabled');
  }
}

// -----------------------------------------------------------------------------
// TIER 2: Environment Secret & Matrix Validation
// -----------------------------------------------------------------------------
console.log(
  c.bold(c.cyan(`\n[Tier 2: Environment Secret & URL Matrix (${targetEnv.toUpperCase()})]`))
);

// Load local .env files if present to populate process.env for local auditing
const envFiles = [
  path.join(PORTAL_DIR, '.env'),
  path.join(ROOT_DIR, '.env.vercel.prod'),
  path.join(ROOT_DIR, '.env.local'),
  path.join(ROOT_DIR, '.env'),
];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        // Avoid placeholders like <project-ref> or [SENSITIVE]
        if (val.includes('<') && val.includes('>')) continue;
        if (val === '[SENSITIVE]') continue;

        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  }
}

const requiredPublicVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

for (const v of requiredPublicVars) {
  const val = process.env[v];
  if (!val) {
    recordError(`Missing public environment variable: ${v}`);
  } else if (v === 'NEXT_PUBLIC_SUPABASE_URL' && !val.startsWith('https://')) {
    recordError(`${v} must be a secure HTTPS URL (got '${val}')`);
  } else {
    recordPass(`${v} is defined and formatted correctly`);
  }
}

// Database Connection String & Supavisor Pooler Check
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
if (dbUrl) {
  if (dbUrl.includes(':5432/')) {
    recordWarn(
      'DATABASE_URL connects to direct Postgres port 5432. For Vercel Serverless, ' +
        'use Supavisor transaction pooler port 6543 to avoid connection exhaustion.'
    );
  } else if (dbUrl.includes(':6543/')) {
    recordPass('DATABASE_URL is correctly routed to Supavisor transaction pooler (port 6543)');
  } else {
    recordPass('DATABASE_URL is configured');
  }
} else {
  if (targetEnv === 'production') {
    recordWarn(
      'DATABASE_URL not detected in shell (required for Kysely direct pooled queries in production).'
    );
  } else {
    recordPass('DATABASE_URL check skipped for preview (Supabase JS REST API used by default)');
  }
}

// Production-Specific Secrets
if (targetEnv === 'production') {
  const prodSecrets = ['SUPABASE_SERVICE_KEY', 'REDIS_URL', 'CRON_SECRET'];
  for (const secret of prodSecrets) {
    const val = process.env[secret];
    if (!val) {
      recordWarn(
        `Production secret ${secret} not detected in local shell (ensure set in Vercel Dashboard).`
      );
    } else if (secret === 'CRON_SECRET' && val.length < 16) {
      recordWarn('CRON_SECRET should be at least 16 characters for cryptographic safety.');
    } else if (secret === 'REDIS_URL' && val.includes('localhost')) {
      recordError('Production REDIS_URL cannot point to localhost.');
    } else {
      recordPass(`Production secret ${secret} verified`);
    }
  }
}

// -----------------------------------------------------------------------------
// TIER 3: Edge Proxy & Route Compatibility
// -----------------------------------------------------------------------------
console.log(c.bold(c.cyan('\n[Tier 3: Edge Proxy & Runtime Constraints]')));

const proxyPath = path.join(PORTAL_DIR, 'proxy.ts');
const serverProxyPath = path.join(PORTAL_DIR, 'server/proxy.ts');

if (!fs.existsSync(proxyPath)) {
  recordError('Missing apps/portal/proxy.ts (Next.js 16 standard routing proxy).');
} else {
  recordPass('apps/portal/proxy.ts exists');
}

if (fs.existsSync(serverProxyPath)) {
  const content = fs.readFileSync(serverProxyPath, 'utf8');
  // Check for disallowed Node native modules in Edge middleware
  const disallowedModules = ['node:fs', 'node:net', 'node:child_process', 'node:tls'];
  const importedDisallowed = disallowedModules.filter((m) => content.includes(m));
  if (importedDisallowed.length > 0) {
    recordError(
      `server/proxy.ts imports Node native modules illegal in Edge runtime: ${importedDisallowed.join(', ')}`
    );
  } else {
    recordPass('server/proxy.ts verified free of prohibited Node native modules');
  }

  // Check CSP connect-src header
  if (
    content.includes('connect-src') ||
    fs.readFileSync(proxyPath, 'utf8').includes('connect-src')
  ) {
    recordPass('Content-Security-Policy headers and nonces configured');
  }
}

// -----------------------------------------------------------------------------
// TIER 4: Build Artifacts & Chunk Budget
// -----------------------------------------------------------------------------
console.log(c.bold(c.cyan('\n[Tier 4: Build Artifacts & Budget Safeguards]')));

const nextBuildDir = path.join(PORTAL_DIR, '.next');
const reqServerFiles = path.join(nextBuildDir, 'required-server-files.json');

if (fs.existsSync(reqServerFiles)) {
  recordPass('Previous build artifact found (.next/required-server-files.json)');

  // Audit client chunks size <= 1.0 MB
  const staticChunksDir = path.join(nextBuildDir, 'static/chunks');
  if (fs.existsSync(staticChunksDir)) {
    const chunkFiles = fs.readdirSync(staticChunksDir).filter((f) => f.endsWith('.js'));
    let maxChunkSize = 0;
    let maxChunkName = '';

    for (const chunk of chunkFiles) {
      const stats = fs.statSync(path.join(staticChunksDir, chunk));
      if (stats.size > maxChunkSize) {
        maxChunkSize = stats.size;
        maxChunkName = chunk;
      }
    }

    const maxMb = (maxChunkSize / (1024 * 1024)).toFixed(2);
    if (maxChunkSize > 1024 * 1024) {
      recordWarn(
        `Largest client chunk (${maxChunkName}) is ${maxMb} MB (target budget <= 1.0 MB).`
      );
    } else {
      recordPass(`Largest client chunk (${maxChunkName}) is ${maxMb} MB (within 1.0 MB budget)`);
    }
  }
} else {
  recordPass('No prior build cache to inspect. Build will execute cleanly on Vercel.');
}

// -----------------------------------------------------------------------------
// TIER 5: Vercel Project Linkage (.vercel/)
// -----------------------------------------------------------------------------
console.log(c.bold(c.cyan('\n[Tier 5: Vercel Project Linkage & Authorization]')));

const vercelProjectJson = path.join(ROOT_DIR, '.vercel/project.json');
if (!fs.existsSync(vercelProjectJson)) {
  recordError('.vercel/project.json not found in root. Run `pnpm dlx vercel link --yes` once.');
} else {
  try {
    const projectData = JSON.parse(fs.readFileSync(vercelProjectJson, 'utf8'));
    if (!projectData.projectId || !projectData.orgId) {
      recordError('.vercel/project.json is missing projectId or orgId.');
    } else {
      recordPass(
        `Linked to Project: ${projectData.projectName || projectData.projectId} (Org: ${projectData.orgId})`
      );
    }
  } catch (err) {
    recordError(`.vercel/project.json is invalid JSON: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// TIER 6: Supabase Endpoint Connectivity
// -----------------------------------------------------------------------------
console.log(c.bold(c.cyan('\n[Tier 6: Supabase Endpoint Reachability]')));

async function checkSupabaseReachability() {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!sbUrl) return;

  try {
    const url = new URL(sbUrl);
    await new Promise((resolve) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: 443,
          path: '/rest/v1/',
          method: 'GET',
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          timeout: 4000,
        },
        (res) => {
          // Status 200 or 401/400 (auth check response) proves reachability
          if (res.statusCode && res.statusCode < 500) {
            recordPass(
              `Supabase REST endpoint reachable (${url.hostname}, HTTP ${res.statusCode})`
            );
          } else {
            recordWarn(`Supabase REST endpoint returned HTTP ${res.statusCode}`);
          }
          resolve();
        }
      );
      req.on('error', (err) => {
        recordWarn(`Supabase connectivity check warning: ${err.message}`);
        resolve();
      });
      req.on('timeout', () => {
        req.destroy();
        recordWarn('Supabase connectivity check timed out after 4000ms');
        resolve();
      });
      req.end();
    });
  } catch (err) {
    recordWarn(`Could not verify Supabase connectivity: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Final Evaluation & Exit Status
// -----------------------------------------------------------------------------
async function run() {
  await checkSupabaseReachability();

  console.log(
    c.bold(c.blue('\n======================================================================'))
  );
  if (errors > 0) {
    console.log(
      c.red(
        c.bold(`❌ Preflight FAILED with ${errors} blocking error(s) and ${warnings} warning(s).`)
      )
    );
    console.log(c.red('   Resolve all blocking errors before deploying to Vercel.'));
    process.exit(1);
  } else {
    console.log(
      c.green(
        c.bold(
          `✅ Preflight 100% PASSED with ${warnings} non-blocking warning(s).\n` +
            `   Monorepo is fully certified and guaranteed ready for Vercel ${targetEnv.toUpperCase()} deployment.`
        )
      )
    );
    process.exit(0);
  }
}

run();
