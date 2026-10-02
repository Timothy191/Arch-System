// @ts-check
import { execFileSync } from 'node:child_process';
import { GitError, BranchNotFoundError, GitHubApiError, RateLimitError } from './errors.mjs';
import { runGit } from './local-git.mjs';

export function parseGitHubRemoteUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().replace(/\/+$/, '');

  const match = clean.match(/(?:^|[/@])github\.com[:/](?:[0-9]+\/)?([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return null;

  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  return { owner, repo };
}

export async function discoverGitHubContext(cwd = process.cwd(), options = {}) {
  const env = options.env || process.env;
  let owner = '';
  let repo = '';
  let branch = '';

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

  if (!owner || !repo) {
    let rawRemote = '';
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
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (token) return token;
  } catch {}
  return null;
}

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
      } catch {}
    }
    throw fetchErr;
  }
}

export async function compareCommits(context, base, head, options = {}) {
  if (base === head) {
    return {
      status: 'identical',
      localAheadBy: 0,
      localBehindBy: 0,
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
        localAheadBy: data.ahead_by ?? 0,
        localBehindBy: data.behind_by ?? 0,
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
          localAheadBy: data.ahead_by ?? 0,
          localBehindBy: data.behind_by ?? 0,
          totalCommits: data.total_commits ?? 0,
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

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

  if (localCommit === remoteCommit) {
    result.statusWithLocal = 'identical';
    result.localAheadBy = 0;
    result.localBehindBy = 0;
    return result;
  }

  const compare = await compareCommits(context, remoteCommit, localCommit, {
    ...effectiveOptions,
    token: effectiveToken,
  });

  if (compare) {
    result.statusWithLocal = compare.status;
    result.localAheadBy = compare.localAheadBy;
    result.localBehindBy = compare.localBehindBy;
    return result;
  }

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
        result.localAheadBy = localUnique;
        result.localBehindBy = 0;
      } else if (localUnique === 0 && remoteUnique > 0) {
        result.statusWithLocal = 'behind';
        result.localAheadBy = 0;
        result.localBehindBy = remoteUnique;
      } else if (localUnique === 0 && remoteUnique === 0) {
        result.statusWithLocal = 'identical';
        result.localAheadBy = 0;
        result.localBehindBy = 0;
      } else {
        result.statusWithLocal = 'diverged';
        result.localAheadBy = localUnique;
        result.localBehindBy = remoteUnique;
      }
      return result;
    }
  } catch {}

  result.statusWithLocal = 'ahead';
  result.localAheadBy = 1;
  result.localBehindBy = 0;
  return result;
}
