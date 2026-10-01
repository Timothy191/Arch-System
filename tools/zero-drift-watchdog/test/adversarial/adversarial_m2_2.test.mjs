// @ts-check
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';

import {
  discoverVercelContext,
  inspectVercelDeployment,
  extractCommitSha,
  createVercelHeaders,
  buildVercelUrl,
  resolveVercelToken,
  fetchDeployments,
  fetchProject,
  resolveDeployHookUrl,
  triggerDeployHook,
  COMMIT_SHA_REGEX,
} from '../../src/vercel-inspector.mjs';

import {
  WatchdogError,
  VercelApiError,
  VercelError,
  VercelAuthError,
  VercelProjectNotFoundError,
  VercelRateLimitError,
} from '../../src/errors.mjs';

import { createMockVercelServer } from '../fixtures/mock-vercel.mjs';

describe('Empirical Adversarial Stress Test Harness - Challenger M2-2', () => {
  /** @type {ReturnType<typeof createMockVercelServer>} */
  let vc;
  const testProjectId = 'prj_challenger_m2_2';
  const testTeamId = 'team_adversarial_sec';
  const testToken = 'valid-adversarial-token-12345';
  const sampleSha1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const sampleSha2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const sampleSha3 = 'cccccccccccccccccccccccccccccccccccccccc';

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
  // SECTION 1: HTTP 429 Rate Limit Responses with Various Retry-After Values
  // =========================================================================
  describe('1. HTTP 429 Rate Limit & Retry-After Boundary Permutations', () => {
    it('handles numeric seconds retry-after (e.g. 120, 5, 0)', async () => {
      const cases = [
        { header: '120', expectedSec: 120, expectedWaitMs: 120000 },
        { header: '5', expectedSec: 5, expectedWaitMs: 5000 },
        { header: '0', expectedSec: 0, expectedWaitMs: 60000 }, // 0 triggers default 60000 in VercelRateLimitError
      ];

      for (const { header, expectedSec, expectedWaitMs } of cases) {
        vc.setError(
          `/v6/deployments`,
          429,
          {
            error: { code: 'rate_limited', message: 'Too many requests' },
          },
          { 'retry-after': header }
        );

        await assert.rejects(
          async () => {
            await fetchDeployments(
              { projectId: testProjectId, token: testToken },
              { apiUrl: vc.url }
            );
          },
          (err) => {
            assert.ok(
              err instanceof VercelRateLimitError,
              `Expected VercelRateLimitError for header ${header}`
            );
            assert.equal(err.statusCode, 429);
            assert.equal(err.code, 'ERR_VERCEL_RATE_LIMIT');
            assert.equal(err.exitCode, 2);
            assert.equal(err.retryAfterSec, expectedSec);
            assert.equal(err.suggestedWaitMs, expectedWaitMs);
            return true;
          }
        );
        vc.clearErrors();
      }
    });

    it('handles missing retry-after header by falling back to 60s default', async () => {
      // 429 without retry-after header
      vc.setError(`/v6/deployments`, 429, {
        error: {
          code: 'rate_limited',
          message: 'Rate limit exceeded without header',
          limit: { reset: 1700000000, remaining: 0 },
        },
      });

      await assert.rejects(
        async () => {
          await inspectVercelDeployment({
            projectId: testProjectId,
            token: testToken,
            apiUrl: vc.url,
          });
        },
        (err) => {
          assert.ok(err instanceof VercelRateLimitError);
          assert.equal(err.statusCode, 429);
          assert.equal(err.retryAfterSec, 60);
          assert.equal(err.suggestedWaitMs, 60000);
          assert.equal(err.resetEpoch, 1700000000);
          return true;
        }
      );
    });

    it('documents behavior under negative retry-after values (e.g. -5, -1)', async () => {
      vc.setError(
        `/v6/deployments`,
        429,
        {
          error: { code: 'rate_limited', message: 'Negative retry after' },
        },
        { 'retry-after': '-5' }
      );

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelRateLimitError);
          assert.equal(err.statusCode, 429);
          // parseInt('-5', 10) produces -5
          assert.equal(err.retryAfterSec, -5);
          // In VercelRateLimitError: retryAfterSec ? retryAfterSec * 1000 : 60000 => -5000
          assert.equal(err.suggestedWaitMs, -5000);
          return true;
        }
      );
    });

    it('handles non-numeric / malformed retry-after strings (e.g. HTTP date or invalid text)', async () => {
      // Some proxies or reverse proxies forward RFC 7231 HTTP-date in retry-after
      vc.setError(
        `/v6/deployments`,
        429,
        {
          error: { code: 'rate_limited', message: 'HTTP date retry after' },
        },
        { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }
      );

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelRateLimitError);
          assert.equal(err.statusCode, 429);
          // parseInt returns NaN for HTTP date
          assert.ok(Number.isNaN(err.retryAfterSec));
          // Because NaN is falsy in JS ternary (retryAfterSec ? retryAfterSec * 1000 : 60000), suggestedWaitMs safely falls back to 60000
          assert.equal(err.suggestedWaitMs, 60000);
          return true;
        }
      );
    });

    it('handles 429 on fetchProject during fallback empty deployment check', async () => {
      // Deployments returns 200 with empty list
      vc.setError(`/v6/deployments`, 200, { deployments: [] });
      // Project lookup returns 429
      vc.setError(
        `/v9/projects/${testProjectId}`,
        429,
        {
          error: { code: 'rate_limited', message: 'Project lookup rate limited' },
        },
        { 'retry-after': '30' }
      );

      await assert.rejects(
        async () => {
          await inspectVercelDeployment({
            projectId: testProjectId,
            token: testToken,
            apiUrl: vc.url,
          });
        },
        (err) => {
          assert.ok(err instanceof VercelRateLimitError);
          assert.equal(err.statusCode, 429);
          assert.equal(err.retryAfterSec, 30);
          assert.equal(err.suggestedWaitMs, 30000);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // SECTION 2: HTTP 401 & 403 Authentication Boundaries & HTML Error Bodies
  // =========================================================================
  describe('2. HTTP 401 & 403 Responses, Missing/Invalid Tokens & HTML Edge Bodies', () => {
    it('distinguishes missingToken vs invalidToken from API JSON response', async () => {
      // 1. Missing Token response from API
      vc.setError(`/v6/deployments`, 403, {
        error: { code: 'forbidden', message: 'Missing token', missingToken: true },
      });

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.missingToken, true);
          assert.equal(err.invalidToken, false);
          assert.equal(err.code, 'ERR_VERCEL_MISSING_TOKEN');
          return true;
        }
      );
      vc.clearErrors();

      // 2. Invalid Token response from API
      vc.setError(`/v6/deployments`, 403, {
        error: { code: 'forbidden', message: 'Invalid token', invalidToken: true },
      });

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.missingToken, false);
          assert.equal(err.invalidToken, true);
          assert.equal(err.code, 'ERR_VERCEL_INVALID_TOKEN');
          return true;
        }
      );
    });

    it('safely handles Cloudflare / WAF HTML 403 error page without JSON parsing crash', async () => {
      const htmlBody = `<!DOCTYPE html>
<html>
<head><title>403 Forbidden</title></head>
<body>
<center><h1>403 Forbidden</h1></center>
<hr><center>cloudflare</center>
</body>
</html>`;

      vc.setError(`/v6/deployments`, 403, htmlBody, { 'content-type': 'text/html; charset=UTF-8' });

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(
            err instanceof VercelAuthError,
            'Should throw VercelAuthError when edge returns HTML'
          );
          assert.equal(err.statusCode, 403);
          assert.equal(err.invalidToken, true);
          assert.equal(err.missingToken, false);
          assert.equal(err.code, 'ERR_VERCEL_INVALID_TOKEN');
          // Response body was non-JSON, so responseBody is empty object
          assert.deepEqual(err.responseBody, {});
          assert.match(err.message, /Forbidden.*403/);
          return true;
        }
      );
    });

    it('safely handles Edge Gateway HTML 401 Unauthorized page without JSON parsing crash', async () => {
      const html401 = `<html><body><h1>401 Authorization Required</h1></body></html>`;
      vc.setError(`/v6/deployments`, 401, html401, { 'content-type': 'text/html' });

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelAuthError);
          assert.equal(err.invalidToken, true);
          assert.equal(err.missingToken, false);
          assert.match(err.message, /Forbidden.*401/);
          return true;
        }
      );
    });

    it('handles HTML 502/503/504 Bad Gateway from reverse proxy without crash', async () => {
      const html502 = `<html><body><h1>502 Bad Gateway</h1></body></html>`;
      vc.setError(`/v6/deployments`, 502, html502, { 'content-type': 'text/html' });

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: testProjectId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.statusCode, 502);
          assert.equal(err.exitCode, 2);
          return true;
        }
      );
    });

    it('enforces preflight validation on empty, null, or whitespace-only token', async () => {
      const invalidTokens = ['', '   ', '\t\n'];
      for (const tok of invalidTokens) {
        await assert.rejects(
          async () => {
            await inspectVercelDeployment({
              projectId: testProjectId,
              token: tok,
              apiUrl: vc.url,
            });
          },
          (err) => {
            assert.ok(err instanceof VercelAuthError);
            assert.equal(err.missingToken, true);
            assert.equal(err.invalidToken, false);
            assert.equal(err.code, 'ERR_VERCEL_MISSING_TOKEN');
            return true;
          }
        );
      }
    });
  });

  // =========================================================================
  // SECTION 3: HTTP 404 Responses (Project Not Found vs Team Scoping Mismatch)
  // =========================================================================
  describe('3. HTTP 404 Responses for Project Not Found vs Team Scoping Mismatch', () => {
    it('throws VercelProjectNotFoundError when direct deployment collection returns 404', async () => {
      vc.setError(`/v6/deployments`, 404, {
        error: { code: 'not_found', message: 'Project not found.' },
      });

      await assert.rejects(
        async () => {
          await fetchDeployments(
            { projectId: 'prj_missing_alpha', teamId: testTeamId, token: testToken },
            { apiUrl: vc.url }
          );
        },
        (err) => {
          assert.ok(err instanceof VercelProjectNotFoundError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.code, 'ERR_VERCEL_PROJECT_NOT_FOUND');
          assert.equal(err.projectId, 'prj_missing_alpha');
          assert.equal(err.teamId, testTeamId);
          assert.match(err.message, /team_adversarial_sec/);
          return true;
        }
      );
    });

    it('verifies team scoping mismatch: project belongs to team but request omits teamId', async () => {
      const scopedProject = 'prj_team_owned_xyz';
      vc.setProject(scopedProject, 'team-owned-app', {
        teamId: testTeamId,
        prodCommitSha: sampleSha1,
      });

      // Without teamId, project lookup on /v9/projects returns 404
      await assert.rejects(
        async () => {
          await fetchProject(scopedProject, { token: testToken }, { apiUrl: vc.url });
        },
        (err) => {
          assert.ok(err instanceof VercelProjectNotFoundError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.teamId, null);
          return true;
        }
      );

      // With correct teamId, returns 200
      const proj = await fetchProject(
        scopedProject,
        { teamId: testTeamId, token: testToken },
        { apiUrl: vc.url }
      );
      assert.equal(proj.id, scopedProject);
      assert.equal(proj.teamId, testTeamId);
    });

    it('differentiates empty deployments on existing project vs non-existent project', async () => {
      const existingProjectNoDeploys = 'prj_existing_no_deploys';
      vc.setProject(existingProjectNoDeploys, 'zero-deploy-app', {
        teamId: testTeamId,
      });
      // Remove any default deployment added by setProject
      // And configure /v6/deployments to return empty array
      vc.setError(`/v6/deployments`, 200, { deployments: [] });

      // In mock-vercel, setProject adds targets.production. Let's override project object to have no targets
      const projWithoutTargets = {
        id: existingProjectNoDeploys,
        name: 'zero-deploy-app',
        teamId: testTeamId,
        targets: {},
      };
      vc.setError(`/v9/projects/${existingProjectNoDeploys}`, 200, projWithoutTargets);

      const state = await inspectVercelDeployment({
        projectId: existingProjectNoDeploys,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      // Should return UNKNOWN state and null commit, NOT throw 404
      assert.equal(state.state, 'UNKNOWN');
      assert.equal(state.commit, null);
      assert.equal(state.deploymentId, null);
      assert.equal(state.inFlightCommit, null);
    });

    it('falls back to targets.production when deployments collection is empty', async () => {
      const projTargetsOnly = 'prj_targets_only';
      vc.setProject(projTargetsOnly, 'targets-app', {
        teamId: testTeamId,
        prodCommitSha: sampleSha2,
        prodState: 'READY',
      });
      vc.setError(`/v6/deployments`, 200, { deployments: [] });

      const state = await inspectVercelDeployment({
        projectId: projTargetsOnly,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'READY');
      assert.equal(state.commit, sampleSha2);
    });
  });

  // =========================================================================
  // SECTION 4: SHA Extraction Hierarchy under Adversarial Permutations
  // =========================================================================
  describe('4. SHA Extraction Hierarchy under Adversarial Metadata Permutations', () => {
    it('strict priority: meta.githubCommitSha > gitSource.sha > meta.commitSha', () => {
      // 1. All 3 present with conflicting valid SHAs
      const allThree = {
        meta: {
          githubCommitSha: sampleSha1,
          commitSha: sampleSha3,
        },
        gitSource: {
          sha: sampleSha2,
        },
      };
      assert.equal(extractCommitSha(allThree), sampleSha1, 'githubCommitSha must win');

      // 2. githubCommitSha omitted, gitSource.sha vs commitSha conflict
      const gitSourceVsMeta = {
        meta: {
          commitSha: sampleSha3,
        },
        gitSource: {
          sha: sampleSha2,
        },
      };
      assert.equal(
        extractCommitSha(gitSourceVsMeta),
        sampleSha2,
        'gitSource.sha must win over meta.commitSha'
      );
    });

    it('falls through when higher-priority property contains invalid/corrupt SHA', () => {
      // githubCommitSha has invalid string (too short) -> falls through to gitSource.sha
      const corruptGithubSha = {
        meta: {
          githubCommitSha: '12345',
          commitSha: sampleSha3,
        },
        gitSource: {
          sha: sampleSha2,
        },
      };
      assert.equal(extractCommitSha(corruptGithubSha), sampleSha2);

      // githubCommitSha has non-hex string -> falls through to gitSource.sha
      const nonHexGithubSha = {
        meta: {
          githubCommitSha: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
          commitSha: sampleSha3,
        },
        gitSource: {
          sha: sampleSha2,
        },
      };
      assert.equal(extractCommitSha(nonHexGithubSha), sampleSha2);

      // both githubCommitSha and gitSource.sha corrupt -> falls through to meta.commitSha
      const corruptBoth = {
        meta: {
          githubCommitSha: 'short',
          commitSha: sampleSha3,
        },
        gitSource: {
          sha: 'also-not-a-sha',
        },
      };
      assert.equal(extractCommitSha(corruptBoth), sampleSha3);
    });

    it('correctly handles extended fallbacks (gitlabCommitSha, bitbucketCommitSha, vcsCommitSha, sha)', () => {
      const fallbacks = [
        { obj: { meta: { gitlabCommitSha: sampleSha1 } }, expected: sampleSha1 },
        { obj: { meta: { bitbucketCommitSha: sampleSha2 } }, expected: sampleSha2 },
        { obj: { meta: { vcsCommitSha: sampleSha3 } }, expected: sampleSha3 },
        { obj: { meta: { sha: sampleSha1 } }, expected: sampleSha1 },
      ];

      for (const { obj, expected } of fallbacks) {
        assert.equal(extractCommitSha(obj), expected);
      }
    });

    it('validates 64-character SHA-256 commit hashes', () => {
      const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      assert.equal(sha256.length, 64);
      assert.ok(COMMIT_SHA_REGEX.test(sha256));

      const dpl = {
        meta: {
          githubCommitSha: sha256,
        },
      };
      assert.equal(extractCommitSha(dpl), sha256);
    });

    it('safely handles whitespace padding, mixed case, and boundary lengths', () => {
      // 1. Whitespace padding trimmed
      const padded = { meta: { githubCommitSha: `   ${sampleSha1}  \n` } };
      assert.equal(extractCommitSha(padded), sampleSha1);

      // 2. Uppercase hex accepted
      const upperSha = sampleSha1.toUpperCase();
      const upper = { meta: { githubCommitSha: upperSha } };
      assert.equal(extractCommitSha(upper), upperSha);

      // 3. Exactly 39 characters (one short) -> rejected
      const short39 = { meta: { githubCommitSha: 'a'.repeat(39) } };
      assert.equal(extractCommitSha(short39), null);

      // 4. Exactly 65 characters (one over 64) -> rejected
      const long65 = { meta: { githubCommitSha: 'a'.repeat(65) } };
      assert.equal(extractCommitSha(long65), null);
    });

    it('adversarial malformed objects: null, undefined, primitive, circular, empty', () => {
      assert.equal(extractCommitSha(null), null);
      assert.equal(extractCommitSha(undefined), null);
      assert.equal(extractCommitSha('string'), null);
      assert.equal(extractCommitSha(12345), null);
      assert.equal(extractCommitSha(true), null);
      assert.equal(extractCommitSha([]), null);
      assert.equal(extractCommitSha({}), null);
      assert.equal(extractCommitSha({ meta: null }), null);
      assert.equal(extractCommitSha({ gitSource: null }), null);
      assert.equal(extractCommitSha({ meta: 'not-an-object' }), null);

      // Circular reference object
      const circular = { meta: {} };
      circular.meta.self = circular;
      assert.equal(extractCommitSha(circular), null);
    });
  });

  // =========================================================================
  // SECTION 5: Deploy Hook Error Conditions (500, ECONNREFUSED)
  // =========================================================================
  describe('5. Deploy Hook Error Conditions (500, ECONNREFUSED)', () => {
    it('throws VercelApiError with code ERR_VERCEL_DEPLOY_HOOK_MISSING for empty hook URL', async () => {
      const badUrls = ['', '   ', null, undefined];
      for (const bad of badUrls) {
        await assert.rejects(
          async () => {
            // @ts-ignore
            await triggerDeployHook(bad);
          },
          (err) => {
            assert.ok(err instanceof VercelApiError);
            assert.equal(err.code, 'ERR_VERCEL_DEPLOY_HOOK_MISSING');
            assert.equal(err.exitCode, 2);
            return true;
          }
        );
      }
    });

    it('handles HTTP 500 Internal Server Error from deploy hook', async () => {
      const hookId = 'hook_err_500';
      const hookPath = `/v1/integrations/deploy/${hookId}`;
      vc.setError(hookPath, 500, {
        error: { code: 'internal_error', message: 'Vercel build system temporarily unavailable' },
      });

      const hookUrl = `${vc.url}${hookPath}`;
      await assert.rejects(
        async () => {
          await triggerDeployHook(hookUrl);
        },
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.exitCode, 2);
          assert.match(err.message, /Deploy hook invocation failed: 500/);
          assert.equal(err.endpoint, hookUrl);
          assert.deepEqual(err.responseBody, {
            error: {
              code: 'internal_error',
              message: 'Vercel build system temporarily unavailable',
            },
          });
          return true;
        }
      );
    });

    it('handles HTTP 404 Hook Not Found', async () => {
      const hookId = 'hook_nonexistent_404';
      const hookUrl = `${vc.url}/v1/integrations/deploy/${hookId}`;

      await assert.rejects(
        async () => {
          await triggerDeployHook(hookUrl);
        },
        (err) => {
          assert.ok(err instanceof VercelApiError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.exitCode, 2);
          assert.match(err.message, /Deploy hook invocation failed: 404/);
          return true;
        }
      );
    });

    it('stress-tests Connection Refused (ECONNREFUSED) behavior on deploy hook', async () => {
      // Connect to dead port
      const deadPort = 64991;
      const deadHookUrl = `http://127.0.0.1:${deadPort}/v1/integrations/deploy/dead_hook`;

      // Empirically observe whether triggerDeployHook catches and wraps network error, or throws raw TypeError
      let caughtError = null;
      try {
        await triggerDeployHook(deadHookUrl);
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError !== null, 'Must reject on connection refused');

      // Observation: triggerDeployHook does not wrap fetchImpl with try/catch,
      // so it throws Node.js native TypeError ('fetch failed') with cause.code === 'ECONNREFUSED'
      // unlike fetchDeployments and fetchProject which wrap into VercelApiError ('ERR_VERCEL_NETWORK').
      assert.equal(caughtError.constructor.name, 'TypeError');
      assert.equal(caughtError.message, 'fetch failed');
      assert.equal(/** @type {any} */ (caughtError).cause?.code, 'ECONNREFUSED');
    });

    it('returns { ok: true } when deploy hook responds with non-JSON 200 OK', async () => {
      const hookId = 'hook_text_200';
      const hookPath = `/v1/integrations/deploy/${hookId}`;
      vc.setError(hookPath, 200, 'SUCCESS', { 'content-type': 'text/plain' });

      const res = await triggerDeployHook(`${vc.url}${hookPath}`);
      assert.deepEqual(res, { ok: true });
    });
  });

  // =========================================================================
  // SECTION 6: Context Discovery Resilience & In-Flight Edge Cases
  // =========================================================================
  describe('6. Discovery Resilience Against Corrupted Config Files & In-Flight Edge Cases', () => {
    it('gracefully ignores corrupted JSON in .vercel/project.json and falls back', async () => {
      const { default: fs } = await import('node:fs');
      const { default: os } = await import('node:os');
      const { default: path } = await import('node:path');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-corrupt-project-'));
      try {
        const vcDir = path.join(tmpDir, '.vercel');
        fs.mkdirSync(vcDir, { recursive: true });
        // Corrupted JSON syntax
        fs.writeFileSync(path.join(vcDir, 'project.json'), '{ invalid json: syntax error, [');

        // Should not crash, should fall back to directory basename
        const context = await discoverVercelContext(tmpDir);
        assert.ok(context.projectId.startsWith('zdw-corrupt-project-'));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('gracefully handles corrupted CLI auth.json without throwing', async () => {
      const { default: fs } = await import('node:fs');
      const { default: os } = await import('node:os');
      const { default: path } = await import('node:path');

      const tmpXdg = fs.mkdtempSync(path.join(os.tmpdir(), 'zdw-corrupt-xdg-'));
      try {
        const cliDir = path.join(tmpXdg, 'com.vercel.cli');
        fs.mkdirSync(cliDir, { recursive: true });
        fs.writeFileSync(path.join(cliDir, 'auth.json'), 'NOT JSON AT ALL');

        const token = resolveVercelToken({ env: { XDG_DATA_HOME: tmpXdg } });
        assert.equal(token, null, 'Should return null instead of throwing on corrupted auth.json');
      } finally {
        fs.rmSync(tmpXdg, { recursive: true, force: true });
      }
    });

    it('handles in-flight deployment with corrupted/short commit SHA without crashing', async () => {
      const flightProj = 'prj_flight_corrupt_sha';
      vc.setProject(flightProj, 'flight-corrupt-app', {
        prodCommitSha: sampleSha1,
        teamId: testTeamId,
      });

      // Add in-flight deployment with invalid commit SHA
      vc.addDeployment({
        uid: 'dpl_flight_bad',
        projectId: flightProj,
        state: 'BUILDING',
        readyState: 'BUILDING',
        target: 'production',
        meta: { githubCommitSha: 'corrupted-not-a-valid-sha' },
      });

      const state = await inspectVercelDeployment({
        projectId: flightProj,
        teamId: testTeamId,
        token: testToken,
        apiUrl: vc.url,
      });

      assert.equal(state.state, 'BUILDING');
      assert.equal(
        state.commit,
        sampleSha1,
        'Active serving commit should remain valid READY commit'
      );
      assert.equal(state.inFlightCommit, null, 'Corrupted in-flight commit should parse as null');
    });
  });
});
