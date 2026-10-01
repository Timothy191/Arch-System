// @ts-check
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createMockGitHubServer } from './mock-github.mjs';
import { createMockVercelServer } from './mock-vercel.mjs';
import { createMockGitRepo } from './mock-git.mjs';

describe('Test Infrastructure Fixtures Verification', () => {
  describe('Mock GitHub Server', () => {
    /** @type {ReturnType<typeof createMockGitHubServer>} */
    let gh;
    const testOwner = 'test-org';
    const testRepo = 'test-repo';
    const testBranch = 'main';
    const testSha = 'a'.repeat(40);

    before(async () => {
      gh = createMockGitHubServer({ token: 'mock-gh-token', requireAuth: true });
      await gh.start();
      gh.setBranch(testOwner, testRepo, testBranch, testSha, 'Initial commit');
    });

    after(async () => {
      await gh.close();
    });

    it('should reject requests without User-Agent header with 403 HTML', async () => {
      const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
        headers: {
          'User-Agent': '',
          Authorization: 'Bearer mock-gh-token',
        },
      });
      assert.equal(res.status, 403);
      const text = await res.text();
      assert.match(text, /User-Agent/i);
    });

    it('should reject requests with invalid token with 401 Bad credentials', async () => {
      const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
        headers: {
          'User-Agent': 'test-agent',
          Authorization: 'Bearer wrong-token',
        },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.message, 'Bad credentials');
    });

    it('should retrieve branch HEAD SHA with valid headers', async () => {
      const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
        headers: {
          'User-Agent': 'test-agent',
          Authorization: 'Bearer mock-gh-token',
          Accept: 'application/vnd.github+json',
        },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-github-api-version'), '2022-11-28');
      assert.ok(res.headers.get('x-ratelimit-remaining'));

      const body = await res.json();
      assert.equal(body.name, testBranch);
      assert.equal(body.commit.sha, testSha);
    });

    it('should return 422 Unprocessable Entity for invalid commit SHA', async () => {
      const badSha = '0'.repeat(40);
      const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/commits/${badSha}`, {
        headers: {
          'User-Agent': 'test-agent',
          Authorization: 'Bearer mock-gh-token',
        },
      });
      assert.equal(res.status, 422);
      const body = await res.json();
      assert.match(body.message, /No commit found for SHA/);
    });

    it('should evaluate commit comparison status correctly', async () => {
      const res = await fetch(
        `${gh.url}/repos/${testOwner}/${testRepo}/compare/${testSha}...${testSha}`,
        {
          headers: {
            'User-Agent': 'test-agent',
            Authorization: 'Bearer mock-gh-token',
          },
        }
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'identical');
      assert.equal(body.ahead_by, 0);
      assert.equal(body.behind_by, 0);
    });

    it('should simulate rate limit exhaustion with 403', async () => {
      gh.setRateLimit({ remaining: 0 });
      const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
        headers: {
          'User-Agent': 'test-agent',
          Authorization: 'Bearer mock-gh-token',
        },
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.message, /API rate limit exceeded/);
      gh.setRateLimit({ remaining: 4999 }); // Reset
    });
  });

  describe('Mock Vercel Server', () => {
    /** @type {ReturnType<typeof createMockVercelServer>} */
    let vc;
    const testProjectId = 'prj_watchdog_test';
    const testProjectName = 'watchdog-test';
    const testSha = 'b'.repeat(40);

    before(async () => {
      vc = createMockVercelServer({ token: 'mock-vc-token', requireAuth: true });
      await vc.start();
      vc.setProject(testProjectId, testProjectName, {
        prodCommitSha: testSha,
        prodState: 'READY',
        teamId: 'team_test123',
      });
      vc.setDeployHook('hook_123', testProjectId, 'main');
    });

    after(async () => {
      await vc.close();
    });

    it('should reject unauthenticated requests with 403 missingToken', async () => {
      const res = await fetch(`${vc.url}/v6/deployments?projectId=${testProjectId}`);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.missingToken, true);
    });

    it('should return 400 Bad Request on GET /v13/deployments without id', async () => {
      const res = await fetch(`${vc.url}/v13/deployments`, {
        headers: { Authorization: 'Bearer mock-vc-token' },
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'bad_request');
    });

    it('should query production deployments matching project and teamId', async () => {
      const res = await fetch(
        `${vc.url}/v6/deployments?projectId=${testProjectId}&target=production&state=READY&teamId=team_test123`,
        {
          headers: { Authorization: 'Bearer mock-vc-token' },
        }
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.deployments));
      assert.equal(body.deployments.length, 1);
      assert.equal(body.deployments[0].meta.githubCommitSha, testSha);
    });

    it('should query project metadata via /v9/projects/:id', async () => {
      const res = await fetch(`${vc.url}/v9/projects/${testProjectId}?teamId=team_test123`, {
        headers: { Authorization: 'Bearer mock-vc-token' },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.id, testProjectId);
      assert.equal(body.targets.production.meta.githubCommitSha, testSha);
    });

    it('should trigger deploy hook via POST without bearer token', async () => {
      const res = await fetch(`${vc.url}/v1/integrations/deploy/hook_123`, {
        method: 'POST',
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.job.state, 'QUEUED');
    });

    it('should simulate polling transition from BUILDING to READY', async () => {
      const inFlightUid = 'dpl_inflight_test';
      const newSha = 'c'.repeat(40);
      vc.addDeployment({
        uid: inFlightUid,
        projectId: testProjectId,
        state: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: newSha },
      });

      vc.queueTransition({
        deploymentId: inFlightUid,
        targetState: 'READY',
        targetSha: newSha,
        triggerAfterPolls: 1,
      });

      // Poll 1: triggers transition
      const poll1 = await fetch(
        `${vc.url}/v6/deployments?projectId=${testProjectId}&target=production&teamId=team_test123`,
        { headers: { Authorization: 'Bearer mock-vc-token' } }
      );
      const body1 = await poll1.json();
      const dpl1 = body1.deployments.find((d) => d.uid === inFlightUid);
      assert.equal(dpl1.state, 'READY');
      assert.equal(dpl1.meta.githubCommitSha, newSha);
    });
  });

  describe('Mock Git Sandbox', () => {
    /** @type {ReturnType<typeof createMockGitRepo>} */
    let repo;

    before(() => {
      repo = createMockGitRepo({ branch: 'main', initialCommit: true });
    });

    after(() => {
      repo.cleanup();
    });

    it('should initialize clean git repo on branch main', () => {
      assert.equal(repo.getBranch(), 'main');
      assert.equal(repo.isClean(), true);
      const head = repo.getHeadCommit();
      assert.match(head, /^[0-9a-f]{40}$/);
    });

    it('should create new commits and advance HEAD', () => {
      const prevHead = repo.getHeadCommit();
      const newSha = repo.commitFile('test.txt', 'hello world', 'feat: add test file');
      assert.notEqual(newSha, prevHead);
      assert.equal(repo.getHeadCommit(), newSha);
      assert.equal(repo.isClean(), true);
    });

    it('should detect dirty untracked and unstaged files', () => {
      repo.createDirtyFile('untracked.txt', 'some content');
      assert.equal(repo.isClean(), false);
      const status = repo.getPorcelainStatus();
      assert.match(status, /\?\? untracked\.txt/);
    });

    it('should support bare upstream origin and local offline push', () => {
      const cleanRepo = createMockGitRepo({ branch: 'main', initialCommit: true });
      try {
        const { simulatedRemoteUrl } = cleanRepo.setupBareOrigin({
          owner: 'test-org',
          repo: 'test-repo',
        });
        assert.match(simulatedRemoteUrl, /github\.com\/test-org\/test-repo\.git/);

        // Commit file and push
        const newCommit = cleanRepo.commitFile('pushed.txt', 'pushed', 'feat: pushed commit');
        cleanRepo.exec('push origin main');

        assert.equal(cleanRepo.getBareOriginHead('main'), newCommit);
      } finally {
        cleanRepo.cleanup();
      }
    });
  });
});
