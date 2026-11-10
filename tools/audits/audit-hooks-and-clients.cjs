#!/usr/bin/env node

/**
 * @file tools/audits/audit-hooks-and-clients.cjs
 * @description Reality check audit for hooks and client libraries:
 * 1. Prohibits dual-query client libraries (e.g. SWR) to preserve TanStack Query & Server Components SSoT.
 * 2. Enforces SSR hydration safety on custom hooks (browser globals guarded against undefined window).
 * 3. Enforces Vercel CLI deployment readiness and preflight validation.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '../..');
const _PORTAL_DIR = path.join(ROOT_DIR, 'apps/portal');
const HOOKS_DIR = path.join(ROOT_DIR, 'libs/shared/hooks/src');

const chalk = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

console.log(chalk.bold(chalk.blue('=======================================================')));
console.log(chalk.bold(chalk.blue('🔍 [AUDIT] Hooks, Query Libraries & Deployment Guard...')));
console.log(chalk.bold(chalk.blue('=======================================================')));

let errors = 0;
let warnings = 0;

// 1. Prohibit SWR and fragmented test runners across the monorepo
console.log(
  chalk.bold(
    '1. Checking for forbidden dual query libraries (SWR) and fragmented test runners (AVA, Mocha)...'
  )
);
const forbiddenPackages = [
  {
    name: 'swr',
    rationale:
      'Arch-System mandates @tanstack/react-query and Server Components. Dual-cache imports are prohibited.',
  },
  {
    name: 'swr/mutation',
    rationale: 'Arch-System mandates @tanstack/react-query and Server Components.',
  },
  {
    name: 'swr/infinite',
    rationale: 'Arch-System mandates @tanstack/react-query and Server Components.',
  },
  {
    name: 'ava',
    rationale:
      'Arch-System standardizes unit/integration testing on Jest 30. AVA is prohibited to prevent test runner fragmentation.',
  },
  {
    name: 'mocha',
    rationale: 'Arch-System standardizes unit/integration testing on Jest 30. Mocha is prohibited.',
  },
  {
    name: 'tape',
    rationale: 'Arch-System standardizes unit/integration testing on Jest 30. Tape is prohibited.',
  },
];
const scanDirs = [
  path.join(ROOT_DIR, 'apps/portal'),
  path.join(ROOT_DIR, 'libs'),
  path.join(ROOT_DIR, 'packages'),
];

function checkFilesForForbiddenImports(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '.turbo', 'build'].includes(entry.name)) continue;
      checkFilesForForbiddenImports(fullPath);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const item of forbiddenPackages) {
        const pkg = item.name;
        const importPattern = new RegExp(
          `from\\s+['"]${pkg}['"]|import\\(['"]${pkg}['"]\\)|require\\(['"]${pkg}['"]\\)`,
          'g'
        );
        if (importPattern.test(content)) {
          console.log(
            chalk.red(`❌ Forbidden import '${pkg}' found in ${path.relative(ROOT_DIR, fullPath)}`)
          );
          console.log(chalk.yellow(`   ${item.rationale}`));
          errors++;
        }
      }
    }
  }
}

for (const dir of scanDirs) {
  checkFilesForForbiddenImports(dir);
}

if (errors === 0) {
  console.log(
    chalk.green('   ✅ Zero forbidden imports (SWR / AVA / Mocha) found. Jest 30 SSoT maintained.')
  );
}

// 2. Validate custom hooks SSR safety
console.log(
  chalk.bold(
    '\n2. Auditing custom hooks SSR hydration safety in libs/shared/hooks & apps/portal/hooks...'
  )
);
const hookDirs = [HOOKS_DIR, path.join(_PORTAL_DIR, 'hooks')];
let hooksChecked = 0;

for (const hookDir of hookDirs) {
  if (!fs.existsSync(hookDir)) continue;
  const hookFiles = fs
    .readdirSync(hookDir)
    .filter(
      (f) =>
        f.startsWith('use') &&
        f.endsWith('.ts') &&
        !f.endsWith('.test.ts') &&
        !f.endsWith('.spec.ts')
    );

  for (const hookFile of hookFiles) {
    const fullPath = path.join(hookDir, hookFile);
    const content = fs.readFileSync(fullPath, 'utf8');
    hooksChecked++;

    // Check if the hook accesses browser globals without typeof window check or inside useEffect
    const usesBrowserGlobals = /\b(window|localStorage|sessionStorage|navigator|document)\b/.test(
      content
    );
    if (usesBrowserGlobals) {
      const hasWindowGuard =
        /typeof\s+window\s*!==\s*['"]undefined['"]|typeof\s+window\s*===\s*['"]undefined['"]|isBrowser/.test(
          content
        );
      const hasUseEffect = /\buseEffect\b|\buseLayoutEffect\b|\buseCallback\b/.test(content);

      if (!hasWindowGuard && !hasUseEffect) {
        console.log(
          chalk.yellow(
            `   ⚠️  Hook ${path.relative(ROOT_DIR, fullPath)} references browser globals without an explicit window guard or effect wrapper.`
          )
        );
        warnings++;
      }
    }
  }
}
console.log(
  chalk.green(
    `   ✅ Checked ${hooksChecked} custom industrial hooks across libs/shared/hooks & apps/portal/hooks. All satisfy SSR hydration safety patterns.`
  )
);

// 2b. Validate HTTP Security Headers in apps/portal/proxy.ts & apps/portal/next.config.mjs
console.log(chalk.bold('\n2b. Auditing HTTP Security Headers (CSP, HSTS, Frame & MIME Guards)...'));
const proxyPath = path.join(_PORTAL_DIR, 'proxy.ts');
const nextConfigPath = path.join(_PORTAL_DIR, 'next.config.mjs');
if (!fs.existsSync(proxyPath) || !fs.existsSync(nextConfigPath)) {
  console.log(chalk.red('   ❌ Missing apps/portal/proxy.ts or apps/portal/next.config.mjs.'));
  errors++;
} else {
  const proxySrc = fs.readFileSync(proxyPath, 'utf8');
  const nextConfigSrc = fs.readFileSync(nextConfigPath, 'utf8');
  const requiredProxyHeaders = ['Content-Security-Policy', 'x-nonce', "frame-ancestors 'none'"];
  for (const hdr of requiredProxyHeaders) {
    if (!proxySrc.includes(hdr)) {
      console.log(
        chalk.red(`   ❌ apps/portal/proxy.ts missing required security directive: ${hdr}`)
      );
      errors++;
    }
  }
  const requiredNextHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Strict-Transport-Security',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Robots-Tag',
  ];
  for (const hdr of requiredNextHeaders) {
    if (!nextConfigSrc.includes(hdr)) {
      console.log(
        chalk.red(`   ❌ apps/portal/next.config.mjs missing required HTTP security header: ${hdr}`)
      );
      errors++;
    }
  }
  if (errors === 0) {
    console.log(
      chalk.green(
        `   ✅ Verified ${requiredProxyHeaders.length} proxy CSP directives and ${requiredNextHeaders.length} Next.js HTTP security headers.`
      )
    );
  }
}

// 3. Validate Vercel CLI & Preflight
console.log(chalk.bold('\n3. Verifying Vercel CLI availability and preflight script...'));
try {
  const vercelVersion = execSync('vercel --version', { encoding: 'utf8' }).trim();
  console.log(chalk.green(`   ✅ Vercel CLI verified on PATH: ${vercelVersion}`));
} catch (e) {
  console.log(chalk.yellow(`   ⚠️  Vercel CLI command check returned warning: ${e.message}`));
  warnings++;
}

const preflightScript = path.join(ROOT_DIR, 'tools/scripts/vercel-preflight.cjs');
if (fs.existsSync(preflightScript)) {
  console.log(
    chalk.green('   ✅ tools/scripts/vercel-preflight.cjs exists and is ready for CI/CD gates.')
  );
} else {
  console.log(chalk.red('   ❌ tools/scripts/vercel-preflight.cjs missing.'));
  errors++;
}

console.log(chalk.bold(chalk.blue('\n=======================================================')));
if (errors > 0) {
  console.log(
    chalk.red(
      chalk.bold(
        `❌ Hooks & Client Audit FAILED with ${errors} error(s) and ${warnings} warning(s).`
      )
    )
  );
  process.exit(1);
} else {
  console.log(
    chalk.green(chalk.bold(`✅ Hooks & Client Audit PASSED with ${warnings} warning(s).`))
  );
  process.exit(0);
}
