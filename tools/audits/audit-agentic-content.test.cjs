'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { getActiveSkillDirectories } = require('./active-skill-directories.cjs');
const { validateSkillDirectory } = require('./validate-agent-skill.cjs');

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

const symlinkDir = path.resolve(__dirname, '../../.agents/skills');
const realFs = require('node:fs');
const activeSkills = getActiveSkillDirectories(
  realFs.readdirSync(symlinkDir, { withFileTypes: true }),
  symlinkDir
);
assert.ok(activeSkills.some((e) => e.name === 'audit-federation'));

for (const entry of activeSkills) {
  const { errors, warnings } = validateSkillDirectory(path.join(symlinkDir, entry.name));
  assert.deepEqual(errors, [], `Unexpected errors in skill ${entry.name}`);
  assert.deepEqual(warnings, [], `Unexpected warnings in skill ${entry.name}`);
}

console.log('Active skill directory regression checks passed.');
