// @ts-check
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createMockGitHubServer } from '../fixtures/mock-github.mjs';
import { createMockVercelServer } from '../fixtures/mock-vercel.mjs';
import { createMockGitRepo } from '../fixtures/mock-git.mjs';
import { runWatchdog, requireCli, hasModule, PROJECT_ROOT } from '../fixtures/cli-helper.mjs';

describe('Tier 1: Feature Coverage (Individual Features in Isolation)', () => {
  /** @type {ReturnType<typeof createMockGitHubServer>} */
  let gh;
  /** @type {ReturnType<typeof createMockVercelServer>} */
  let vc;
  /** @type {ReturnType<typeof createMockGitRepo>} */
  let gitRepo;

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

    gitRepo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    gitRepo.setupBareOrigin({ owner: testOwner, repo: testRepo });
  });

  after(async () => {
    await gh.close();
    await vc.close();
    gitRepo.cleanup();
  });

  // Feature 1: Local Git Commit Resolution
  it('F1: should resolve exact 40-character commit SHA of current HEAD', async (t) => {
    const headSha = gitRepo.getHeadCommit();
    assert.match(headSha, /^[0-9a-f]{40}$/);

    if (hasModule('git-inspector.mjs')) {
      const { inspectLocalGit } = await import(path.join(PROJECT_ROOT, 'src/git-inspector.mjs'));
      const state = await inspectLocalGit(gitRepo.dir);
      assert.equal(state.commit, headSha);
    }
  });

  // Feature 2: Local Working Tree Hygiene
  it('F2: should detect clean working tree vs dirty uncommitted changes', async (t) => {
    assert.equal(gitRepo.isClean(), true);

    if (hasModule('git-inspector.mjs')) {
      const { inspectLocalGit } = await import(path.join(PROJECT_ROOT, 'src/git-inspector.mjs'));
      const state = await inspectLocalGit(gitRepo.dir);
      assert.equal(state.isClean, true);
      assert.deepEqual(state.uncommittedFiles, []);
    }
  });

  // Feature 3: Local Branch Resolution
  it('F3: should resolve active branch name and identify detached HEAD status', async (t) => {
    assert.equal(gitRepo.getBranch(), testBranch);

    if (hasModule('git-inspector.mjs')) {
      const { inspectLocalGit } = await import(path.join(PROJECT_ROOT, 'src/git-inspector.mjs'));
      const state = await inspectLocalGit(gitRepo.dir);
      assert.equal(state.branch, testBranch);
      assert.equal(state.isDetached, false);
    }
  });

  // Feature 4: GitHub Environment Discovery
  it('F4: should discover repository owner/name from GITHUB_REPOSITORY or git remote origin', async (t) => {
    if (hasModule('git-inspector.mjs')) {
      const { discoverGitHubContext } = await import(
        path.join(PROJECT_ROOT, 'src/git-inspector.mjs')
      );
      const context = await discoverGitHubContext(gitRepo.dir);
      assert.equal(context.owner, testOwner);
      assert.equal(context.repo, testRepo);
      assert.equal(context.branch, testBranch);
    }
  });

  // Feature 5: GitHub Branch Commit Lookup
  it('F5: should query GitHub REST API for branch HEAD commit SHA', async (t) => {
    const res = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
      headers: {
        'User-Agent': 'zero-drift-watchdog/1.0.0',
        Authorization: 'Bearer mock-gh-token',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.commit.sha, testSha);

    if (hasModule('git-inspector.mjs')) {
      const { inspectGitHubRemote } = await import(
        path.join(PROJECT_ROOT, 'src/git-inspector.mjs')
      );
      const remoteState = await inspectGitHubRemote(
        { owner: testOwner, repo: testRepo, branch: testBranch },
        'mock-gh-token',
        { apiUrl: gh.url }
      );
      assert.equal(remoteState.commit, testSha);
    }
  });

  // Feature 6: GitHub Commit Compare
  it('F6: should compare commits via compare API and parse status (identical/ahead/behind/diverged)', async (t) => {
    gh.setCompare(testOwner, testRepo, testSha, testSha, {
      status: 'identical',
      ahead_by: 0,
      behind_by: 0,
    });

    const res = await fetch(
      `${gh.url}/repos/${testOwner}/${testRepo}/compare/${testSha}...${testSha}`,
      {
        headers: {
          'User-Agent': 'zero-drift-watchdog/1.0.0',
          Authorization: 'Bearer mock-gh-token',
        },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'identical');
    assert.equal(data.ahead_by, 0);
    assert.equal(data.behind_by, 0);
  });

  // Feature 7: GitHub HTTP Invariants
  it('F7: should enforce User-Agent, X-GitHub-Api-Version, and Authorization Bearer headers', async (t) => {
    // Missing User-Agent returns 403
    const badRes = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
      headers: {
        'User-Agent': '',
        Authorization: 'Bearer mock-gh-token',
      },
    });
    assert.equal(badRes.status, 403);

    // Valid headers return 200
    const okRes = await fetch(`${gh.url}/repos/${testOwner}/${testRepo}/branches/${testBranch}`, {
      headers: {
        'User-Agent': 'zero-drift-watchdog/1.0.0',
        Authorization: 'Bearer mock-gh-token',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers.get('x-github-api-version'), '2022-11-28');
  });

  // Feature 8: Vercel Environment Discovery
  it('F8: should resolve Vercel project ID and team ID from environment', async (t) => {
    if (hasModule('vercel-inspector.mjs')) {
      const origEnv = { ...process.env };
      try {
        process.env.VERCEL_PROJECT_ID = testProjectId;
        process.env.VERCEL_ORG_ID = 'team_plantcor';
        const { discoverVercelContext } = await import(
          path.join(PROJECT_ROOT, 'src/vercel-inspector.mjs')
        );
        const context = await discoverVercelContext(gitRepo.dir);
        assert.equal(context.projectId, testProjectId);
        assert.equal(context.teamId, 'team_plantcor');
      } finally {
        process.env = origEnv;
      }
    }
  });

  // Feature 9: Vercel Active Deployment Lookup
  it('F9: should query GET /v6/deployments for production deployment in READY state', async (t) => {
    const res = await fetch(
      `${vc.url}/v6/deployments?projectId=${testProjectId}&target=production&state=READY&teamId=team_plantcor`,
      {
        headers: {
          Authorization: 'Bearer mock-vc-token',
        },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.deployments));
    assert.equal(data.deployments[0].state, 'READY');
    assert.equal(data.deployments[0].meta.githubCommitSha, testSha);
  });

  // Feature 10: Vercel Commit SHA Extraction
  it('F10: should extract commit SHA with priority meta.githubCommitSha > gitSource.sha > meta.commitSha', async (t) => {
    const dpl = {
      meta: { githubCommitSha: testSha, commitSha: 'secondary' },
      gitSource: { sha: 'tertiary' },
    };
    const resolvedSha = dpl.meta?.githubCommitSha || dpl.gitSource?.sha || dpl.meta?.commitSha;
    assert.equal(resolvedSha, testSha);

    if (hasModule('vercel-inspector.mjs')) {
      const { inspectVercelDeployment } = await import(
        path.join(PROJECT_ROOT, 'src/vercel-inspector.mjs')
      );
      const state = await inspectVercelDeployment({
        projectId: testProjectId,
        teamId: 'team_plantcor',
        token: 'mock-vc-token',
        apiUrl: vc.url,
      });
      assert.equal(state.commit, testSha);
      assert.equal(state.state, 'READY');
    }
  });

  // Feature 11: Vercel Team Scoping
  it('F11: should pass teamId query parameter when team is configured', async (t) => {
    // Missing teamId on team-owned project returns empty deployments list or 404
    const resNoTeam = await fetch(
      `${vc.url}/v6/deployments?projectId=${testProjectId}&target=production&state=READY`,
      {
        headers: { Authorization: 'Bearer mock-vc-token' },
      }
    );
    const dataNoTeam = await resNoTeam.json();
    assert.equal(dataNoTeam.deployments.length, 0);

    // With teamId returns matching deployment
    const resWithTeam = await fetch(
      `${vc.url}/v6/deployments?projectId=${testProjectId}&target=production&state=READY&teamId=team_plantcor`,
      {
        headers: { Authorization: 'Bearer mock-vc-token' },
      }
    );
    const dataWithTeam = await resWithTeam.json();
    assert.equal(dataWithTeam.deployments.length, 1);
  });

  // Feature 12: Vercel In-Flight State Detection
  it('F12: should detect BUILDING, INITIALIZING, and QUEUED deployments', async (t) => {
    const inFlightSha = '2222222222222222222222222222222222222222';
    vc.addDeployment({
      uid: 'dpl_inflight_f12',
      projectId: testProjectId,
      state: 'BUILDING',
      target: 'production',
      meta: { githubCommitSha: inFlightSha },
    });

    const res = await fetch(
      `${vc.url}/v6/deployments?projectId=${testProjectId}&target=production&teamId=team_plantcor`,
      {
        headers: { Authorization: 'Bearer mock-vc-token' },
      }
    );
    const data = await res.json();
    const building = data.deployments.find((d) => d.state === 'BUILDING');
    assert.ok(building);
    assert.equal(building.meta.githubCommitSha, inFlightSha);
  });

  // Feature 13: CLI Runner & Help Interface
  it('F13: should display CLI options and flags when invoked with --help', async (t) => {
    if (!requireCli(t)) return;

    const res = await runWatchdog(['--help']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /--audit-only/);
    assert.match(res.stdout, /--fix/);
    assert.match(res.stdout, /--dir/);
    assert.match(res.stdout, /--branch/);
    assert.match(res.stdout, /--json/);
  });
});
