// @ts-check
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createMockGitHubServer } from '../fixtures/mock-github.mjs';
import { createMockVercelServer } from '../fixtures/mock-vercel.mjs';
import { createMockGitRepo } from '../fixtures/mock-git.mjs';
import { runWatchdog, requireCli, hasModule, PROJECT_ROOT } from '../fixtures/cli-helper.mjs';

describe('Tier 4: Real-World Scenarios (End-to-End Operational Lifecycle)', () => {
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

  // T4.1: Clean Parity Happy Path Run
  it('T4.1: Clean Parity Run -> audits in-sync environment, logs zero drift, exits 0', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const commitSha = repo.getHeadCommit();
      gh.setBranch(testOwner, testRepo, testBranch, commitSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: commitSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

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
        assert.equal(res.status, 0, 'Must exit with 0 on zero drift');
        assert.match(res.stdout, /zero drift/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T4.2: Automated Push Resolution
  it('T4.2: Automated Push Resolution -> detects local ahead, pushes to origin, confirms parity', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const baseSha = repo.getHeadCommit();
      repo.setupBareOrigin({ owner: testOwner, repo: testRepo });

      // Create new commit locally
      const newSha = repo.commitFile('update.txt', 'new code', 'feat: update feature');

      // GitHub and Vercel are still on baseSha
      gh.setBranch(testOwner, testRepo, testBranch, baseSha);
      gh.setCompare(testOwner, testRepo, baseSha, newSha, {
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
      });
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: newSha, // Vercel already deployed or simulated matching
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      if (requireCli(t)) {
        const res = await runWatchdog(
          ['--dir', repo.dir, '--project', testProjectId, '--team', 'team_plantcor', '--fix'],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
            },
          }
        );
        assert.equal(res.status, 0, 'Must exit with 0 after successful push fix');
        // Verify bare origin received the new commit
        assert.equal(repo.getBareOriginHead(testBranch), newSha);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T4.3: Automated Deploy Resolution via Deploy Hook
  it('T4.3: Automated Deploy Resolution -> triggers deploy webhook, polls until READY, confirms parity', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const targetSha = repo.getHeadCommit();
      const staleSha = 'stale00000000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, targetSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: staleSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });
      vc.setDeployHook('hook_auto_deploy', testProjectId, testBranch);

      // Queue promotion to READY on polling
      vc.queueTransition({
        deploymentId: `dpl_${testRepo}_prod`,
        targetState: 'READY',
        targetSha,
        triggerAfterPolls: 1,
      });

      if (requireCli(t)) {
        const hookUrl = `${vc.url}/v1/integrations/deploy/hook_auto_deploy`;
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--fix',
            '--poll-timeout',
            '10',
            '--poll-interval',
            '1',
          ],
          {
            env: {
              GITHUB_TOKEN: 'mock-gh-token',
              GITHUB_API_URL: gh.url,
              VERCEL_TOKEN: 'mock-vc-token',
              VERCEL_API_URL: vc.url,
              VERCEL_DEPLOY_HOOK_URL: hookUrl,
            },
          }
        );
        assert.equal(res.status, 0, 'Must exit with 0 after deploy resolution');
      }
    } finally {
      repo.cleanup();
    }
  });

  // T4.4: In-Flight Wait & Auto-Resolution
  it('T4.4: In-Flight Wait & Resolution -> polls active build without re-triggering, exits 0 on READY', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const targetSha = repo.getHeadCommit();
      const prevSha = 'prev000000000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, targetSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: prevSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      const inFlightUid = 'dpl_inflight_t44';
      vc.addDeployment({
        uid: inFlightUid,
        projectId: testProjectId,
        state: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: targetSha },
      });

      // Transition to READY after 1 poll
      vc.queueTransition({
        deploymentId: inFlightUid,
        targetState: 'READY',
        targetSha,
        triggerAfterPolls: 1,
      });

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--fix',
            '--poll-timeout',
            '10',
            '--poll-interval',
            '1',
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
      }
    } finally {
      repo.cleanup();
    }
  });

  // T4.5: Deployment Polling Timeout
  it('T4.5: Deployment Timeout -> exits with code 1 if deployment exceeds poll timeout', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const targetSha = repo.getHeadCommit();
      const prevSha = 'prev000000000000000000000000000000000000';

      gh.setBranch(testOwner, testRepo, testBranch, targetSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: prevSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });
      // Deployment stays stuck in BUILDING (no transition queued)
      vc.addDeployment({
        uid: 'dpl_stuck',
        projectId: testProjectId,
        state: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: targetSha },
      });

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--fix',
            '--poll-timeout',
            '1', // 1 second timeout
            '--poll-interval',
            '1',
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
        assert.equal(res.status, 1, 'Must exit with 1 on deployment timeout');
        assert.match(res.stderr + res.stdout, /timeout|timed out/i);
      }
    } finally {
      repo.cleanup();
    }
  });

  // T4.6: Machine-Readable JSON Output Fidelity
  it('T4.6: JSON Output Fidelity -> --json produces valid JSON conforming to DriftReport contract', async (t) => {
    const repo = createMockGitRepo({ branch: testBranch, initialCommit: true });
    try {
      const commitSha = repo.getHeadCommit();
      gh.setBranch(testOwner, testRepo, testBranch, commitSha);
      vc.setProject(testProjectId, testRepo, {
        prodCommitSha: commitSha,
        prodState: 'READY',
        teamId: 'team_plantcor',
      });

      if (requireCli(t)) {
        const res = await runWatchdog(
          [
            '--dir',
            repo.dir,
            '--project',
            testProjectId,
            '--team',
            'team_plantcor',
            '--json',
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
        assert.ok(res.json, 'Output must be parseable JSON');
        assert.ok(res.json.timestamp);
        assert.ok(res.json.target);
        assert.ok(res.json.state);
        assert.ok(res.json.state.local);
        assert.ok(res.json.state.github);
        assert.ok(res.json.state.vercel);
        assert.ok(res.json.drift);
        assert.equal(typeof res.json.drift.hasDrift, 'boolean');
        assert.equal(res.json.drift.hasDrift, false);
      }
    } finally {
      repo.cleanup();
    }
  });
});
