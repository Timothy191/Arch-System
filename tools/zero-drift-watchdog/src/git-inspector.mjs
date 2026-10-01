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
export function parseGitHubRemoteUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().replace(/\/+$/, '');

  // Must match github.com preceded by boundary (^ or / or @), optional port, owner, and repo
  const match = clean.match(/(?:^|[/@])github\.com[:/](?:[0-9]+\/)?([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return null;

  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  return { owner, repo };
}

/**
 * Discovers owner, repo, and branch from CI environment variables or local git.
 *
 * @param {string} [cwd=process.cwd()]
 * @param {object} [options={}]
 * @returns {Promise<{ owner: string, repo: string, branch: string }>}
 */
export async function discoverGitHubContext(cwd = process.cwd(), options = {}) {
  const env = options.env || process.env;
  let owner = '';
  let repo = '';
  let branch = '';

  // 1. CI Environment Variables
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY.includes('/')) {
    const parts = env.GITHUB_REPOSITORY.split('/');
    owner = parts[0];
    repo = parts[1];
  }
  if (env.GITHUB_REF_NAME) {
    branch = env.GITHUB_REF_NAME;
  } else if (env.GITHUB_REF && env.GITHUB_REF.startsWith('refs/heads/')) {
    branch = env.GITHUB_REF.replace('refs/heads/', '');
  }

  // 2. Local Git Remote URL Fallback
  if (!owner || !repo) {
    let rawRemote = '';
    // Check git config --get remote.origin.url first (raw URL before insteadOf rewrites)
    const configRes = await runGit(['config', '--get', 'remote.origin.url'], cwd, options);
    let parsed =
      configRes.success && configRes.stdout.trim()
        ? parseGitHubRemoteUrl(configRes.stdout.trim())
        : null;
    if (configRes.success && configRes.stdout.trim()) {
      rawRemote = configRes.stdout.trim();
    }

    if (!parsed) {
      const remoteRes = await runGit(['remote', 'get-url', 'origin'], cwd, options);
      if (remoteRes.success && remoteRes.stdout.trim()) {
        rawRemote = remoteRes.stdout.trim();
        parsed = parseGitHubRemoteUrl(remoteRes.stdout.trim());
      }
    }

    if (parsed) {
      owner = parsed.owner;
      repo = parsed.repo;
    } else if (rawRemote) {
      throw new GitError(`Remote origin is not a valid GitHub repository URL: ${rawRemote}`, {
        code: 'ERR_INVALID_GITHUB_REMOTE_URL',
        cwd,
        command: 'git remote get-url origin',
      });
    }
  }

  if (!owner || !repo) {
    throw new GitError(
      'Unable to discover GitHub repository context from environment or git remotes',
      {
        code: 'ERR_GITHUB_CONTEXT_NOT_FOUND',
        cwd,
      }
    );
  }

  // 3. Local Branch Resolution Fallback
  if (!branch) {
    const symRes = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], cwd, options);
    if (symRes.success && symRes.stdout.trim()) {
      branch = symRes.stdout.trim();
    } else {
      const abbrevRes = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, options);
      const detected = abbrevRes.success ? abbrevRes.stdout.trim() : '';
      if (detected && detected !== 'HEAD') {
        branch = detected;
      } else {
        const showRes = await runGit(['branch', '--show-current'], cwd, options);
        const current = showRes.success ? showRes.stdout.trim() : '';
        branch = current || 'main';
      }
    }
  }

  return { owner, repo, branch };
}

/**
 * Resolve GitHub authentication token from options, env vars, or gh CLI auth token.
 *
 * @param {object} [options={}]
 * @returns {string|null}
 */
export function resolveGitHubToken(options = {}) {
  if (options.token && typeof options.token === 'string' && options.token.trim()) {
    return options.token.trim();
  }
  const env = options.env || process.env;
  if (env.GITHUB_TOKEN !== undefined) {
    return env.GITHUB_TOKEN.trim() || null;
  }
  if (env.GH_TOKEN !== undefined) {
    return env.GH_TOKEN.trim() || null;
  }
  if (env.GITHUB_API_URL) {
    return null;
  }
  // Subprocess token resolution via gh auth token
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (token) return token;
  } catch {
    // gh CLI not installed or unauthenticated
  }
  return null;
}

/**
 * Create standard GitHub HTTP headers enforcing User-Agent, Accept, and API version.
 *
 * @param {string} [token]
 * @returns {Record<string, string>}
 */
export function createGitHubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'zero-drift-watchdog/1.0.0 (anti-drift synchronization watchdog)',
  };
  if (token && typeof token === 'string' && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }
  return headers;
}

/**
 * Execute gh CLI command safely.
 *
 * @param {string[]} args
 * @param {object} [options={}]
 * @returns {string}
 */
