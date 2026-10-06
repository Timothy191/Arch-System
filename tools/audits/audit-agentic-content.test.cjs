'use strict';

const assert = require('node:assert/strict');
const { getActiveSkillDirectories } = require('./active-skill-directories.cjs');

function directory(name) {
  return { name, isDirectory: () => true };
}

function file(name) {
  return { name, isDirectory: () => false };
}

const archiveEntries = [directory('.archived'), directory('supabase')];
assert.deepEqual(getActiveSkillDirectories(archiveEntries), [archiveEntries[1]]);

const malformedSkillEntries = [directory('broken-skill')];
assert.deepEqual(getActiveSkillDirectories(malformedSkillEntries), malformedSkillEntries);

const mixedEntries = [file('README.md'), directory('supabase')];
assert.deepEqual(getActiveSkillDirectories(mixedEntries), [mixedEntries[1]]);

console.log('Active skill directory regression checks passed.');
