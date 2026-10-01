// @ts-check
import { describe, it, afterEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

import {
  inspectLocalGit,
  parsePorcelainStatus,
  parseRenamedPath,
  getUpstreamStatus,
  isGitRepository,
  parseGitHubRemoteUrl,
  discoverGitHubContext,
  inspectGitHubRemote,
} from '../../src/git-inspector.mjs';

import {
  WatchdogError,
  GitError,
  BranchNotFoundError,
  GitHubApiError,
  RateLimitError,
} from '../../src/errors.mjs';

import { createMockGitRepo } from '../fixtures/mock-git.mjs';
import { createMockGitHubServer } from '../fixtures/mock-github.mjs';

describe('Empirical Adversarial Stress Test Harness - Milestone 1', () => {
  /** @type {ReturnType<typeof createMockGitRepo>|null} */
  let sandbox = null;

  afterEach(() => {
    if (sandbox) {
      sandbox.cleanup();
      sandbox = null;
    }
  });

  // =========================================================================
  // SECTION 1: WEIRD FILENAMES (Spaces, Quotes, Unicode, Non-ASCII, Newlines)
  // =========================================================================
  describe('Adversarial 1: Filenames & Path Escaping', () => {
    it('handles files with multiple spaces, tabs, and nested folders with spaces', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const spaceFile = 'nested folder/deep space/telemetry log  2026.txt';
      sandbox.commitFile(spaceFile, 'pit extraction telemetry 1');
      sandbox.modifyUnstaged(spaceFile, 'pit extraction telemetry 2 (modified unstaged)');

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.equal(state.uncommittedFiles.length, 1);
      assert.equal(state.uncommittedFiles[0], spaceFile);
    });

    it('handles files with single quotes, double quotes, and backticks', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const singleQuoteFile = "it's_a_sensor_reading.csv";
      const backtickFile = 'sensor`rate`reading.csv';

      sandbox.createDirtyFile(singleQuoteFile, 'temp,pressure\n30,100\n', false);
      sandbox.createDirtyFile(backtickFile, 'rate=500\n', false);

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.ok(state.uncommittedFiles.includes(singleQuoteFile), `Missing ${singleQuoteFile}`);
      assert.ok(state.uncommittedFiles.includes(backtickFile), `Missing ${backtickFile}`);
    });

    it('handles non-ASCII and Unicode filenames (Cyrillic, CJK, German umlauts, Emojis)', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const umlautFile = 'pit_dumper_über_schicht.txt';
      const cjkFile = '採掘計画_2026_Brakfontein.log';
      const cyrillicFile = 'файл_экскаватор_отчет.txt';
      const emojiFile = 'telemetry_🚜_drill_depth_💥.json';

      sandbox.createDirtyFile(umlautFile, 'umlaut content', true); // staged
      sandbox.createDirtyFile(cjkFile, 'cjk content', false); // untracked
      sandbox.createDirtyFile(cyrillicFile, 'cyrillic content', true); // staged
      sandbox.createDirtyFile(emojiFile, 'emoji content', false); // untracked

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.equal(state.uncommittedFiles.length, 4);
    });

    it('handles filenames with literal newlines without corrupting line-splitting', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const newlineFile = 'file\nwith\nnewline.txt';
      sandbox.createDirtyFile(newlineFile, 'newline file content', false);

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.equal(state.uncommittedFiles.length, 1);
      // Git porcelain quotes newlines as C-escaped \n inside quotes
      assert.ok(
        state.uncommittedFiles[0].includes('newline'),
        `Expected newline in filename: ${state.uncommittedFiles[0]}`
      );
    });

    it('handles raw porcelain lines with leading/trailing spaces and rename arrows', () => {
      const raw =
        [
          '?? " file_with_leading_space.txt"',
          '?? "file_with_trailing_space.txt "',
          ' M "quoted_modified_file.txt"',
          'R  "old pit/plan A.doc" -> "new pit/plan B.doc"',
          'A  "nested/special \\"quotes\\"/file.txt"',
        ].join('\n') + '\n';

      const parsed = parsePorcelainStatus(raw);
      assert.equal(parsed.isClean, false);
      assert.equal(parsed.uncommittedFiles.length, 5);
      assert.ok(parsed.uncommittedFiles.includes(' file_with_leading_space.txt'));
      assert.ok(parsed.uncommittedFiles.includes('file_with_trailing_space.txt '));
      assert.ok(parsed.uncommittedFiles.includes('quoted_modified_file.txt'));
      assert.ok(parsed.uncommittedFiles.includes('new pit/plan B.doc'));
    });

    it('identifies empirical limitation/hazard: literal " -> " in untracked/modified filenames', () => {
      // Adversarial test documenting parseRenamedPath behavior when filename itself contains ' -> '
      const raw = '?? step1 -> step2.txt\n';
      const parsed = parsePorcelainStatus(raw);
      // parseRenamedPath currently splits ANY path containing ' -> ', even on '??' lines
      // It returns filePath: 'step2.txt' and origPath: 'step1' instead of preserving full name
      assert.equal(parsed.isClean, false);
      assert.equal(parsed.uncommittedFiles.length, 1);
      assert.equal(parsed.entries[0].origPath, 'step1');
      assert.equal(parsed.entries[0].filePath, 'step2.txt');
    });
  });

  // =========================================================================
  // SECTION 2: COMPLEX PORCELAIN STATUS COMBINATIONS
  // =========================================================================
  describe('Adversarial 2: Porcelain Status Permutations & Parsing', () => {
    it('accurately parses every standard two-letter git porcelain status code', () => {
      const raw =
        [
          '?? untracked.txt',
          'A  staged_new.txt',
          'AM staged_new_modified_unstaged.txt',
          'AD staged_new_deleted_unstaged.txt',
          ' M unstaged_modification.txt',
          'M  staged_modification.txt',
          'MM staged_and_unstaged_modification.txt',
          'MD staged_modification_deleted_unstaged.txt',
          ' D unstaged_deletion.txt',
          'D  staged_deletion.txt',
          'R  old.txt -> new.txt',
          'RM old2.txt -> new2.txt',
          'RD old3.txt -> new3.txt',
          'C  source.txt -> copy.txt',
          'CM source2.txt -> copy2.txt',
          // Merge conflicts
          'UU conflict_both_modified.txt',
          'AA conflict_both_added.txt',
          'DD conflict_both_deleted.txt',
          'AU conflict_added_by_us.txt',
          'UD conflict_updated_by_us_deleted_by_them.txt',
          'UA conflict_deleted_by_us_updated_by_them.txt',
          'DU conflict_deleted_by_us_updated_by_them_2.txt',
        ].join('\n') + '\n';

      const parsed = parsePorcelainStatus(raw);
      assert.equal(parsed.isClean, false);
      assert.equal(parsed.uncommittedFiles.length, 22);

      // Verify conflict detection
      const conflicts = parsed.entries.filter((e) => e.isConflicted);
      assert.equal(conflicts.length, 7);
      for (const c of conflicts) {
        assert.equal(c.isConflicted, true);
        assert.ok(parsed.uncommittedFiles.includes(c.filePath));
      }

      // Verify staged and unstaged flags
      const stagedOnly = parsed.entries.find((e) => e.filePath === 'staged_new.txt');
      assert.ok(stagedOnly);
      assert.equal(stagedOnly.isStaged, true);
      assert.equal(stagedOnly.isUnstaged, false);
      assert.equal(stagedOnly.isUntracked, false);

      const unstagedOnly = parsed.entries.find((e) => e.filePath === 'unstaged_modification.txt');
      assert.ok(unstagedOnly);
      assert.equal(unstagedOnly.isStaged, false);
      assert.equal(unstagedOnly.isUnstaged, true);

      const both = parsed.entries.find(
        (e) => e.filePath === 'staged_and_unstaged_modification.txt'
      );
      assert.ok(both);
      assert.equal(both.isStaged, true);
      assert.equal(both.isUnstaged, true);

      // Verify renames
      const rename = parsed.entries.find((e) => e.filePath === 'new.txt');
      assert.ok(rename);
      assert.equal(rename.origPath, 'old.txt');
    });

    it('empirically creates and detects a merge conflict in a live git sandbox', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.commitFile('shared.txt', 'line 1\nline 2\n');

      // Create branch feature-conflict
      sandbox.checkoutBranch('feature-conflict');
      sandbox.commitFile('shared.txt', 'line 1\nfeature change\n');

      // Checkout main without resetting and make conflicting commit
      sandbox.exec('checkout main');
      sandbox.commitFile('shared.txt', 'line 1\nmain change\n');

      // Attempt merge - expect conflict
      try {
        sandbox.exec('merge feature-conflict');
      } catch {
        // Merge conflict throws exit code 1 as expected
      }

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.ok(state.uncommittedFiles.includes('shared.txt'));

      // Check parsePorcelainStatus directly on sandbox
      const rawStatus = sandbox.getPorcelainStatus();
      const parsed = parsePorcelainStatus(rawStatus);
      const conflictEntry = parsed.entries.find((e) => e.filePath === 'shared.txt');
      assert.ok(conflictEntry, 'Conflict entry must exist');
      assert.equal(conflictEntry.isConflicted, true);
      assert.equal(conflictEntry.statusCode, 'UU');
    });

    it('empirically detects staged renames with spaces and subsequent modifications', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.commitFile('initial name with spaces.txt', 'alpha bravo charlie');

      // Rename via git mv
      sandbox.exec('mv "initial name with spaces.txt" "renamed destination with spaces.txt"');
      // Modify unstaged on destination
      sandbox.modifyUnstaged('renamed destination with spaces.txt', 'alpha bravo charlie modified');

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.ok(state.uncommittedFiles.includes('renamed destination with spaces.txt'));

      const raw = sandbox.getPorcelainStatus();
      const parsed = parsePorcelainStatus(raw);
      const entry = parsed.entries.find(
        (e) => e.filePath === 'renamed destination with spaces.txt'
      );
      assert.ok(entry);
      assert.equal(entry.origPath, 'initial name with spaces.txt');
      assert.equal(entry.statusCode, 'RM');
    });

    it('empirically respects .gitignore and only triggers dirty on unignored or force-staged files', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.commitFile('.gitignore', '*.log\nbuild/\n');
      sandbox.createDirtyFile('trace.log', 'ignored trace data', false);
      sandbox.createDirtyFile('build/bundle.js', 'ignored build output', false);

      // Clean check with ignored files present
      let state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, true);
      assert.deepEqual(state.uncommittedFiles, []);

      // Force stage an ignored file
      sandbox.exec('add -f trace.log');
      state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.ok(state.uncommittedFiles.includes('trace.log'));
    });

    it('handles large file count (200 modified files) without buffer exhaustion', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      for (let i = 0; i < 200; i++) {
        sandbox.commitFile(`bulk/file_${i}.txt`, `initial ${i}`);
      }
      for (let i = 0; i < 200; i++) {
        sandbox.modifyUnstaged(`bulk/file_${i}.txt`, `modified ${i}`);
      }

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isClean, false);
      assert.equal(state.uncommittedFiles.length, 200);
    });

    it('handles SHA-256 modern git repositories with 64-character commit hashes', async () => {
      const sha256Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-sha256-'));
      try {
        execSync('git init --object-format=sha256', { cwd: sha256Dir, stdio: 'pipe' });
        execSync(
          'git config user.name "SHA256 Tester" && git config user.email "sha256@example.com"',
          { cwd: sha256Dir }
        );
        fs.writeFileSync(path.join(sha256Dir, 'test.txt'), 'sha256 payload');
        execSync('git add test.txt && git commit -m "sha256 commit"', {
          cwd: sha256Dir,
          stdio: 'pipe',
        });

        const state = await inspectLocalGit(sha256Dir);
        assert.equal(state.commit.length, 64);
        assert.match(state.commit, /^[0-9a-f]{64}$/i);
        assert.equal(state.isClean, true);
      } finally {
        fs.rmSync(sha256Dir, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // SECTION 3: DETACHED HEAD, UNBORN BRANCHES, AND NON-GIT DIRECTORIES
  // =========================================================================
  describe('Adversarial 3: Detached HEAD, Unborn, and Non-Git Edge Cases', () => {
    it('handles detached HEAD state after commit, checkout commit SHA, and subsequent changes', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const sha1 = sandbox.commitFile('file1.txt', 'version 1');
      const sha2 = sandbox.commitFile('file2.txt', 'version 2');

      // Checkout sha1 directly (detached HEAD)
      sandbox.exec(`checkout ${sha1}`);

      const state = await inspectLocalGit(sandbox.dir);
      assert.equal(state.isDetached, true);
      assert.equal(state.branch, 'HEAD');
      assert.equal(state.commit, sha1);
      assert.equal(state.isClean, true);

      // Add dirty untracked file while in detached HEAD
      sandbox.createDirtyFile('detached_experiment.txt', 'scratchpad');
      const dirtyState = await inspectLocalGit(sandbox.dir);
      assert.equal(dirtyState.isDetached, true);
      assert.equal(dirtyState.isClean, false);
      assert.ok(dirtyState.uncommittedFiles.includes('detached_experiment.txt'));
    });

    it('handles unborn branch (0 commits) with staged and untracked files with allowUnborn', async () => {
      sandbox = createMockGitRepo({ branch: 'trunk', initialCommit: false });

      // Default: throws ERR_EMPTY_GIT_REPO
      await assert.rejects(
        () => inspectLocalGit(sandbox.dir),
        (err) => {
          assert.ok(err instanceof GitError);
          assert.equal(err.code, 'ERR_EMPTY_GIT_REPO');
          return true;
        }
      );

      // With allowUnborn: true on empty repo
      const emptyState = await inspectLocalGit(sandbox.dir, { allowUnborn: true });
      assert.equal(emptyState.isUnborn, true);
      assert.equal(emptyState.commit, '');
      assert.equal(emptyState.branch, 'trunk');
      assert.equal(emptyState.isClean, true);

      // Now add staged file in unborn repo
      sandbox.createDirtyFile('first_file.txt', 'first content', true);
      const stagedState = await inspectLocalGit(sandbox.dir, { allowUnborn: true });
      assert.equal(stagedState.isUnborn, true);
      assert.equal(stagedState.commit, '');
      assert.equal(stagedState.isClean, false);
      assert.ok(stagedState.uncommittedFiles.includes('first_file.txt'));
    });

    it('handles non-git directory, corrupt .git directory, bare repo, and non-existent paths', async () => {
      // 1. Directory does not exist
      const nonExistent = path.join(os.tmpdir(), `zdw-fake-${Date.now()}`);
      await assert.rejects(
        () => inspectLocalGit(nonExistent),
        (err) => {
          assert.ok(err instanceof GitError);
          assert.equal(err.code, 'ERR_DIR_NOT_FOUND');
          return true;
        }
      );
      assert.equal(await isGitRepository(nonExistent), false);

      // 2. Normal directory without git
      const normalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-plain-dir-'));
      try {
        await assert.rejects(
          () => inspectLocalGit(normalDir),
          (err) => {
            assert.ok(err instanceof GitError);
            assert.equal(err.code, 'ERR_NOT_A_GIT_REPO');
            assert.equal(err.exitCode, 2);
            return true;
          }
        );
        assert.equal(await isGitRepository(normalDir), false);

        // 3. Corrupt .git (file pointer or invalid dir)
        const fakeGitFile = path.join(normalDir, '.git');
        fs.writeFileSync(fakeGitFile, 'corrupt git pointer');
        await assert.rejects(
          () => inspectLocalGit(normalDir),
          (err) => {
            assert.ok(err instanceof GitError);
            assert.equal(err.code, 'ERR_NOT_A_GIT_REPO');
            return true;
          }
        );
        assert.equal(await isGitRepository(normalDir), false);
      } finally {
        fs.rmSync(normalDir, { recursive: true, force: true });
      }

      // 4. Bare repository (lacks working tree)
      const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-bare-check-'));
      try {
        execSync('git init --bare', { cwd: bareDir, stdio: 'pipe' });
        await assert.rejects(
          () => inspectLocalGit(bareDir),
          (err) => {
            assert.ok(err instanceof GitError);
            assert.equal(err.code, 'ERR_NOT_A_GIT_REPO');
            return true;
          }
        );
        assert.equal(await isGitRepository(bareDir), false);
      } finally {
        fs.rmSync(bareDir, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // SECTION 4: UPSTREAM TRACKING PERMUTATIONS
  // =========================================================================
  describe('Adversarial 4: Upstream Tracking Permutations', () => {
    it('case 1: unconfigured upstream tracking returns no_upstream safely', async () => {
      sandbox = createMockGitRepo({ branch: 'feature-isolated', initialCommit: true });
      const status = await getUpstreamStatus(sandbox.dir);

      assert.equal(status.hasUpstream, false);
      assert.equal(status.upstreamBranch, null);
      assert.equal(status.ahead, 0);
      assert.equal(status.behind, 0);
      assert.equal(status.status, 'no_upstream');
    });

    it('case 2: upstream tracking in sync returns identical', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.setupBareOrigin({ owner: 'plantcor', repo: 'arch-system' });

      const status = await getUpstreamStatus(sandbox.dir);
      assert.equal(status.hasUpstream, true);
      assert.equal(status.upstreamBranch, 'origin/main');
      assert.equal(status.ahead, 0);
      assert.equal(status.behind, 0);
      assert.equal(status.status, 'identical');
    });

    it('case 3: local ahead of upstream by 3 commits returns ahead', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.setupBareOrigin({ owner: 'plantcor', repo: 'arch-system' });

      sandbox.commitFile('c1.txt', '1');
      sandbox.commitFile('c2.txt', '2');
      sandbox.commitFile('c3.txt', '3');

      const status = await getUpstreamStatus(sandbox.dir);
      assert.equal(status.hasUpstream, true);
      assert.equal(status.ahead, 3);
      assert.equal(status.behind, 0);
      assert.equal(status.status, 'ahead');
    });

    it('case 4: local behind upstream by 2 commits returns behind', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const { bareDir } = sandbox.setupBareOrigin({ owner: 'plantcor', repo: 'arch-system' });

      // Create a second clone to push 2 commits to bare origin on main branch
      const peerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-peer-'));
      try {
        execSync(`git clone "${bareDir}" "${peerDir}"`, { stdio: 'pipe' });
        execSync('git config user.name "Peer Tester" && git config user.email "peer@example.com"', {
          cwd: peerDir,
        });
        execSync('git checkout main', { cwd: peerDir, stdio: 'pipe' });

        fs.writeFileSync(path.join(peerDir, 'remote1.txt'), 'remote 1');
        execSync('git add . && git commit -m "remote commit 1" && git push origin main', {
          cwd: peerDir,
          stdio: 'pipe',
        });
        fs.writeFileSync(path.join(peerDir, 'remote2.txt'), 'remote 2');
        execSync('git add . && git commit -m "remote commit 2" && git push origin main', {
          cwd: peerDir,
          stdio: 'pipe',
        });

        // In primary sandbox, fetch from origin without merging
        sandbox.exec('fetch origin');

        const status = await getUpstreamStatus(sandbox.dir);
        assert.equal(status.hasUpstream, true);
        assert.equal(status.ahead, 0);
        assert.equal(status.behind, 2);
        assert.equal(status.status, 'behind');
      } finally {
        fs.rmSync(peerDir, { recursive: true, force: true });
      }
    });

    it('case 5: local and upstream diverged (ahead 2, behind 1) returns diverged', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const { bareDir } = sandbox.setupBareOrigin({ owner: 'plantcor', repo: 'arch-system' });

      // Peer clone pushes 1 commit to main
      const peerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-peer2-'));
      try {
        execSync(`git clone "${bareDir}" "${peerDir}"`, { stdio: 'pipe' });
        execSync('git config user.name "Peer Tester" && git config user.email "peer@example.com"', {
          cwd: peerDir,
        });
        execSync('git checkout main', { cwd: peerDir, stdio: 'pipe' });
        fs.writeFileSync(path.join(peerDir, 'peer.txt'), 'peer commit');
        execSync('git add . && git commit -m "peer commit" && git push origin main', {
          cwd: peerDir,
          stdio: 'pipe',
        });

        // Primary sandbox makes 2 local commits without fetching
        sandbox.commitFile('local1.txt', 'local 1');
        sandbox.commitFile('local2.txt', 'local 2');

        // Fetch origin in primary sandbox so @{u} is updated
        sandbox.exec('fetch origin');

        const status = await getUpstreamStatus(sandbox.dir);
        assert.equal(status.hasUpstream, true);
        assert.equal(status.ahead, 2);
        assert.equal(status.behind, 1);
        assert.equal(status.status, 'diverged');
      } finally {
        fs.rmSync(peerDir, { recursive: true, force: true });
      }
    });

    it('case 6: detached HEAD upstream status handles non-branch gracefully', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      sandbox.setupBareOrigin({ owner: 'plantcor', repo: 'arch-system' });
      sandbox.detachHead();

      const status = await getUpstreamStatus(sandbox.dir);
      assert.equal(status.hasUpstream, false);
      assert.equal(status.upstreamBranch, null);
      assert.equal(status.status, 'no_upstream');
    });
  });

  // =========================================================================
  // SECTION 5: GITHUB DISCOVERY & REMOTE STATE COMPUTATION
  // =========================================================================
  describe('Adversarial 5: GitHub Remote Inspector & Unpushed Drift Fallback', () => {
    /** @type {ReturnType<typeof createMockGitHubServer>} */
    let ghServer;
    const testOwner = 'plantcor';
    const testRepo = 'arch-system';
    const testBranch = 'main';

    before(async () => {
      ghServer = createMockGitHubServer({ token: 'test-token', requireAuth: true });
      await ghServer.start();
    });

    after(async () => {
      await ghServer.close();
    });

    it('computes statusWithLocal when localCommit is identical to remote', async () => {
      const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      ghServer.setBranch(testOwner, testRepo, testBranch, sha);

      const remoteState = await inspectGitHubRemote(
        { owner: testOwner, repo: testRepo, branch: testBranch },
        'test-token',
        { apiUrl: ghServer.url, localCommit: sha }
      );

      assert.equal(remoteState.commit, sha);
      assert.equal(remoteState.statusWithLocal, 'identical');
      assert.equal(remoteState.aheadBy, 0);
      assert.equal(remoteState.behindBy, 0);
    });

    it('computes drift via local rev-list fallback when localCommit is not on remote (unpushed)', async () => {
      sandbox = createMockGitRepo({ branch: 'main', initialCommit: true });
      const initialSha = sandbox.getHeadCommit();

      // Remote branch points to initialSha
      ghServer.setBranch(testOwner, testRepo, testBranch, initialSha);

      // Local makes 3 new commits (unpushed)
      sandbox.commitFile('fileA.txt', 'A');
      sandbox.commitFile('fileB.txt', 'B');
      const latestLocalSha = sandbox.commitFile('fileC.txt', 'C');

      // GitHub compare API for base=initialSha...head=latestLocalSha returns 404 because latestLocalSha is not on GitHub
      ghServer.setError(
        `/repos/${testOwner}/${testRepo}/compare/${initialSha}...${latestLocalSha}`,
        404,
        {
          message: 'Not Found',
        }
      );

      // inspectGitHubRemote falls back to local git rev-list
      const remoteState = await inspectGitHubRemote(
        { owner: testOwner, repo: testRepo, branch: testBranch },
        'test-token',
        { apiUrl: ghServer.url, localCommit: latestLocalSha, cwd: sandbox.dir }
      );

      assert.equal(remoteState.commit, initialSha);
      assert.equal(remoteState.statusWithLocal, 'ahead');
      assert.equal(remoteState.aheadBy, 3);
      assert.equal(remoteState.behindBy, 0);
    });

    it('discovers GitHub repository context from diverse URL formats and env variables', async () => {
      assert.deepEqual(parseGitHubRemoteUrl('https://github.com/plantcor/arch-system.git'), {
        owner: 'plantcor',
        repo: 'arch-system',
      });
      assert.deepEqual(parseGitHubRemoteUrl('git@github.com:plantcor/arch-system.git'), {
        owner: 'plantcor',
        repo: 'arch-system',
      });
      assert.deepEqual(parseGitHubRemoteUrl('ssh://git@github.com:22/plantcor/arch-system.git'), {
        owner: 'plantcor',
        repo: 'arch-system',
      });
      assert.deepEqual(
        parseGitHubRemoteUrl(
          'https://x-access-token:ghs_secret@github.com/plantcor/arch-system.git'
        ),
        { owner: 'plantcor', repo: 'arch-system' }
      );
      assert.deepEqual(parseGitHubRemoteUrl('https://github.com/my-org/telemetry.core.v2'), {
        owner: 'my-org',
        repo: 'telemetry.core.v2',
      });
    });
  });
});
