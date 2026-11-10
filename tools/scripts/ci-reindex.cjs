#!/usr/bin/env node
/**
 * @file tools/scripts/ci-reindex.cjs
 * @description Rebuild the CodeGraph index from the source tree.
 *
 * Pipeline:
 *   1. ts_parse_dir.cjs  → per-file structural AST nodes (node + TypeScript)
 *   2. backfill_ranges.py → merge end_line ranges into the SQLite index
 *
 * The index lives OUTSIDE the repo at <workspace-root>/local.db so it is not
 * git-tracked. CODEGRAPH_DB overrides the path; CODEGRAPH_REPO overrides the
 * repo root.
 *
 * Usage: node tools/scripts/ci-reindex.cjs [db_path] [repo_root]
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const HOME_ROOT = path.resolve(ROOT, '..', '..');
const SKILL_DIR = fs.existsSync(
  path.join(HOME_ROOT, '.agents', 'skills', 'code-intelligence', 'scripts')
)
  ? path.join(HOME_ROOT, '.agents', 'skills', 'code-intelligence', 'scripts')
  : path.join(ROOT, '..', '.agents', 'skills', 'code-intelligence', 'scripts');
const DB_PATH =
  process.env.CODEGRAPH_DB ||
  (fs.existsSync(path.join(HOME_ROOT, 'local.db'))
    ? path.join(HOME_ROOT, 'local.db')
    : path.join(path.resolve(ROOT, '..'), 'local.db'));
const REPO_ROOT = process.env.CODEGRAPH_REPO || ROOT;

function run(label, cmd, opts) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  const res = execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
  return res;
}

function main() {
  console.log('=======================================================');
  console.log('🛠 [CI] Code-Intelligence Reindex');
  console.log('=======================================================');
  console.log(`  repo:      ${REPO_ROOT}`);
  console.log(`  db:        ${DB_PATH}`);
  console.log(`  skill dir: ${SKILL_DIR}`);

  for (const f of ['ts_parse_dir.cjs', 'backfill_ranges.py']) {
    if (!fs.existsSync(path.join(SKILL_DIR, f))) {
      console.error(`❌ missing prerequisite: ${path.join(SKILL_DIR, f)}`);
      process.exit(1);
    }
  }

  run('1/2 Parse TS/TSX tree', `node "${path.join(SKILL_DIR, 'ts_parse_dir.cjs')}" "${REPO_ROOT}"`);

  run(
    '2/2 Backfill entity ranges',
    `python3 "${path.join(SKILL_DIR, 'backfill_ranges.py')}" "${DB_PATH}" "${REPO_ROOT}"`
  );

  console.log('\n✅ Reindex complete.');
}

main();