export function executeGhCli(args, options = {}) {
  try {
    return execFileSync('gh', args, {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeoutMs || 15000,
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    throw new GitError(
      `GitHub CLI (gh) execution failed: ${args.join(' ')}\n${stderr || err.message}`,
      {
        code: 'ERR_GH_CLI_FAILED',
        command: `gh ${args.join(' ')}`,
        stderr,
        gitExitCode: err.status ?? 1,
      }
    );
  }
}

/**
 * Retrieve branch HEAD commit SHA from GitHub REST API.
 *
 * @param {{ owner: string, repo: string, branch: string }} context
 * @param {object} [options={}]
 * @returns {Promise<string>} 40-character commit SHA
 */
export async function fetchBranchHeadSha(context, options = {}) {
  const { owner, repo, branch } = context;
  const token = options.token !== undefined ? options.token : resolveGitHubToken(options);
  const baseUrl = options.apiUrl || 'https://api.github.com';
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  const url = `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`;

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: createGitHubHeaders(token),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    });

    const remaining = res.headers?.get?.('x-ratelimit-remaining');
    const resetTime = res.headers?.get?.('x-ratelimit-reset');
    const retryAfter = res.headers?.get?.('retry-after');

    if (retryAfter) {
      const retrySec = parseInt(retryAfter, 10) || 60;
      throw new RateLimitError(`GitHub secondary rate limit exceeded. Retry after ${retrySec}s`, {
        retryAfterSec: retrySec,
        endpoint: url,
        headers: res.headers,
      });
    }

    if (res.status === 403 && remaining === '0') {
      const resetEpoch = parseInt(resetTime, 10) || Math.floor(Date.now() / 1000) + 3600;
      throw new RateLimitError(
        `GitHub API rate limit exhausted. Resets at ${new Date(resetEpoch * 1000).toISOString()}`,
        {
          resetEpoch,
          remaining: 0,
          endpoint: url,
          headers: res.headers,
        }
      );
    }

    if (res.status === 401) {
      throw new GitHubApiError('Bad credentials or missing token', {
        statusCode: 401,
        statusText: res.statusText || 'Unauthorized',
        endpoint: url,
        code: 'ERR_GITHUB_API',
      });
    }

    if (res.status === 404) {
      let data = {};
      try {
        data = await res.json();
      } catch {}
      if (data.message === 'Branch not found' || String(data.message).includes('Branch')) {
        throw new BranchNotFoundError(branch, {
          target: 'remote',
          repository: `${owner}/${repo}`,
          endpoint: url,
        });
      }
      throw new GitHubApiError(
        `GitHub repository ${owner}/${repo} not found or token lacks access`,
        {
          statusCode: 404,
          statusText: res.statusText || 'Not Found',
          endpoint: url,
          responseBody: data,
        }
      );
    }

    if (!res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch {}
      throw new GitHubApiError(
        data.message || `GitHub API request failed: ${res.status} ${res.statusText}`,
        {
          statusCode: res.status,
          statusText: res.statusText,
          endpoint: url,
          responseBody: data,
        }
      );
    }

    const data = await res.json();
    if (!data.commit || !data.commit.sha) {
      throw new GitHubApiError('Invalid branch response from GitHub API: missing commit.sha', {
        statusCode: res.status,
        endpoint: url,
        responseBody: data,
      });
    }

    return data.commit.sha;
  } catch (fetchErr) {
    if (
      fetchErr instanceof RateLimitError ||
      fetchErr instanceof BranchNotFoundError ||
      (fetchErr instanceof GitHubApiError &&
        (fetchErr.statusCode === 401 || fetchErr.statusCode === 404)) ||
      options.apiUrl
    ) {
      throw fetchErr;
    }

    if (options.fallbackToGh !== false) {
      try {
        const sha = executeGhCli(
          [
            'api',
            `repos/${owner}/${repo}/branches/${branch}`,
            '-H',
            'X-GitHub-Api-Version: 2022-11-28',
            '--jq',
            '.commit.sha',
          ],
          { cwd: options.cwd, timeout: 3000 }
        );
        if (/^[0-9a-f]{40,64}$/i.test(sha)) {
          return sha;
        }
      } catch {
        // Fallback failed, rethrow original fetch error
      }
    }
    throw fetchErr;
  }
}

/**
 * Compare two commits on GitHub via compare API.
 *
 * @param {{ owner: string, repo: string }} context
 * @param {string} base
 * @param {string} head
 * @param {object} [options={}]
 * @returns {Promise<{ status: 'identical'|'ahead'|'behind'|'diverged', aheadBy: number, behindBy: number, totalCommits: number }|null>}
 */
