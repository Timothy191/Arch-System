'use strict';

const fs = require('node:fs');
const path = require('node:path');

function getActiveSkillDirectories(entries, baseDir) {
  return entries.filter((entry) => {
    if (entry.name.startsWith('.')) return false;
    if (entry.isDirectory()) return true;
    if (typeof entry.isSymbolicLink === 'function' && entry.isSymbolicLink() && baseDir) {
      try {
        return fs.statSync(path.join(baseDir, entry.name)).isDirectory();
      } catch {
        return false;
      }
    }
    return false;
  });
}

module.exports = { getActiveSkillDirectories };
