#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const WORKTREE_BASE = path.dirname(PROJ);

function getWorktreeDir(unitId) {
  const safeId = unitId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(WORKTREE_BASE, `Arch-Mk2-${safeId}`);
}

module.exports = {
  create(unitId) {
    const dir = getWorktreeDir(unitId);
    try {
      if (fs.existsSync(dir)) {
        return dir; // Already exists
      }
      execSync(`git worktree add "${dir}" HEAD`, {
        cwd: PROJ,
        stdio: 'pipe',
        timeout: 15000
      });
      return dir;
    } catch (err) {
      const msg = err.stderr?.toString() || err.message;
      // If worktree already exists, use it
      if (msg.includes('already exists')) {
        return dir;
      }
      console.error(`[worktree] Failed to create ${unitId}: ${msg}`);
      return null;
    }
  },

  injectConfig(unitId, instructions) {
    const dir = getWorktreeDir(unitId);
    if (!dir || !fs.existsSync(dir)) return false;

    try {
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), instructions);
      return true;
    } catch {
      return false;
    }
  },

  mergeChanges(unitId) {
    const dir = getWorktreeDir(unitId);
    if (!dir || !fs.existsSync(dir)) return { merged: false, error: 'Worktree not found' };

    try {
      execSync(`git diff --quiet HEAD`, { cwd: dir, stdio: 'pipe' });
      return { merged: true, changes: 0 }; // No changes
    } catch {
      // There are changes
      try {
        execSync(`git add -A && git commit -m "Worktree ${unitId}: auto-merge"`, {
          cwd: dir, stdio: 'pipe', timeout: 10000
        });
        execSync(`git checkout ${PROJ.replace(/^.*\//, '')}-master -- .`, {
          cwd: dir, stdio: 'pipe', timeout: 10000
        });
        return { merged: true, changes: 1 };
      } catch (err) {
        return { merged: false, error: err.stderr?.toString() || err.message };
      }
    }
  },

  remove(unitId) {
    const dir = getWorktreeDir(unitId);
    if (!dir || !fs.existsSync(dir)) return true;

    try {
      execSync(`git worktree remove "${dir}"`, {
        cwd: PROJ, stdio: 'pipe', timeout: 10000
      });
      return true;
    } catch (err) {
      const msg = err.stderr?.toString() || err.message;
      if (msg.includes('not found') || msg.includes('main worktree')) {
        return true; // Already gone
      }
      console.error(`[worktree] Failed to remove ${unitId}: ${msg}`);
      return false;
    }
  },

  list() {
    try {
      const output = execSync('git worktree list', {
        cwd: PROJ, encoding: 'utf8', timeout: 5000
      });
      return output.trim().split('\n').map(line => {
        const parts = line.split(/\s+/);
        return { path: parts[0], branch: parts[1] || '', commit: parts[2] || '' };
      });
    } catch {
      return [];
    }
  },

  prune() {
    try {
      execSync('git worktree prune', { cwd: PROJ, stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
};
