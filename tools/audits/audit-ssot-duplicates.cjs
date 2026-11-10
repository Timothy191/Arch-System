#!/usr/bin/env node
'use strict';

/**
 * @file tools/audits/audit-ssot-duplicates.cjs
 * @description Static regression guard ensuring the 18 consolidated Single-Source-of-Truth (SSoT)
 * functions, components, hooks, and constants are declared exclusively in their canonical modules.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SCAN_ROOTS = ['apps/portal', 'libs', 'packages', 'tools'];

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.git',
  '.cache',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SELF_REL_PATH = 'tools/audits/audit-ssot-duplicates.cjs';

const CANONICAL_SSOT_SYMBOLS = [
  {
    symbol: 'assertAdmin',
    canonicalPath: 'apps/portal/features/admin/actions/shared.ts',
  },
  {
    symbol: 'assertAccessControlRole',
    canonicalPath: 'apps/portal/app/(departments)/access-control/actions/shared.ts',
  },
  {
    symbol: 'sanitizeCsvCell',
    canonicalPath: 'apps/portal/lib/api/export-helpers.ts',
  },
  {
    symbol: 'prepareExportRequest',
    canonicalPath: 'apps/portal/lib/api/export-helpers.ts',
  },
  {
    symbol: 'authorizeRedisProxyRequest',
    canonicalPath: 'apps/portal/lib/api/telemetry-auth.ts',
  },
  {
    symbol: 'getWorkflowQueue',
    canonicalPath: 'apps/portal/lib/workflows/queue.ts',
  },
  {
    symbol: 'ARCH_LOGO_PATH',
    canonicalPath: 'packages/ui/src/components/Logo.tsx',
  },
  {
    symbol: 'GoldenTelemetrySparkline',
    canonicalPath: 'apps/portal/components/telemetry/GoldenTelemetrySparkline.tsx',
  },
  {
    symbol: 'buildSparklinePoints',
    canonicalPath: 'apps/portal/components/telemetry/GoldenTelemetrySparkline.tsx',
  },
  {
    symbol: 'DepartmentPageLoadingSkeleton',
    canonicalPath: 'apps/portal/components/skeletons/DepartmentPageLoadingSkeleton.tsx',
  },
  {
    symbol: 'openDockedGoogleWindow',
    canonicalPath: 'apps/portal/lib/google-workspace.ts',
  },
  {
    symbol: 'useFormDraftPersistence',
    canonicalPath: 'libs/shared/hooks/src/useFormDraftPersistence.ts',
  },
  {
    symbol: 'resolveSupabasePublicConfig',
    canonicalPath: 'packages/supabase/src/config.ts',
  },
  {
    symbol: 'unrefSleep',
    canonicalPath: 'packages/redis/src/internal-utils.ts',
  },
  {
    symbol: 'getCircuitGuardedRedisClient',
    canonicalPath: 'packages/redis/src/internal-utils.ts',
  },
  {
    symbol: 'getDirSize',
    canonicalPath: 'tools/lib/fs-metrics.cjs',
  },
  {
    symbol: 'getNextLogNumber',
    canonicalPath: 'tools/lib/versioned-log-dir.cjs',
  },
  {
    symbol: 'stripSqlComments',
    canonicalPath: 'tools/lib/sql-migration-utils.cjs',
  },
  {
    symbol: 'DepartmentFilterToolbar',
    canonicalPath: 'packages/ui/src/components/DepartmentFilterToolbar.tsx',
  },
  {
    symbol: 'parseServerTimingHeader',
    canonicalPath: 'apps/portal/lib/observability/server-timing-client.ts',
  },
];

function isExcludedFile(fileName, relPath) {
  if (relPath === SELF_REL_PATH) return true;
  if (fileName.endsWith('.d.ts')) return true;
  if (/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(fileName)) return true;
  const ext = path.extname(fileName);
  return !SOURCE_EXTENSIONS.has(ext);
}

function collectSourceFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectSourceFiles(path.join(dirPath, entry.name), collected);
      continue;
    }
    if (!entry.isFile()) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath).split(path.sep).join('/');
    if (isExcludedFile(entry.name, relPath)) continue;
    collected.push({ fullPath, relPath });
  }
  return collected;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

function buildDeclarationRegexes(symbol) {
  return [
    new RegExp(`^\\s*function\\s+${symbol}\\b`),
    new RegExp(`^\\s*export\\s+function\\s+${symbol}\\b`),
    new RegExp(`^\\s*export\\s+async\\s+function\\s+${symbol}\\b`),
    new RegExp(`^\\s*(?:export\\s+)?const\\s+${symbol}\\s*(?::[^=]+)?=`),
  ];
}

function findDeclarationsInFile(lines, regexes) {
  const matchedLines = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (/^\s*export\s*\{/.test(line)) continue;
    if (regexes.some((rx) => rx.test(line))) {
      matchedLines.push(idx + 1);
    }
  }
  return matchedLines;
}

function runAudit() {
  const allFiles = [];
  for (const scanRoot of SCAN_ROOTS) {
    collectSourceFiles(path.join(ROOT_DIR, scanRoot), allFiles);
  }

  const fileLinesMap = new Map();
  for (const file of allFiles) {
    const raw = fs.readFileSync(file.fullPath, 'utf8');
    const cleaned = stripComments(raw);
    fileLinesMap.set(file.relPath, cleaned.split('\n'));
  }

  const results = [];
  const violations = [];

  for (const spec of CANONICAL_SSOT_SYMBOLS) {
    const regexes = buildDeclarationRegexes(spec.symbol);
    const canonicalLines = fileLinesMap.get(spec.canonicalPath);
    const canonicalMatches = canonicalLines ? findDeclarationsInFile(canonicalLines, regexes) : [];
    const duplicates = [];

    for (const [relPath, lines] of fileLinesMap.entries()) {
      if (relPath === spec.canonicalPath) continue;
      const matches = findDeclarationsInFile(lines, regexes);
      if (matches.length > 0) {
        duplicates.push({ relPath, lines: matches });
        violations.push({
          symbol: spec.symbol,
          offendingPath: relPath,
          lines: matches,
          canonicalPath: spec.canonicalPath,
        });
      }
    }

    if (canonicalMatches.length === 0) {
      violations.push({
        symbol: spec.symbol,
        offendingPath: '<missing-canonical-declaration>',
        lines: [],
        canonicalPath: spec.canonicalPath,
      });
    }

    results.push({
      symbol: spec.symbol,
      canonicalPath: spec.canonicalPath,
      canonicalFound: canonicalMatches.length > 0,
      duplicateCount: duplicates.length,
    });
  }

  console.log('================================================================================');
  console.log('🔍 [SSoT DUPLICATE AUDIT] Checking 20 Canonical SSoT Symbol Declarations');
  console.log('================================================================================');
  console.log(
    `${'Symbol'.padEnd(32)} | ${'Canonical SSoT Module'.padEnd(58)} | ${'Dups'.padEnd(4)} | Status`
  );
  console.log('-'.repeat(106));

  for (const row of results) {
    const status = row.canonicalFound && row.duplicateCount === 0 ? 'PASS' : 'FAIL';
    console.log(
      `${row.symbol.padEnd(32)} | ${row.canonicalPath.padEnd(58)} | ${String(row.duplicateCount).padEnd(4)} | ${status}`
    );
  }

  console.log('-'.repeat(106));
  console.log(`Scanned ${allFiles.length} source files across ${SCAN_ROOTS.join(', ')}.`);

  if (violations.length > 0) {
    console.error(`\n❌ FAIL — Found ${violations.length} SSoT declaration violation(s):`);
    for (const v of violations) {
      const loc = v.lines.length > 0 ? `:${v.lines.join(',')}` : '';
      console.error(
        `  • ${v.symbol}: offending declaration in ${v.offendingPath}${loc} (canonical SSoT: ${v.canonicalPath})`
      );
    }
    process.exit(1);
  }

  console.log(
    '\n✅ PASS — All 20 SSoT symbols are declared exclusively in their canonical modules (0 duplicates).'
  );
  process.exit(0);
}

runAudit();
