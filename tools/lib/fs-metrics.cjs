'use strict';

/**
 * Shared filesystem metrics helpers for build-time governance scripts
 * (token-tracker, context-debloat, agents-cleanup).
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Recursively sums file sizes (bytes) under `dirPath`.
 * @param {string} dirPath
 * @param {readonly string[]} [excludeDirs] directory basenames to skip
 * @returns {number}
 */
function getDirSize(dirPath, excludeDirs = []) {
  if (!fs.existsSync(dirPath)) return 0;

  let totalSize = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      totalSize += getDirSize(fullPath, excludeDirs);
      continue;
    }
    totalSize += fs.statSync(fullPath).size;
  }
  return totalSize;
}

module.exports = { getDirSize };
