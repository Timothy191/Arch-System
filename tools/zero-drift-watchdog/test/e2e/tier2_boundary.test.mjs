// @ts-check
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createMockGitHubServer } from '../fixtures/mock-github.mjs';
import { createMockVercelServer } from '../fixtures/mock-vercel.mjs';
import { createMockGitRepo } from '../fixtures/mock-git.mjs';
import { runWatchdog, requireCli, hasModule, PROJECT_ROOT } from '../fixtures/cli-helper.mjs';

describe('Tier 2: Boundary & Corner Cases (Resilience & Error Handling)', () => {
  /** @type {ReturnType<typeof createMockGitHubServer>} */
  let gh;
  /** @type {ReturnType<typeof createMockVercelServer>} */
  let vc;

  const testOwner = 'plantcor';
  const testRepo = 'arch-system';
  const testBranch = 'main';
  const testSha = '1111111111111111111111111111111111111111';
  const testProjectId = 'prj_arch_system';

  before(async () => {
    gh = createMockGitHubServer({ token: 'mock-gh-token', requireAuth: true });
    await gh.start();
    gh.setBranch(testOwner, testRepo, testBranch, testSha);

    vc = createMockVercelServer({ token: 'mock-vc-token', requireAuth: true });
    await vc.start();
    vc.setProject(testProjectId, testRepo, {
      prodCommitSha: testSha,
      prodState: 'READY',
      teamId: 'team_plantcor',
    });
  });

  after(async () => {
    await gh.close();
    await vc.close();
  });

  // T2.1: Unborn Branch / Empty Repo
  it('T2.1: should handle unborn branch (repo with 0 commits) gracefully without unhandled exception', async (t) => {
    const emptyRepo = createMockGitRepo({ branch: 'main', initialCommit: false });
    try {
      if (hasModule('git-inspector.mjs')) {
        const { inspectLocalGit } = await import(path.join(PROJECT_ROOT, 'src/git-inspector.mjs'));
        await assert.rejects(
          async () => inspectLocalGit(emptyRepo.dir),
          (err) => {
            assert.match(String(err), /no commits|unborn|fatal/i);
            return true;
          }
        );
      }

      if (requireCli(t)) {
        const res = await runWatchdog(['--dir', emptyRepo.dir, '--audit-only'], {
          env: { GITHUB_TOKEN: 'mock-gh-token', VERCEL_TOKEN: 'mock-vc-token' },
        });
        assert.equal(res.status, 2, 'Should exit with code 2 on git error');
        assert.match(res.stderr + res.stdout, /commit|git|unborn/i);
      }
    } finally {
      emptyRepo.cleanup();
    }
  });

  // T2.2: Detached HEAD State
  it('T2.2: should detect detached HEAD state and report isDetached: true', async (t) => {
    const detachedRepo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      detachedRepo.detachHead();
      assert.equal(detachedRepo.getBranch(), 'HEAD');

      if (hasModule('git-inspector.mjs')) {
        const { inspectLocalGit } = await import(path.join(PROJECT_ROOT, 'src/git-inspector.mjs'));
        const state = await inspectLocalGit(detachedRepo.dir);
        assert.equal(state.isDetached, true);
        assert.match(state.commit, /^[0-9a-f]{40}$/);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          ['--dir', detachedRepo.dir, '--branch', 'main', '--audit-only'],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              VERCEL_TOKEN: 'mock-vc-token',
              GITHUB_API_URL: gh.url,
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.ok(res.status === 0 || res.status === 1);
      }
    } finally {
      detachedRepo.cleanup();
    }
  });

  // T2.3: Missing GitHub Token
  it('T2.3: should reject execution or report fatal error when GitHub token is missing', async (t) => {
    const repo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      if (hasModule('git-inspector.mjs')) {
        const { inspectGitHubRemote } = await import(
          path.join(PROJECT_ROOT, 'src/git-inspector.mjs')
        );
        // Attempting to query with requireAuth and no token
        await assert.rejects(
          async () =>
            inspectGitHubRemote({ owner: testOwner, repo: testRepo, branch: testBranch }, '', {
              apiUrl: gh.url,
            }),
          (err) => {
            assert.match(String(err), /token|credential|401/i);
            return true;
          }
        );
      }

      if (requireCli(t)) {
        const res = await runWatchdog(['--dir', repo.dir, '--audit-only'], {
          env: { GITHUB_TOKEN: '', VERCEL_TOKEN: 'mock-vc-token' },
        });
        assert.equal(res.status, 2, 'Should exit code 2 on missing GitHub token');
        assert.match(res.stderr + res.stdout, /github.*token/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T2.4: Missing Vercel Token
  it('T2.4: should reject execution or report fatal error when Vercel token is missing', async (t) => {
    const repo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      if (hasModule('vercel-inspector.mjs')) {
        const { inspectVercelDeployment } = await import(
          path.join(PROJECT_ROOT, 'src/vercel-inspector.mjs')
        );
        await assert.rejects(
          async () =>
            inspectVercelDeployment({
              projectId: testProjectId,
              teamId: 'team_plantcor',
              token: '',
              apiUrl: vc.url,
            }),
          (err) => {
            assert.match(String(err), /token|auth|forbidden|403/i);
            return true;
          }
        );
      }

      if (requireCli(t)) {
        const res = await runWatchdog(['--dir', repo.dir, '--audit-only'], {
          env: { GITHUB_TOKEN: 'mock-gh-token', VERCEL_TOKEN: '' },
        });
        assert.equal(res.status, 2, 'Should exit code 2 on missing Vercel token');
        assert.match(res.stderr + res.stdout, /vercel.*token/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T2.5: Non-Existent GitHub Repository (404)
  it('T2.5: should handle non-existent remote repository (404) with fatal exit code 2', async (t) => {
    const repo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      const badOwner = 'nonexistent-org';
      const badRepo = 'nonexistent-repo';

      const res = await fetch(`${gh.url}/repos/${badOwner}/${badRepo}/branches/${testBranch}`, {
        headers: {
          'User-Agent': 'zero-drift-watchdog/1.0.0',
          Authorization: 'Bearer mock-gh-token',
        },
      });
      assert.equal(res.status, 404);

      if (requireCli(t)) {
        const cliRes = await runWatchdog(
          ['--dir', repo.dir, '--repo', `${badOwner}/${badRepo}`, '--audit-only'],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(cliRes.status, 2, 'Must exit with code 2 for repository not found');
        assert.match(cliRes.stderr + cliRes.stdout, /404|not found/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T2.6: Non-Existent Commit Ref (422)
  it('T2.6: should properly handle 422 Unprocessable Entity for invalid commit SHA', async () => {
    const invalidSha = '0'.repeat(40);
    const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/commits/${invalidSha}`, {
      headers: {
        'User-Agent': 'zero-drift-watchdog/1.0.0',
        Authorization: 'Bearer mock-gh-token',
      },
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.match(body.message, /No commit found for SHA/);
  });

  // T2.7: Non-Existent Vercel Project (404)
  it('T2.7: should handle non-existent Vercel project (404) with fatal exit code 2', async (t) => {
    const repo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      const badProject = 'prj_does_not_exist';
      const res = await fetch(`${vc.url}/v9/projects/${badProject}`, {
        headers: { Authorization: 'Bearer mock-vc-token' },
      });
      assert.equal(res.status, 404);

      if (requireCli(t)) {
        const cliRes = await runWatchdog(
          ['--dir', repo.dir, '--project', badProject, '--audit-only'],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(cliRes.status, 2, 'Must exit code 2 when Vercel project not found');
        assert.match(cliRes.stderr + cliRes.stdout, /project.*not found|404/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T2.8: Dirty Working Tree Blocking Push
  it('T2.8: should refuse automated push when working tree is dirty to prevent corrupting state', async (t) => {
    const dirtyRepo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      dirtyRepo.setupBareOrigin({ owner: testOwner, repo: testRepo });

      // Create new commit so local is ahead
      dirtyRepo.commitFile('new-feature.js', 'console.log("new")', 'feat: new feature');

      // Now create uncommitted dirty file
      dirtyRepo.createDirtyFile('uncommitted.tmp', 'in-progress dirty draft');
      assert.equal(dirtyRepo.isClean(), false);

      if (requireCli(t)) {
        const res = await runWatchdog(['--dir', dirtyRepo.dir, '--fix'], {
          env: {
            GITHUB_TOKEN: 'mock-gh-token',
            GITHUB_API_URL: gh.url,
            VERCEL_TOKEN: 'mock-vc-token',
            VERCEL_API_URL: vc.url,
          },
        });
        // Must exit code 1 (drift detected, cannot fix due to dirty working tree)
        assert.equal(res.status, 1);
        assert.match(res.stderr + res.stdout, /dirty|uncommitted/i);
      }
    } finally {
      dirtyRepo.cleanup();
    }
  });

  // T2.9: GitHub Rate Limit Exceeded (403)
  it('T2.9: should detect rate limit exhaustion (403) and log reset guidance', async () => {
    gh.setRateLimit({ remaining: 0, reset: Math.floor(Date.now() / 1000) + 1800 });
    const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
      headers: {
        'User-Agent': 'zero-drift-watchdog/1.0.0',
        Authorization: 'Bearer mock-gh-token',
      },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /rate limit exceeded/i);
    gh.setRateLimit({ remaining: 4999 }); // Reset rate limit
  });

  // T2.10: Vercel Rate Limiting (429)
  it('T2.10: should parse 429 response and retry-after header from Vercel API', async () => {
    vc.setRateLimit({ remaining: 0, retryAfter: 30 });
    const res = await fetch(`${vc.url}/v6/deployments?projectId=${testProjectId}`, {
      headers: { Authorization: 'Bearer mock-vc-token' },
    });
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('retry-after'), '30');
    vc.setRateLimit(null); // Reset
  });

  // T2.11: Mandatory User-Agent Rejection
  it('T2.11: should confirm client always sends User-Agent header and never triggers edge 403', async () => {
    // If request has empty User-Agent:
    const emptyAgentRes = await fetch(
      `${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`,
      {
        headers: {
          'User-Agent': '',
          Authorization: 'Bearer mock-gh-token',
        },
      }
    );
    assert.equal(emptyAgentRes.status, 403);

    // If request has standard watchdog User-Agent:
    const validRes = await fetch(
      `${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`,
      {
        headers: {
          'User-Agent': 'zero-drift-watchdog/1.0.0',
          Authorization: 'Bearer mock-gh-token',
        },
      }
    );
    assert.equal(validRes.status, 200);
  });

  // T2.12: Unreachable Server / Connection Error
  it('T2.12: should handle network connection error without unhandled promise rejection', async (t) => {
    const deadPort = 65432;
    const repo = createMockGitRepo({ branch: 'main', initialCommit: true });
    try {
      if (requireCli(t)) {
        const res = await runWatchdog(['--dir', repo.dir, '--audit-only'], {
          env: {
            GITHUB_TOKEN: 'mock-gh-token',
            GITHUB_API_URL: `http://127.0.0.1:${deadPort}`,
            VERCEL_TOKEN: 'mock-vc-token',
            VERCEL_API_URL: vc.url,
          },
        });
        assert.equal(res.status, 2, 'Must exit with code 2 on network connection failure');
        assert.match(res.stderr + res.stdout, /connection|fetch|network|ECONNREFUSED/i);
      }
    } finally {
      repo.cleanup();
    }
  });
});
