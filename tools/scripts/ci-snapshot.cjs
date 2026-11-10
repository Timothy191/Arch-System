#!/usr/bin/env node
/**
 * @file tools/scripts/ci-snapshot.cjs
 * @description Record the current CodeGraph index state as a baseline snapshot.
 *
 * Writes .agents/memory_base/index-snapshot.json with the entity / relation /
 * file counts and the ranged-entity ratio. audit-code-intelligence-drift.cjs
 * diffs against this. Safe to re-run anytime; it only records, never mutates
 * the index.
 *
 * Usage: node tools/scripts/ci-snapshot.cjs [db_path]
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..', '..');
// The index lives OUTSIDE the repo at <workspace-root>/local.db so it is not
// tracked by git and survives across sessions. CODEGRAPH_DB overrides it.
const DB_PATH = process.env.CODEGRAPH_DB || path.join(path.resolve(ROOT, '..', '..'), 'local.db');
const OUT_PATH = path.join(ROOT, '.agents', 'memory_base', 'index-snapshot.json');

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`index DB not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000;');

  const entities = db.prepare('SELECT COUNT(*) AS c FROM code_entities').get().c;
  const relations = db.prepare('SELECT COUNT(*) AS c FROM code_relations').get().c;
  const files = db.prepare('SELECT COUNT(DISTINCT file_path) AS c FROM code_entities').get().c;
  const ranged = db
    .prepare('SELECT COUNT(*) AS c FROM code_entities WHERE end_line > start_line')
    .get().c;

  const snap = {
    capturedAt: new Date().toISOString(),
    db: DB_PATH,
    entities,
    relations,
    files,
    ranged,
    rangedRatio: entities ? Number((ranged / entities).toFixed(4)) : 0,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(snap, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify(snap, null, 2));
  console.log(`snapshot written to ${OUT_PATH}`);
}

main();
