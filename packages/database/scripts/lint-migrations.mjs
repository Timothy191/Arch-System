#!/usr/bin/env node
/**
 * Lint changed SQL migrations with Squawk and enforce the project's RLS policy:
 * every table created by a migration must enable row level security and define
 * at least one policy.
 *
 * Usage:
 *   node scripts/lint-migrations.mjs --all
 *   node scripts/lint-migrations.mjs --staged
 *   node scripts/lint-migrations.mjs --changed[=<git-ref>]
 *   node scripts/lint-migrations.mjs <file> [<file>...]
 *
 * Exemptions must include a reason:
 *   -- rls-exempt: <reason>
 *   -- rls-exempt-table <schema.table>: <reason>
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = 'packages/database/migrations';
const MIN_EXEMPTION_REASON_LENGTH = 8;

const IDENT_PART = '(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)';
const QUALIFIED_NAME = String.raw`${IDENT_PART}(?:\s*\.\s*${IDENT_PART})?`;

const CREATE_TABLE_RE = new RegExp(
  String.raw`\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:(TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${QUALIFIED_NAME})`,
  'gi'
);
const ENABLE_RLS_RE = new RegExp(
  String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${QUALIFIED_NAME})\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b`,
  'gi'
);
const CREATE_POLICY_RE = new RegExp(
  String.raw`\bCREATE\s+POLICY\s+(?:${IDENT_PART})\s+ON\s+(${QUALIFIED_NAME})`,
  'gi'
);

const FILE_EXEMPT_RE = /^\s*--\s*rls-exempt\s*:\s*(.*)$/gim;
const TABLE_EXEMPT_RE = /^\s*--\s*rls-exempt-table\s+([^\s:]+)\s*:\s*(.*)$/gim;

/**
 * Remove comments and string literals while preserving character offsets.
 * Dollar-quoted DO blocks are retained (recursively masked) so policies written
 * inside `DO $$ ... $$` guards are still detected. Function bodies are masked.
 *
 * @param {string} sql
 * @param {{ keepDoBlocks?: boolean }} [options]
 * @returns {string}
 */
