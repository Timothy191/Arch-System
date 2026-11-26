'use strict';

const { execFileSync } = require('node:child_process');

const { toPosix } = require('./util.cjs');

function runGit(root, args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function splitLines(output) {
  return (output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.map(toPosix))].sort();
}

function stagedFiles(root) {
  return unique(
    splitLines(runGit(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']))
  );
}

function workingTreeFiles(root) {
  const output = runGit(root, ['status', '--porcelain', '--untracked-files=all']);
  const files = splitLines(output).map((line) => {
    const raw = line.slice(3);
    const renamed = raw.includes(' -> ') ? raw.split(' -> ').pop() : raw;
    return renamed.replace(/^"|"$/g, '');
  });
  return unique(files);
}

function branchDiffFiles(root) {
  const ranges = [['origin/main...HEAD'], ['main...HEAD'], ['HEAD~1...HEAD']];
  for (const args of ranges) {
    const output = runGit(root, ['diff', '--name-only', ...args]);
    if (output !== null) return unique(splitLines(output));
  }
  return [];
}

function changedFiles(root, mode) {
  if (mode === 'staged') return stagedFiles(root);
  if (mode === 'ci') return branchDiffFiles(root);
  return workingTreeFiles(root);
}

function currentBranch(root) {
  return (runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD').trim();
}

module.exports = { branchDiffFiles, changedFiles, currentBranch, stagedFiles, workingTreeFiles };
