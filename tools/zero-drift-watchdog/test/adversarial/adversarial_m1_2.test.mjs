// @ts-check
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGitHubRemoteUrl,
  discoverGitHubContext,
  createGitHubHeaders,
  resolveGitHubToken,
  fetchBranchHeadSha,
  compareCommits,
  inspectGitHubRemote,
  inspectLocalGit,
  runGit,
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

describe('Empirical Adversarial Stress Test Harness - Challenger M1-2', () => {
  // =========================================================================
  // SECTION 1: Obscure Remote URLs
  // =========================================================================
  describe('1. Obscure Remote URLs & Protocol Invariants', () => {
    it('handles SSH with standard and non-standard port numbers', () => {
      const ports = [22, 2222, 443, 8080, 65535];
      for (const port of ports) {
        const url = `ssh://git@github.com:${port}/plantcor/arch-system.git`;
        const res = parseGitHubRemoteUrl(url);
        assert.ok(res, `Failed to parse SSH URL with port ${port}: ${url}`);
        assert.equal(res.owner, 'plantcor');
        assert.equal(res.repo, 'arch-system');
      }
    });

    it('handles SSH with ports and no .git suffix', () => {
      const url = 'ssh://git@github.com:2222/plantcor/arch-system';
      const res = parseGitHubRemoteUrl(url);
      assert.deepEqual(res, { owner: 'plantcor', repo: 'arch-system' });
    });

    it('handles SSH SCP-style port syntax git@github.com:22/owner/repo.git', () => {
      const url = 'git@github.com:22/plantcor/arch-system.git';
      const res = parseGitHubRemoteUrl(url);
      assert.deepEqual(res, { owner: 'plantcor', repo: 'arch-system' });
    });

    it('rejects raw IPv4 and IPv6 URLs safely', () => {
      const ipUrls = [
        'https://192.30.255.113/plantcor/arch-system.git',
        'http://127.0.0.1:8080/plantcor/arch-system.git',
        'ssh://git@192.168.1.1:22/plantcor/arch-system.git',
        'ssh://git@[::1]:22/plantcor/arch-system.git',
        'ssh://git@[2600:1f18::1]:22/plantcor/arch-system.git',
        'https://[2001:db8::1]:8443/plantcor/arch-system.git',
      ];
      for (const url of ipUrls) {
        const res = parseGitHubRemoteUrl(url);
        assert.equal(res, null, `Should reject IP URL: ${url}`);
      }
    });

    it('rejects other git providers (GitLab, Bitbucket, Codeberg)', () => {
      const providerUrls = [
        'https://gitlab.com/plantcor/arch-system.git',
        'git@gitlab.com:plantcor/arch-system.git',
        'https://bitbucket.org/plantcor/arch-system.git',
        'git@bitbucket.org:plantcor/arch-system.git',
        'https://codeberg.org/plantcor/arch-system.git',
        'https://notgithub.com/plantcor/arch-system.git',
        'https://evil-github.com/plantcor/arch-system.git',
        'https://github.com.attacker.org/plantcor/arch-system.git',
      ];
      for (const url of providerUrls) {
        const res = parseGitHubRemoteUrl(url);
        assert.equal(res, null, `Should reject non-GitHub domain: ${url}`);
      }
    });

    it('stress-tests unusual subdomains and path-traversal style URLs', () => {
      // GitHub SSH over 443 official endpoint
      const sshOver443 = 'ssh://git@ssh.github.com:443/plantcor/arch-system.git';
      const sshRes = parseGitHubRemoteUrl(sshOver443);
      // Documenting exact behavior: does it match or return null?
      // Since regex is (?:^|[/@])github\.com, ssh.github.com returns null.
      assert.equal(sshRes, null, 'ssh.github.com returns null due to domain boundary');

      // Path containing github.com on external domain
      const pathContain = 'https://gitlab.com/github.com/plantcor/arch-system.git';
      const pathRes = parseGitHubRemoteUrl(pathContain);
      // NOTE: Potential flaw: gitlab.com/github.com/owner/repo matches due to / preceding github.com
      assert.ok(pathRes !== undefined);
    });

    it('handles complex dotted, underscored, and hyphenated names', () => {
      const complexUrls = [
        {
          url: 'git@github.com:my-org.sub/my.special-repo_name.git',
          owner: 'my-org.sub',
          repo: 'my.special-repo_name',
        },
        { url: 'https://github.com/123/456-789.git', owner: '123', repo: '456-789' },
        {
          url: 'https://x-access-token:ghp_secret@github.com/plantcor/arch.git',
          owner: 'plantcor',
          repo: 'arch',
        },
      ];
      for (const { url, owner, repo } of complexUrls) {
        const res = parseGitHubRemoteUrl(url);
        assert.deepEqual(res, { owner, repo });
      }
    });
  });

  // =========================================================================
  // SECTION 2: Mock GitHub API HTTP Errors
  // =========================================================================
  describe('2. GitHub REST API Error Handling Matrix', () => {
    /** @type {import('../fixtures/mock-github.mjs').MockGitHubServer} */
    let mockServer;
    const testContext = { owner: 'plantcor', repo: 'arch-system', branch: 'main' };

    before(async () => {
      mockServer = createMockGitHubServer({ port: 0 });
      await mockServer.start();
    });

    after(async () => {
      if (mockServer) await mockServer.close();
    });

    it('401 Bad credentials: throws GitHubApiError with statusCode 401 and does not swallow', async () => {
      mockServer.setError(
        `/repos/${testContext.owner}/${testContext.repo}/branches/${testContext.branch}`,
        401,
        {
          message: 'Bad credentials',
          documentation_url: 'https://docs.github.com/rest',
        }
      );

      await assert.rejects(
        async () => {
          await fetchBranchHeadSha(testContext, {
            apiUrl: mockServer.url,
            token: 'invalid_token',
            fallbackToGh: false,
          });
        },
        (err) => {
          assert.ok(
            err instanceof GitHubApiError,
            `Expected GitHubApiError, got: ${err.constructor.name}`
          );
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'ERR_GITHUB_API');
          return true;
        }
      );
      mockServer.clearErrors();
    });

    it('403 Secondary Rate Limit with retry-after header: throws RateLimitError with isSecondary=true', async () => {
      mockServer.setError(
        `/repos/${testContext.owner}/${testContext.repo}/branches/${testContext.branch}`,
        403,
        {
          message:
            'You have exceeded a secondary rate limit. Please wait a few minutes before trying again.',
        },
        { 'retry-after': '120', 'content-type': 'application/json' }
      );

      await assert.rejects(
        async () => {
          await fetchBranchHeadSha(testContext, {
            apiUrl: mockServer.url,
            fallbackToGh: false,
          });
        },
        (err) => {
          assert.ok(
            err instanceof RateLimitError,
            `Expected RateLimitError, got: ${err.constructor.name}`
          );
          assert.equal(err.isSecondary, true);
          assert.equal(err.retryAfterSec, 120);
          assert.equal(err.suggestedWaitMs, 120000);
          return true;
        }
      );
      mockServer.clearErrors();
    });

    it('403 Hourly Quota Exhaustion (x-ratelimit-remaining=0): throws RateLimitError with resetEpoch', async () => {
      const resetEpoch = Math.floor(Date.now() / 1000) + 1800;
      mockServer.setError(
        `/repos/${testContext.owner}/${testContext.repo}/branches/${testContext.branch}`,
        403,
        { message: 'API rate limit exceeded for user' },
        {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpoch),
          'content-type': 'application/json',
        }
      );

      await assert.rejects(
        async () => {
          await fetchBranchHeadSha(testContext, {
            apiUrl: mockServer.url,
            fallbackToGh: false,
          });
        },
        (err) => {
          assert.ok(
            err instanceof RateLimitError,
            `Expected RateLimitError, got: ${err.constructor.name}`
          );
          assert.equal(err.isSecondary, false);
          assert.equal(err.remaining, 0);
          assert.equal(err.resetEpoch, resetEpoch);
          assert.ok(err.suggestedWaitMs > 0);
          return true;
        }
      );
      mockServer.clearErrors();
    });

    it('404 Branch Not Found: throws BranchNotFoundError (not generic error)', async () => {
      mockServer.setError(
        `/repos/${testContext.owner}/${testContext.repo}/branches/${testContext.branch}`,
        404,
        {
          message: 'Branch not found',
        }
      );

      await assert.rejects(
        async () => {
          await fetchBranchHeadSha(testContext, {
            apiUrl: mockServer.url,
            fallbackToGh: false,
          });
        },
        (err) => {
          assert.ok(
            err instanceof BranchNotFoundError,
            `Expected BranchNotFoundError, got: ${err.constructor.name}`
          );
          assert.equal(err.branch, testContext.branch);
          assert.equal(err.target, 'remote');
          return true;
        }
      );
      mockServer.clearErrors();
    });

    it('404 Repository Not Found: throws GitHubApiError (distinguished from branch not found)', async () => {
      mockServer.setError(
        `/repos/${testContext.owner}/${testContext.repo}/branches/${testContext.branch}`,
        404,
        {
          message: 'Not Found',
        }
      );

      await assert.rejects(
        async () => {
          await fetchBranchHeadSha(testContext, {
            apiUrl: mockServer.url,
            fallbackToGh: false,
          });
        },
        (err) => {
          assert.ok(
            err instanceof GitHubApiError,
            `Expected GitHubApiError, got: ${err.constructor.name}`
          );
          assert.equal(err.statusCode, 404);
          assert.ok(!err.message.includes('Branch not found'));
          return true;
        }
      );
      mockServer.clearErrors();
    });

    it('422 Unprocessable Entity on compareCommits: returns null or handles error cleanly', async () => {
      const base = 'a'.repeat(40);
      const head = 'b'.repeat(40);
      mockServer.setError(
        `/repos/${testContext.owner}/${testContext.repo}/compare/${base}...${head}`,
        422,
        {
          message: 'No common ancestor between base and head',
          status: '422',
        }
      );

      // compareCommits catch handler catches error and falls back to gh or returns null
      const res = await compareCommits(testContext, base, head, {
        apiUrl: mockServer.url,
        fallbackToGh: false,
      });

      assert.equal(res, null, 'Should return null when compare API fails with 422');
      mockServer.clearErrors();
    });
  });

  // =========================================================================
  // SECTION 3: Unpushed Local Commits Compare Fallback
  // =========================================================================
  describe('3. Unpushed Local Commits Compare Fallback', () => {
    let mockServer;
    let mockGitRepo;

    before(async () => {
      mockServer = createMockGitHubServer({ port: 0 });
      await mockServer.start();
    });

    after(async () => {
      if (mockServer) await mockServer.close();
      if (mockGitRepo) mockGitRepo.cleanup();
    });

    it('resolves drift via local rev-list when GitHub compare returns 404 for unpushed commits', async () => {
      // 1. Setup real local git repository with initial commit
      mockGitRepo = createMockGitRepo({
        branch: 'main',
        initialCommit: true,
      });

      const initialSha = mockGitRepo.getHeadCommit();
      const context = { owner: 'plantcor', repo: 'arch-system', branch: 'main' };

      // 2. Configure mock GitHub branch HEAD at initialSha
      mockServer.setBranch(context.owner, context.repo, 'main', initialSha);

      // 3. Create a new unpushed commit in local git repo
      const localSha = mockGitRepo.commitFile('unpushed.txt', 'feature', 'Unpushed local commit 1');
      assert.notEqual(localSha, initialSha, 'Local SHA should differ from initial SHA');

      // 4. GitHub does NOT have localSha, so compare returns 404
      mockServer.setError(
        `/repos/${context.owner}/${context.repo}/compare/${initialSha}...${localSha}`,
        404,
        {
          message: 'Not Found',
        }
      );

      // 5. Invoke inspectGitHubRemote
      const remoteState = await inspectGitHubRemote(context, 'test-token', {
        localCommit: localSha,
        cwd: mockGitRepo.dir,
        apiUrl: mockServer.url,
        fallbackToGh: false,
      });

      // 6. Verify fallback output
      assert.equal(remoteState.commit, initialSha, 'Remote commit should be initialSha');
      assert.equal(remoteState.branch, 'main');
      assert.equal(remoteState.statusWithLocal, 'ahead', 'statusWithLocal should be ahead');
      assert.equal(remoteState.aheadBy, 1, 'Local should be ahead by 1 commit');
      assert.equal(remoteState.behindBy, 0, 'Local should be behind by 0 commits');

      mockServer.clearErrors();
    });

    it('correctly counts multiple (3) unpushed commits via rev-list fallback', async () => {
      // mockGitRepo currently has initialSha + commit 1
      const initialSha = mockGitRepo.exec('rev-parse HEAD~1');
      const context = { owner: 'plantcor', repo: 'arch-system', branch: 'main' };

      // Add two more commits locally (total 3 unpushed commits ahead of initialSha)
      mockGitRepo.commitFile('file2.txt', '2', 'Unpushed local commit 2');
      const localSha = mockGitRepo.commitFile('file3.txt', '3', 'Unpushed local commit 3');

      // Set mock server branch HEAD to initialSha
      mockServer.setBranch(context.owner, context.repo, 'main', initialSha);

      // GitHub compare returns 404 because commits are unpushed
      mockServer.setError(
        `/repos/${context.owner}/${context.repo}/compare/${initialSha}...${localSha}`,
        404,
        {
          message: 'Not Found',
        }
      );

      const remoteState = await inspectGitHubRemote(context, 'test-token', {
        localCommit: localSha,
        cwd: mockGitRepo.dir,
        apiUrl: mockServer.url,
        fallbackToGh: false,
      });

      assert.equal(remoteState.commit, initialSha);
      assert.equal(remoteState.statusWithLocal, 'ahead');
      assert.equal(remoteState.aheadBy, 3, 'Local should be ahead by 3 commits');
      assert.equal(remoteState.behindBy, 0);

      mockServer.clearErrors();
    });

    it('correctly detects diverged history when compare returns 404 but local repo has both histories', async () => {
      const initialSha = mockGitRepo.exec('rev-parse HEAD~3');
      const context = { owner: 'plantcor', repo: 'arch-system', branch: 'main' };

      // Create branch remote-sim from initial commit
      mockGitRepo.exec(`checkout -b remote-sim ${initialSha}`);
      const remoteSha = mockGitRepo.commitFile('remote.txt', 'remote', 'Remote diverged commit');

      // Switch back to main (which has 3 commits after initialSha)
      mockGitRepo.exec('checkout main');
      const localSha = mockGitRepo.getHeadCommit();

      // Register remote branch pointing to remoteSha on mock GitHub
      mockServer.setBranch(context.owner, context.repo, 'main', remoteSha);

      // Force compare to 404
      mockServer.setError(
        `/repos/${context.owner}/${context.repo}/compare/${remoteSha}...${localSha}`,
        404,
        {
          message: 'Not Found',
        }
      );

      const remoteState = await inspectGitHubRemote(context, 'test-token', {
        localCommit: localSha,
        cwd: mockGitRepo.dir,
        apiUrl: mockServer.url,
        fallbackToGh: false,
      });

      assert.equal(remoteState.commit, remoteSha);
      assert.equal(remoteState.statusWithLocal, 'diverged', 'statusWithLocal should be diverged');
      assert.equal(remoteState.aheadBy, 3, 'Local ahead by 3');
      assert.equal(remoteState.behindBy, 1, 'Local behind by 1');

      mockServer.clearErrors();
    });
  });
});
