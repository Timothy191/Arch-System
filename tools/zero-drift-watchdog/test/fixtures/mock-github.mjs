// @ts-check
import http from 'node:http';

/**
 * Creates a lightweight, zero-dependency mock GitHub REST API server.
 * Faithfully reproduces GitHub API v2022-11-28 behavior including:
 * - Mandatory User-Agent header verification (returns 403 HTML if missing)
 * - Rate limit headers (x-ratelimit-*) and throttling
 * - 401 Bad credentials, 404 Not Found, and 422 Unprocessable Entity for invalid commit refs
 * - Commit comparison (identical, ahead, behind, diverged)
 *
 * @param {object} [options]
 * @param {number} [options.port=0]
 * @param {string} [options.token] - Optional token to enforce
 * @param {boolean} [options.requireAuth=false]
 */
export function createMockGitHubServer(options = {}) {
  const defaultPort = options.port ?? 0;
  const expectedToken = options.token ?? null;
  let requireAuth = options.requireAuth ?? Boolean(options.token);

  /** @type {Map<string, { branches: Map<string, any>, commits: Map<string, any>, compare: Map<string, any> }>} */
  const repos = new Map();

  /** @type {Array<{ method: string, url: string, headers: http.IncomingHttpHeaders, body: string, timestamp: number }>} */
  const requestLog = [];

  /** @type {Map<string, { statusCode: number, body: any, headers?: Record<string, string> }>} */
  const errorOverrides = new Map();

  let rateLimit = {
    limit: 5000,
    remaining: 4999,
    reset: Math.floor(Date.now() / 1000) + 3600,
    used: 1,
    retryAfter: /** @type {number|null} */ (null),
  };

  /**
   * Helper to ensure repo exists in memory
   * @param {string} owner
   * @param {string} repo
   */
  function ensureRepo(owner, repo) {
    const key = `${owner}/${repo}`.toLowerCase();
    if (!repos.has(key)) {
      repos.set(key, {
        branches: new Map(),
        commits: new Map(),
        compare: new Map(),
      });
    }
    return repos.get(key);
  }

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

      // Default GitHub rate-limiting headers
      res.setHeader('x-ratelimit-limit', String(rateLimit.limit));
      res.setHeader('x-ratelimit-remaining', String(rateLimit.remaining));
      res.setHeader('x-ratelimit-reset', String(rateLimit.reset));
      res.setHeader('x-ratelimit-used', String(rateLimit.used));
      res.setHeader('X-GitHub-Api-Version', '2022-11-28');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      // 1. Check Rate Limit Exceeded
      if (rateLimit.remaining <= 0) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            message: 'API rate limit exceeded for mock',
            documentation_url:
              'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
          })
        );
        return;
      }

      if (rateLimit.retryAfter !== null) {
        res.statusCode = 429;
        res.setHeader('retry-after', String(rateLimit.retryAfter));
        res.end(
          JSON.stringify({
            message:
              'You have exceeded a secondary rate limit. Please wait a few minutes before trying again.',
            documentation_url:
              'https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits',
          })
        );
        return;
      }

      // 2. Mandatory User-Agent check (Matches GitHub edge proxy invariant)
      const userAgent = req.headers['user-agent'];
      if (!userAgent || userAgent.trim() === '') {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          'Request forbidden by administrative rules. Please make sure your request has a User-Agent header (https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#user-agent-required).'
        );
        return;
      }

      // 3. Auth Check if enabled
      if (requireAuth) {
        const authHeader = req.headers.authorization;
        const validBearer = expectedToken ? `Bearer ${expectedToken}` : null;
        const validToken = expectedToken ? `token ${expectedToken}` : null;
        if (
          !authHeader ||
          (expectedToken && authHeader !== validBearer && authHeader !== validToken)
        ) {
          res.statusCode = 401;
          res.end(
            JSON.stringify({
              message: 'Bad credentials',
              documentation_url: 'https://docs.github.com/rest',
            })
          );
          return;
        }
      }

      // 4. Injected Error Overrides
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

      // 5. Routing
      // Match GET /repos/:owner/:repo/branches/:branch
      const branchMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/branches\/([^/]+)$/);
      if (branchMatch) {
        const [, owner, repo, branch] = branchMatch;
        const repoData = repos.get(`${owner}/${repo}`.toLowerCase());
        if (!repoData) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: 'Not Found', status: '404' }));
          return;
        }
        const branchData = repoData.branches.get(branch);
        if (!branchData) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: 'Branch not found', status: '404' }));
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify(branchData));
        return;
      }

      // Match GET /repos/:owner/:repo/commits/:ref
      const commitMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/commits\/([^/]+)$/);
      if (commitMatch) {
        const [, owner, repo, ref] = commitMatch;
        const repoData = repos.get(`${owner}/${repo}`.toLowerCase());
        if (!repoData) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: 'Not Found', status: '404' }));
          return;
        }

        // Check if ref is a branch name first
        if (repoData.branches.has(ref)) {
          const branchData = repoData.branches.get(ref);
          const commitSha = branchData.commit.sha;
          const commitData = repoData.commits.get(commitSha);
          res.statusCode = 200;
          res.end(
            JSON.stringify(
              commitData || { sha: commitSha, commit: { message: 'Commit on branch ' + ref } }
            )
          );
          return;
        }

        // Check commit by SHA
        const commitData = repoData.commits.get(ref);
        if (!commitData) {
          // GitHub returns 422 Unprocessable Entity when commit ref is not found!
          res.statusCode = 422;
          res.end(
            JSON.stringify({
              message: `No commit found for SHA: ${ref}`,
              documentation_url: 'https://docs.github.com/rest/commits/commits#get-a-commit',
              status: '422',
            })
          );
          return;
        }

        res.statusCode = 200;
        res.end(JSON.stringify(commitData));
        return;
      }

      // Match GET /repos/:owner/:repo/compare/:base...:head
      const compareMatch = pathname.match(
        /^\/repos\/([^/]+)\/([^/]+)\/compare\/([^.]+)\.\.\.([^.]+)$/
      );
      if (compareMatch) {
        const [, owner, repo, base, head] = compareMatch;
        const repoData = repos.get(`${owner}/${repo}`.toLowerCase());
        if (!repoData) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: 'Not Found', status: '404' }));
          return;
        }

        const compareKey = `${base}...${head}`;
        if (repoData.compare.has(compareKey)) {
          res.statusCode = 200;
          res.end(JSON.stringify(repoData.compare.get(compareKey)));
          return;
        }

        // Default comparison resolution
        if (base === head) {
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: 'identical',
              ahead_by: 0,
              behind_by: 0,
              total_commits: 0,
              commits: [],
            })
          );
          return;
        }

        // Default: If not explicitly configured and not identical, return ahead or diverged based on registered commits
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            status: 'ahead',
            ahead_by: 1,
            behind_by: 0,
            total_commits: 1,
            commits: [{ sha: head, commit: { message: 'Comparison commit' } }],
          })
        );
        return;
      }

      // Unmatched route
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found', status: '404' }));
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
     * Start the mock HTTP server
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
     * Stop the mock server and destroy all active connections
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
      repos.clear();
      errorOverrides.clear();
      requestLog.length = 0;
    },

    /**
     * Set or update a branch in a repository
     * @param {string} owner
     * @param {string} repo
     * @param {string} branch
     * @param {string} commitSha
     * @param {string} [commitMessage]
     */
    setBranch(owner, repo, branch, commitSha, commitMessage = 'Commit message') {
      const repoData = ensureRepo(owner, repo);
      const branchPayload = {
        name: branch,
        commit: {
          sha: commitSha,
          node_id: `C_${commitSha.slice(0, 10)}`,
          commit: {
            author: {
              name: 'Test Author',
              email: 'test@example.com',
              date: new Date().toISOString(),
            },
            committer: {
              name: 'Test Author',
              email: 'test@example.com',
              date: new Date().toISOString(),
            },
            message: commitMessage,
            tree: { sha: `tree_${commitSha.slice(0, 10)}` },
          },
          parents: [],
        },
        _links: {
          self: `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
          html: `https://github.com/${owner}/${repo}/tree/${branch}`,
        },
        protected: true,
      };
      repoData.branches.set(branch, branchPayload);
      repoData.commits.set(commitSha, {
        sha: commitSha,
        commit: branchPayload.commit.commit,
        parents: [],
        stats: { total: 1, additions: 1, deletions: 0 },
        files: [],
      });
    },

    /**
     * Add a commit directly to the repository commits store
     * @param {string} owner
     * @param {string} repo
     * @param {string} sha
     * @param {string} [message]
     */
    setCommit(owner, repo, sha, message = 'Commit') {
      const repoData = ensureRepo(owner, repo);
      repoData.commits.set(sha, {
        sha,
        commit: {
          author: {
            name: 'Test Author',
            email: 'test@example.com',
            date: new Date().toISOString(),
          },
          committer: {
            name: 'Test Author',
            email: 'test@example.com',
            date: new Date().toISOString(),
          },
          message,
        },
        parents: [],
      });
    },

    /**
     * Set commit comparison outcome
     * @param {string} owner
     * @param {string} repo
     * @param {string} base
     * @param {string} head
     * @param {object} result
     * @param {'identical'|'ahead'|'behind'|'diverged'} result.status
     * @param {number} result.ahead_by
     * @param {number} result.behind_by
     * @param {number} [result.total_commits]
     * @param {any[]} [result.commits]
     */
    setCompare(owner, repo, base, head, result) {
      const repoData = ensureRepo(owner, repo);
      repoData.compare.set(`${base}...${head}`, {
        status: result.status,
        ahead_by: result.ahead_by,
        behind_by: result.behind_by,
        total_commits: result.total_commits ?? result.ahead_by + result.behind_by,
        commits: result.commits ?? [],
      });
    },

    /**
     * Configure rate limit response
     * @param {object} options
     * @param {number} [options.limit]
     * @param {number} [options.remaining]
     * @param {number} [options.reset]
     * @param {number|null} [options.retryAfter]
     */
    setRateLimit(options) {
      rateLimit = {
        limit: options.limit ?? rateLimit.limit,
        remaining: options.remaining ?? rateLimit.remaining,
        reset: options.reset ?? rateLimit.reset,
        used: (options.limit ?? rateLimit.limit) - (options.remaining ?? rateLimit.remaining),
        retryAfter: options.retryAfter !== undefined ? options.retryAfter : rateLimit.retryAfter,
      };
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
     * Set whether authentication is strictly required
     * @param {boolean} required
     */
    setRequireAuth(required) {
      requireAuth = required;
    },

    /**
     * Get array of all requests received by the mock server
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
