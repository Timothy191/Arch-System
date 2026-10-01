// @ts-check
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  inspectLocalGit,
  parsePorcelainStatus,
  getUpstreamStatus,
  isGitRepository,
} from '../../src/git-inspector.mjs';

import { GitError } from '../../src/errors.mjs';
import { createMockGitRepo } from '../fixtures/mock-git.mjs';

describe('Unit: Local Git State Inspector', () => {
  /** @type {ReturnType<typeof createMockGitRepo>|null} */
  let sandbox = null;

  afterEach(() => {
    if (sandbox) {
      sandbox.cleanup();
      sandbox = null;
    }
  });

  describe('inspectLocalGit', () => {
    it('returns valid 40-character commit SHA, branch, and clean status for clean repo', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const state = await inspectLocalGit(sandbox.dir);

      assert.equal(typeof state.commit, 'string');
      assert.match(state.commit, /^[0-9a-f]{40}$/i);
      assert.equal(state.branch, 'main');
      assert.equal(state.isClean, true);
      assert.deepEqual(state.uncommittedFiles, []);
      assert.equal(state.isDetached, false);
      assert.equal(state.isUnborn, false);
    });

    it('detects uncommitted changes safely preserving leading whitespace on " M" lines', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      // Unstaged modification on README.md (' M README.md')
      sandbox.modifyUnstaged('README.md', '# Modified Unstaged Content\n');
      // Untracked file ('?? untracked.txt')
      sandbox.createDirtyFile('untracked.txt', 'untracked content\n');

      const state = await inspectLocalGit(sandbox.dir);

      assert.equal(state.isClean, false);
      assert.equal(state.uncommittedFiles.length, 2);
      // Verify leading space was not stripped causing "EADME.md"
      assert.ok(
        state.uncommittedFiles.includes('README.md'),
        `Expected README.md in uncommittedFiles: ${JSON.stringify(state.uncommittedFiles)}`
      );
      assert.ok(
        state.uncommittedFiles.includes('untracked.txt'),
        `Expected untracked.txt in uncommittedFiles: ${JSON.stringify(state.uncommittedFiles)}`
      );
    });

    it('detects detached HEAD state accurately', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const commitSha = sandbox.commitFile('notes.txt', 'second commit');
      sandbox.detachHead();

      const state = await inspectLocalGit(sandbox.dir);

      assert.equal(state.isDetached, true);
      assert.equal(state.branch, 'HEAD');
      assert.equal(state.commit, commitSha);
    });

    it('throws GitError on unborn repository with 0 commits by default', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: false });

      await assert.rejects(
        async () => inspectLocalGit(sandbox.dir),
        (err) => {
          assert.ok(err instanceof GitError);
          assert.equal(err.code, 'ERR_EMPTY_GIT_REPO');
          assert.match(err.message, /no commits|unborn/i);
          assert.equal(err.gitExitCode, 128);
          return true;
        }
      );
    });

    it('returns isUnborn: true when allowUnborn: true option is provided', async () => {
      sandbox = createMockGitRepo({ branch: 'feature-unborn', initialCommit: false });
      const state = await inspectLocalGit(sandbox.dir, { allowUnborn: true });

      assert.equal(state.commit, '');
      assert.equal(state.isUnborn, true);
      assert.equal(state.branch, 'feature-unborn');
      assert.equal(state.isClean, true);
      assert.deepEqual(state.uncommittedFiles, []);
    });

    it('throws GitError (ERR_NOT_A_GIT_REPO) when run in non-git directory', async () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-nongit-'));
      try {
        await assert.rejects(
          async () => inspectLocalGit(nonGitDir),
          (err) => {
            assert.ok(err instanceof GitError);
            assert.equal(err.code, 'ERR_NOT_A_GIT_REPO');
            assert.equal(err.exitCode, 2);
            return true;
          }
        );
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    it('throws GitError (ERR_DIR_NOT_FOUND) when directory does not exist', async () => {
      const nonExistentDir = path.join(os.tmpdir(), 'zdw-does-not-exist-' + Date.now());
      await assert.rejects(
        async () => inspectLocalGit(nonExistentDir),
        (err) => {
          assert.ok(err instanceof GitError);
          assert.equal(err.code, 'ERR_DIR_NOT_FOUND');
          return true;
        }
      );
    });
  });

  describe('parsePorcelainStatus', () => {
    it('correctly handles all standard porcelain statuses and whitespaces', () => {
      const raw =
        [
          ' M file_unstaged.txt',
          'M  file_staged.txt',
          'MM file_staged_and_modified.txt',
          'A  new_staged.txt',
          'AM new_staged_and_modified.txt',
          ' D file_unstaged_del.txt',
          'D  file_staged_del.txt',
          'R  "old path/file.txt" -> "new path/file.txt"',
          '?? untracked_file.txt',
          'UU conflict.txt',
        ].join('\n') + '\n';

      const result = parsePorcelainStatus(raw);

      assert.equal(result.isClean, false);
      assert.equal(result.uncommittedFiles.length, 10);
      assert.ok(result.uncommittedFiles.includes('file_unstaged.txt'));
      assert.ok(result.uncommittedFiles.includes('file_staged.txt'));
      assert.ok(result.uncommittedFiles.includes('new path/file.txt'));
      assert.ok(result.uncommittedFiles.includes('untracked_file.txt'));
      assert.ok(result.uncommittedFiles.includes('conflict.txt'));

      const conflictEntry = result.entries.find((e) => e.filePath === 'conflict.txt');
      assert.ok(conflictEntry);
      assert.equal(conflictEntry.isConflicted, true);

      const renameEntry = result.entries.find((e) => e.filePath === 'new path/file.txt');
      assert.ok(renameEntry);
      assert.equal(renameEntry.origPath, 'old path/file.txt');
    });

    it('returns isClean: true for empty or whitespace-only input', () => {
      const resEmpty = parsePorcelainStatus('');
      assert.equal(resEmpty.isClean, true);
      assert.deepEqual(resEmpty.uncommittedFiles, []);
      assert.deepEqual(resEmpty.entries, []);

      const resWhitespace = parsePorcelainStatus('   \n\n');
      assert.equal(resWhitespace.isClean, true);
    });
  });

  describe('getUpstreamStatus', () => {
    it('returns hasUpstream: false and no_upstream when no upstream tracking branch is set', async () => {
      sandbox = createMockGitRepo({ branch: 'feature-solo', initialCommit: true });
      const status = await getUpstreamStatus(sandbox.dir);

      assert.equal(status.hasUpstream, false);
      assert.equal(status.upstreamBranch, null);
      assert.equal(status.ahead, 0);
      assert.equal(status.behind, 0);
      assert.equal(status.status, 'no_upstream');
    });

    it('correctly reports identical and ahead status when bare upstream origin exists', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.setupBareOrigin({ owner: 'acme', repo: 'watchdog' });

      // Initially in sync with bare origin
      const inSync = await getUpstreamStatus(sandbox.dir);
      assert.equal(inSync.hasUpstream, true);
      assert.equal(inSync.upstreamBranch, 'origin/main');
      assert.equal(inSync.ahead, 0);
      assert.equal(inSync.behind, 0);
      assert.equal(inSync.status, 'identical');

      // Make 2 local commits without pushing
      sandbox.commitFile('change1.txt', 'data 1');
      sandbox.commitFile('change2.txt', 'data 2');

      const aheadStatus = await getUpstreamStatus(sandbox.dir);
      assert.equal(aheadStatus.hasUpstream, true);
      assert.equal(aheadStatus.ahead, 2);
      assert.equal(aheadStatus.behind, 0);
      assert.equal(aheadStatus.status, 'ahead');
    });
  });

  describe('isGitRepository', () => {
    it('returns true for valid git repo and false otherwise', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      assert.equal(await isGitRepository(sandbox.dir), true);

      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-check-'));
      try {
        assert.equal(await isGitRepository(nonGitDir), false);
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }

      assert.equal(await isGitRepository('/non/existent/path'), false);
    });
  });
});
