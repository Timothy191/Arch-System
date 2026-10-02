// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateDrift,
  formatDriftReport,
  triggerGitPush,
  triggerVercelDeploy,
  pollVercelDeploymentConvergence,
  resolveDrift,
  reconcileDrift,
  IN_FLIGHT_STATES,
} from '../../src/drift-engine.mjs';

import {
  UncommittedChangesError,
  GitError,
  TimeoutError,
  VercelApiError,
  VercelAuthError,
  VercelProjectNotFoundError,
} from '../../src/errors.mjs';

describe('Unit: Drift Resolution Engine (Tri-State Drift Matrix & Remediation)', () => {
  const sha1 = '1111111111111111111111111111111111111111';
  const sha2 = '2222222222222222222222222222222222222222';
  const sha3 = '3333333333333333333333333333333333333333';

  describe('evaluateDrift', () => {
    it('evaluates perfect tri-state parity (Zero Drift)', () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha1,
          branch: 'main',
          statusWithLocal: 'identical',
          localAheadBy: 0,
          localBehindBy: 0,
        },
        { commit: sha1, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' },
        { repository: 'plantcor/arch-system', vercelProject: 'arch-system' }
      );

      assert.equal(report.drift.hasDrift, false);
      assert.equal(report.drift.localAhead, false);
      assert.equal(report.drift.localBehind, false);
      assert.equal(report.drift.vercelBehind, false);
      assert.equal(report.drift.dirtyWorkingTree, false);
      assert.equal(report.drift.isDirty, false);
      assert.equal(report.drift.diverged, false);
      assert.equal(report.drift.inFlight, false);
      assert.equal(report.resolved, true);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /zero drift/i);
    });

    it('evaluates local ahead (Local > GitHub == Vercel)', () => {
      const report = evaluateDrift(
        { commit: sha2, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha1,
          branch: 'main',
          statusWithLocal: 'ahead',
          localAheadBy: 1,
          localBehindBy: 0,
        },
        { commit: sha1, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.localAhead, true);
      assert.equal(report.drift.githubBehind, true);
      assert.equal(report.drift.vercelBehind, false);
      assert.equal(report.resolved, false);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /local ahead/i);
      assert.match(formatted, /ahead/i);
    });

    it('evaluates vercel behind (Local == GitHub > Vercel)', () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha1,
          branch: 'main',
          statusWithLocal: 'identical',
          localAheadBy: 0,
          localBehindBy: 0,
        },
        { commit: sha2, deploymentId: 'dpl_old', url: 'app.vercel.app', state: 'READY' }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.localAhead, false);
      assert.equal(report.drift.vercelBehind, true);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /vercel behind/i);
    });

    it('evaluates multi-tier cascading drift (Local > GitHub > Vercel)', () => {
      const report = evaluateDrift(
        { commit: sha3, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha2,
          branch: 'main',
          statusWithLocal: 'ahead',
          localAheadBy: 1,
          localBehindBy: 0,
        },
        { commit: sha1, deploymentId: 'dpl_ancient', url: 'app.vercel.app', state: 'READY' }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.localAhead, true);
      assert.equal(report.drift.vercelBehind, true);
    });

    it('evaluates in-flight deployment active on GitHub commit', () => {
      const report = evaluateDrift(
        { commit: sha2, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha2,
          branch: 'main',
          statusWithLocal: 'identical',
          localAheadBy: 0,
          localBehindBy: 0,
        },
        {
          commit: sha1,
          deploymentId: 'dpl_prev',
          url: 'app.vercel.app',
          state: 'BUILDING',
          inFlightCommit: sha2,
        }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.inFlight, true);
      assert.equal(report.state.vercel.inFlightCommit, sha2);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /in-flight|building|in progress/i);
    });

    it('evaluates diverged branches (ahead > 0 && behind > 0)', () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha2,
          branch: 'main',
          statusWithLocal: 'diverged',
          localAheadBy: 2,
          localBehindBy: 3,
        },
        { commit: sha2, deploymentId: 'dpl_div', url: 'app.vercel.app', state: 'READY' }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.diverged, true);
      assert.equal(report.drift.localAhead, false);
      assert.equal(report.drift.localBehind, false);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /diverged/i);
    });

    it('evaluates local behind remote (Local < GitHub)', () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha2,
          branch: 'main',
          statusWithLocal: 'behind',
          localAheadBy: 0,
          localBehindBy: 1,
        },
        { commit: sha2, deploymentId: 'dpl_ahead', url: 'app.vercel.app', state: 'READY' }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.localBehind, true);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /behind|pull/i);
    });

    it('evaluates dirty working tree even when commits match', () => {
      const report = evaluateDrift(
        {
          commit: sha1,
          branch: 'main',
          isClean: false,
          uncommittedFiles: ['src/app.mjs'],
          isDetached: false,
        },
        {
          commit: sha1,
          branch: 'main',
          statusWithLocal: 'identical',
          localAheadBy: 0,
          localBehindBy: 0,
        },
        { commit: sha1, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
      );

      assert.equal(report.drift.hasDrift, true);
      assert.equal(report.drift.dirtyWorkingTree, true);
      assert.equal(report.drift.isDirty, true);

      const formatted = formatDriftReport(report);
      assert.match(formatted, /dirty|uncommitted/i);
    });

    it('handles null/undefined inputs with defensive defaults', () => {
      const report = evaluateDrift(null, null, null);
      assert.ok(report.timestamp);
      assert.ok(report.target);
      assert.ok(report.state);
      assert.ok(report.drift);
      assert.equal(typeof report.drift.hasDrift, 'boolean');
    });

    it('accepts targetContext passed as direct target or nested target', () => {
      const rep1 = evaluateDrift(null, null, null, { directory: '/foo/bar', branch: 'feat/test' });
      assert.equal(rep1.target.directory, '/foo/bar');
      assert.equal(rep1.target.branch, 'feat/test');

      const rep2 = evaluateDrift(null, null, null, {
        target: { directory: '/baz/qux', branch: 'release/1.0' },
      });
      assert.equal(rep2.target.directory, '/baz/qux');
      assert.equal(rep2.target.branch, 'release/1.0');
    });
  });

  describe('triggerGitPush', () => {
    it('throws UncommittedChangesError when working tree is dirty', async () => {
      await assert.rejects(
        async () =>
          triggerGitPush({
            branch: 'main',
            isClean: false,
            uncommittedFiles: ['modified.js'],
          }),
        (err) => err instanceof UncommittedChangesError && err.uncommittedFiles.length === 1
      );
    });

    it('throws GitError when branch is detached HEAD', async () => {
      await assert.rejects(
        async () =>
          triggerGitPush({
            branch: 'HEAD',
            isClean: true,
            isDetached: true,
          }),
        (err) => err instanceof GitError && err.code === 'ERR_GIT_DETACHED_HEAD'
      );
    });

    it('executes git push when clean and on a valid branch', async () => {
      let executedArgs = null;
      const execFn = (cmd) => {
        executedArgs = cmd;
        return '';
      };
      const res = await triggerGitPush(
        { branch: 'feature/v1', isClean: true, uncommittedFiles: [], isDetached: false },
        { execFn, skipCleanCheck: true }
      );
      assert.equal(res.pushed, true);
      assert.ok(executedArgs.includes('push'));
      assert.ok(executedArgs.includes('feature/v1'));
    });
  });

  describe('triggerVercelDeploy', () => {
    it('triggers deploy hook with POST without Authorization header', async () => {
      let interceptedHeaders = null;
      let interceptedMethod = '';
      const fetchImpl = async (url, init) => {
        interceptedMethod = init?.method ?? 'GET';
        interceptedHeaders = init?.headers ?? {};
        return {
          ok: true,
          json: async () => ({ job: { id: 'job_deploy_1', state: 'QUEUED' } }),
        };
      };

      const res = await triggerVercelDeploy(
        {
          projectId: 'prj_test',
          deployHookUrl: 'https://api.vercel.com/v1/integrations/deploy/hook123',
        },
        { fetchImpl }
      );

      assert.equal(res.triggered, true);
      assert.equal(res.method, 'deploy_hook');
      assert.equal(interceptedMethod, 'POST');
      assert.equal(
        interceptedHeaders.Authorization,
        undefined,
        'Must NOT send Authorization header to Deploy Hook'
      );
    });

    it('triggers REST API with Bearer token and teamId when hook URL is missing', async () => {
      let interceptedUrl = '';
      let interceptedHeaders = null;
      let interceptedBody = null;

      const fetchImpl = async (url, init) => {
        interceptedUrl = String(url);
        interceptedHeaders = init?.headers ?? {};
        interceptedBody = JSON.parse(init?.body ?? '{}');
        return {
          ok: true,
          json: async () => ({ id: 'dpl_rest_123', readyState: 'BUILDING' }),
        };
      };

      const res = await triggerVercelDeploy(
        {
          projectId: 'prj_arch_system',
          teamId: 'team_plantcor',
          token: 'vc_token_test',
          branch: 'main',
          commitSha: sha1,
        },
        { fetchImpl }
      );

      assert.equal(res.triggered, true);
      assert.equal(res.method, 'rest_api');
      assert.ok(interceptedUrl.includes('teamId=team_plantcor'));
      assert.equal(interceptedHeaders.Authorization, 'Bearer vc_token_test');
      assert.equal(interceptedBody.gitSource?.sha, sha1);
    });

    it('throws VercelApiError when neither hook nor token is configured', async () => {
      await assert.rejects(
        async () =>
          triggerVercelDeploy({ projectId: 'prj_test' }, { allowCliFallback: false, token: '' }),
        (err) => err instanceof VercelApiError && err.code === 'ERR_VERCEL_NO_TRIGGER_METHOD'
      );
    });
  });

  describe('pollVercelDeploymentConvergence', () => {
    it('returns converged immediately when active deployment is READY on target commit', async () => {
      const fetchImpl = async () => ({
        ok: true,
        json: async () => ({
          deployments: [
            {
              id: 'dpl_ready',
              state: 'READY',
              readyState: 'READY',
              target: 'production',
              meta: { githubCommitSha: sha1 },
            },
          ],
        }),
      });

      const res = await pollVercelDeploymentConvergence(
        sha1,
        {
          projectId: 'prj_test',
          token: 'vc_token',
        },
        {
          fetchImpl,
          pollIntervalMs: 10,
          pollTimeoutMs: 500,
        }
      );

      assert.equal(res.converged, true);
      assert.equal(res.pollCount, 1);
      assert.equal(res.deploymentState.commit, sha1);
    });

    it('aborts and throws VercelApiError on deployment ERROR state', async () => {
      const fetchImpl = async () => ({
        ok: true,
        json: async () => ({
          deployments: [
            {
              id: 'dpl_error',
              state: 'ERROR',
              readyState: 'ERROR',
              target: 'production',
              meta: { githubCommitSha: sha1 },
            },
          ],
        }),
      });

      await assert.rejects(
        async () =>
          pollVercelDeploymentConvergence(
            sha1,
            {
              projectId: 'prj_test',
              token: 'vc_token',
            },
            {
              fetchImpl,
              pollIntervalMs: 10,
              pollTimeoutMs: 500,
            }
          ),
        (err) => err instanceof VercelApiError && err.exitCode === 2
      );
    });

    it('throws TimeoutError with exitCode 1 when polling budget is exceeded', async () => {
      const fetchImpl = async () => ({
        ok: true,
        json: async () => ({
          deployments: [
            {
              id: 'dpl_stuck',
              state: 'BUILDING',
              readyState: 'BUILDING',
              target: 'production',
              meta: { githubCommitSha: sha1 },
            },
          ],
        }),
      });

      await assert.rejects(
        async () =>
          pollVercelDeploymentConvergence(
            sha1,
            {
              projectId: 'prj_test',
              token: 'vc_token',
            },
            {
              fetchImpl,
              pollIntervalMs: 10,
              pollTimeoutMs: 50,
            }
          ),
        (err) => err instanceof TimeoutError && err.exitCode === 1
      );
    });
  });

  describe('resolveDrift', () => {
    it('returns resolved true immediately when no drift is present', async () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha1,
          branch: 'main',
          statusWithLocal: 'identical',
          localAheadBy: 0,
          localBehindBy: 0,
        },
        { commit: sha1, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
      );

      const resolved = await resolveDrift(report);
      assert.equal(resolved.resolved, true);
      assert.ok(resolved.actionsTaken.length > 0);
    });

    it('refuses to resolve and throws UncommittedChangesError when working tree is dirty', async () => {
      const report = evaluateDrift(
        {
          commit: sha1,
          branch: 'main',
          isClean: false,
          uncommittedFiles: ['dirty.txt'],
          isDetached: false,
        },
        {
          commit: sha1,
          branch: 'main',
          statusWithLocal: 'identical',
          localAheadBy: 0,
          localBehindBy: 0,
        },
        { commit: sha1, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
      );

      await assert.rejects(
        async () => resolveDrift(report),
        (err) => err instanceof UncommittedChangesError
      );
    });

    it('refuses to resolve and throws GitError when repositories have diverged', async () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha2,
          branch: 'main',
          statusWithLocal: 'diverged',
          localAheadBy: 1,
          localBehindBy: 2,
        },
        { commit: sha2, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
      );

      await assert.rejects(
        async () => resolveDrift(report),
        (err) => err instanceof GitError && err.code === 'ERR_GIT_DIVERGED' && err.exitCode === 1
      );
    });

    it('refuses to resolve and throws GitError when local is behind remote', async () => {
      const report = evaluateDrift(
        { commit: sha1, branch: 'main', isClean: true, uncommittedFiles: [], isDetached: false },
        {
          commit: sha2,
          branch: 'main',
          statusWithLocal: 'behind',
          localAheadBy: 0,
          localBehindBy: 1,
        },
        { commit: sha2, deploymentId: 'dpl_1', url: 'app.vercel.app', state: 'READY' }
      );

      await assert.rejects(
        async () => resolveDrift(report),
        (err) =>
          err instanceof GitError && err.code === 'ERR_GIT_LOCAL_BEHIND' && err.exitCode === 1
      );
    });
  });
});
