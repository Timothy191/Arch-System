// @ts-check
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { GitError, BranchNotFoundError, GitHubApiError, RateLimitError } from './errors.mjs';

const execFileAsync = promisify(execFile);

export const COMMIT_SHA_REGEX = /^[0-9a-f]{40,64}$/i;
export const UPSTREAM_COUNT_REGEX = /^(\d+)\s+(\d+)$/;

/**
 * Execute git command safely without shell expansion.
 * Supports dependency injection via options.execFn or options.env.
 *
 * @param {string[]} args
 * @param {string} [cwd=process.cwd()]
 * @param {object} [options={}]
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function runGit(args, cwd = process.cwd(), options = {}) {
  if (options.execFn) {
    try {
      const stdout = options.execFn(`git ${args.join(' ')}`);
      return { success: true, stdout: String(stdout), stderr: '', exitCode: 0 };
    } catch (err) {
      return {
        success: false,
        stdout: err.stdout ? String(err.stdout) : '',
        stderr: err.stderr ? String(err.stderr).trim() : (err.message || '').trim(),
        exitCode: err.status ?? err.code ?? 1,
      };
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: options.timeout || 30000,
      env: { ...process.env, ...(options.env || {}) },
    });
    return { success: true, stdout, stderr: stderr ? stderr.trim() : '', exitCode: 0 };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout ? String(err.stdout) : '',
      stderr: err.stderr ? String(err.stderr).trim() : (err.message || '').trim(),
      exitCode: err.code ?? err.status ?? 1,
    };
  }
}

/**
 * Check if the given directory is inside an initialized git worktree.
 *
 * @param {string} [cwd=process.cwd()]
 * @param {object} [options={}]
 * @returns {Promise<boolean>}
 */
export async function isGitRepository(cwd = process.cwd(), options = {}) {
  if (!fs.existsSync(cwd)) return false;
  const res = await runGit(['rev-parse', '--is-inside-work-tree'], cwd, options);
  return res.success && res.stdout.trim() === 'true';
}

/**
 * Unescape quotes and separate rename paths ('old -> new').
 *
 * @param {string} rawPath
 * @returns {{ origPath: string|null, filePath: string }}
 */
export function parseRenamedPath(rawPath) {
  if (rawPath.includes(' -> ')) {
    const [orig, target] = rawPath.split(' -> ').map((p) => p.replace(/^"|"$/g, ''));
    return { origPath: orig, filePath: target };
  }
  return { origPath: null, filePath: rawPath.replace(/^"|"$/g, '') };
}

/**
 * Parse git status --porcelain output preserving leading whitespace on ' M' lines.
 *
 * @param {string} rawOutput
 * @returns {{ isClean: boolean, uncommittedFiles: string[], entries: Array<any> }}
 */
export function parsePorcelainStatus(rawOutput) {
  if (!rawOutput || !rawOutput.trim()) return { isClean: true, uncommittedFiles: [], entries: [] };

  // CRITICAL: Do NOT run rawOutput.trim() before split!
  // Doing so removes the leading space on line 0 when line 0 is an unstaged modification (' M file').
  const lines = rawOutput.split(/\r?\n/);
  const entries = [];
  const uncommittedFiles = [];

  for (const line of lines) {
    if (line.length < 3) continue;
    const rawPath = line.slice(3).trim();
    if (!rawPath) continue;

    const statusCode = line.slice(0, 2);
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const { origPath, filePath } = parseRenamedPath(rawPath);

    const isUntracked = statusCode === '??';
    const isStaged = indexStatus !== ' ' && indexStatus !== '?';
    const isUnstaged = workTreeStatus !== ' ' && workTreeStatus !== '?';
    const isConflicted = ['UU', 'AA', 'DD', 'AU', 'UD', 'UA', 'DU'].includes(statusCode);

    entries.push({
      statusCode,
      indexStatus,
      workTreeStatus,
      filePath,
      origPath,
      isUntracked,
      isStaged,
      isUnstaged,
      isConflicted,
    });
    uncommittedFiles.push(filePath);
  }

  return {
    isClean: uncommittedFiles.length === 0,
    uncommittedFiles,
    entries,
  };
}

/**
 * Inspect local git repository state.
 *
 * @param {string} [cwd=process.cwd()]
 * @param {object} [options={}]
 * @param {boolean} [options.allowUnborn=false] - If true, returns isUnborn: true instead of throwing for 0-commit repos
 * @returns {Promise<{ commit: string, branch: string, isClean: boolean, uncommittedFiles: string[], isDetached: boolean, isUnborn: boolean }>}
 */
