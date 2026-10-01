// @ts-check
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  discoverVercelContext,
  inspectVercelDeployment,
  extractCommitSha,
  createVercelHeaders,
  buildVercelUrl,
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

describe('Empirical Adversarial Stress Test Harness - Milestone 2 (Vercel Inspector)', () => {
  /** @type {ReturnType<typeof createMockVercelServer>} */
  let vc;
  const testProjectId = 'prj_adversarial_m2';
  const testTeamId = 'team_adversarial_sec';
  const testToken = 'mock-vc-secret-token-12345';
  const shaA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // Serving READY commit
  const shaB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // In-flight BUILDING commit
  const shaC = 'cccccccccccccccccccccccccccccccccccccccc'; // Next target commit
  const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

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

  // =========================================================================
  // SECTION 1: MALFORMED / INCOMPLETE DEPLOYMENT PAYLOADS
  // =========================================================================
  describe('Adversarial 1: Malformed & Incomplete Deployment Payloads', () => {
    it('extractCommitSha rejects null, undefined, and non-object inputs safely', () => {
      assert.equal(extractCommitSha(null), null);
      assert.equal(extractCommitSha(undefined), null);
      assert.equal(extractCommitSha(42), null);
      assert.equal(extractCommitSha('string'), null);
      assert.equal(extractCommitSha(true), null);
      assert.equal(extractCommitSha(Symbol('test')), null);
      assert.equal(
        extractCommitSha(() => {}),
        null
      );
      assert.equal(extractCommitSha([]), null);
      assert.equal(extractCommitSha({}), null);
    });

    it('extractCommitSha safely handles corrupted meta and gitSource structures', () => {
      // meta is not an object
      assert.equal(extractCommitSha({ meta: 'invalid_string' }), null);
      assert.equal(extractCommitSha({ meta: 12345 }), null);
      assert.equal(extractCommitSha({ meta: null }), null);
      assert.equal(extractCommitSha({ meta: [] }), null);

      // gitSource is not an object
      assert.equal(extractCommitSha({ gitSource: 'invalid_string' }), null);
      assert.equal(extractCommitSha({ gitSource: 12345 }), null);
      assert.equal(extractCommitSha({ gitSource: null }), null);
      assert.equal(extractCommitSha({ gitSource: [] }), null);

      // Both null
      assert.equal(extractCommitSha({ meta: null, gitSource: null }), null);

      // meta fields are non-string or empty
      assert.equal(extractCommitSha({ meta: { githubCommitSha: null } }), null);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: undefined } }), null);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 12345 } }), null);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: '' } }), null);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: '   ' } }), null);
    });

    it('extractCommitSha rejects invalid SHA strings with precision', () => {
      // 39 chars (1 char too short)
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 'a'.repeat(39) } }), null);

      // 65 chars (1 char too long for sha256)
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 'a'.repeat(65) } }), null);

      // Valid 40-char SHA-1 and 64-char SHA-256
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 'a'.repeat(40) } }), 'a'.repeat(40));
      assert.equal(extractCommitSha({ meta: { githubCommitSha: sha256 } }), sha256);

      // Non-hex characters
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 'g'.repeat(40) } }), null);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: 'z'.repeat(40) } }), null);
      assert.equal(
        extractCommitSha({ meta: { githubCommitSha: '111111111111111111111111111111111111111g' } }),
        null
      );
      assert.equal(
        extractCommitSha({ meta: { githubCommitSha: '11111111-1111-1111-1111-111111111111' } }),
        null
      );

      // Internal whitespace or newlines
      assert.equal(
        extractCommitSha({ meta: { githubCommitSha: `${shaA.slice(0, 20)} ${shaA.slice(20)}` } }),
        null
      );
      assert.equal(
        extractCommitSha({ meta: { githubCommitSha: `${shaA.slice(0, 20)}\n${shaA.slice(20)}` } }),
        null
      );

      // Leading/trailing whitespace should be trimmed and accepted
      assert.equal(extractCommitSha({ meta: { githubCommitSha: `  ${shaA}  ` } }), shaA);
      assert.equal(extractCommitSha({ meta: { githubCommitSha: `\n\t${shaA}\t\n` } }), shaA);
    });

    it('extractCommitSha gracefully falls through priority hierarchy when higher priorities are malformed', () => {
      // githubCommitSha malformed -> fallback to gitSource.sha
      const dpl1 = {
        meta: { githubCommitSha: 'short_sha_123' },
        gitSource: { sha: shaA },
      };
      assert.equal(extractCommitSha(dpl1), shaA);

      // githubCommitSha malformed, gitSource.sha malformed -> fallback to meta.commitSha
      const dpl2 = {
        meta: {
          githubCommitSha: 'invalid_non_hex_gggggggggggggggggggggggggggggggggggggggg',
          commitSha: shaB,
        },
        gitSource: { sha: 'short' },
      };
      assert.equal(extractCommitSha(dpl2), shaB);

      // Fallback to extended candidates: gitlabCommitSha, bitbucketCommitSha, vcsCommitSha, sha
      const dpl3 = {
        meta: {
          githubCommitSha: null,
          commitSha: 'bad',
          gitlabCommitSha: 'bad',
          bitbucketCommitSha: shaC,
        },
      };
      assert.equal(extractCommitSha(dpl3), shaC);

      const dpl4 = {
        meta: {
          vcsCommitSha: shaA,
        },
      };
      assert.equal(extractCommitSha(dpl4), shaA);

      const dpl5 = {
        meta: {
          sha: shaB,
        },
      };
      assert.equal(extractCommitSha(dpl5), shaB);
    });

    it('handles non-array or missing deployments field from /v6/deployments', async () => {
      const proj = 'prj_non_array_test';
      vc.setProject(proj, 'non-array-app', { prodCommitSha: shaA, teamId: testTeamId });

      // Override /v6/deployments to return { deployments: null }
      vc.setError('/v6/deployments', 200, { deployments: null, pagination: null });

      // fetchDeployments should normalize null to []
      const res = await fetchDeployments(
        {
          projectId: proj,
          token: testToken,
          teamId: testTeamId,
        },
        { apiUrl: vc.url }
      );
      assert.deepEqual(res.deployments, []);

      // inspectVercelDeployment should fall back to fetchProject targets.production
      const state = await inspectVercelDeployment({
        projectId: proj,
        token: testToken,
        teamId: testTeamId,
        apiUrl: vc.url,
      });
      assert.equal(state.state, 'READY');
      assert.equal(state.commit, shaA);
      assert.equal(state.inFlightCommit, null);
    });

    it('handles deployments containing objects with missing or unexpected state values', async () => {
      const proj = 'prj_corrupt_states';
      vc.setProject(proj, 'corrupt-states-app', { teamId: testTeamId });

      // Add deployment with missing state/readyState and no meta
      vc.addDeployment({
        uid: 'dpl_empty_meta',
        id: 'dpl_empty_meta',
        projectId: proj,
        state: null,
        readyState: null,
        meta: {},
        gitSource: null,
      });

      const state = await inspectVercelDeployment({
        projectId: proj,
        token: testToken,
        teamId: testTeamId,
        apiUrl: vc.url,
      });

      // Should safely identify serving state without throwing TypeError
      assert.ok(state);
      assert.equal(state.inFlightCommit, null);
      // readyState is null, so it falls back to UNKNOWN or READY depending on list
      assert.ok(['READY', 'UNKNOWN'].includes(state.state));
    });

    it('identifies empirical hazard: null elements in deployments array trigger TypeError', async () => {
      const proj = 'prj_null_in_array';
      vc.setError('/v6/deployments', 200, { deployments: [null] });

      await assert.rejects(
        () => inspectVercelDeployment({ projectId: proj, token: testToken, apiUrl: vc.url }),
        (err) => {
          assert.ok(err instanceof TypeError);
          assert.ok(err.message.includes('null'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // SECTION 2: IN-FLIGHT STATE TRANSITIONS (POLLING & STATE MACHINES)
  // =========================================================================
  describe('Adversarial 2: In-Flight State Transitions', () => {
    it('simulates BUILDING -> READY transition across 2 polls with serving parity preserved', async () => {
      const proj = 'prj_trans_b_to_r';
      const buildingDplId = 'dpl_building_1';

      // Seed project with existing production deployment serving shaA
      vc.setProject(proj, 'trans-app-1', { prodCommitSha: shaA, teamId: testTeamId });

      // Add new deployment currently BUILDING with shaB
      vc.addDeployment({
        uid: buildingDplId,
        id: buildingDplId,
        projectId: proj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: shaB },
      });

      // Configure transition: trigger on Poll 2 (triggerAfterPolls: 2)
      vc.queueTransition({
        deploymentId: buildingDplId,
        targetState: 'READY',
        targetSha: shaB,
        triggerAfterPolls: 2,
      });

      // --- Poll 1: Should detect BUILDING state, serving commit shaA, in-flight commit shaB ---
      const poll1 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(poll1.state, 'BUILDING', 'Poll 1 must report BUILDING state');
      assert.equal(poll1.commit, shaA, 'Poll 1 must report serving production commit shaA');
      assert.equal(poll1.inFlightCommit, shaB, 'Poll 1 must report in-flight commit shaB');
      assert.ok(poll1.deploymentId, 'Poll 1 must provide deploymentId');

      // --- Poll 2: Transition fires. Should now report READY state, commit shaB, null inFlightCommit ---
      const poll2 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(poll2.state, 'READY', 'Poll 2 must report READY state after transition');
      assert.equal(poll2.commit, shaB, 'Poll 2 must report new active production commit shaB');
      assert.equal(poll2.inFlightCommit, null, 'Poll 2 inFlightCommit must clear to null');
    });

    it('simulates BUILDING -> ERROR transition: production rolls back to/keeps previous serving commit', async () => {
      const proj = 'prj_trans_b_to_err';
      const failDplId = 'dpl_fail_build';

      // Seed project with production deployment serving shaA
      vc.setProject(proj, 'trans-app-err', { prodCommitSha: shaA, teamId: testTeamId });

      // Add new deployment BUILDING with shaB
      vc.addDeployment({
        uid: failDplId,
        id: failDplId,
        projectId: proj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: shaB },
      });

      // Transition to ERROR on poll 2
      vc.queueTransition({
        deploymentId: failDplId,
        targetState: 'ERROR',
        triggerAfterPolls: 2,
      });

      // Poll 1: BUILDING
      const poll1 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(poll1.state, 'BUILDING');
      assert.equal(poll1.commit, shaA);
      assert.equal(poll1.inFlightCommit, shaB);

      // Poll 2: The building deployment failed (ERROR).
      // Since shaA is still the READY deployment on production, Vercel continues serving shaA!
      const poll2 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(
        poll2.state,
        'READY',
        'When in-flight fails, active production deployment remains READY'
      );
      assert.equal(poll2.commit, shaA, 'Serving commit remains previous READY commit shaA');
      assert.equal(poll2.inFlightCommit, null, 'inFlightCommit clears to null on error');
    });

    it('simulates BUILDING -> ERROR transition when NO prior READY deployment exists', async () => {
      const proj = 'prj_trans_b_to_err_fresh';
      const prodDplId = 'dpl_fresh-app-err_prod';

      // Seed empty project whose only deployment is in BUILDING state
      vc.setProject(proj, 'fresh-app-err', {
        teamId: testTeamId,
        prodState: 'BUILDING',
        prodCommitSha: shaB,
      });

      // Transition the single deployment to ERROR on poll 2
      vc.queueTransition({
        deploymentId: prodDplId,
        targetState: 'ERROR',
        triggerAfterPolls: 2,
      });

      // Poll 1: BUILDING (no ready commit)
      const poll1 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(poll1.state, 'BUILDING');
      assert.equal(poll1.inFlightCommit, shaB);

      // Poll 2: ERROR (transition fired, no other deployment exists)
      const poll2 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(poll2.state, 'ERROR');
      assert.equal(poll2.inFlightCommit, null);
    });

    it('simulates complete multi-step lifecycle: QUEUED -> INITIALIZING -> BUILDING -> READY', async () => {
      const proj = 'prj_lifecycle_4stage';
      const dplId = 'dpl_multistage';

      vc.setProject(proj, 'multistage-app', { prodCommitSha: shaA, teamId: testTeamId });

      // Start in QUEUED state with shaC
      vc.addDeployment({
        uid: dplId,
        id: dplId,
        projectId: proj,
        state: 'QUEUED',
        readyState: 'QUEUED',
        target: 'production',
        meta: { githubCommitSha: shaC },
      });

      // Queue 3 consecutive transitions
      vc.queueTransition({
        deploymentId: dplId,
        targetState: 'INITIALIZING',
        triggerAfterPolls: 2, // triggers on poll 2
      });
      vc.queueTransition({
        deploymentId: dplId,
        targetState: 'BUILDING',
        triggerAfterPolls: 3, // triggers on poll 3
      });
      vc.queueTransition({
        deploymentId: dplId,
        targetState: 'READY',
        targetSha: shaC,
        triggerAfterPolls: 4, // triggers on poll 4
      });

      // --- Poll 1: QUEUED ---
      const p1 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(p1.state, 'QUEUED');
      assert.equal(p1.commit, shaA);
      assert.equal(p1.inFlightCommit, shaC);

      // --- Poll 2: INITIALIZING ---
      const p2 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(p2.state, 'INITIALIZING');
      assert.equal(p2.commit, shaA);
      assert.equal(p2.inFlightCommit, shaC);

      // --- Poll 3: BUILDING ---
      const p3 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(p3.state, 'BUILDING');
      assert.equal(p3.commit, shaA);
      assert.equal(p3.inFlightCommit, shaC);

      // --- Poll 4: READY ---
      const p4 = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });
      assert.equal(p4.state, 'READY');
      assert.equal(p4.commit, shaC);
      assert.equal(p4.inFlightCommit, null);
    });
  });

  // =========================================================================
  // SECTION 3: IN-FLIGHT VS SERVING PARITY & ISOLATION
  // =========================================================================
  describe('Adversarial 3: In-Flight vs Serving Parity & Isolation', () => {
    it('guarantees complete isolation between serving production commit and pending inFlightCommit', async () => {
      const proj = 'prj_isolation_test';
      vc.setProject(proj, 'isolation-app', { prodCommitSha: shaA, teamId: testTeamId });

      // In-flight deployment uses gitSource.sha while ready deployment uses meta.githubCommitSha
      vc.addDeployment({
        uid: 'dpl_inflight_isolation',
        id: 'dpl_inflight_isolation',
        projectId: proj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: null }, // no meta commit
        gitSource: { sha: shaB, ref: 'main', type: 'github' },
      });

      const state = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'BUILDING');
      assert.equal(state.commit, shaA, 'Serving commit must match READY deployment');
      assert.equal(state.inFlightCommit, shaB, 'In-flight commit must match BUILDING gitSource');
      assert.notEqual(
        state.commit,
        state.inFlightCommit,
        'Serving and in-flight commits must not collide'
      );

      // DeploymentId and URL must reflect the serving production deployment
      assert.ok(state.deploymentId?.includes('prod'));
      assert.ok(state.url?.includes('isolation-app'));
    });

    it('selects the newest in-flight deployment when multiple builds are pending (e.g. rapid pushes)', async () => {
      const proj = 'prj_rapid_pushes';
      vc.setProject(proj, 'rapid-app', { prodCommitSha: shaA, teamId: testTeamId });

      // First push: BUILDING with shaB (older)
      vc.addDeployment({
        uid: 'dpl_push_1',
        id: 'dpl_push_1',
        projectId: proj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: shaB },
        createdAt: 1000,
      });

      // Second push: QUEUED with shaC (newer, unshifted to top of deployments list)
      vc.addDeployment({
        uid: 'dpl_push_2',
        id: 'dpl_push_2',
        projectId: proj,
        state: 'QUEUED',
        readyState: 'QUEUED',
        target: 'production',
        meta: { githubCommitSha: shaC },
        createdAt: 2000,
      });

      const state = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      // Should detect newest in-flight deployment (push 2)
      assert.equal(state.state, 'QUEUED');
      assert.equal(state.inFlightCommit, shaC);
      assert.equal(state.commit, shaA);
    });

    it('handles in-flight deployment with completely missing commit metadata gracefully', async () => {
      const proj = 'prj_missing_inflight_meta';
      vc.setProject(proj, 'missing-meta-app', { prodCommitSha: shaA, teamId: testTeamId });

      // In-flight deployment without any SHA metadata
      vc.addDeployment({
        uid: 'dpl_no_sha',
        id: 'dpl_no_sha',
        projectId: proj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: {},
        gitSource: null,
      });

      const state = await inspectVercelDeployment({
        projectId: proj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      // State is BUILDING, serving is shaA, but inFlightCommit is null because SHA is missing
      assert.equal(state.state, 'BUILDING');
      assert.equal(state.commit, shaA);
      assert.equal(state.inFlightCommit, null);
    });
  });

  // =========================================================================
  // SECTION 4: CONCURRENT & HIGH-VOLUME QUERIES
  // =========================================================================
  describe('Adversarial 4: Concurrency & Stress Load', () => {
    it('executes 50 concurrent inspectVercelDeployment calls without socket exhaustion or data corruption', async () => {
      const proj = 'prj_concurrent_load';
      vc.setProject(proj, 'concurrent-app', { prodCommitSha: shaA, teamId: testTeamId });

      vc.addDeployment({
        uid: 'dpl_concurrent_inflight',
        id: 'dpl_concurrent_inflight',
        projectId: proj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: shaB },
      });

      const CONCURRENCY = 50;
      const tasks = Array.from({ length: CONCURRENCY }, (_, i) =>
        inspectVercelDeployment({
          projectId: proj,
          teamId: testTeamId,
          token: testToken,
          apiUrl: vc.url,
        })
      );

      const results = await Promise.all(tasks);
      assert.equal(results.length, CONCURRENCY);

      for (const res of results) {
        assert.equal(res.state, 'BUILDING');
        assert.equal(res.commit, shaA);
        assert.equal(res.inFlightCommit, shaB);
        assert.ok(res.deploymentId);
      }
    });

    it('interleaves concurrent queries across 3 projects with different operational states', async () => {
      const pReady = 'prj_state_ready';
      const pBuilding = 'prj_state_building';
      const pError = 'prj_state_error';

      // Project 1: Pure READY
      vc.setProject(pReady, 'ready-app', { prodCommitSha: shaA, teamId: testTeamId });

      // Project 2: In-flight BUILDING
      vc.setProject(pBuilding, 'building-app', { prodCommitSha: shaA, teamId: testTeamId });
      vc.addDeployment({
        uid: 'dpl_b2',
        id: 'dpl_b2',
        projectId: pBuilding,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: shaB },
      });

      // Project 3: ERROR state with no READY deployment
      vc.setProject(pError, 'error-app', {
        teamId: testTeamId,
        prodState: 'ERROR',
        prodCommitSha: shaC,
      });

      const promises = [];
      for (let i = 0; i < 30; i++) {
        const targetProj = i % 3 === 0 ? pReady : i % 3 === 1 ? pBuilding : pError;
        promises.push(
          inspectVercelDeployment({
            projectId: targetProj,
            teamId: testTeamId,
            token: testToken,
            apiUrl: vc.url,
          }).then((res) => ({ index: i, project: targetProj, res }))
        );
      }

      const results = await Promise.all(promises);
      assert.equal(results.length, 30);

      for (const { project, res } of results) {
        if (project === pReady) {
          assert.equal(res.state, 'READY');
          assert.equal(res.commit, shaA);
          assert.equal(res.inFlightCommit, null);
        } else if (project === pBuilding) {
          assert.equal(res.state, 'BUILDING');
          assert.equal(res.commit, shaA);
          assert.equal(res.inFlightCommit, shaB);
        } else if (project === pError) {
          assert.equal(res.state, 'ERROR');
          assert.equal(res.inFlightCommit, null);
        }
      }
    });
  });

  // =========================================================================
  // SECTION 5: SECURITY, SCOPING & ERROR PROTOCOL INVARIANTS
  // =========================================================================
  describe('Adversarial 5: Security, Team Scoping & Error Protocol', () => {
    it('guarantees triggerDeployHook does NOT send Bearer auth tokens (zero credential leak)', async () => {
      const hookId = 'hook_sec_test_123';
      const hookProj = 'prj_hook_sec';
      vc.setProject(hookProj, 'hook-sec-app', { prodCommitSha: shaA });
      vc.setDeployHook(hookId, hookProj, 'main');

      const hookUrl = `${vc.url}/v1/integrations/deploy/${hookId}`;
      const result = await triggerDeployHook(hookUrl);
      assert.ok(result.job);

      // Verify recorded request in mock server: Authorization header must NOT be present
      const reqs = vc.getRequests().filter((r) => r.url?.includes(hookId));
      assert.equal(reqs.length, 1);
      assert.equal(reqs[0].method, 'POST');
      assert.equal(
        reqs[0].headers.authorization,
        undefined,
        'Deploy hooks must not transmit bearer credentials'
      );
    });

    it('enforces URL encoding and strict parameter isolation on teamId in buildVercelUrl', () => {
      const url1 = buildVercelUrl(
        'https://api.vercel.com',
        '/v6/deployments',
        { projectId: 'prj_test' },
        {
          projectId: 'prj_test',
          teamId: 'team_special&strange=1',
        }
      );
      const parsed1 = new URL(url1);
      assert.equal(parsed1.searchParams.get('teamId'), 'team_special&strange=1');
      assert.equal(parsed1.searchParams.get('projectId'), 'prj_test');

      // Does not duplicate teamId if already explicitly provided
      const url2 = buildVercelUrl(
        'https://api.vercel.com',
        '/v6/deployments',
        { teamId: 'override_team' },
        {
          projectId: 'prj_test',
          teamId: 'default_team',
        }
      );
      const parsed2 = new URL(url2);
      assert.equal(parsed2.searchParams.get('teamId'), 'override_team');
    });

    it('handles HTTP 429 Rate Limiting with dynamic retry-after values', async () => {
      const proj = 'prj_rate_limit_adv';
      vc.setProject(proj, 'rate-limit-app', { teamId: testTeamId });

      // Configure rate limit: retryAfter = 45s
      vc.setRateLimit({ remaining: 0, reset: 1770000000, retryAfter: 45 });

      await assert.rejects(
        () =>
          inspectVercelDeployment({
            projectId: proj,
            teamId: testTeamId,
            token: testToken,
            apiUrl: vc.url,
          }),
        (err) => {
          assert.ok(err instanceof VercelRateLimitError);
          assert.equal(err.retryAfterSec, 45);
          assert.equal(err.statusCode, 429);
          assert.ok(err.message.includes('45s'));
          return true;
        }
      );
    });

    it('handles HTTP 404 Project Not Found throwing VercelProjectNotFoundError', async () => {
      const nonExistentProj = 'prj_completely_imaginary_999';

      await assert.rejects(
        () =>
          inspectVercelDeployment({
            projectId: nonExistentProj,
            teamId: testTeamId,
            token: testToken,
            apiUrl: vc.url,
          }),
        (err) => {
          assert.ok(err instanceof VercelProjectNotFoundError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.projectId, nonExistentProj);
          assert.ok(err.message.includes(nonExistentProj));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // SECTION 6: DOMAIN ALIAS SHORTCUT & DEPLOY HOOK EDGE CASES
  // =========================================================================
  describe('Adversarial 6: Domain Alias & Webhook Edge Cases', () => {
    it('resolves production deployment via domain alias shortcut (e.g. app.vercel.app)', async () => {
      const aliasDomain = 'plantcor-mining.vercel.app';
      // Register deployment in mock server with url matching the domain
      vc.addDeployment({
        uid: 'dpl_alias_match',
        id: 'dpl_alias_match',
        url: aliasDomain,
        state: 'READY',
        readyState: 'READY',
        target: 'production',
        meta: { githubCommitSha: shaA },
      });

      const state = await inspectVercelDeployment({
        projectId: aliasDomain,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'READY');
      assert.equal(state.commit, shaA);
      assert.equal(state.deploymentId, 'dpl_alias_match');
      assert.equal(state.url, aliasDomain);
      assert.equal(state.inFlightCommit, null);
    });

    it('falls through to standard deployments collection when domain alias returns 404', async () => {
      const fallbackDomain = 'fallback-pit.vercel.app';
      // Project is registered with standard ID but alias query will 404
      vc.setProject(fallbackDomain, 'fallback-pit', { prodCommitSha: shaB, teamId: testTeamId });

      const state = await inspectVercelDeployment({
        projectId: fallbackDomain,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'READY');
      assert.equal(state.commit, shaB);
    });

    it('triggerDeployHook throws VercelApiError on invalid or missing hook URL', async () => {
      await assert.rejects(
        () => triggerDeployHook(''),
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.code, 'ERR_VERCEL_DEPLOY_HOOK_MISSING');
          return true;
        }
      );

      await assert.rejects(
        () => triggerDeployHook('   '),
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.code, 'ERR_VERCEL_DEPLOY_HOOK_MISSING');
          return true;
        }
      );
    });

    it('triggerDeployHook throws VercelApiError with status code when hook returns HTTP 500', async () => {
      const hookId = 'hook_error_500';
      vc.setError(`/v1/integrations/deploy/${hookId}`, 500, {
        error: { code: 'server_error', message: 'Internal Build Trigger Failed' },
      });

      await assert.rejects(
        () => triggerDeployHook(`${vc.url}/v1/integrations/deploy/${hookId}`),
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.statusCode, 500);
          assert.ok(
            err.message.includes('Internal Build Trigger Failed') || err.message.includes('500')
          );
          return true;
        }
      );
    });

    it('triggerDeployHook handles HTTP 200 with non-JSON response gracefully', async () => {
      const hookId = 'hook_non_json_200';
      // Mock returns 200 with plain text or HTML
      vc.setError(`/v1/integrations/deploy/${hookId}`, 200, 'OK');

      const result = await triggerDeployHook(`${vc.url}/v1/integrations/deploy/${hookId}`);
      assert.deepEqual(result, { ok: true });
    });
  });

  // =========================================================================
  // SECTION 7: AUTH DISCRIMINATION & CONTEXT DISCOVERY MATRIX
  // =========================================================================
  describe('Adversarial 7: Authentication & Context Discovery Invariants', () => {
    it('discriminates 401 invalidToken vs missingToken accurately', async () => {
      const proj = 'prj_auth_discrim';
      vc.setError('/v6/deployments', 401, {
        error: { code: 'invalid_token', message: 'Invalid Vercel API Token', invalidToken: true },
      });

      await assert.rejects(
        () => inspectVercelDeployment({ projectId: proj, token: 'invalid_tok', apiUrl: vc.url }),
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.invalidToken, true);
          assert.equal(err.missingToken, false);
          return true;
        }
      );
    });

    it('throws VercelAuthError preflight when token is missing or empty without hitting network', async () => {
      await assert.rejects(
        () => inspectVercelDeployment({ projectId: 'prj_test', token: '' }),
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.missingToken, true);
          return true;
        }
      );

      await assert.rejects(
        () => inspectVercelDeployment({ projectId: 'prj_test', token: '   ' }),
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.missingToken, true);
          return true;
        }
      );
    });

    it('discoverVercelContext rejects whitespace-only or empty projectId when fallback disabled', async () => {
      await assert.rejects(
        () => discoverVercelContext({ projectId: '   ', fallbackToDirName: false }),
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.code, 'ERR_VERCEL_CONTEXT_NOT_FOUND');
          return true;
        }
      );
    });
  });
});
