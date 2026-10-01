// @ts-check
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Creates an isolated, temporary local Git repository sandbox.
 * Allows simulating clean states, dirty working trees, detached HEADs,
 * commit histories, and bare upstream remotes for offline git push verification.
 *
 * @param {object} [options]
 * @param {string} [options.branch='main']
 * @param {boolean} [options.initialCommit=true]
 * @param {string} [options.remoteUrl]
 * @param {string} [options.prefix='zdw-repo-']
 */
export function createMockGitRepo(options = {}) {
  const targetBranch = options.branch ?? 'main';
  const prefix = options.prefix ?? 'zdw-repo-';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  let bareOriginDir = /** @type {string|null} */ (null);

  /**
   * Run git command inside sandbox
   * @param {string} cmd
   * @returns {string}
   */
  function runGit(cmd) {
    return execSync(`git ${cmd}`, {
      cwd: tmpDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Watchdog Tester',
        GIT_AUTHOR_EMAIL: 'watchdog@example.com',
        GIT_COMMITTER_NAME: 'Watchdog Tester',
        GIT_COMMITTER_EMAIL: 'watchdog@example.com',
      },
    }).trim();
  }

  // 1. Initialize git repo
  try {
    runGit('init');
    runGit(`checkout -B ${targetBranch}`);
    runGit('config user.name "Watchdog Tester"');
    runGit('config user.email "watchdog@example.com"');
    runGit('config commit.gpgSign false');
    runGit('config core.autocrlf false');
  } catch (err) {
    throw new Error(`Failed to initialize git repository at ${tmpDir}: ${err}`);
  }

  // 2. Initial Commit if requested
  let initialSha = '';
  if (options.initialCommit) {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Zero Drift Sandbox\n');
    runGit('add README.md');
    runGit('commit -m "chore: initial repository commit"');
    initialSha = runGit('rev-parse HEAD');
  }

  // 3. Set remote if requested directly or default fallback
  const remote =
    options.remoteUrl ?? (options.noRemote ? null : 'https://github.com/plantcor/arch-system.git');
  if (remote) {
    runGit(`remote add origin ${remote}`);
  }

  return {
    dir: tmpDir,
    get bareOriginDir() {
      return bareOriginDir;
    },

    /**
     * Commit a new file or updated file
     * @param {string} relativePath
     * @param {string} content
     * @param {string} [message='update file']
     * @returns {string} Commit SHA
     */
    commitFile(relativePath, content, message = 'update file') {
      const fullPath = path.join(tmpDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      runGit(`add "${relativePath}"`);
      runGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
      return runGit('rev-parse HEAD');
    },

    /**
     * Create an uncommitted/untracked file in working tree
     * @param {string} relativePath
     * @param {string} content
     * @param {boolean} [stage=false]
     */
    createDirtyFile(relativePath, content, stage = false) {
      const fullPath = path.join(tmpDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      if (stage) {
        runGit(`add "${relativePath}"`);
      }
    },

    /**
     * Modify an existing file without staging it
     * @param {string} relativePath
     * @param {string} content
     */
    modifyUnstaged(relativePath, content) {
      const fullPath = path.join(tmpDir, relativePath);
      fs.writeFileSync(fullPath, content);
    },

    /**
     * Check if working directory is clean
     * @returns {boolean}
     */
    isClean() {
      const status = runGit('status --porcelain');
      return status.length === 0;
    },

    /**
     * Get raw porcelain status output
     * @returns {string}
     */
    getPorcelainStatus() {
      return runGit('status --porcelain');
    },

    /**
     * Get current 40-char HEAD commit hash
     * @returns {string}
     */
    getHeadCommit() {
      return runGit('rev-parse HEAD');
    },

    /**
     * Get active branch name or 'HEAD' if detached
     * @returns {string}
     */
    getBranch() {
      return runGit('rev-parse --abbrev-ref HEAD');
    },

    /**
     * Detach HEAD to point directly to current commit
     */
    detachHead() {
      runGit('checkout --detach HEAD');
    },

    /**
     * Switch or create branch
     * @param {string} branchName
     */
    checkoutBranch(branchName) {
      runGit(`checkout -B ${branchName}`);
    },

    /**
     * Setup a local bare git repository as the upstream 'origin'.
     * Configures simulated GitHub URL while routing pushes locally via insteadOf.
     * Allows real 'git push origin <branch>' to succeed completely offline.
     *
     * @param {object} [bareOptions]
     * @param {string} [bareOptions.owner='test-owner']
     * @param {string} [bareOptions.repo='test-repo']
     * @returns {{ bareDir: string, simulatedRemoteUrl: string }}
     */
    setupBareOrigin(bareOptions = {}) {
      const owner = bareOptions.owner ?? 'test-owner';
      const repo = bareOptions.repo ?? 'test-repo';
      const simulatedUrl = `https://github.com/${owner}/${repo}.git`;

      bareOriginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-bare-origin-'));
      execSync('git init --bare', { cwd: bareOriginDir, stdio: ['pipe', 'pipe', 'pipe'] });

      // Remove existing origin if set
      try {
        runGit('remote remove origin');
      } catch {}

      // Add simulated remote URL
      runGit(`remote add origin ${simulatedUrl}`);

      // Route git push/fetch from simulated URL to local bare directory
      runGit(`config url."${bareOriginDir}".insteadOf "${simulatedUrl}"`);

      // Push current branch to bare origin and set tracking
      runGit(`push -u origin ${targetBranch}`);

      return {
        bareDir: bareOriginDir,
        simulatedRemoteUrl: simulatedUrl,
      };
    },

    /**
     * Get latest commit SHA in the bare origin repo
     * @param {string} [branch='main']
     * @returns {string}
     */
    getBareOriginHead(branch = targetBranch) {
      if (!bareOriginDir) {
        throw new Error('Bare origin has not been configured. Call setupBareOrigin() first.');
      }
      return execSync(`git rev-parse refs/heads/${branch}`, {
        cwd: bareOriginDir,
        encoding: 'utf8',
      }).trim();
    },

    /**
     * Execute arbitrary git command in sandbox
     * @param {string} cmd
     * @returns {string}
     */
    exec(cmd) {
      return runGit(cmd);
    },

    /**
     * Clean up all temporary files and directories
     */
    cleanup() {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
      if (bareOriginDir) {
        try {
          fs.rmSync(bareOriginDir, { recursive: true, force: true });
        } catch {}
      }
    },
  };
}
