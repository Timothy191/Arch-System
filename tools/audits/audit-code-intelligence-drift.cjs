#!/usr/bin/env node
/**
 * @file tools/audits/audit-code-intelligence-drift.cjs
 * @description Code-intelligence substrate drift guard.
 *
 * The CodeGraph index (SQLite) is the single source of truth for structural
 * knowledge: entities carry (file_path, name, kind, start_line, end_line) and
 * relations carry (source_file, source_name, target_name, relation_type,
 * line_number). end_line is NOT optional — it is the body range that makes
 * syntactic chunking, impact analysis, and TDAD meaningful.
 *
 * This gate fails when the index has drifted from the source tree:
 *   1. entity count / relation count / distinct files differ from a prior
 *      snapshot recorded in .agents/memory_base/index-snapshot.json
 *   2. end_line == start_line for more than a tolerance share of entities
 *      (body ranges missing — the failure this gate exists to prevent)
 *
 * Uses the Node 26 built-in `node:sqlite` (no external dependency).
 * Exit codes: 0 = in sync, 1 = drift detected.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..', '..');
// The index lives OUTSIDE the repo at <workspace-root>/local.db so it is not
// tracked by git and survives across sessions. CODEGRAPH_DB overrides it.
const DB_PATH = process.env.CODEGRAPH_DB || path.join(path.resolve(ROOT, '..', '..'), 'local.db');
const SNAPSHOT_PATH = path.join(ROOT, '.agents', 'memory_base', 'index-snapshot.json');

// Tolerances. A healthy index after a backfill is ~75%+ ranged.
const RANGED_MIN_RATIO = 0.5;
const NO_RANGE_MAX_RATIO = 0.45;

function fmt(n) {
  return n.toLocaleString();
}

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function count(db, sql) {
  return db.prepare(sql).get().c;
}

function main() {
  console.log('=======================================================');
  console.log('🔍 [AUDIT] Code-Intelligence Substrate Drift');
  console.log('=======================================================');
  console.log(`  db:        ${DB_PATH}`);
  console.log(`  snapshot:  ${SNAPSHOT_PATH}`);

  if (!fs.existsSync(DB_PATH)) {
    console.log(`❌ FAIL — index DB not found at ${DB_PATH}`);
    console.log('  RESOLVE: rebuild the index (see .agents/skills/code-intelligence/SKILL.md).');
    process.exit(1);
  }

  let db;
  try {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA busy_timeout = 5000;');
  } catch (e) {
    console.log(`❌ FAIL — cannot open DB: ${e.message}`);
    process.exit(1);
  }

  const entities = count(db, 'SELECT COUNT(*) AS c FROM code_entities');
  const relations = count(db, 'SELECT COUNT(*) AS c FROM code_relations');
  const files = count(db, 'SELECT COUNT(DISTINCT file_path) AS c FROM code_entities');
  const ranged = count(db, 'SELECT COUNT(*) AS c FROM code_entities WHERE end_line > start_line');
  const noRange = count(db, 'SELECT COUNT(*) AS c FROM code_entities WHERE end_line = start_line');
  const rangedRatio = entities ? ranged / entities : 0;
  const noRangeRatio = entities ? noRange / entities : 0;

  const snap = loadSnapshot();
  const failures = [];

  if (snap) {
    const deltaEntities = Math.abs(entities - snap.entities);
    const deltaRelations = Math.abs(relations - snap.relations);
    const deltaFiles = Math.abs(files - snap.files);
    if (deltaEntities > 0) {
      failures.push(
        `entity count drifted ${fmt(snap.entities)} → ${fmt(entities)} ` +
          `(Δ ${fmt(deltaEntities)})`
      );
    }
    if (deltaRelations > 0) {
      failures.push(
        `relation count drifted ${fmt(snap.relations)} → ${fmt(relations)} ` +
          `(Δ ${fmt(deltaRelations)})`
      );
    }
    if (deltaFiles > 0) {
      failures.push(
        `distinct files drifted ${fmt(snap.files)} → ${fmt(files)} ` + `(Δ ${fmt(deltaFiles)})`
      );
    }
  } else {
    console.log('⚠  No snapshot found — recording current state as baseline.');
  }

  if (rangedRatio < RANGED_MIN_RATIO) {
    failures.push(
      `only ${(rangedRatio * 100).toFixed(1)}% of entities carry a body range ` +
        `(${fmt(ranged)}/${fmt(entities)}); need ≥ ${(RANGED_MIN_RATIO * 100).toFixed(0)}%`
    );
  }
  if (noRangeRatio > NO_RANGE_MAX_RATIO) {
    failures.push(
      `${(noRangeRatio * 100).toFixed(1)}% of entities have end_line == start_line ` +
        `(${fmt(noRange)}); max allowed ${(NO_RANGE_MAX_RATIO * 100).toFixed(0)}%`
    );
  }

  console.log(`  entities:   ${fmt(entities)}`);
  console.log(`  relations:  ${fmt(relations)}`);
  console.log(`  files:      ${fmt(files)}`);
  console.log(`  ranged:     ${fmt(ranged)} (${(rangedRatio * 100).toFixed(1)}%)`);
  console.log(`  no range:   ${fmt(noRange)} (${(noRangeRatio * 100).toFixed(1)}%)`);

  if (failures.length === 0) {
    console.log('✅ PASS — code-intelligence substrate is in sync.');
    process.exit(0);
  }

  console.log(`\n❌ FAIL — ${failures.length} drift condition(s) detected:`);
  for (const f of failures) {
    console.log(`  • ${f}`);
  }
  console.log(
    '\n  RESOLVE: run `pnpm ci:reindex` (or see ' +
      '.agents/skills/code-intelligence/SKILL.md) to rebuild the index, ' +
      'then `pnpm ci:snapshot` to refresh the baseline.'
  );
  process.exit(1);
}

main();