export async function inspectLocalGit(cwd = process.cwd(), options = {}) {
  // 1. Verify directory exists
  if (!fs.existsSync(cwd)) {
    throw new GitError(`Directory does not exist: ${cwd}`, {
      code: 'ERR_DIR_NOT_FOUND',
      cwd,
    });
  }

  // 2. Verify git worktree
  const isRepo = await runGit(['rev-parse', '--is-inside-work-tree'], cwd, options);
  if (!isRepo.success || isRepo.stdout.trim() !== 'true') {
    throw new GitError(`Not a git repository: ${cwd}`, {
      code: 'ERR_NOT_A_GIT_REPO',
      cwd,
      stderr: isRepo.stderr,
      gitExitCode: isRepo.exitCode,
      command: 'git rev-parse --is-inside-work-tree',
    });
  }

  // 3. Resolve active branch & detached HEAD
  const symRef = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], cwd, options);
  let branch = '';
  let isDetached = false;

  if (symRef.success && symRef.stdout.trim()) {
    branch = symRef.stdout.trim();
    isDetached = false;
  } else {
    const abbrevRef = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, options);
    branch = abbrevRef.success ? abbrevRef.stdout.trim() : 'HEAD';
    isDetached = true;
  }

  // 4. Resolve commit SHA & unborn state
  const revParse = await runGit(['rev-parse', '--verify', '-q', 'HEAD'], cwd, options);
  let commit = '';
  let isUnborn = false;

  if (revParse.success && revParse.stdout.trim()) {
    commit = revParse.stdout.trim();
    if (!COMMIT_SHA_REGEX.test(commit)) {
      throw new GitError(`Invalid commit SHA format received: ${commit}`, {
        code: 'ERR_INVALID_COMMIT_SHA',
        cwd,
        stdout: commit,
      });
    }
  } else {
    // Unborn repository (0 commits)
    isUnborn = true;
    if (!options.allowUnborn) {
      throw new GitError(`Repository has no commits (unborn branch '${branch}')`, {
        code: 'ERR_EMPTY_GIT_REPO',
        gitExitCode: 128,
        cwd,
        command: 'git rev-parse --verify -q HEAD',
      });
    }
  }

  // 5. Parse porcelain status
  const statusRes = await runGit(['status', '--porcelain'], cwd, options);
  const { isClean, uncommittedFiles } = parsePorcelainStatus(statusRes.stdout);

  return {
    commit,
    branch,
    isClean,
    uncommittedFiles,
    isDetached,
    isUnborn,
  };
}

/**
 * Query upstream tracking status (ahead/behind commit counts).
 *
 * @param {string} [cwd=process.cwd()]
 * @param {object} [options={}]
 * @returns {Promise<{ hasUpstream: boolean, upstreamBranch: string|null, ahead: number, behind: number, status: 'identical'|'ahead'|'behind'|'diverged'|'no_upstream' }>}
 */
export async function getUpstreamStatus(cwd = process.cwd(), options = {}) {
  const upRef = await runGit(['rev-parse', '--abbrev-ref', '@{u}'], cwd, options);
  if (!upRef.success) {
    return {
      hasUpstream: false,
      upstreamBranch: null,
      ahead: 0,
      behind: 0,
      status: 'no_upstream',
    };
  }

  const upstreamBranch = upRef.stdout.trim();
  const countRes = await runGit(
    ['rev-list', '--left-right', '--count', 'HEAD...@{u}'],
    cwd,
    options
  );
  if (!countRes.success) {
    return {
      hasUpstream: true,
      upstreamBranch,
      ahead: 0,
      behind: 0,
      status: 'diverged',
    };
  }

  const match = countRes.stdout.trim().match(UPSTREAM_COUNT_REGEX);
  const ahead = match ? parseInt(match[1], 10) : 0;
  const behind = match ? parseInt(match[2], 10) : 0;

  let status = 'identical';
  if (ahead > 0 && behind > 0) status = 'diverged';
  else if (ahead > 0) status = 'ahead';
  else if (behind > 0) status = 'behind';

  return {
    hasUpstream: true,
    upstreamBranch,
    ahead,
    behind,
    status,
  };
}

/**
 * Robust parser for GitHub remote URLs supporting HTTPS, SSH, custom ports,
 * authentication tokens, and dotted repository names.
 *
 * @param {string} url - Remote git URL
 * @returns {{ owner: string, repo: string } | null}
 */
