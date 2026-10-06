#!/usr/bin/env node

/**
 * Migration Drift & Structural Linter
 *
 * Static analysis of the canonical migration tree (packages/database/migrations).
 * Checks that:
 *
 *   1. Filenames follow NNN_name.sql (3-4 digit prefix), no duplicate version numbers
 *   2. Deploy-time paths (packages/supabase/migrations, packages/database/supabase/migrations)
 *      are symlinks resolving to the canonical tree (single source of truth)
 *   3. Every public-schema relation referenced by an active migration
 *      (ALTER TABLE / CREATE INDEX ... ON / TRUNCATE / COMMENT ON /
 *       GRANT ... ON TABLE / POLICY ... ON / REFERENCES) is actually created by
 *      some active migration (CREATE TABLE / MATERIALIZED VIEW / VIEW /
 *       PARTITION OF / RENAME TO, including inside DO blocks, excluding TEMP
 *       tables). References inside a file that carries a to_regclass() guard for
 *      the relation are downgraded to a warning (guarded legacy compatibility,
 *      e.g. 166_harden_legacy_migrations).
 *   4. No REFRESH MATERIALIZED VIEW CONCURRENTLY inside a plpgsql function or DO
 *      block, and no bare top-level CONCURRENTLY statement (both fail because a
 *      migration or plpgsql body runs inside a transaction block). The only
 *      legitimate form is a quoted string argument to cron.schedule(...), which
 *      pg_cron executes in its own transaction.
 *   5. No *.backup artifacts inside the canonical tree
 *   6. Warning: filenames whose lexicographic order breaks numeric monotonicity
 *      (pre-existing 0145_/0146_ 4-digit naming quirk)
 *
 * Run: node tests/check-migration-drift.mjs
 * Exit code: 0 (pass) or 1 (fail)
 */