export function maskSql(sql, { keepDoBlocks = false } = {}) {
  let out = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      let depth = 1;
      out += '  ';
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          out += '  ';
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          out += '  ';
          i += 2;
        } else {
          out += sql[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      continue;
    }

    if (ch === "'") {
      out += "'";
      i++;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            out += '  ';
            i += 2;
            continue;
          }
          out += "'";
          i++;
          break;
        }
        out += sql[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    if (ch === '"') {
      out += '"';
      i++;
      while (i < sql.length) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            out += '""';
            i += 2;
            continue;
          }
          out += '"';
          i++;
          break;
        }
        out += sql[i];
        i++;
      }
      continue;
    }

    if (ch === '$') {
      const match = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (match) {
        const tag = match[0];
        const bodyStart = i + tag.length;
        const closing = sql.indexOf(tag, bodyStart);
        const bodyEnd = closing === -1 ? sql.length : closing;
        const body = sql.slice(bodyStart, bodyEnd);
        const isDoBlock = keepDoBlocks && /\bDO(?:\s+LANGUAGE\s+\w+)?\s*$/i.test(out.trimEnd());
        const maskedBody = isDoBlock
          ? maskSql(body, { keepDoBlocks: false })
          : body.replace(/[^\n]/g, ' ');
        out += ' '.repeat(tag.length) + maskedBody;
        if (closing !== -1) {
          out += ' '.repeat(tag.length);
          i = closing + tag.length;
        } else {
          i = sql.length;
        }
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeTableName(raw) {
  const parts = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (quoted && raw[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (ch === '.' && !quoted) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  const normalized = parts.map((part) => part.trim().toLowerCase());
  if (normalized.length === 1) return `public.${normalized[0]}`;
  return `${normalized[0]}.${normalized[1]}`;
}

/**
 * @param {string} sql
 * @returns {{ fileLevel: string | null, tables: Map<string, string>, invalid: Array<{ marker: string, reason: string }> }}
 */
export function parseExemptions(sql) {
  let fileLevel = null;
  const tables = new Map();
  const invalid = [];

  for (const match of sql.matchAll(FILE_EXEMPT_RE)) {
    const reason = (match[1] || '').trim();
    if (reason.length < MIN_EXEMPTION_REASON_LENGTH) {
      invalid.push({ marker: 'rls-exempt', reason });
    } else {
      fileLevel = reason;
    }
  }

  for (const match of sql.matchAll(TABLE_EXEMPT_RE)) {
    const table = normalizeTableName(match[1]);
    const reason = (match[2] || '').trim();
    if (reason.length < MIN_EXEMPTION_REASON_LENGTH) {
      invalid.push({ marker: `rls-exempt-table ${match[1]}`, reason });
    } else {
      tables.set(table, reason);
    }
  }

  return { fileLevel, tables, invalid };
}

/**
 * @param {string} sql
 * @param {{ file?: string }} [options]
 * @returns {{
 *   file: string,
 *   tables: Array<{ name: string, line: number }>,
 *   violations: Array<{ code: string, table?: string, line?: number, message: string }>
 * }}
 */
export function analyzeMigration(sql, { file = '<memory>' } = {}) {
  const structure = maskSql(sql, { keepDoBlocks: false });
  const withDoBlocks = maskSql(sql, { keepDoBlocks: true });
  const exemptions = parseExemptions(sql);
  const violations = [];

  for (const marker of exemptions.invalid) {
    violations.push({
      code: 'invalid-exemption',
      message: `Exemption "${marker.marker}" needs a reason of at least ${MIN_EXEMPTION_REASON_LENGTH} characters.`,
    });
  }

  const rlsEnabled = new Set();
  for (const match of withDoBlocks.matchAll(ENABLE_RLS_RE)) {
    rlsEnabled.add(normalizeTableName(match[1]));
  }

  const policies = new Set();
  for (const match of withDoBlocks.matchAll(CREATE_POLICY_RE)) {
    policies.add(normalizeTableName(match[1]));
  }

  const tables = [];
  for (const match of structure.matchAll(CREATE_TABLE_RE)) {
    const modifier = (match[1] || '').toUpperCase();
    const rawName = match[2];
    const tail = structure.slice(match.index + match[0].length, match.index + match[0].length + 60);

    if (modifier === 'TEMP' || modifier === 'TEMPORARY') continue;
    if (/^\s*PARTITION\s+OF\b/i.test(tail)) continue;

    const name = normalizeTableName(rawName);
    const line = sql.slice(0, match.index).split('\n').length;
    tables.push({ name, line });
  }

  for (const table of tables) {
    if (exemptions.fileLevel || exemptions.tables.has(table.name)) continue;

    if (!rlsEnabled.has(table.name)) {
      violations.push({
        code: 'missing-rls',
        table: table.name,
        line: table.line,
        message:
          'new table does not enable row level security. Add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` ' +
          'or an `-- rls-exempt-table <table>: <reason>` marker.',
      });
      continue;
    }

    if (!policies.has(table.name)) {
      violations.push({
        code: 'missing-policy',
        table: table.name,
        line: table.line,
        message:
          'new table has RLS enabled but no policy. Add at least one `CREATE POLICY ... ON ...` ' +
          'or an `-- rls-exempt-table <table>: <reason>` marker.',
      });
    }
  }

  return { file, tables, violations };
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getRepoRoot() {
  try {
    return git(['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  } catch {
    throw new Error(
      'Unable to locate the git repository root. Run this script from inside Arch-System.'
    );
  }
}

const SAFE_REF_RE = /^(?!-)[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function assertSafeRef(ref) {
  if (!SAFE_REF_RE.test(ref)) {
    throw new Error(`Invalid base ref "${ref}". Use a commit SHA or branch name.`);
  }
}

function refExists(repoRoot, ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: repoRoot });
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef() {
  const explicit = process.env.MIGRATION_BASE_REF;
  if (explicit) {
    assertSafeRef(explicit);
    return explicit;
  }

  const pullRequestBase = process.env.GITHUB_BASE_REF;
  if (pullRequestBase) {
    assertSafeRef(pullRequestBase);
    return refExists(process.cwd(), `origin/${pullRequestBase}`)
      ? `origin/${pullRequestBase}`
      : pullRequestBase;
  }

  const pushBefore = process.env.GITHUB_EVENT_BEFORE;
  if (pushBefore && /^[0-9a-f]{40}$/i.test(pushBefore) && !/^0+$/.test(pushBefore)) {
    return pushBefore;
  }

  return null;
}

function selectFiles({ mode, base, explicitFiles, repoRoot }) {
  const migrationsDir = path.join(repoRoot, MIGRATIONS_DIR);

  if (explicitFiles.length > 0) {
    return explicitFiles.map((file) => {
      const absolute = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
      return path.relative(repoRoot, absolute).split(path.sep).join('/');
    });
  }

  if (mode === 'all') {
    return fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => `${MIGRATIONS_DIR}/${name}`)
      .sort();
  }

  const args =
    mode === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', MIGRATIONS_DIR]
      : ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`, '--', MIGRATIONS_DIR];

  const output = git(args, { cwd: repoRoot });
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function usage() {
  return [
    'Usage: node scripts/lint-migrations.mjs [--all | --staged | --changed[=<ref>]] [files...]',
    '',
    '  --all           Lint every migration (audit mode; legacy files may fail).',
    '  --staged        Lint migrations staged for commit.',
    '  --changed[=ref] Lint migrations changed against a git ref (default: CI/base or HEAD~1).',
    '  --no-squawk     Skip Squawk (RLS checks still run).',
    '  --help          Show this help.',
    '',
    'Exemptions:',
    `  -- rls-exempt: <reason of ${MIN_EXEMPTION_REASON_LENGTH}+ characters>`,
    `  -- rls-exempt-table <schema.table>: <reason of ${MIN_EXEMPTION_REASON_LENGTH}+ characters>`,
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    mode: 'changed',
    base: null,
    files: [],
    runSquawk: true,
    help: false,
  };
  let modeCount = 0;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--all') {
      options.mode = 'all';
      modeCount++;
    } else if (arg === '--staged') {
      options.mode = 'staged';
      modeCount++;
    } else if (arg === '--changed') {
      options.mode = 'changed';
      modeCount++;
    } else if (arg.startsWith('--changed=')) {
      options.mode = 'changed';
      options.base = arg.slice('--changed='.length);
      if (!options.base)
        throw new Error('--changed requires a git ref, e.g. --changed=origin/main');
      modeCount++;
    } else if (arg === '--no-squawk') {
      options.runSquawk = false;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.files.push(arg);
    }
  }

  if (modeCount > 1) {
    throw new Error('Choose only one of --all, --staged, or --changed.');
  }
  if (modeCount > 0 && options.files.length > 0) {
    throw new Error('Pass either a mode flag or explicit files, not both.');
  }

  return options;
}

function runSquawk(repoRoot, files) {
  if (files.length === 0) return true;

  const configPath = path.join(repoRoot, '.squawk.toml');
  const localBin = path.join(repoRoot, 'packages/database/node_modules/.bin/squawk');
  const binary =
    process.platform === 'win32' && fs.existsSync(`${localBin}.cmd`) ? `${localBin}.cmd` : localBin;
  const command = fs.existsSync(binary) ? binary : 'squawk';

  const result = spawnSync(command, ['--config', configPath, ...files], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`\nERROR: could not run Squawk: ${result.error.message}`);
    console.error('Install it with: pnpm --filter @repo/database add -D squawk-cli');
    return false;
  }

  return result.status === 0;
}

export function formatResults(results) {
  const lines = [];
  for (const result of results) {
    if (result.violations.length === 0) continue;
    lines.push(`\nERROR: ${result.file}`);
    for (const violation of result.violations) {
      const location = violation.line ? `:${violation.line}` : '';
      const table = violation.table ? ` [${violation.table}]` : '';
      lines.push(`  ${result.file}${location}${table}: ${violation.message}`);
    }
  }
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`ERROR: ${error.message}\n\n${usage()}`);
    return 1;
  }

  if (options.help) {
    console.log(usage());
    return 0;
  }

  const repoRoot = getRepoRoot();
  let files;
  let base = options.base;

  try {
    if (options.mode === 'changed') {
      if (base) {
        assertSafeRef(base);
        if (!refExists(repoRoot, base)) {
          throw new Error(`Base ref "${base}" does not exist.`);
        }
      } else {
        base = resolveBaseRef();
        if (base) {
          if (!refExists(repoRoot, base)) {
            throw new Error(
              `Base ref "${base}" does not exist. Set MIGRATION_BASE_REF to a valid commit.`
            );
          }
        } else if (refExists(repoRoot, 'origin/main')) {
          base = 'origin/main';
        } else if (refExists(repoRoot, 'HEAD~1')) {
          base = 'HEAD~1';
        } else {
          console.warn('No base ref found; linting all migrations.');
          options.mode = 'all';
        }
      }
    }

    files = selectFiles({
      mode: options.mode,
      base,
      explicitFiles: options.files,
      repoRoot,
    });
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return 1;
  }

  files = [...new Set(files)].filter((file) => {
    const absolute = path.join(repoRoot, file);
    return (
      file.startsWith(`${MIGRATIONS_DIR}/`) && file.endsWith('.sql') && fs.existsSync(absolute)
    );
  });

  if (files.length === 0) {
    console.log('No changed migrations to lint.');
    return 0;
  }

  const scope =
    options.mode === 'all'
      ? 'all migrations'
      : options.mode === 'staged'
        ? 'staged migrations'
        : `migrations changed against ${base || 'the selected base'}`;
  console.log(`Linting ${files.length} migration(s) (${scope})...`);

  let squawkOk = true;
  if (options.runSquawk) {
    squawkOk = runSquawk(repoRoot, files);
  }

  const results = files.map((file) =>
    analyzeMigration(fs.readFileSync(path.join(repoRoot, file), 'utf8'), { file })
  );
  const violationCount = results.reduce((count, result) => count + result.violations.length, 0);

  if (violationCount > 0) {
    console.error(formatResults(results));
    console.error(
      `\nRLS gate failed: ${violationCount} violation(s) across ${files.length} migration(s).`
    );
  } else {
    console.log(`RLS gate passed for ${files.length} migration(s).`);
  }

  if (!squawkOk) {
    console.error(
      '\nSquawk failed. Fix the warnings above or add a reviewed rule exclusion to .squawk.toml.'
    );
  }

  return squawkOk && violationCount === 0 ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exitCode = main();
}
