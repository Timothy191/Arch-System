'use strict';

/**
 * Shared helpers for versioned `log-NNN-YY-MM-DD` output folders
 * (audit reports, codebase maps).
 */

const fs = require('node:fs');

const LOG_DIR_PATTERN = /^log-(\d+)/i;
const DECIMAL_RADIX = 10;
const YEAR_SUFFIX_LENGTH = -2;
const PAD_WIDTH = 2;

/** Date strings for versioned folder naming (YY-MM-DD) and ISO/UTC metadata. */
function getFormattedDate() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(YEAR_SUFFIX_LENGTH);
  const mm = String(now.getMonth() + 1).padStart(PAD_WIDTH, '0');
  const dd = String(now.getDate()).padStart(PAD_WIDTH, '0');
  return {
    folderDate: `${yy}-${mm}-${dd}`,
    isoDate: now.toISOString(),
    displayDate: `${now.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
  };
}

/**
 * Returns the next `log-N` number inside `rootDir`, creating the directory if missing.
 * @param {string} rootDir
 * @returns {number}
 */
function getNextLogNumber(rootDir) {
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
    return 1;
  }

  let maxLogNum = 0;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(LOG_DIR_PATTERN);
    if (!match) continue;
    maxLogNum = Math.max(maxLogNum, Number.parseInt(match[1], DECIMAL_RADIX));
  }
  return maxLogNum + 1;
}

module.exports = { getFormattedDate, getNextLogNumber };
