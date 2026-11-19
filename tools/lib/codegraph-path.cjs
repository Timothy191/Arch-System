'use strict';

/**
 * @file tools/lib/codegraph-path.cjs
 * @description Portable path resolution for the CodeGraph SQLite index and
 * external code-intelligence scripts across standalone and nested checkouts.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Resolves the CodeGraph SQLite index path in priority order:
 *   1. Explicit `CODEGRAPH_DB` environment override
 *   2. User home directory (`~/local.db`) when present
 *   3. Gitignored repo-local fallback (`<repoRoot>/.ci-local/local.db`)
 *
 * @param {string} repoRoot
 * @returns {string}
 */
function resolveCodeGraphDbPath(repoRoot) {
  if (process.env.CODEGRAPH_DB) {
    return process.env.CODEGRAPH_DB;
  }
  const homeDb = path.join(os.homedir(), 'local.db');
  if (fs.existsSync(homeDb)) {
    return homeDb;
  }
  return path.join(repoRoot, '.ci-local', 'local.db');
}

/**
 * Resolves the code-intelligence parser/backfill scripts directory across
 * user-home (`~/.agents`), repo-local (`.agents`), or parent federated layouts.
 *
 * @param {string} repoRoot
 * @returns {string}
 */
function resolveCodeIntelSkillDir(repoRoot) {
  const candidates = [
    path.join(os.homedir(), '.agents', 'skills', 'code-intelligence', 'scripts'),
    path.join(repoRoot, '.agents', 'skills', 'code-intelligence', 'scripts'),
    path.join(repoRoot, '..', '.agents', 'skills', 'code-intelligence', 'scripts'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

module.exports = {
  resolveCodeGraphDbPath,
  resolveCodeIntelSkillDir,
};