export async function compareCommits(context, base, head, options = {}) {
  if (base === head) {
    return {
      status: 'identical',
      aheadBy: 0,
      behindBy: 0,
      totalCommits: 0,
    };
  }

  const { owner, repo } = context;
  const token = options.token !== undefined ? options.token : resolveGitHubToken(options);
  const baseUrl = options.apiUrl || 'https://api.github.com';
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  try {
    const url = `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: createGitHubHeaders(token),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        status: data.status,
        aheadBy: data.ahead_by ?? 0,
        behindBy: data.behind_by ?? 0,
        totalCommits: data.total_commits ?? 0,
      };
    }

    if (res.status === 404) {
      return null;
    }

    let data = {};
    try {
      data = await res.json();
    } catch {}
    throw new GitHubApiError(`GitHub compare API failed: ${res.status} ${res.statusText}`, {
      statusCode: res.status,
      statusText: res.statusText,
      endpoint: url,
      responseBody: data,
    });
  } catch (err) {
    if (options.fallbackToGh !== false) {
      try {
        const raw = executeGhCli(
          [
            'api',
            `repos/${owner}/${repo}/compare/${base}...${head}`,
            '--jq',
            '{ status: .status, ahead_by: .ahead_by, behind_by: .behind_by, total_commits: .total_commits }',
          ],
          { cwd: options.cwd }
        );
        const data = JSON.parse(raw);
        return {
          status: data.status,
          aheadBy: data.ahead_by ?? 0,
          behindBy: data.behind_by ?? 0,
          totalCommits: data.total_commits ?? 0,
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Inspect remote GitHub repository state and compute drift relative to localCommit.
 *
 * @param {{ owner: string, repo: string, branch: string }} context
 * @param {string|object} [token]
 * @param {object} [options={}]
 * @returns {Promise<{ commit: string, branch: string, statusWithLocal?: 'identical'|'ahead'|'behind'|'diverged', aheadBy?: number, behindBy?: number }>}
 */
export async function inspectGitHubRemote(context, token, options = {}) {
  let effectiveToken = typeof token === 'string' ? token : undefined;
  let effectiveOptions =
    typeof token === 'object' && token !== null ? { ...token, ...options } : { ...options };
  if (effectiveToken === undefined && effectiveOptions.token !== undefined) {
    effectiveToken = effectiveOptions.token;
  }
  if (effectiveToken === undefined) {
    effectiveToken = resolveGitHubToken(effectiveOptions);
  }

  const remoteCommit = await fetchBranchHeadSha(context, {
    ...effectiveOptions,
    token: effectiveToken,
  });

  const result = {
    commit: remoteCommit,
    branch: context.branch,
  };

  const localCommit = effectiveOptions.localCommit;
  if (!localCommit) {
    return result;
  }

  // 1. Identical Check
  if (localCommit === remoteCommit) {
    result.statusWithLocal = 'identical';
    result.aheadBy = 0;
    result.behindBy = 0;
    return result;
  }

  // 2. Remote Compare Query (base=remoteCommit, head=localCommit)
  const compare = await compareCommits(context, remoteCommit, localCommit, {
    ...effectiveOptions,
    token: effectiveToken,
  });

  if (compare) {
    result.statusWithLocal = compare.status;
    result.aheadBy = compare.aheadBy;
    result.behindBy = compare.behindBy;
    return result;
  }

  // 3. Fallback: Local Git Calculation for Unpushed Local Commit
  try {
    const countRes = await runGit(
      ['rev-list', '--left-right', '--count', `${localCommit}...${remoteCommit}`],
      effectiveOptions.cwd || process.cwd(),
      effectiveOptions
    );
    if (countRes.success) {
      const parts = countRes.stdout.trim().split(/\s+/);
      const localUnique = parseInt(parts[0] || '0', 10);
      const remoteUnique = parseInt(parts[1] || '0', 10);

      if (localUnique > 0 && remoteUnique === 0) {
        result.statusWithLocal = 'ahead';
        result.aheadBy = localUnique;
        result.behindBy = 0;
      } else if (localUnique === 0 && remoteUnique > 0) {
        result.statusWithLocal = 'behind';
        result.aheadBy = 0;
        result.behindBy = remoteUnique;
      } else if (localUnique === 0 && remoteUnique === 0) {
        result.statusWithLocal = 'identical';
        result.aheadBy = 0;
        result.behindBy = 0;
      } else {
        result.statusWithLocal = 'diverged';
        result.aheadBy = localUnique;
        result.behindBy = remoteUnique;
      }
      return result;
    }
  } catch {
    // Ignore local git error, fall through to default
  }

  result.statusWithLocal = 'ahead';
  result.aheadBy = 1;
  result.behindBy = 0;
  return result;
}
