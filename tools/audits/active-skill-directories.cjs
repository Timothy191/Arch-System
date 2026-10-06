'use strict';

function getActiveSkillDirectories(entries) {
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
}

module.exports = { getActiveSkillDirectories };
