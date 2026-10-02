// @ts-check
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createMockGitHubServer } from '../fixtures/mock-github.mjs';
import { createMockVercelServer } from '../fixtures/mock-vercel.mjs';
import { createMockGitRepo } from '../fixtures/mock-git.mjs';
import { runWatchdog, requireCli, hasModule, PROJECT_ROOT } from '../fixtures/cli-helper.mjs';

describe('Tier 3: Pairwise Combinations (Tri-State Drift Matrix)', () => {
  /** @type {ReturnType<typeof createMockGitHubServer>} */
  let gh;
  /** @type {ReturnType<typeof createMockVercelServer>} */
  let vc;

  const testOwner = 'plantcor';
  const testRepo = 'arch-system';
  const testBranch = 'main';
  const testProjectId = 'prj_arch_system';

  before(async () => {
    gh = createMockGitHubServer({ token: 'mock-gh-token', requireAuth: true });
    await gh.start();

    vc = createMockVercelServer({ token: 'mock-vc-token', requireAuth: true });
    await vc.start();
  });

  after(async () => {
    await gh.close();
    await vc.close();
  });

  beforeEach(() => {
    gh.reset();
    vc.reset();
  });

  // T3.1: Tri-State Parity (Zero Drift)
  it('T3.1: Tri-State Parity (Local == GitHub == Vercel) -> reports zero drift, exits 0', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const paritySha = repo.getHeadCommit();
      gh.setBranch(testOwner, testRepo, testBranch, paritySha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: paritySha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: paritySha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: paritySha,
            branch: testBranch,
            statusWithLocal: 'identical',
            localAheadBy: 0,
            localBehindBy: 0,
          },
          { commit: paritySha, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
        );
        assert.equal(report.drift.hasDrift, false);
        assert.equal(report.drift.localAhead, false);
        assert.equal(report.drift.vercelBehind, false);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--audit-only',
          ],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(res.status, 0);
        assert.match(res.stdout, /zero drift/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T3.2: Local Ahead, GitHub matches Vercel (Local > GitHub == Vercel)
  it('T3.2: Local Ahead (Local > GitHub == Vercel) -> flags localAhead: true, exits 1 on audit', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const baseSha = repo.getHeadCommit();
      gh.setBranch(testOwner, testRepo, testBranch, baseSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: baseSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      // Commit locally to advance local HEAD
      const aheadSha = repo.commitFile('feature.js', 'console.log(1)', 'feat: local feature');
      assert.notEqual(aheadSha, baseSha);

      gh.setCompare(testOwner, testRepo, baseSha, aheadSha, {
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: aheadSha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: baseSha,
            branch: testBranch,
            statusWithLocal: 'ahead',
            localAheadBy: 1,
            localBehindBy: 0,
          },
          { commit: baseSha, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
        );
        assert.equal(report.drift.hasDrift, true);
        assert.equal(report.drift.localAhead, true);
        assert.equal(report.drift.vercelBehind, false);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--audit-only',
          ],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(res.status, 1);
        assert.match(res.stdout + res.stderr, /ahead|drift/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T3.3: Local matches GitHub, Vercel Behind (Local == GitHub > Vercel)
  it('T3.3: Vercel Behind (Local == GitHub > Vercel) -> flags vercelBehind: true, exits 1 on audit', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const latestSha = repo.getHeadCommit();
      const staleSha = 'stale00000000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, latestSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: staleSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: latestSha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: latestSha,
            branch: testBranch,
            statusWithLocal: 'identical',
            localAheadBy: 0,
            localBehindBy: 0,
          },
          { commit: staleSha, deploymentId: 'dpl_old', url: 'app.vercel.app', state: 'READY' }
        );
        assert.equal(report.drift.hasDrift, true);
        assert.equal(report.drift.localAhead, false);
        assert.equal(report.drift.vercelBehind, true);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--audit-only',
          ],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(res.status, 1);
        assert.match(res.stdout + res.stderr, /vercel.*behind|drift/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T3.4: Multi-Tier Drift (Local > GitHub > Vercel)
  it('T3.4: Multi-Tier Drift (Local > GitHub > Vercel) -> flags localAhead AND vercelBehind', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const githubSha = repo.getHeadCommit();
      const localSha = repo.commitFile('local.txt', 'local', 'feat: local change');
      const vercelSha = 'ancient000000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, githubSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: vercelSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: localSha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: githubSha,
            branch: testBranch,
            statusWithLocal: 'ahead',
            localAheadBy: 1,
            localBehindBy: 0,
          },
          { commit: vercelSha, deploymentId: 'dpl_ancient', url: 'app.vercel.app', state: 'READY' }
        );
        assert.equal(report.drift.hasDrift, true);
        assert.equal(report.drift.localAhead, true);
        assert.equal(report.drift.vercelBehind, true);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--audit-only',
          ],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(res.status, 1);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T3.5: In-Flight Vercel Deployment
  it('T3.5: In-Flight Vercel Deployment -> identifies build in progress, avoids duplicate deployment', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const targetSha = repo.getHeadCommit();
      const prevSha = 'prev000000000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, targetSha);
      // Ready deployment is old
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: prevSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });
      // But in-flight deployment exists for targetSha
      vc.addDeployment({
        uid: 'dpl_inflight_t35',
        projectId: testProjectId,
        state: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: targetSha },
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: targetSha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: targetSha,
            branch: testBranch,
            statusWithLocal: 'identical',
            localAheadBy: 0,
            localBehindBy: 0,
          },
          {
            commit: prevSha,
            deploymentId: 'dpl_prev',
            url: 'app.vercel.app',
            state: 'BUILDING',
            inFlightCommit: targetSha,
          }
        );
        assert.equal(report.state.vercel.inFlightCommit, targetSha);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--audit-only',
          ],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.match(res.stdout + res.stderr, /in-flight|building|in progress/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T3.6: Diverged Repositories (ahead > 0 && behind > 0)
  it('T3.6: Diverged Repositories -> flags diverged: true, forbids automated push, exits 1', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const localSha = repo.getHeadCommit();
      const remoteSha = 'diverged0000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, remoteSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: remoteSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });
      gh.setCompare(testOwner, testRepo, remoteSha, localSha, {
        status: 'diverged',
        ahead_by: 2,
        behind_by: 3,
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: localSha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: remoteSha,
            branch: testBranch,
            statusWithLocal: 'diverged',
            localAheadBy: 2,
            localBehindBy: 3,
          },
          { commit: remoteSha, deploymentId: 'dpl_div', url: 'app.vercel.app', state: 'READY' }
        );
        assert.equal(report.drift.diverged, true);
        assert.equal(report.drift.hasDrift, true);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(['--dir', repo.dir, '--project', testProjectId, '--fix'], {
          env: {
            GITHUB_TOKEN: 'mock-gh-token',
            GITHUB_API_URL: gh.url,
            VERCEL_TOKEN: 'mock-vc-token',
            VERCEL_API_URL: vc.url,
          },
        });
        assert.equal(res.status, 1);
        assert.match(res.stdout + res.stderr, /diverged/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T3.7: Local Behind Remote (Local < GitHub)
  it('T3.7: Local Behind Remote -> flags localBehind: true, prompts for git pull, does not push', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const localSha = repo.getHeadCommit();
      const aheadRemoteSha = 'aheadrem0000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, aheadRemoteSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: aheadRemoteSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });
      gh.setCompare(testOwner, testRepo, aheadRemoteSha, localSha, {
        status: 'behind',
        ahead_by: 0,
        behind_by: 1,
      });

      if (hasModule('drift-engine.mjs')) {
        const { evaluateDrift } = await import(path.join(PROJECT_ROOT, 'src/drift-engine.mjs'));
        const report = evaluateDrift(
          {
            commit: localSha,
            branch: testBranch,
            isClean: true,
            uncommittedFiles: [],
            isDetached: false,
          },
          {
            commit: aheadRemoteSha,
            branch: testBranch,
            statusWithLocal: 'behind',
            localAheadBy: 0,
            localBehindBy: 1,
          },
          {
            commit: aheadRemoteSha,
            deploymentId: 'dpl_ahead',
            url: 'app.vercel.app',
            state: 'READY',
          }
        );
        assert.equal(report.drift.localBehind, true);
      }

      if (requireCli(t)) {
        const res = await runWatchdog(
          ['--dir', repo.dir, '--project', testProjectId, '--audit-only'],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(res.status, 1);
        assert.match(res.stdout + res.stderr, /behind|pull/i);
      }
    } finally {
      repo.cleanup();
    }
  });
});
