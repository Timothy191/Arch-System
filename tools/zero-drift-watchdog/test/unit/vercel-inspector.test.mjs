// @ts-check
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  discoverVercelContext,
  inspectVercelDeployment,
  extractCommitSha,
  createVercelHeaders,
  buildVercelUrl,
  getVercelCliConfigDirs,
  resolveVercelToken,
  findVercelProjectConfig,
  fetchDeployments,
  fetchProject,
  resolveDeployHookUrl,
  triggerDeployHook,
  IN_FLIGHT_STATES,
  COMMIT_SHA_REGEX,
} from '../../src/vercel-inspector.mjs';

import {
  WatchdogError,
  VercelApiError,
  VercelAuthError,
  VercelProjectNotFoundError,
  VercelRateLimitError,
} from '../../src/errors.mjs';

import { createMockVercelServer } from '../fixtures/mock-vercel.mjs';

describe('Unit: Vercel Deployment Inspector & Protocol Invariants', () => {
  /** @type {ReturnType<typeof createMockVercelServer>} */
  let vc;
  const testProjectId = 'prj_watchdog_test';
  const testTeamId = 'team_plantcor_mining';
  const testToken = 'mock-vc-token-secret';
  const readySha = '1111111111111111111111111111111111111111';
  const targetSha = '2222222222222222222222222222222222222222';

  before(async () => {
    vc = createMockVercelServer({ token: testToken, requireAuth: true });
    await vc.start();
  });

  after(async () => {
    if (vc) {
      await vc.close();
    }
  });

  beforeEach(() => {
    vc.clearErrors();
    vc.clearRequests();
    vc.setRateLimit(null);
  });

  // ==========================================
  // F8: Vercel Environment & XDG Discovery
  // ==========================================
  describe('F8: Environment Discovery & Context Resolution', () => {
    it('resolves projectId, teamId, token, and deployHookUrl from environment variables', async () => {
      const origEnv = { ...process.env };
      try {
        process.env.VERCEL_PROJECT_ID = testProjectId;
        process.env.VERCEL_ORG_ID = testTeamId;
        process.env.VERCEL_TOKEN = testToken;
        process.env.VERCEL_DEPLOY_HOOK_URL =
          'https://api.vercel.com/v1/integrations/deploy/hook_abc';

        const context = await discoverVercelContext(process.cwd());
        assert.equal(context.projectId, testProjectId);
        assert.equal(context.teamId, testTeamId);
        assert.equal(context.token, testToken);
        assert.equal(
          context.deployHookUrl,
          'https://api.vercel.com/v1/integrations/deploy/hook_abc'
        );
      } finally {
        process.env = origEnv;
      }
    });

    it('resolves context from .vercel/project.json when env variables are unset', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-vc-discovery-'));
      try {
        const vcDir = path.join(tmpDir, '.vercel');
        fs.mkdirSync(vcDir, { recursive: true });
        fs.writeFileSync(
          path.join(vcDir, 'project.json'),
          JSON.stringify({
            projectId: 'prj_from_json',
            orgId: 'team_from_json',
            projectName: 'portal-app',
          })
        );

        const origEnv = { ...process.env };
        delete process.env.VERCEL_PROJECT_ID;
        delete process.env.VERCEL_ORG_ID;

        try {
          const context = await discoverVercelContext(tmpDir);
          assert.equal(context.projectId, 'prj_from_json');
          assert.equal(context.teamId, 'team_from_json');
        } finally {
          process.env = origEnv;
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('resolves context from .vercel/repo.json for monorepos', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-vc-monorepo-'));
      try {
        const vcDir = path.join(tmpDir, '.vercel');
        fs.mkdirSync(vcDir, { recursive: true });
        fs.writeFileSync(
          path.join(vcDir, 'repo.json'),
          JSON.stringify({
            remoteName: 'origin',
            projects: [
              { id: 'prj_root', name: 'root-app', directory: '.', orgId: 'team_root' },
              { id: 'prj_sub', name: 'sub-app', directory: 'apps/portal', orgId: 'team_sub' },
            ],
          })
        );

        const subDir = path.join(tmpDir, 'apps', 'portal');
        fs.mkdirSync(subDir, { recursive: true });

        const origEnv = { ...process.env };
        delete process.env.VERCEL_PROJECT_ID;
        delete process.env.VERCEL_ORG_ID;

        try {
          const context = await discoverVercelContext(subDir);
          assert.equal(context.projectId, 'prj_sub');
          assert.equal(context.teamId, 'team_sub');
        } finally {
          process.env = origEnv;
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('resolves token and currentTeam from XDG CLI config directories', () => {
      const tmpXdg = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-xdg-'));
      try {
        const cliDir = path.join(tmpXdg, 'com.vercel.cli');
        fs.mkdirSync(cliDir, { recursive: true });
        fs.writeFileSync(
          path.join(cliDir, 'auth.json'),
          JSON.stringify({ token: 'xdg-token-value', userId: 'usr_123' })
        );
        fs.writeFileSync(
          path.join(cliDir, 'config.json'),
          JSON.stringify({ currentTeam: 'team_xdg_active' })
        );

        const fakeEnv = { XDG_DATA_HOME: tmpXdg };
        const dirs = getVercelCliConfigDirs(fakeEnv);
        assert.equal(dirs[0], cliDir);

        const token = resolveVercelToken({ env: fakeEnv });
        assert.equal(token, 'xdg-token-value');
      } finally {
        fs.rmSync(tmpXdg, { recursive: true, force: true });
      }
    });

    it('falls back to directory name if projectId is unconfigured', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-inferred-project-'));
      const origEnv = { ...process.env };
      delete process.env.VERCEL_PROJECT_ID;
      try {
        const context = await discoverVercelContext(tmpDir);
        assert.ok(context.projectId.startsWith('my-inferred-project-'));
      } finally {
        process.env = origEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('throws ERR_VERCEL_CONTEXT_NOT_FOUND when fallbackToDirName is false and project is not found', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-no-fallback-'));
      const origEnv = { ...process.env };
      delete process.env.VERCEL_PROJECT_ID;
      try {
        await assert.rejects(
          async () => discoverVercelContext(tmpDir, { fallbackToDirName: false }),
          (err) => {
            assert.ok(err instanceof VercelApiError);
            assert.equal(err.code, 'ERR_VERCEL_CONTEXT_NOT_FOUND');
            assert.equal(err.exitCode, 2);
            return true;
          }
        );
      } finally {
        process.env = origEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ==========================================
  // F9: Vercel Active Deployment Lookup
  // ==========================================
  describe('F9: Active Deployment Lookup (GET /v6/deployments)', () => {
    it('queries production deployment and extracts READY state and metadata', async () => {
      vc.setProject(testProjectId, 'watchdog-portal', {
        prodCommitSha: readySha,
        prodState: 'READY',
        teamId: testTeamId,
      });

      const state = await inspectVercelDeployment({
        projectId: testProjectId,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.commit, readySha);
      assert.equal(state.state, 'READY');
      assert.equal(state.inFlightCommit, null);
      assert.ok(state.deploymentId && state.deploymentId.startsWith('dpl_'));
      assert.ok(state.url && state.url.includes('vercel.app'));

      const reqs = vc.getRequests();
      const lastReq = reqs[reqs.length - 1];
      assert.equal(lastReq.headers['authorization'], `Bearer ${testToken}`);
      assert.match(lastReq.headers['user-agent'], /zero-drift-watchdog/);
    });

    it('returns UNKNOWN state and null commit when deployments array is empty', async () => {
      const emptyProject = 'prj_empty_no_deploys';
      vc.setProject(emptyProject, 'empty-app', { teamId: testTeamId });

      // Custom fetch that returns an empty deployments list for an existing project
      const reqMock = async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ deployments: [] }),
      });

      const state = await inspectVercelDeployment(
        { projectId: emptyProject, teamId: testTeamId, token: testToken, apiUrl: vc.url },
        { fetchImpl: /** @type {any} */ (reqMock) }
      );

      assert.equal(state.commit, null);
      assert.equal(state.state, 'UNKNOWN');
      assert.equal(state.deploymentId, null);
      assert.equal(state.inFlightCommit, null);
    });
  });

  // ==========================================
  // F10: Commit SHA Extraction Hierarchy
  // ==========================================
  describe('F10: Commit SHA Extraction Hierarchy', () => {
    it('prioritizes meta.githubCommitSha > gitSource.sha > meta.commitSha', () => {
      const allPresent = {
        meta: {
          githubCommitSha: '1111111111111111111111111111111111111111',
          commitSha: '3333333333333333333333333333333333333333',
        },
        gitSource: { sha: '2222222222222222222222222222222222222222' },
      };
      assert.equal(extractCommitSha(allPresent), '1111111111111111111111111111111111111111');

      const noGithubMeta = {
        meta: { commitSha: '3333333333333333333333333333333333333333' },
        gitSource: { sha: '2222222222222222222222222222222222222222' },
      };
      assert.equal(extractCommitSha(noGithubMeta), '2222222222222222222222222222222222222222');

      const onlyGenericMeta = {
        meta: { commitSha: '3333333333333333333333333333333333333333' },
      };
      assert.equal(extractCommitSha(onlyGenericMeta), '3333333333333333333333333333333333333333');

      const gitlabFallback = {
        meta: { gitlabCommitSha: '4444444444444444444444444444444444444444' },
      };
      assert.equal(extractCommitSha(gitlabFallback), '4444444444444444444444444444444444444444');
    });

    it('rejects malformed or short SHA strings cleanly returning null', () => {
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 'not-a-sha' } }), null);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: '12345' } }), null);
      assert.equal(extractCommitSha(null), null);
      assert.equal(extractCommitSha({}), null);
      assert.equal(extractCommitSha('string'), null);
    });
  });

  // ==========================================
  // F11: Vercel Team Scoping
  // ==========================================
  describe('F11: Team Scoping Invariants (?teamId=)', () => {
    it('appends ?teamId= query parameter when teamId is present', async () => {
      vc.setProject(testProjectId, 'scoped-project', {
        teamId: testTeamId,
        prodCommitSha: readySha,
      });

      await inspectVercelDeployment({
        projectId: testProjectId,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      const reqs = vc.getRequests();
      const last = reqs[reqs.length - 1];
      assert.match(last.url, /teamId=team_plantcor_mining/);
    });

    it('omits ?teamId= when teamId is not configured', async () => {
      vc.setProject('prj_personal', 'personal-app', { prodCommitSha: readySha });

      await inspectVercelDeployment({
        projectId: 'prj_personal',
        token: testToken,
        apiUrl: vc.url,
      });

      const reqs = vc.getRequests();
      const last = reqs[reqs.length - 1];
      assert.equal(last.url.includes('teamId='), false);
    });

    it('proves team-owned project requires teamId to retrieve deployments', async () => {
      const teamProj = 'prj_team_isolation';
      vc.setProject(teamProj, 'team-app', { teamId: testTeamId, prodCommitSha: readySha });

      // Without teamId: returns 0 deployments
      const noTeamResult = await fetchDeployments(
        { projectId: teamProj, target: 'production', token: testToken },
        { apiUrl: vc.url }
      );
      assert.equal(noTeamResult.deployments.length, 0);

      // With teamId: returns matching deployment
      const withTeamResult = await fetchDeployments(
        { projectId: teamProj, target: 'production', teamId: testTeamId, token: testToken },
        { apiUrl: vc.url }
      );
      assert.equal(withTeamResult.deployments.length, 1);
      assert.equal(extractCommitSha(withTeamResult.deployments[0]), readySha);
    });
  });

  // ==========================================
  // F12: In-Flight State Detection & Duplicate Prevention
  // ==========================================
  describe('F12: In-Flight State Detection & Duplicate Prevention', () => {
    it('detects BUILDING state deployment and exposes inFlightCommit while keeping active READY commit', async () => {
      const buildProj = 'prj_flight_building';
      vc.setProject(buildProj, 'flight-app', {
        prodCommitSha: readySha,
        prodState: 'READY',
        teamId: testTeamId,
      });

      vc.addDeployment({
        uid: 'dpl_inflight_test',
        projectId: buildProj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: targetSha },
      });

      const state = await inspectVercelDeployment({
        projectId: buildProj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'BUILDING');
      assert.equal(state.commit, readySha);
      assert.equal(state.inFlightCommit, targetSha);
    });

    it('detects INITIALIZING and QUEUED states reliably', async () => {
      for (const st of ['INITIALIZING', 'QUEUED']) {
        const queueProj = `prj_queue_${st.toLowerCase()}`;
        vc.setProject(queueProj, `queue-${st.toLowerCase()}`, {
          prodCommitSha: readySha,
          teamId: testTeamId,
        });
        vc.addDeployment({
          uid: `dpl_${st.toLowerCase()}`,
          projectId: queueProj,
          state: st,
          readyState: st,
          target: 'production',
          meta: { githubCommitSha: targetSha },
        });

        const state = await inspectVercelDeployment({
          projectId: queueProj,
          teamId: testTeamId,
          token: testToken,
          apiUrl: vc.url,
        });

        assert.equal(state.state, st);
        assert.equal(state.inFlightCommit, targetSha);
        assert.equal(state.commit, readySha);
      }
    });

    it('simulates polling transition from BUILDING to READY via queueTransition', async () => {
      const transProj = 'prj_trans_test';
      const inFlightUid = 'dpl_poll_trans';
      vc.setProject(transProj, 'trans-app', { prodCommitSha: readySha, teamId: testTeamId });
      vc.addDeployment({
        uid: inFlightUid,
        id: inFlightUid,
        projectId: transProj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: targetSha },
      });

      vc.queueTransition({
        deploymentId: inFlightUid,
        targetState: 'READY',
        targetSha,
        triggerAfterPolls: 1,
      });

      // Poll 1: Triggers transition to READY
      const state = await inspectVercelDeployment({
        projectId: transProj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'READY');
      assert.equal(state.commit, targetSha);
      assert.equal(state.inFlightCommit, null);
    });

    it('handles deployments in ERROR or CANCELED states when no READY exists', async () => {
      const errProj = 'prj_only_errors';
      vc.setProject(errProj, 'err-app', {
        teamId: testTeamId,
        prodState: 'ERROR',
        prodCommitSha: targetSha,
      });

      const state = await inspectVercelDeployment({
        projectId: errProj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'ERROR');
      assert.equal(state.commit, targetSha);
      assert.equal(state.inFlightCommit, null);
    });
  });

  // ==========================================
  // Error Resilience & Protocol Edge Cases
  // ==========================================
  describe('Error Resilience & Boundary Invariants', () => {
    it('throws VercelAuthError when VERCEL_TOKEN is empty or missing (403 missingToken)', async () => {
      await assert.rejects(
        async () =>
          inspectVercelDeployment({
            projectId: testProjectId,
            teamId: testTeamId,
            token: '',
            apiUrl: vc.url,
          }),
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.missingToken, true);
          assert.equal(err.exitCode, 2);
          assert.match(String(err), /token|auth|forbidden|403/i);
          return true;
        }
      );
    });

    it('throws VercelAuthError when token is invalid (403 invalidToken)', async () => {
      await assert.rejects(
        async () =>
          inspectVercelDeployment({
            projectId: testProjectId,
            teamId: testTeamId,
            token: 'wrong-bad-token',
            apiUrl: vc.url,
          }),
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.invalidToken, true);
          assert.equal(err.exitCode, 2);
          assert.match(String(err), /token|auth|forbidden|not authorized/i);
          return true;
        }
      );
    });

    it('throws VercelProjectNotFoundError on 404 Project Not Found', async () => {
      await assert.rejects(
        async () =>
          inspectVercelDeployment({
            projectId: 'prj_nonexistent_xyz',
            teamId: testTeamId,
            token: testToken,
            apiUrl: vc.url,
          }),
        (err) => {
          assert.ok(err instanceof VercelProjectNotFoundError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.exitCode, 2);
          assert.match(String(err), /project.*not found|404/i);
          return true;
        }
      );
    });

    it('throws VercelRateLimitError on 429 parsing retry-after header', async () => {
      vc.setRateLimit({ remaining: 0, retryAfter: 45, reset: Math.floor(Date.now() / 1000) + 45 });
      try {
        await assert.rejects(
          async () =>
            inspectVercelDeployment({
              projectId: testProjectId,
              teamId: testTeamId,
              token: testToken,
              apiUrl: vc.url,
            }),
          (err) => {
            assert.ok(err instanceof VercelRateLimitError);
            assert.equal(err.statusCode, 429);
            assert.equal(err.retryAfterSec, 45);
            assert.equal(err.suggestedWaitMs, 45000);
            assert.equal(err.exitCode, 2);
            assert.match(String(err), /rate limit/i);
            return true;
          }
        );
      } finally {
        vc.setRateLimit(null);
      }
    });

    it('handles network failure throwing VercelApiError with ERR_VERCEL_NETWORK', async () => {
      const deadPort = 64999;
      await assert.rejects(
        async () =>
          inspectVercelDeployment({
            projectId: testProjectId,
            token: testToken,
            apiUrl: `http://127.0.0.1:${deadPort}`,
          }),
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.exitCode, 2);
          assert.match(err.message, /Network request failed/i);
          return true;
        }
      );
    });

    it('serializes VercelApiError and subclasses to JSON with exitCode and details', () => {
      const authErr = new VercelAuthError('Missing token', { missingToken: true });
      assert.equal(authErr.exitCode, 2);
      assert.equal(authErr.code, 'ERR_VERCEL_MISSING_TOKEN');
      assert.deepEqual(authErr.toJSON(), {
        error: 'VercelAuthError',
        code: 'ERR_VERCEL_MISSING_TOKEN',
        message: 'Missing token',
        exitCode: 2,
        details: null,
        cause: undefined,
        statusCode: 403,
        statusText: 'Forbidden',
        endpoint: '',
        missingToken: true,
        invalidToken: false,
        projectId: null,
        responseBody: null,
      });

      const pErr = new VercelProjectNotFoundError('prj_abc', { teamId: 'team_1' });
      assert.equal(pErr.statusCode, 404);
      assert.equal(pErr.teamId, 'team_1');

      const rErr = new VercelRateLimitError('Limited', { retryAfterSec: 15 });
      assert.equal(rErr.suggestedWaitMs, 15000);
      assert.equal(rErr.retryAfterSec, 15);
    });
  });

  // ==========================================
  // Deploy Hook & Utility Functions
  // ==========================================
  describe('Deploy Hook & Utility Functions', () => {
    it('creates standard Vercel headers with User-Agent and Authorization', () => {
      const headersWithToken = createVercelHeaders('my-secret-token');
      assert.equal(headersWithToken['Accept'], 'application/json');
      assert.match(headersWithToken['User-Agent'], /zero-drift-watchdog/);
      assert.equal(headersWithToken['Authorization'], 'Bearer my-secret-token');

      const headersNoToken = createVercelHeaders(undefined);
      assert.equal(headersNoToken['Authorization'], undefined);
    });

    it('builds Vercel URL with query params and teamId scoping', () => {
      const url = buildVercelUrl(
        'https://api.vercel.com',
        '/v6/deployments',
        { limit: 5 },
        { projectId: 'prj_1', teamId: 'team_abc' }
      );
      assert.equal(url, 'https://api.vercel.com/v6/deployments?limit=5&teamId=team_abc');
    });

    it('resolves deploy hook URL from context, env, and project metadata', async () => {
      // 1. From context directly
      const hook1 = await resolveDeployHookUrl({
        projectId: testProjectId,
        deployHookUrl: 'https://api.vercel.com/hook1',
      });
      assert.equal(hook1, 'https://api.vercel.com/hook1');

      // 2. From project metadata via link.deployHooks
      vc.setProject('prj_with_hook', 'hook-app', {
        teamId: testTeamId,
        prodCommitSha: readySha,
        deployHooks: [
          {
            id: 'hook_main',
            name: 'main-deploy',
            ref: 'main',
            url: `${vc.url}/v1/integrations/deploy/hook_main`,
          },
        ],
      });

      const hook2 = await resolveDeployHookUrl(
        { projectId: 'prj_with_hook', teamId: testTeamId, token: testToken, apiUrl: vc.url },
        { branch: 'main' }
      );
      assert.equal(hook2, `${vc.url}/v1/integrations/deploy/hook_main`);
    });

    it('triggers deploy hook via POST without bearer token', async () => {
      const hookId = 'hook_test_f12';
      vc.setDeployHook(hookId, testProjectId, 'main');
      const hookUrl = `${vc.url}/v1/integrations/deploy/${hookId}`;
      const res = await triggerDeployHook(hookUrl);
      assert.ok(res.job || res.uid || res.id || res.ok);

      const reqs = vc.getRequests();
      const last = reqs[reqs.length - 1];
      assert.equal(last.method, 'POST');
      assert.equal(
        last.headers['authorization'],
        undefined,
        'Deploy hook must not pass authorization header'
      );
    });
  });
});
