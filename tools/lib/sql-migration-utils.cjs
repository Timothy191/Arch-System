'use strict';

/**
 * Shared SQL migration helpers for RLS / query-plan audits.
 */

const fs = require('node:fs');

const EXIT_MISSING_MIGRATIONS = 2;

/** Strips SQL block and line comments to avoid regex false positives (approximate). */
function stripSqlComments(sql) {
  const withoutBlocks = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks.replace(/(^|\s)--[^\n]*/g, '$1');
}

/**
 * Lists `.sql` migration filenames in apply order (zero-padded NNN_ prefix sorts correctly).
 * Exits the process with code 2 when the directory is missing (fail-closed for audits).
 * @param {string} migrationsDir
 * @returns {string[]}
 */
function listMigrationFiles(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migration directory not found: ${migrationsDir}`);
    process.exit(EXIT_MISSING_MIGRATIONS);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
}

module.exports = { listMigrationFiles, stripSqlComments };
