// @ts-check
import http from 'node:http';

/**
 * Creates a lightweight, zero-dependency mock Vercel REST API & Webhook server.
 * Faithfully reproduces Vercel REST API behavior including:
 * - Authentication validation (returns 403 with missingToken/invalidToken)
 * - Team scoping (?teamId= parameter)
 * - Collection listing (/v6/deployments & /v7/deployments)
 * - Single deployment inspection (/v13/deployments/:idOrUrl)
 * - Prohibits GET /v13/deployments without path (returns 400 Invalid API version)
 * - Project lookup with embedded production target (/v9/projects/:idOrName)
 * - Deploy Hooks POST (/v1/integrations/deploy/:hookId)
 * - In-flight deployment lifecycle simulation (BUILDING -> READY transitions upon polling)
 * - Rate limiting simulation (HTTP 429 with retry-after)
 *
 * @param {object} [options]
 * @param {number} [options.port=0]
 * @param {string} [options.token] - Expected token
 * @param {boolean} [options.requireAuth=false]
 */
export function createMockVercelServer(options = {}) {
  const defaultPort = options.port ?? 0;
  const expectedToken = options.token ?? null;
  let requireAuth = options.requireAuth ?? Boolean(options.token);

  /** @type {Map<string, any>} */
  const projects = new Map();

  /** @type {Array<any>} */
  const deployments = [];

  /** @type {Map<string, { hookId: string, projectId: string, branch: string }>} */
  const deployHooks = new Map();

  /** @type {Array<{ method: string, url: string, headers: http.IncomingHttpHeaders, body: string, timestamp: number }>} */
  const requestLog = [];

  /** @type {Map<string, { statusCode: number, body: any, headers?: Record<string, string> }>} */
  const errorOverrides = new Map();

  /** @type {{ remaining: number, reset: number, retryAfter: number|null }|null} */
  let rateLimit = null;

  /** @type {Array<{ deploymentId: string, targetState: string, targetSha?: string, triggerAfterPolls: number, currentPolls: number }>} */
  const pendingTransitions = [];

  /** @type {http.Server|null} */
  let server = null;
  /** @type {Set<import('node:net').Socket>} */
  const openSockets = new Set();
  let serverPort = 0;
  let serverUrl = '';

  const requestListener = (req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      const fullUrl = new URL(req.url ?? '/', `http://127.0.0.1:${serverPort}`);
      const pathname = fullUrl.pathname;

      requestLog.push({
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: req.headers,
        body,
        timestamp: Date.now(),
      });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      // 1. Rate Limit Simulation
      if (rateLimit !== null) {
        if (rateLimit.retryAfter !== null || rateLimit.remaining <= 0) {
          res.statusCode = 429;
          if (rateLimit.retryAfter !== null) {
            res.setHeader('retry-after', String(rateLimit.retryAfter));
          }
          res.end(
            JSON.stringify({
              error: {
                code: 'rate_limited',
                message: 'Rate limit exceeded. Please back off.',
                limit: { reset: rateLimit.reset, remaining: 0 },
              },
            })
          );
          return;
        }
      }

      // 2. Authentication Check (for standard API endpoints, not public deploy hooks)
      const isDeployHook = pathname.startsWith('/v1/integrations/deploy/');
      if (requireAuth && !isDeployHook) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              error: {
                code: 'forbidden',
                message: 'The request is missing an authentication token',
                missingToken: true,
              },
            })
          );
          return;
        }
        if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              error: {
                code: 'forbidden',
                message: 'Not authorized',
                invalidToken: true,
              },
            })
          );
          return;
        }
      }

      // 3. Error Overrides
      if (errorOverrides.has(pathname)) {
        const override = errorOverrides.get(pathname);
        res.statusCode = override.statusCode;
        if (override.headers) {
          for (const [k, v] of Object.entries(override.headers)) {
            res.setHeader(k, v);
          }
        }
        res.end(typeof override.body === 'string' ? override.body : JSON.stringify(override.body));
        return;
      }

      // 4. Special empirical edge case: GET /v13/deployments (without id) returns 400
      if (
        req.method === 'GET' &&
        (pathname === '/v13/deployments' || pathname === '/v13/deployments/')
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: {
              code: 'bad_request',
              message: 'Invalid API version',
            },
          })
        );
        return;
      }

      // 5. Deploy Hook Execution: POST /v1/integrations/deploy/:hookId
      const hookMatch = pathname.match(/^\/v1\/integrations\/deploy\/([^/]+)$/);
      if (hookMatch && req.method === 'POST') {
        const [, hookId] = hookMatch;
        const hook = deployHooks.get(hookId);
        if (!hook) {
          res.statusCode = 404;
          res.end(
            JSON.stringify({ error: { code: 'not_found', message: 'Deploy hook not found' } })
          );
          return;
        }

        // Trigger new deployment in BUILDING state
        const project = projects.get(hook.projectId);
        const newUid = `dpl_hook_${Date.now()}`;
        const newDpl = {
          uid: newUid,
          id: newUid,
          name: project ? project.name : hook.projectId,
          projectId: hook.projectId,
          state: 'BUILDING',
          readyState: 'BUILDING',
          target: 'production',
          url: `${project ? project.name : 'app'}-${newUid.slice(-6)}.vercel.app`,
          meta: {
            githubCommitSha:
              project?.targets?.production?.meta?.githubCommitSha ??
              '0000000000000000000000000000000000000000',
            branch: hook.branch,
          },
          gitSource: {
            sha:
              project?.targets?.production?.meta?.githubCommitSha ??
              '0000000000000000000000000000000000000000',
            ref: hook.branch,
            type: 'github',
          },
          createdAt: Date.now(),
        };
        deployments.unshift(newDpl);

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            job: {
              id: `job_${Date.now()}`,
              state: 'QUEUED',
              createdAt: Date.now(),
            },
          })
        );
        return;
      }

      // 6. Deployments Collection: GET /v6/deployments or GET /v7/deployments
      if (
        req.method === 'GET' &&
        (pathname === '/v6/deployments' || pathname === '/v7/deployments')
      ) {
        const queryProjectId = fullUrl.searchParams.get('projectId');
        const queryTarget = fullUrl.searchParams.get('target');
        const queryState = fullUrl.searchParams.get('state');
        const queryLimit = parseInt(fullUrl.searchParams.get('limit') ?? '20', 10);
        const queryTeamId = fullUrl.searchParams.get('teamId');

        // Check in-flight transitions
        for (let i = pendingTransitions.length - 1; i >= 0; i--) {
          const t = pendingTransitions[i];
          t.currentPolls += 1;
          if (t.currentPolls >= t.triggerAfterPolls) {
            const dpl = deployments.find(
              (d) => d.uid === t.deploymentId || d.id === t.deploymentId
            );
            if (dpl) {
              dpl.state = t.targetState;
              dpl.readyState = t.targetState;
              if (t.targetSha) {
                dpl.meta.githubCommitSha = t.targetSha;
                if (dpl.gitSource) dpl.gitSource.sha = t.targetSha;
              }
              // Also update project targets.production if applicable
              const proj = projects.get(dpl.projectId);
              if (proj && t.targetState === 'READY') {
                proj.targets.production = {
                  id: dpl.id,
                  readyState: 'READY',
                  meta: { githubCommitSha: dpl.meta.githubCommitSha },
                };
              }
            }
            pendingTransitions.splice(i, 1);
          }
        }

        let filtered = deployments.filter((d) => {
          if (queryProjectId) {
            const proj = projects.get(d.projectId);
            const matchesId =
              d.projectId === queryProjectId ||
              d.name === queryProjectId ||
              (proj && proj.name === queryProjectId);
            if (!matchesId) return false;
          }
          if (queryTarget && d.target !== queryTarget) return false;
          if (queryState && d.state !== queryState && d.readyState !== queryState) return false;
          return true;
        });

        // Team ID validation: If project belongs to team and request lacks teamId
        if (queryProjectId) {
          const proj = projects.get(queryProjectId);
          if (proj && proj.teamId && queryTeamId !== proj.teamId) {
            // Team scoping mismatch returns empty list or not found
            filtered = [];
          }
        }

        const paginated = filtered.slice(0, queryLimit);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            deployments: paginated,
            pagination: {
              count: paginated.length,
              next: null,
              prev: null,
            },
          })
        );
        return;
      }

      // 7. Single Deployment Lookup: GET /v13/deployments/:idOrUrl
      const singleDplMatch = pathname.match(/^\/v13\/deployments\/([^/]+)$/);
      if (req.method === 'GET' && singleDplMatch) {
        const [, idOrUrl] = singleDplMatch;
        const dpl = deployments.find(
          (d) => d.uid === idOrUrl || d.id === idOrUrl || d.url === idOrUrl
        );
        if (!dpl) {
          res.statusCode = 404;
          res.end(
            JSON.stringify({ error: { code: 'not_found', message: 'Deployment not found' } })
          );
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify(dpl));
        return;
      }

      // 8. Create Deployment: POST /v13/deployments
      if (req.method === 'POST' && pathname === '/v13/deployments') {
        let payload = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch {}

        const projectId = payload.project || payload.name || 'test-project';
        const project = projects.get(projectId);
        const newUid = `dpl_${Date.now()}`;
        const commitSha =
          payload.gitSource?.sha ||
          payload.meta?.githubCommitSha ||
          project?.targets?.production?.meta?.githubCommitSha ||
          '1111111111111111111111111111111111111111';

        const newDpl = {
          uid: newUid,
          id: newUid,
          name: project ? project.name : projectId,
          projectId: project ? project.id : projectId,
          state: 'BUILDING',
          readyState: 'BUILDING',
          target: payload.target || 'production',
          url: `${project ? project.name : 'app'}-${newUid.slice(-6)}.vercel.app`,
          meta: {
            githubCommitSha: commitSha,
            commitSha: commitSha,
          },
          gitSource: {
            sha: commitSha,
            ref: payload.gitSource?.ref || 'main',
            type: 'github',
          },
          createdAt: Date.now(),
        };

        deployments.unshift(newDpl);

        res.statusCode = 200;
        res.end(JSON.stringify(newDpl));
        return;
      }

      // 9. Project Lookup: GET /v9/projects/:idOrName
      const projectMatch = pathname.match(/^\/v9\/projects\/([^/]+)$/);
      if (req.method === 'GET' && projectMatch) {
        const [, idOrName] = projectMatch;
        const queryTeamId = fullUrl.searchParams.get('teamId');
        const project = projects.get(idOrName);

        if (!project) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: { code: 'not_found', message: 'Project not found.' } }));
          return;
        }

        // Verify teamId scoping
        if (project.teamId && queryTeamId !== project.teamId) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: { code: 'not_found', message: 'Project not found.' } }));
          return;
        }

        res.statusCode = 200;
        res.end(JSON.stringify(project));
        return;
      }

      // Unmatched route
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }));
    });
  };

  return {
    get port() {
      return serverPort;
    },
    get url() {
      return serverUrl;
    },

    /**
     * Start the mock Vercel HTTP server
     * @returns {Promise<{ port: number, url: string }>}
     */
    async start() {
      return new Promise((resolve, reject) => {
        server = http.createServer(requestListener);
        server.keepAliveTimeout = 1;
        server.on('connection', (socket) => {
          openSockets.add(socket);
          socket.on('close', () => openSockets.delete(socket));
        });
        server.on('error', reject);
        server.listen(defaultPort, '127.0.0.1', () => {
          const addr = server?.address();
          if (addr && typeof addr === 'object') {
            serverPort = addr.port;
            serverUrl = `http://127.0.0.1:${serverPort}`;
            resolve({ port: serverPort, url: serverUrl });
          } else {
            reject(new Error('Failed to obtain server address'));
          }
        });
      });
    },

    /**
     * Stop server and tear down sockets
     * @returns {Promise<void>}
     */
    async close() {
      return new Promise((resolve) => {
        for (const socket of openSockets) {
          socket.destroy();
        }
        openSockets.clear();
        if (server) {
          server.close(() => resolve());
          server = null;
        } else {
          resolve();
        }
      });
    },

    /**
     * Reset all in-memory mock data
     */
    reset() {
      projects.clear();
      deployments.length = 0;
      pendingTransitions.length = 0;
      deployHooks.clear();
      errorOverrides.clear();
      requestLog.length = 0;
    },

    /**
     * Register or configure a project
     * @param {string} id
     * @param {string} name
     * @param {object} [options]
     * @param {string} [options.prodCommitSha]
     * @param {string} [options.prodState='READY']
     * @param {string} [options.teamId]
     * @param {Array<any>} [options.deployHooks]
     */
    setProject(id, name, options = {}) {
      const prodCommitSha = options.prodCommitSha ?? 'f34570eba581c26d02dd6a7e1b85d0f7a6070dc9';
      const prodState = options.prodState ?? 'READY';
      const dplId = `dpl_${name}_prod`;

      const projectData = {
        id,
        name,
        teamId: options.teamId ?? null,
        targets: {
          production: {
            id: dplId,
            readyState: prodState,
            meta: {
              githubCommitSha: prodCommitSha,
              commitSha: prodCommitSha,
            },
          },
        },
        link: {
          type: 'github',
          repo: name,
          org: 'test-owner',
          productionBranch: 'main',
          deployHooks: options.deployHooks ?? [],
        },
      };

      projects.set(id, projectData);
      projects.set(name, projectData);

      // Clear previous deployments and pending transitions for this project to prevent state leak across tests
      pendingTransitions.length = 0;
      for (let i = deployments.length - 1; i >= 0; i--) {
        if (deployments[i].projectId === id || deployments[i].name === name) {
          deployments.splice(i, 1);
        }
      }

      // Register matching production deployment
      this.addDeployment({
        uid: dplId,
        id: dplId,
        name,
        projectId: id,
        state: prodState,
        readyState: prodState,
        target: 'production',
        url: `${name}.vercel.app`,
        meta: { githubCommitSha: prodCommitSha, commitSha: prodCommitSha },
        gitSource: { sha: prodCommitSha, ref: 'main', type: 'github' },
      });
    },

    /**
     * Add or update a deployment
     * @param {any} deployment
     */
    addDeployment(deployment) {
      const idx = deployments.findIndex((d) => d.uid === deployment.uid || d.id === deployment.id);
      const record = {
        uid: deployment.uid || deployment.id || `dpl_${Date.now()}`,
        id: deployment.id || deployment.uid || `dpl_${Date.now()}`,
        name: deployment.name || 'test-project',
        projectId: deployment.projectId || 'prj_test',
        state: deployment.state || deployment.readyState || 'READY',
        readyState: deployment.readyState || deployment.state || 'READY',
        target: deployment.target || 'production',
        url: deployment.url || `${deployment.name || 'app'}.vercel.app`,
        meta: deployment.meta || {},
        gitSource: deployment.gitSource || {
          sha: deployment.meta?.githubCommitSha,
          ref: 'main',
          type: 'github',
        },
        createdAt: deployment.createdAt || Date.now(),
      };
      if (idx >= 0) {
        deployments[idx] = record;
      } else {
        deployments.unshift(record);
      }
      return record;
    },

    /**
     * Register a deploy webhook
     * @param {string} hookId
     * @param {string} projectId
     * @param {string} [branch='main']
     */
    setDeployHook(hookId, projectId, branch = 'main') {
      deployHooks.set(hookId, { hookId, projectId, branch });
    },

    /**
     * Queue an automatic deployment state transition upon polling
     * @param {object} options
     * @param {string} options.deploymentId
     * @param {string} options.targetState - e.g. "READY"
     * @param {string} [options.targetSha] - commit SHA to update to
     * @param {number} [options.triggerAfterPolls=1] - transitions after N poll requests
     */
    queueTransition(options) {
      pendingTransitions.push({
        deploymentId: options.deploymentId,
        targetState: options.targetState,
        targetSha: options.targetSha,
        triggerAfterPolls: options.triggerAfterPolls ?? 1,
        currentPolls: 0,
      });
    },

    /**
     * Configure rate limit simulation
     * @param {{ remaining?: number, reset?: number, retryAfter?: number|null }|null} options
     */
    setRateLimit(options) {
      if (options === null) {
        rateLimit = null;
      } else {
        rateLimit = {
          remaining: options.remaining ?? 0,
          reset: options.reset ?? Math.floor(Date.now() / 1000) + 60,
          retryAfter: options.retryAfter !== undefined ? options.retryAfter : 10,
        };
      }
    },

    /**
     * Set custom error response for an endpoint path
     * @param {string} pathname
     * @param {number} statusCode
     * @param {any} body
     * @param {Record<string, string>} [headers]
     */
    setError(pathname, statusCode, body, headers) {
      errorOverrides.set(pathname, { statusCode, body, headers });
    },

    /**
     * Clear error overrides
     */
    clearErrors() {
      errorOverrides.clear();
    },

    /**
     * Toggle mandatory authentication
     * @param {boolean} required
     */
    setRequireAuth(required) {
      requireAuth = required;
    },

    /**
     * Get list of recorded requests
     * @returns {Array<{ method: string, url: string, headers: http.IncomingHttpHeaders, body: string, timestamp: number }>}
     */
    getRequests() {
      return [...requestLog];
    },

    /**
     * Clear recorded request log
     */
    clearRequests() {
      requestLog.length = 0;
    },
  };
}
