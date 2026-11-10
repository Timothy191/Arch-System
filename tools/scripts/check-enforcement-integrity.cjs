#!/usr/bin/env node
/**
 * @file tools/scripts/check-enforcement-integrity.cjs
 * @description Pre-commit guard for the Code-Intelligence enforcement SSoT.
 *
 * Proves the enforcement layer is intact before anything ships:
 *   1. the drift audit script exists and passes against the live index
 *   2. the snapshot baseline exists and matches the live counts
 *   3. .qoder/settings.json registers the code-intelligence edit-time hook
 *   4. .husky/pre-push fast-path compares against totalGates, not a magic 27/28
 *
 * Exits 0 on success, 1 on any break. Wired from .husky/pre-commit.
 *
 * Usage: node tools/scripts/check-enforcement-integrity.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = process.env.CODEGRAPH_DB || path.join(path.resolve(ROOT, '..', '..'), 'local.db');
const SNAPSHOT = path.join(ROOT, '.agents', 'memory_base', 'index-snapshot.json');
const SETTINGS = path.join(ROOT, '.qoder', 'settings.json');
const PRE_PUSH = path.join(ROOT, '.husky', 'pre-push');

const failures = [];

function check(name, ok, detail) {
  if (ok) {
    console.log(`✅ ${name}`);
  } else {
    failures.push(`${name}: ${detail}`);
    console.log(`❌ ${name} — ${detail}`);
  }
}

// 1. Audit script exists and passes.
{
  const audit = path.join(ROOT, 'tools', 'audits', 'audit-code-intelligence-drift.cjs');
  let passed = false;
  let err = '';
  if (!fs.existsSync(audit)) {
    err = 'audit script missing';
  } else {
    try {
      execSync(`node "${audit}"`, { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
      passed = true;
    } catch (e) {
      err = (e.stderr || e.stdout || e.message || String(e))
        .toString()
        .trim()
        .split('\n')
        .slice(-3)
        .join(' | ');
    }
  }
  check('drift audit passes', passed, err || 'gate failed');
}

// 2. Snapshot exists and matches the live index counts.
{
  let ok = false;
  let detail = '';
  if (!fs.existsSync(SNAPSHOT)) {
    detail = 'snapshot missing — run pnpm ci:snapshot';
  } else if (!fs.existsSync(DB_PATH)) {
    detail = `index DB missing at ${DB_PATH} — run pnpm ci:reindex`;
  } else {
    try {
      const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
      const db = new DatabaseSync(DB_PATH);
      db.exec('PRAGMA busy_timeout = 5000;');
      const q = (sql) => db.prepare(sql).get().c;
      const entities = q('SELECT COUNT(*) AS c FROM code_entities');
      const relations = q('SELECT COUNT(*) AS c FROM code_relations');
      const files = q('SELECT COUNT(DISTINCT file_path) AS c FROM code_entities');
      ok = entities === snap.entities && relations === snap.relations && files === snap.files;
      if (!ok) {
        detail = `snapshot (${snap.entities}/${snap.relations}/${snap.files}) vs live (${entities}/${relations}/${files})`;
      }
    } catch (e) {
      detail = e.message;
    }
  }
  check('snapshot matches live index', ok, detail);
}

// 3. Edit-time hook is registered in .qoder/settings.json.
{
  let ok = false;
  let detail = '';
  try {
    const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
    const hooks = s.hooks?.PostToolUse ?? [];
    ok = hooks.some(
      (b) =>
        b?.matcher === 'Edit|Write' &&
        Array.isArray(b.hooks) &&
        b.hooks.some((h) => h?.command?.includes('code-intelligence-gate.sh'))
    );
    if (!ok) detail = 'code-intelligence-gate.sh not registered in PostToolUse';
  } catch (e) {
    detail = `cannot read ${SETTINGS}: ${e.message}`;
  }
  check('edit-time hook registered', ok, detail);
}

// 4. pre-push fast-path is totalGates-aware, not magic-numbered.
{
  let ok = false;
  let detail = '';
  try {
    const txt = fs.readFileSync(PRE_PUSH, 'utf8');
    ok = txt.includes('passedGates === ev.totalGates') && !/passedGates === (27|28)/.test(txt);
    if (!ok) detail = 'pre-push fast-path still hardcodes a magic gate count';
  } catch (e) {
    detail = `cannot read ${PRE_PUSH}: ${e.message}`;
  }
  check('pre-push is totalGates-aware', ok, detail);
}

if (failures.length === 0) {
  console.log('\n✅ Enforcement SSoT integrity verified.');
  process.exit(0);
}

console.log(`\n❌ ${failures.length} enforcement integrity failure(s):`);
for (const f of failures) console.log(`  • ${f}`);
console.log(
  "  RESOLVE: restore the enforcement machinery and run 'pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence'."
);
process.exit(1);
