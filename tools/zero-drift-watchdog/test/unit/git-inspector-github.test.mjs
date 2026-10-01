// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseGitHubRemoteUrl,
  discoverGitHubContext,
  resolveGitHubToken,
  createGitHubHeaders,
  fetchBranchHeadSha,
  compareCommits,
  inspectGitHubRemote,
} from '../../src/git-inspector.mjs';

import {
  WatchdogError,
  GitError,
  UncommittedChangesError,
  BranchNotFoundError,
  GitHubApiError,
  RateLimitError,
} from '../../src/errors.mjs';

describe('Unit: GitHub Remote Client & Protocol Invariants', () => {
  describe('parseGitHubRemoteUrl', () => {
    it('accurately parses standard and edge-case GitHub remote URLs', () => {
      assert.deepEqual(parseGitHubRemoteUrl('https://github.com/plantcor/arch-system.git'), {
        owner: 'plantcor',
        repo: 'arch-system',
      });
      assert.deepEqual(parseGitHubRemoteUrl('https://github.com/plantcor/arch-system'), {
        owner: 'plantcor',
        repo: 'arch-system',
      });
      assert.deepEqual(parseGitHubRemoteUrl('https://github.com/plantcor/arch-system.git/'), {
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
          'https://x-access-token:ghs_12345@github.com/plantcor/arch-system.git'
        ),
        { owner: 'plantcor', repo: 'arch-system' }
      );
      assert.deepEqual(parseGitHubRemoteUrl('git://github.com/plantcor/arch-system.git'), {
        owner: 'plantcor',
        repo: 'arch-system',
      });
      assert.deepEqual(parseGitHubRemoteUrl('https://github.com/my-org/core.engine.v2.git'), {
        owner: 'my-org',
        repo: 'core.engine.v2',
      });
    });

    it('rejects non-GitHub domains and malformed URLs safely', () => {
      assert.equal(parseGitHubRemoteUrl('https://notgithub.com/plantcor/arch-system.git'), null);
      assert.equal(parseGitHubRemoteUrl('https://gitlab.com/plantcor/arch-system.git'), null);
      assert.equal(parseGitHubRemoteUrl('git@bitbucket.org:plantcor/arch-system.git'), null);
      assert.equal(parseGitHubRemoteUrl(''), null);
      assert.equal(parseGitHubRemoteUrl(null), null);
    });
  });

  describe('createGitHubHeaders', () => {
    it('enforces mandatory User-Agent, API version 2022-11-28, and Accept headers', () => {
      const headers = createGitHubHeaders('mock-token-xyz');

      assert.equal(headers['Accept'], 'application/vnd.github+json');
      assert.equal(headers['X-GitHub-Api-Version'], '2022-11-28');
      assert.ok(headers['User-Agent'].startsWith('zero-drift-watchdog/'));
      assert.equal(headers['Authorization'], 'Bearer mock-token-xyz');
    });

    it('omits Authorization header when token is null or undefined', () => {
      const headers = createGitHubHeaders();
      assert.equal(headers['Authorization'], undefined);
      assert.equal(headers['X-GitHub-Api-Version'], '2022-11-28');
    });
  });

  describe('discoverGitHubContext', () => {
    it('discovers repository owner/repo and branch from CI environment variables', async () => {
      const context = await discoverGitHubContext(process.cwd(), {
        env: {
          GITHUB_REPOSITORY: 'plantcor/arch-system',
          GITHUB_REF_NAME: 'feat/drilling-telemetry',
        },
      });

      assert.deepEqual(context, {
        owner: 'plantcor',
        repo: 'arch-system',
        branch: 'feat/drilling-telemetry',
      });
    });

    it('handles GITHUB_REF refs/heads/... syntax when GITHUB_REF_NAME is unset', async () => {
      const context = await discoverGitHubContext(process.cwd(), {
        env: {
          GITHUB_REPOSITORY: 'plantcor/arch-system',
          GITHUB_REF: 'refs/heads/production',
        },
      });

      assert.equal(context.branch, 'production');
    });

    it('discovers context from git remote origin when CI variables are absent', async () => {
      const mockExec = (cmd) => {
        if (cmd.includes('remote get-url origin')) {
          return 'https://github.com/plantcor/zero-drift-watchdog.git\n';
        }
        if (cmd.includes('symbolic-ref')) {
          return 'main\n';
        }
        return '';
      };

      const context = await discoverGitHubContext('/test/repo', {
        execFn: mockExec,
        env: {},
      });

      assert.equal(context.owner, 'plantcor');
      assert.equal(context.repo, 'zero-drift-watchdog');
      assert.equal(context.branch, 'main');
    });

    it('throws GitError (ERR_INVALID_GITHUB_REMOTE_URL) on invalid remote origin URL', async () => {
      const mockExec = (cmd) => {
        if (cmd.includes('remote get-url origin')) {
          return 'https://internal-gitlab.corp/owner/repo.git\n';
        }
        return '';
      };

      await assert.rejects(
        async () => discoverGitHubContext('/test/repo', { execFn: mockExec, env: {} }),
        (err) => {
          assert.ok(err instanceof GitError);
          assert.equal(err.code, 'ERR_INVALID_GITHUB_REMOTE_URL');
          return true;
        }
      );
    });
  });

  describe('resolveGitHubToken', () => {
    it('resolves token from options, GITHUB_TOKEN, or GH_TOKEN', () => {
      assert.equal(resolveGitHubToken({ token: 'opt-token' }), 'opt-token');
      assert.equal(resolveGitHubToken({ env: { GITHUB_TOKEN: 'gh-env-token' } }), 'gh-env-token');
      assert.equal(resolveGitHubToken({ env: { GH_TOKEN: 'gh-cli-token' } }), 'gh-cli-token');
    });
  });

  describe('fetchBranchHeadSha', () => {
    const testContext = { owner: 'plantcor', repo: 'arch-system', branch: 'main' };
    const mockSha = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

    it('successfully retrieves branch HEAD commit SHA', async () => {
      const mockFetch = async (url, opts) => {
        assert.ok(url.includes('/repos/plantcor/arch-system/branches/main'));
        assert.equal(opts.headers['X-GitHub-Api-Version'], '2022-11-28');
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'x-ratelimit-remaining': '4999' }),
          json: async () => ({ commit: { sha: mockSha } }),
        };
      };

      const sha = await fetchBranchHeadSha(testContext, {
        token: 'test-token',
        fetchImpl: mockFetch,
      });

      assert.equal(sha, mockSha);
    });

    it('throws BranchNotFoundError on 404 branch not found', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: 'Branch not found' }),
      });

      await assert.rejects(
        async () =>
          fetchBranchHeadSha(
            { owner: 'plantcor', repo: 'arch-system', branch: 'nonexistent' },
            { token: 'test-token', fetchImpl: mockFetch, fallbackToGh: false }
          ),
        (err) => {
          assert.ok(err instanceof BranchNotFoundError);
          assert.equal(err.target, 'remote');
          assert.equal(err.branch, 'nonexistent');
          assert.equal(err.repository, 'plantcor/arch-system');
          return true;
        }
      );
    });

    it('throws GitHubApiError on 401 Bad credentials', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: async () => ({ message: 'Bad credentials' }),
      });

      await assert.rejects(
        async () =>
          fetchBranchHeadSha(testContext, {
            token: 'invalid',
            fetchImpl: mockFetch,
            fallbackToGh: false,
          }),
        (err) => {
          assert.ok(err instanceof GitHubApiError);
          assert.equal(err.statusCode, 401);
          return true;
        }
      );
    });

    it('throws RateLimitError on 403 hourly quota exhaustion', async () => {
      const resetEpoch = Math.floor(Date.now() / 1000) + 1800;
      const mockFetch = async () => ({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpoch),
        }),
        json: async () => ({ message: 'API rate limit exceeded' }),
      });

      await assert.rejects(
        async () =>
          fetchBranchHeadSha(testContext, {
            token: 'test',
            fetchImpl: mockFetch,
            fallbackToGh: false,
          }),
        (err) => {
          assert.ok(err instanceof RateLimitError);
          assert.equal(err.isSecondary, false);
          assert.equal(err.remaining, 0);
          assert.equal(err.resetEpoch, resetEpoch);
          assert.ok(err.suggestedWaitMs > 0);
          return true;
        }
      );
    });

    it('throws RateLimitError on secondary rate limit with retry-after header', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 429,
        headers: new Headers({
          'retry-after': '45',
        }),
        json: async () => ({ message: 'You have exceeded a secondary rate limit' }),
      });

      await assert.rejects(
        async () =>
          fetchBranchHeadSha(testContext, {
            token: 'test',
            fetchImpl: mockFetch,
            fallbackToGh: false,
          }),
        (err) => {
          assert.ok(err instanceof RateLimitError);
          assert.equal(err.isSecondary, true);
          assert.equal(err.retryAfterSec, 45);
          assert.equal(err.suggestedWaitMs, 45000);
          return true;
        }
      );
    });
  });

  describe('compareCommits', () => {
    const testContext = { owner: 'plantcor', repo: 'arch-system' };
    const shaA = '1111111111111111111111111111111111111111';
    const shaB = '2222222222222222222222222222222222222222';

    it('short-circuits to identical when base equals head', async () => {
      const res = await compareCommits(testContext, shaA, shaA);
      assert.deepEqual(res, {
        status: 'identical',
        aheadBy: 0,
        behindBy: 0,
        totalCommits: 0,
      });
    });

    it('queries compare API and parses status, ahead_by, behind_by', async () => {
      const mockFetch = async (url) => {
        assert.ok(url.includes(`/compare/${shaA}...${shaB}`));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'ahead',
            ahead_by: 3,
            behind_by: 0,
            total_commits: 3,
          }),
        };
      };

      const res = await compareCommits(testContext, shaA, shaB, { fetchImpl: mockFetch });
      assert.equal(res.status, 'ahead');
      assert.equal(res.aheadBy, 3);
      assert.equal(res.behindBy, 0);
      assert.equal(res.totalCommits, 3);
    });

    it('returns null on 404 when commit is not pushed to remote', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 404,
      });

      const res = await compareCommits(testContext, shaA, shaB, {
        fetchImpl: mockFetch,
        fallbackToGh: false,
      });
      assert.equal(res, null);
    });
  });

  describe('inspectGitHubRemote', () => {
    const testContext = { owner: 'plantcor', repo: 'arch-system', branch: 'main' };
    const remoteSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const localSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    it('reports identical when localCommit matches remote branch SHA', async () => {
      const mockFetch = async (url) => {
        if (url.includes('/branches/main')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ commit: { sha: remoteSha } }),
          };
        }
        throw new Error('Unexpected URL: ' + url);
      };

      const res = await inspectGitHubRemote(testContext, 'token', {
        localCommit: remoteSha,
        fetchImpl: mockFetch,
      });

      assert.equal(res.commit, remoteSha);
      assert.equal(res.branch, 'main');
      assert.equal(res.statusWithLocal, 'identical');
      assert.equal(res.aheadBy, 0);
      assert.equal(res.behindBy, 0);
    });

    it('computes statusWithLocal using compare API when local differs', async () => {
      const mockFetch = async (url) => {
        if (url.includes('/branches/main')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ commit: { sha: remoteSha } }),
          };
        }
        if (url.includes('/compare/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'ahead',
              ahead_by: 2,
              behind_by: 0,
              total_commits: 2,
            }),
          };
        }
        throw new Error('Unexpected URL: ' + url);
      };

      const res = await inspectGitHubRemote(testContext, 'token', {
        localCommit: localSha,
        fetchImpl: mockFetch,
      });

      assert.equal(res.commit, remoteSha);
      assert.equal(res.statusWithLocal, 'ahead');
      assert.equal(res.aheadBy, 2);
      assert.equal(res.behindBy, 0);
    });
  });

  describe('Error Hierarchy & Serialization', () => {
    it('WatchdogError and subclasses serialize to JSON with exitCode and details', () => {
      const wErr = new WatchdogError('Watchdog failed', {
        code: 'ERR_TEST',
        exitCode: 2,
        details: { foo: 1 },
      });
      assert.equal(wErr.code, 'ERR_TEST');
      assert.equal(wErr.exitCode, 2);
      assert.deepEqual(wErr.toJSON(), {
        error: 'WatchdogError',
        code: 'ERR_TEST',
        message: 'Watchdog failed',
        exitCode: 2,
        details: { foo: 1 },
        cause: undefined,
      });

      const gitErr = new GitError('Git command failed', {
        command: 'git status',
        gitExitCode: 128,
      });
      assert.equal(gitErr instanceof WatchdogError, true);
      assert.equal(gitErr.command, 'git status');
      assert.equal(gitErr.gitExitCode, 128);

      const uncommErr = new UncommittedChangesError([' M a.txt', '?? b.txt']);
      assert.equal(uncommErr instanceof GitError, true);
      assert.equal(uncommErr.code, 'ERR_UNCOMMITTED_CHANGES');
      assert.equal(uncommErr.uncommittedFiles.length, 2);
      assert.equal(uncommErr.unstagedCount, 1);
      assert.equal(uncommErr.untrackedCount, 1);

      const brErr = new BranchNotFoundError('feat-xyz', {
        target: 'remote',
        repository: 'owner/repo',
      });
      assert.equal(brErr.code, 'ERR_REMOTE_BRANCH_NOT_FOUND');
      assert.equal(brErr.branch, 'feat-xyz');

      const apiErr = new GitHubApiError('Not Found', { statusCode: 404, endpoint: '/repos' });
      assert.equal(apiErr.statusCode, 404);

      const rateErr = new RateLimitError('Rate limited', { retryAfterSec: 30 });
      assert.equal(rateErr.isSecondary, true);
      assert.equal(rateErr.suggestedWaitMs, 30000);
      assert.equal(rateErr.statusCode, 429);
    });
  });
});