import { readdirSync, readFileSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = join(__dirname, '..');
const MIGRATIONS_DIR = join(PKG_DIR, 'migrations');
const ROOT = resolve(PKG_DIR, '..', '..');

// ── Config ───────────────────────────────────────────────────────────────────

const SEQUENTIAL_FILE_REGEX = /^(\d{3,4})_(.+)\.sql$/;
// Relations named like runtime-created partition children (create_next_month_partitions())
const RUNTIME_PARTITION_RE = /_p\d{4}_\d{2}$/;
// External / non-public schemas are never created by migrations
const EXTERNAL_SCHEME_RE =
  /^(auth|storage|cron|extensions|graphql_public|supabase_migrations|pg_|information_schema)/;

const SYMLINK_TARGETS = [
  {
    label: 'packages/supabase/migrations (stale-copy guard)',
    link: join(ROOT, 'packages', 'supabase', 'migrations'),
    expect: join(ROOT, 'packages', 'database', 'migrations'),
  },
  {
    label: 'packages/database/supabase/migrations (supabase CLI project dir)',
    link: join(ROOT, 'packages', 'database', 'supabase', 'migrations'),
    expect: join(ROOT, 'packages', 'database', 'migrations'),
  },
];

// ── Results tracking ─────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

function error(msg, file = '') {
  errors.push({ msg, file });
}
function warn(msg, file = '') {
  warnings.push({ msg, file });
}

// ── Statement parsing ────────────────────────────────────────────────────────

const CREATE_TABLE_RE =
  /^\s*CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const CREATE_TEMP_TABLE_RE = /^\s*CREATE\s+(?:UNLOGGED\s+)?(?:TEMP|TEMPORARY)\s+TABLE/i;
const CREATE_MV_RE =
  /^\s*CREATE\s+MATERIALIZED\s+VIEW(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const CREATE_VIEW_RE =
  /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?VIEW\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const PARTITION_OF_RE = /\bPARTITION\s+OF\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const RENAME_TO_RE = /\bRENAME\s+TO\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;

const ALTER_TABLE_RE =
  /^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const CREATE_INDEX_START_RE = /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/i;
const ON_RELATION_RE =
  /\bON\s+(?!(?:CONFLICT|DELETE|UPDATE|TRUNCATE|COMMIT|COMPLETE)\b)(?:ONLY\s+)?(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const TRUNCATE_RE = /^\s*TRUNCATE(?:TABLE)?\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const COMMENT_ON_RE =
  /^\s*COMMENT\s+ON\s+(?:TABLE|COLUMN|MATERIALIZED\s+VIEW|VIEW)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const GRANT_TABLE_RE = /\bON\s+TABLE\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const POLICY_ON_RE =
  /^\s*(?:CREATE|ALTER|DROP)\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?[A-Za-z_][A-Za-z0-9_]*["']?\s+ON\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i;
const REFERENCES_RE = /\bREFERENCES\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)\s*[\(,]/i;
const CONCURRENTLY_RE = /REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY/i;
const BARE_CONCURRENTLY_RE = /^\s*REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY/i;
const TO_REGCLASS_RE = /to_regclass\(['"](?:public\.)?([A-Za-z_][A-Za-z0-9_]*)['"]\)/gi;

function isExternalOrRuntime(rel) {
  return EXTERNAL_SCHEME_RE.test(rel) || RUNTIME_PARTITION_RE.test(rel);
}

// ── Validate a single migration file ─────────────────────────────────────────

function validateFile(file, { created, references, guardedRels }) {
  const text = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  const lines = text.split('\n');
  let inBody = false;
  let pendingIndex = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Slip trailing comments so prose like "on table and operation" cannot match
    const stmt = rawLine.replace(/--.*$/, '').trim();

    // Body tracking: bare $$ dollar-quote toggle (works for functions, triggers
    // and DO blocks, regardless of END; indentation or `$$ LANGUAGE` placement).
    const dq = (stmt.match(/\$\$/g) || []).length;
    for (let k = 0; k < dq; k++) inBody = !inBody;

    // CONCURRENTLY usage: only legal as a quoted cron.schedule argument (which
    // pg_cron runs in its own transaction). Both in-body and bare top-level
    // forms execute inside a transaction block and fail at runtime.
    if (CONCURRENTLY_RE.test(stmt)) {
      if (inBody) {
        error(
          'REFRESH MATERIALIZED VIEW CONCURRENTLY inside a plpgsql body fails at runtime (plpgsql bodies run in a transaction block). Schedule the bare statement via cron.schedule instead',
          file + ':' + (i + 1)
        );
      } else if (BARE_CONCURRENTLY_RE.test(stmt)) {
        error(
          "Bare top-level REFRESH MATERIALIZED VIEW CONCURRENTLY fails inside the migration transaction. Only use it as a quoted cron.schedule(..., 'REFRESH ...') argument",
          file + ':' + (i + 1)
        );
      }
    }

    let m;

    // creations count both at top level and inside DO/function bodies (e.g.
    // 171 creates the smr_latest matview inside a DO block); TEMP tables are
    // session-scoped and never satisfy cross-file references.
    m = stmt.match(CREATE_TABLE_RE);
    if (m && !CREATE_TEMP_TABLE_RE.test(stmt)) {
      const rel = m[1].toLowerCase();
      if (!isExternalOrRuntime(rel)) {
        created.add(rel);
        const pm = stmt.match(PARTITION_OF_RE);
        if (pm) {
          const parent = pm[1].toLowerCase();
          if (!isExternalOrRuntime(parent)) created.add(parent);
        }
      }
      continue;
    }
    m = stmt.match(CREATE_MV_RE);
    if (m) {
      const rel = m[1].toLowerCase();
      if (!isExternalOrRuntime(rel)) created.add(rel);
      continue;
    }
    m = stmt.match(CREATE_VIEW_RE);
    if (m) {
      const rel = m[1].toLowerCase();
      if (!isExternalOrRuntime(rel)) created.add(rel);
      continue;
    }
    // table renames produce a new relation (e.g. 069 operational_delays -> *_deprecated_20250115)
    m = stmt.match(RENAME_TO_RE);
    if (m) {
      const rel = m[1].toLowerCase();
      if (!isExternalOrRuntime(rel)) created.add(rel);
    }

    // references
    m = stmt.match(ALTER_TABLE_RE);
    if (m) {
      recordRef(m[1].toLowerCase(), references, file, i + 1);
      continue;
    }
    if (CREATE_INDEX_START_RE.test(stmt)) {
      pendingIndex = true;
      // fall through: resolve single-line `CREATE INDEX ... ON tbl (...)` too
    }
    if (pendingIndex) {
      m = stmt.match(ON_RELATION_RE);
      if (m) {
        recordRef(m[1].toLowerCase(), references, file, i + 1);
        pendingIndex = false;
      }
      continue;
    }
    m =
      stmt.match(TRUNCATE_RE) ||
      stmt.match(COMMENT_ON_RE) ||
      stmt.match(GRANT_TABLE_RE) ||
      stmt.match(POLICY_ON_RE);
    if (m) {
      recordRef(m[1].toLowerCase(), references, file, i + 1);
      continue;
    }
    m = stmt.match(REFERENCES_RE);
    if (m) {
      recordRef(m[1].toLowerCase(), references, file, i + 1);
    }
  }

  if (pendingIndex) {
    warn('CREATE INDEX statement did not resolve an ON <table> target', file);
  }

  // record any to_regclass guards for this file (downgrade missing refs)
  for (const gm of text.matchAll(TO_REGCLASS_RE)) {
    guardedRels.add(gm[1].toLowerCase());
  }
}

function recordRef(rel, references, file, line) {
  if (!rel || isExternalOrRuntime(rel)) return;
  references.push({ rel, file, line });
}

// ── Check filename conventions ───────────────────────────────────────────────

function checkFilenames(files) {
  const seenRaw = new Map(); // raw prefix -> [files]
  const byNum = new Map(); // numeric version -> [files]
  for (const f of files) {
    const m = f.match(SEQUENTIAL_FILE_REGEX);
    if (!m) {
      error(`Filenames must match NNN_name.sql (got: "${f}")`, f);
      continue;
    }
    const raw = m[1];
    const num = parseInt(raw, 10);
    if (!seenRaw.has(raw)) seenRaw.set(raw, []);
    seenRaw.get(raw).push(f);
    if (!byNum.has(num)) byNum.set(num, []);
    byNum.get(num).push(f);
  }
  for (const [raw, fs] of seenRaw) {
    if (fs.length > 1) error(`Duplicate raw version prefix "${raw}": ${fs.join(', ')}`, fs[0]);
  }
  for (const [num, fs] of byNum) {
    if (fs.length > 1) error(`Duplicate numeric version ${num}: ${fs.join(', ')}`, fs[0]);
  }

  // numeric monotonicity in lexicographic order (warning only; renumbering would
  // rewrite prod schema_migrations history)
  const byLex = files
    .filter((f) => SEQUENTIAL_FILE_REGEX.test(f))
    .slice()
    .sort();
  let inversions = 0;
  for (let i = 1; i < byLex.length; i++) {
    const prev = parseInt(byLex[i - 1].match(SEQUENTIAL_FILE_REGEX)[1], 10);
    const cur = parseInt(byLex[i].match(SEQUENTIAL_FILE_REGEX)[1], 10);
    if (cur < prev) inversions++;
  }
  if (inversions > 0) {
    warn(
      `${inversions} lexicographic ordering break(s) vs numeric versioning (e.g. 0145_/0146_ sort before 014_/015_). Renumbering would rewrite prod migration history — flagged, not auto-fixed.`
    );
  }
}

// ── Check deploy paths are symlinks to the canonical tree ────────────────────

function checkDeployPaths() {
  for (const { label, link, expect } of SYMLINK_TARGETS) {
    if (!existsSync(link)) {
      error(`${label} is missing`, link);
      continue;
    }
    if (!lstatSync(link).isSymbolicLink()) {
      error(
        `${label} is NOT a symlink (expected -> ${relative(ROOT, expect)}). Single-tree enforcement requires a symlink; a real directory is a stale duplicate.`,
        link
      );
      continue;
    }
    const target = realpathSync(link);
    const expectedReal = realpathSync(expect);
    if (target !== expectedReal) {
      error(
        `${label} resolves to ${relative(ROOT, target)}, expected ${relative(ROOT, expectedReal)}`,
        link
      );
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  } catch (e) {
    error(`Cannot read ${MIGRATIONS_DIR}: ${e.message}`);
    printReport();
    process.exit(1);
  }

  const backups = files.filter((f) => f.endsWith('.backup'));
  for (const b of backups)
    error('Untracked .backup artifact must not live in the migration tree', b);

  const active = files.filter((f) => !f.endsWith('.disabled') && !f.endsWith('.backup'));

  const created = new Set();
  const references = [];
  const guardedRels = new Set();

  for (const f of active) validateFile(f, { created, references, guardedRels });

  // missing-relation reporting (reference not created anywhere in active tree)
  const seenMissing = new Set();
  for (const ref of references) {
    if (created.has(ref.rel)) continue;
    const key = `${ref.rel}:${ref.file}:${ref.line}`;
    if (seenMissing.has(key)) continue;
    seenMissing.add(key);
    const loc = `${ref.file}:${ref.line}`;
    if (guardedRels.has(ref.rel)) {
      warn(
        `Relation "${ref.rel}" (${loc}) is never created by an active migration but is to_regclass()-guarded (legacy compat)`,
        ref.file
      );
    } else {
      error(
        `Relation "${ref.rel}" (${loc}) is referenced but never created by an active migration — clean bootstrap would fail. Create it or guard the reference with to_regclass().`,
        ref.file
      );
    }
  }

  checkFilenames(active);
  checkDeployPaths();

  printReport();
}

function printReport() {
  const divider = '─'.repeat(72);
  console.log(divider);
  console.log(' Migration Drift & Structural Linter');
  console.log(divider);
  console.log();

  if (warnings.length === 0 && errors.length === 0) {
    console.log('✅ All migration drift checks passed.');
  } else {
    if (warnings.length > 0) {
      console.log(`⚠️  Warnings (${warnings.length}):`);
      for (const w of warnings) console.log(`  - ${w.msg}${w.file ? ` [${w.file}]` : ''}`);
      console.log();
    }
    if (errors.length > 0) {
      console.log(`❌ Errors (${errors.length}):`);
      for (const e of errors) console.log(`  - ${e.msg}${e.file ? ` [${e.file}]` : ''}`);
      console.log();
    }
  }

  console.log(divider);
  console.log(`Summary: ${errors.length} error(s), ${warnings.length} warning(s)`);
  console.log(divider);

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
