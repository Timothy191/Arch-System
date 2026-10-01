// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  WatchdogError,
  VercelApiError,
  VercelAuthError,
  VercelProjectNotFoundError,
  VercelRateLimitError,
} from './errors.mjs';

export const COMMIT_SHA_REGEX = /^[0-9a-f]{40,64}$/i;
export const VERCEL_DOMAIN_REGEX = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export const IN_FLIGHT_STATES = ['BUILDING', 'INITIALIZING', 'QUEUED'];
export const DEFAULT_VERCEL_API_URL = 'https://api.vercel.com';

/**
 * @typedef {Object} VercelContext
 * @property {string} projectId
 * @property {string} [teamId]
 * @property {string} [token]
 * @property {string} [deployHookUrl]
 * @property {string} [apiUrl]
 */

/**
 * @typedef {Object} VercelDeploymentState
 * @property {string|null} commit - 40-char commit SHA of serving production deployment
 * @property {string|null} deploymentId - Deployment UID
 * @property {string|null} url - Domain or deployment URL
 * @property {'READY'|'BUILDING'|'INITIALIZING'|'QUEUED'|'ERROR'|'CANCELED'|'UNKNOWN'|string} state
 * @property {string|null} [inFlightCommit] - Commit SHA of active building deployment if any
 */

/**
 * Resolve candidate directories for Vercel CLI global configuration across platforms.
 * Adheres to modern XDG standards on Linux, standard dotfolder fallback, macOS, and Windows.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {string[]}
 */
export function getVercelCliConfigDirs(env = process.env) {
  const dirs = [];
  const homedir = os.homedir();

  // 1. Linux XDG Data Home (modern Vercel CLI global storage)
  if (env.XDG_DATA_HOME) {
    dirs.push(path.join(env.XDG_DATA_HOME, 'com.vercel.cli'));
  } else {
    dirs.push(path.join(homedir, '.local', 'share', 'com.vercel.cli'));
  }

  // 2. Legacy / Standard home directory dotfolder
  dirs.push(path.join(homedir, '.vercel'));

  // 3. macOS Application Support
  dirs.push(path.join(homedir, 'Library', 'Application Support', 'com.vercel.cli'));

  // 4. Windows Local AppData
  if (env.LOCALAPPDATA) {
    dirs.push(path.join(env.LOCALAPPDATA, 'com.vercel.cli'));
  } else {
    dirs.push(path.join(homedir, 'AppData', 'Local', 'com.vercel.cli'));
  }

  return dirs;
}

/**
 * Resolve Vercel authentication token from options, environment variables, or CLI auth.json.
 * Priority: options.token -> env.VERCEL_TOKEN -> env.VC_TOKEN -> auth.json
 *
 * @param {object} [options={}]
 * @returns {string|null}
 */
export function resolveVercelToken(options = {}) {
  if (options.token && typeof options.token === 'string' && options.token.trim()) {
    return options.token.trim();
  }

  const env = options.env || process.env;
  if (env.VERCEL_TOKEN !== undefined) {
    return env.VERCEL_TOKEN.trim() || null;
  }
  if (env.VC_TOKEN !== undefined) {
    return env.VC_TOKEN.trim() || null;
  }
  if (env.VERCEL_API_URL) {
    return null;
  }

  // Probe global CLI auth files across candidate directories
  const candidateDirs = getVercelCliConfigDirs(env);
  for (const dir of candidateDirs) {
    const authPath = path.join(dir, 'auth.json');
    try {
      if (fs.existsSync(authPath)) {
        const raw = fs.readFileSync(authPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.token && typeof parsed.token === 'string' && parsed.token.trim()) {
          return parsed.token.trim();
        }
      }
    } catch {
      // Ignore unreadable or malformed files, proceed to next candidate
    }
  }

  return null;
}

/**
 * Locate and parse project-local Vercel configuration files (.vercel/project.json or .vercel/repo.json).
 * Traverses upwards from startDir to git root or filesystem root.
 *
 * @param {string} [startDir=process.cwd()]
 * @param {number} [maxDepth=15]
 * @returns {{ projectId?: string, teamId?: string, projectName?: string, configPath?: string }|null}
 */
export function findVercelProjectConfig(startDir = process.cwd(), maxDepth = 15) {
  let current = path.resolve(startDir);
  let depth = 0;

  while (depth < maxDepth) {
    const vercelDir = path.join(current, '.vercel');

    // 1. Check .vercel/project.json (standalone project link)
    const projectJsonPath = path.join(vercelDir, 'project.json');
    try {
      if (fs.existsSync(projectJsonPath)) {
        const content = fs.readFileSync(projectJsonPath, 'utf8');
        const json = JSON.parse(content);
        const projectId = json.projectId || json.id || json.projectName;
        const teamId = json.orgId || json.teamId;
        const projectName = json.projectName || json.name;
        if (projectId) {
          return { projectId, teamId, projectName, configPath: projectJsonPath };
        }
      }
    } catch {
      // Ignore read errors
    }

    // 2. Check .vercel/repo.json (monorepo root configuration)
    const repoJsonPath = path.join(vercelDir, 'repo.json');
    try {
      if (fs.existsSync(repoJsonPath)) {
        const content = fs.readFileSync(repoJsonPath, 'utf8');
        const json = JSON.parse(content);
        if (Array.isArray(json.projects) && json.projects.length > 0) {
          const relPath = path.relative(current, startDir) || '.';
          const match =
            json.projects.find((/** @type {any} */ p) => p.directory === relPath) ||
            json.projects.find((/** @type {any} */ p) => p.directory === '.') ||
            json.projects[0];

          if (match) {
            const projectId = match.id || match.name;
            const teamId = match.orgId || match.teamId;
            const projectName = match.name;
            if (projectId) {
              return { projectId, teamId, projectName, configPath: repoJsonPath };
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    // Stop traversal if git root or filesystem root reached
    const gitDir = path.join(current, '.git');
    const parent = path.dirname(current);
    if (fs.existsSync(gitDir) || parent === current) {
      break;
    }

    current = parent;
    depth += 1;
  }

  return null;
}

/**
 * Discover Vercel context (projectId, teamId, token, deployHookUrl, apiUrl).
 *
 * @param {string|object} [cwdOrOptions=process.cwd()]
 * @param {object} [maybeOptions={}]
 * @returns {Promise<VercelContext>}
 */
export async function discoverVercelContext(cwdOrOptions = process.cwd(), maybeOptions = {}) {
  let cwd = process.cwd();
  /** @type {any} */
  let options = {};

  if (typeof cwdOrOptions === 'string') {
    cwd = cwdOrOptions;
    options = maybeOptions || {};
  } else if (typeof cwdOrOptions === 'object' && cwdOrOptions !== null) {
    options = cwdOrOptions;
    cwd = options.cwd || process.cwd();
  }

  const env = options.env || process.env;
  const projectFileConfig = findVercelProjectConfig(cwd);

  // 1. Resolve Project ID
  let projectId =
    options.projectId ||
    options.project ||
    env.VERCEL_PROJECT_ID ||
    env.PROJECT_ID ||
    projectFileConfig?.projectId;

  // Fallback to repo name or directory name if unconfigured (unless explicitly disabled)
  if (!projectId && options.fallbackToDirName !== false) {
    if (options.repoName && typeof options.repoName === 'string' && options.repoName.trim()) {
      projectId = options.repoName.trim();
    } else {
      const baseName = path.basename(path.resolve(cwd));
      if (baseName && baseName !== '/' && baseName !== '.') {
        projectId = baseName;
      }
    }
  }

  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new VercelApiError(
      'Unable to discover Vercel project ID from environment (VERCEL_PROJECT_ID) or project configuration (.vercel/project.json, .vercel/repo.json)',
      { code: 'ERR_VERCEL_CONTEXT_NOT_FOUND', exitCode: 2 }
    );
  }
  projectId = projectId.trim();

  // 2. Resolve Team / Org ID
  let teamId =
    options.teamId ||
    options.team ||
    options.orgId ||
    env.VERCEL_ORG_ID ||
    env.VERCEL_TEAM_ID ||
    projectFileConfig?.teamId;

  if (!teamId && options.owner && typeof options.owner === 'string') {
    teamId = options.owner.startsWith('team_') ? options.owner : `team_${options.owner}`;
  }

  // Fallback to CLI config.json currentTeam if team not found yet (only for production cloud endpoints)
  if (!teamId && !env.VERCEL_API_URL) {
    const candidateDirs = getVercelCliConfigDirs(env);
    for (const dir of candidateDirs) {
      const configPath = path.join(dir, 'config.json');
      try {
        if (fs.existsSync(configPath)) {
          const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (conf.currentTeam && typeof conf.currentTeam === 'string') {
            teamId = conf.currentTeam.trim();
            break;
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  if (teamId && typeof teamId === 'string' && teamId.trim()) {
    teamId = teamId.trim();
  } else {
    teamId = undefined;
  }

  // 3. Resolve Token
  const token = resolveVercelToken({ ...options, env }) || undefined;

  // 4. Resolve Deploy Hook URL
  let deployHookUrl = options.deployHookUrl || env.VERCEL_DEPLOY_HOOK_URL || undefined;

  if (deployHookUrl && typeof deployHookUrl === 'string' && deployHookUrl.trim()) {
    deployHookUrl = deployHookUrl.trim();
  } else {
    deployHookUrl = undefined;
  }

  // 5. Resolve API Base URL
  const apiUrl = options.apiUrl || env.VERCEL_API_URL || DEFAULT_VERCEL_API_URL;

  return {
    projectId,
    ...(teamId ? { teamId } : {}),
    ...(token ? { token } : {}),
    ...(deployHookUrl ? { deployHookUrl } : {}),
    apiUrl,
  };
}

/**
 * Construct URL for Vercel REST API endpoint enforcing automatic team scoping query parameter.
 *
 * @param {string} baseUrl - e.g. "https://api.vercel.com"
 * @param {string} endpointPath - e.g. "/v6/deployments"
 * @param {Record<string, string|number|boolean|undefined|null>} [queryParams={}]
 * @param {VercelContext} [context]
 * @returns {string} Fully qualified URL string
 */
export function buildVercelUrl(baseUrl, endpointPath, queryParams = {}, context) {
  const cleanBase = (baseUrl || DEFAULT_VERCEL_API_URL).replace(/\/+$/, '');
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const url = new URL(`${cleanBase}${cleanPath}`);

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  // Automatic team scoping: append teamId if present and not already set
  const teamId = context?.teamId;
  if (teamId && !url.searchParams.has('teamId') && !url.searchParams.has('slug')) {
    url.searchParams.set('teamId', teamId);
  }

  return url.toString();
}

/**
 * Create standard HTTP headers for Vercel API requests.
 *
 * @param {string} [token]
 * @returns {Record<string, string>}
 */
export function createVercelHeaders(token) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'zero-drift-watchdog/1.0.0 (anti-drift synchronization watchdog)',
  };
  if (token && typeof token === 'string' && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }
  return headers;
}

/**
 * Extract commit SHA from a Vercel deployment or target object according to the authoritative hierarchy:
 * 1. meta.githubCommitSha (GitHub App integration)
 * 2. gitSource.sha (Canonical VCS descriptor)
 * 3. meta.commitSha (CLI or custom deploy)
 * 4. Extended fallbacks: gitlabCommitSha, bitbucketCommitSha, vcsCommitSha, sha
 *
 * @param {any} deployment - Deployment object or project target object
 * @returns {string|null} 40-64 char commit SHA or null if none found
 */
export function extractCommitSha(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    return null;
  }

  // 1. Direct GitHub commit SHA metadata
  if (
    typeof deployment.meta?.githubCommitSha === 'string' &&
    deployment.meta.githubCommitSha.trim()
  ) {
    const candidate = deployment.meta.githubCommitSha.trim();
    if (COMMIT_SHA_REGEX.test(candidate)) return candidate;
  }

  // 2. Canonical gitSource object
  if (typeof deployment.gitSource?.sha === 'string' && deployment.gitSource.sha.trim()) {
    const candidate = deployment.gitSource.sha.trim();
    if (COMMIT_SHA_REGEX.test(candidate)) return candidate;
  }

  // 3. Generic or CLI commitSha metadata
  if (typeof deployment.meta?.commitSha === 'string' && deployment.meta.commitSha.trim()) {
    const candidate = deployment.meta.commitSha.trim();
    if (COMMIT_SHA_REGEX.test(candidate)) return candidate;
  }

  // 4. Extended Fallbacks
  const extendedCandidates = [
    deployment.meta?.gitlabCommitSha,
    deployment.meta?.bitbucketCommitSha,
    deployment.meta?.vcsCommitSha,
    deployment.meta?.sha,
  ];

  for (const candidate of extendedCandidates) {
    if (
      typeof candidate === 'string' &&
      candidate.trim() &&
      COMMIT_SHA_REGEX.test(candidate.trim())
    ) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Query Vercel deployments collection (/v6/deployments).
 *
 * @param {object} params
 * @param {string} params.projectId
 * @param {string} [params.target='production']
 * @param {string} [params.state] - e.g. 'READY', 'BUILDING'
 * @param {number} [params.limit=10]
 * @param {string} [params.teamId]
 * @param {string} [params.token]
 * @param {object} [options={}]
 * @param {string} [options.apiUrl='https://api.vercel.com']
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<{ deployments: Array<any>, pagination: any }>}
 */
export async function fetchDeployments(params, options = {}) {
  const baseUrl = options.apiUrl || 'https://api.vercel.com';
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const token = params.token;

  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new VercelAuthError('Vercel API token is missing or empty. Please set VERCEL_TOKEN.', {
      missingToken: true,
      endpoint: `${baseUrl}/v6/deployments`,
    });
  }

  const url = new URL(`${baseUrl}/v6/deployments`);
  url.searchParams.set('projectId', params.projectId);
  if (params.target) url.searchParams.set('target', params.target);
  if (params.state) url.searchParams.set('state', params.state);
  url.searchParams.set('limit', String(params.limit ?? 10));
  if (params.teamId) url.searchParams.set('teamId', params.teamId);

  let res;
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: createVercelHeaders(token),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    });
  } catch (netErr) {
    if (netErr instanceof WatchdogError) throw netErr;
    throw new VercelApiError(
      `Network request failed for Vercel deployments: ${/** @type {Error} */ (netErr).message}`,
      {
        code: 'ERR_VERCEL_NETWORK',
        cause: /** @type {Error} */ (netErr),
        endpoint: url.toString(),
      }
    );
  }

  // Handle rate limiting (429)
  if (res.status === 429) {
    const retryAfter = res.headers?.get?.('retry-after');
    const retrySec = retryAfter ? parseInt(retryAfter, 10) : 60;
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelRateLimitError(`Vercel rate limit exceeded. Retry after ${retrySec}s.`, {
      retryAfterSec: retrySec,
      resetEpoch: errBody?.error?.limit?.reset ?? null,
      endpoint: url.toString(),
      headers: res.headers,
      responseBody: errBody,
    });
  }

  // Handle authentication failure (401 / 403)
  if (res.status === 401 || res.status === 403) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    const isMissing = errBody?.error?.missingToken === true || !token;
    const isInvalid = errBody?.error?.invalidToken === true || !isMissing;
    throw new VercelAuthError(
      errBody?.error?.message || `Forbidden: Vercel authentication failed (HTTP ${res.status})`,
      {
        missingToken: isMissing,
        invalidToken: isInvalid,
        endpoint: url.toString(),
        responseBody: errBody,
        headers: res.headers,
      }
    );
  }

  // Handle not found (404)
  if (res.status === 404) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelProjectNotFoundError(params.projectId, {
      teamId: params.teamId,
      endpoint: url.toString(),
      responseBody: errBody,
      headers: res.headers,
    });
  }

  if (!res.ok) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelApiError(
      errBody?.error?.message || `Vercel deployments query failed: ${res.status} ${res.statusText}`,
      {
        statusCode: res.status,
        statusText: res.statusText,
        endpoint: url.toString(),
        responseBody: errBody,
      }
    );
  }

  const data = await res.json();
  return {
    deployments: Array.isArray(data.deployments) ? data.deployments : [],
    pagination: data.pagination || null,
  };
}

/**
 * Query Vercel project details (/v9/projects/:idOrName) including targets.production.
 *
 * @param {string} idOrName - Project ID or name
 * @param {object} params
 * @param {string} [params.teamId]
 * @param {string} [params.token]
 * @param {object} [options={}]
 * @param {string} [options.apiUrl='https://api.vercel.com']
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<any>} Full project object
 */
export async function fetchProject(idOrName, params, options = {}) {
  const baseUrl = options.apiUrl || 'https://api.vercel.com';
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const token = params.token;

  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new VercelAuthError('Vercel API token is missing or empty. Please set VERCEL_TOKEN.', {
      missingToken: true,
      endpoint: `${baseUrl}/v9/projects/${encodeURIComponent(idOrName)}`,
    });
  }

  const url = new URL(`${baseUrl}/v9/projects/${encodeURIComponent(idOrName)}`);
  if (params.teamId) url.searchParams.set('teamId', params.teamId);

  let res;
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: createVercelHeaders(token),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    });
  } catch (netErr) {
    if (netErr instanceof WatchdogError) throw netErr;
    throw new VercelApiError(
      `Network request failed for Vercel project: ${/** @type {Error} */ (netErr).message}`,
      {
        code: 'ERR_VERCEL_NETWORK',
        cause: /** @type {Error} */ (netErr),
        endpoint: url.toString(),
      }
    );
  }

  if (res.status === 404) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelProjectNotFoundError(idOrName, {
      teamId: params.teamId,
      endpoint: url.toString(),
      responseBody: errBody,
      headers: res.headers,
    });
  }

  if (res.status === 401 || res.status === 403) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    const isMissing = errBody?.error?.missingToken === true || !token;
    const isInvalid = errBody?.error?.invalidToken === true || !isMissing;
    throw new VercelAuthError(
      errBody?.error?.message || `Forbidden: Vercel authentication failed (HTTP ${res.status})`,
      {
        missingToken: isMissing,
        invalidToken: isInvalid,
        endpoint: url.toString(),
        responseBody: errBody,
        headers: res.headers,
      }
    );
  }

  if (res.status === 429) {
    const retryAfter = res.headers?.get?.('retry-after');
    const retrySec = retryAfter ? parseInt(retryAfter, 10) : 60;
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelRateLimitError(`Vercel rate limit exceeded. Retry after ${retrySec}s.`, {
      retryAfterSec: retrySec,
      resetEpoch: errBody?.error?.limit?.reset ?? null,
      endpoint: url.toString(),
      headers: res.headers,
      responseBody: errBody,
    });
  }

  if (!res.ok) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelApiError(`Vercel project query failed: ${res.status} ${res.statusText}`, {
      statusCode: res.status,
      statusText: res.statusText,
      endpoint: url.toString(),
      responseBody: errBody,
    });
  }

  return await res.json();
}

/**
 * Resolve deploy hook URL from context, env, or by querying project link.deployHooks.
 *
 * @param {VercelContext} context
 * @param {object} [options={}]
 * @param {string} [options.branch='main']
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<string|null>}
 */
export async function resolveDeployHookUrl(context, options = {}) {
  if (context.deployHookUrl) {
    return context.deployHookUrl;
  }

  const env = options.env || process.env;
  if (env.VERCEL_DEPLOY_HOOK_URL && typeof env.VERCEL_DEPLOY_HOOK_URL === 'string') {
    return env.VERCEL_DEPLOY_HOOK_URL.trim();
  }

  if (!context.token) {
    return null;
  }

  const targetBranch = options.branch || 'main';
  try {
    const project = await fetchProject(
      context.projectId,
      { teamId: context.teamId, token: context.token },
      { apiUrl: context.apiUrl, fetchImpl: options.fetchImpl }
    );
    const hooks = project?.link?.deployHooks;
    if (Array.isArray(hooks) && hooks.length > 0) {
      const matchingHook =
        hooks.find((/** @type {any} */ h) => h.ref === targetBranch) ||
        hooks.find((/** @type {any} */ h) => /prod/i.test(h.name || '')) ||
        hooks[0];
      if (matchingHook?.url) {
        return matchingHook.url;
      }
    }
  } catch {
    // Graceful fallback to null if link or hooks unavailable
  }

  return null;
}

/**
 * Trigger deployment build via Vercel Deploy Hook URL.
 * Webhooks require HTTP POST with empty JSON body and no Authorization header.
 *
 * @param {string} hookUrl
 * @param {object} [options={}]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<any>}
 */
export async function triggerDeployHook(hookUrl, options = {}) {
  if (!hookUrl || typeof hookUrl !== 'string' || !hookUrl.trim()) {
    throw new VercelApiError('Deploy hook URL is required to trigger deployment', {
      code: 'ERR_VERCEL_DEPLOY_HOOK_MISSING',
      exitCode: 2,
    });
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const res = await fetchImpl(hookUrl.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'zero-drift-watchdog/1.0.0 (anti-drift synchronization watchdog)',
    },
    body: JSON.stringify({}),
    signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
  });

  if (!res.ok) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {}
    throw new VercelApiError(`Deploy hook invocation failed: ${res.status} ${res.statusText}`, {
      statusCode: res.status,
      statusText: res.statusText,
      endpoint: hookUrl,
      responseBody: errBody,
    });
  }

  try {
    return await res.json();
  } catch {
    return { ok: true };
  }
}

/**
 * Inspect active Vercel production deployment and in-flight build status.
 *
 * Features:
 * - Queries deployments on production target with team scoping (?teamId=)
 * - Detects active in-flight builds (BUILDING, INITIALIZING, QUEUED)
 * - Returns serving production `commit` and pending `inFlightCommit`
 * - Strict commit SHA extraction hierarchy (githubCommitSha > gitSource.sha > commitSha)
 * - Rate limit resilience (429 -> VercelRateLimitError)
 * - Project not found detection (404 -> VercelProjectNotFoundError)
 *
 * @param {VercelContext} context
 * @param {object} [options={}]
 * @param {string} [options.token]
 * @param {string} [options.teamId]
 * @param {string} [options.apiUrl]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.limit=10]
 * @returns {Promise<VercelDeploymentState>}
 */
export async function inspectVercelDeployment(context, options = {}) {
  const projectId = options.projectId || context?.projectId;
  const teamId = options.teamId !== undefined ? options.teamId : context?.teamId;
  const token = options.token !== undefined ? options.token : context?.token;
  const apiUrl =
    options.apiUrl || context?.apiUrl || process.env.VERCEL_API_URL || DEFAULT_VERCEL_API_URL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new VercelApiError('Missing required Vercel projectId', {
      code: 'ERR_VERCEL_PROJECT_REQUIRED',
      exitCode: 2,
    });
  }

  // Preflight check for token
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new VercelAuthError('Vercel API token is missing or empty. Please set VERCEL_TOKEN.', {
      missingToken: true,
      endpoint: `${apiUrl}/v6/deployments`,
    });
  }

  // Domain Alias Resolution Shortcut (e.g. *.vercel.app)
  if (
    VERCEL_DOMAIN_REGEX.test(projectId) &&
    !projectId.startsWith('prj_') &&
    projectId.includes('.')
  ) {
    try {
      const aliasUrl = new URL(`${apiUrl}/v13/deployments/${encodeURIComponent(projectId)}`);
      if (teamId) aliasUrl.searchParams.set('teamId', teamId);

      const aliasRes = await fetchImpl(aliasUrl.toString(), {
        method: 'GET',
        headers: createVercelHeaders(token),
      });

      if (aliasRes.ok) {
        const dpl = await aliasRes.json();
        const commitSha = extractCommitSha(dpl);
        return {
          commit: commitSha,
          deploymentId: dpl.uid || dpl.id || null,
          url: dpl.url || projectId,
          state: dpl.readyState || dpl.state || 'READY',
          inFlightCommit: null,
        };
      }
    } catch {
      // Fall through to standard deployments query
    }
  }

  // Query deployments collection (target=production) without state filter
  // This single request retrieves both serving and in-flight deployments in reverse-chronological order
  const deploymentsResult = await fetchDeployments(
    {
      projectId,
      target: 'production',
      limit: options.limit || 10,
      teamId,
      token,
    },
    { apiUrl, fetchImpl }
  );

  const deployments = deploymentsResult.deployments;

  // Handle empty deployments array: verify if project exists via /v9/projects/:idOrName
  if (deployments.length === 0) {
    try {
      const project = await fetchProject(projectId, { teamId, token }, { apiUrl, fetchImpl });
      // If project has targets.production, use it as fallback
      if (project?.targets?.production) {
        const prod = project.targets.production;
        return {
          commit: extractCommitSha(prod),
          deploymentId: prod.id || null,
          url: `${project.name || projectId}.vercel.app`,
          state: prod.readyState || 'READY',
          inFlightCommit: null,
        };
      }
    } catch (err) {
      if (err instanceof WatchdogError) throw err;
      // If error occurred during project verification, rethrow as VercelApiError
      throw new VercelApiError(
        `Failed to verify project existence: ${/** @type {Error} */ (err).message}`,
        {
          cause: /** @type {Error} */ (err),
          endpoint: `${apiUrl}/v9/projects/${encodeURIComponent(projectId)}`,
        }
      );
    }

    return {
      commit: null,
      deploymentId: null,
      url: null,
      state: 'UNKNOWN',
      inFlightCommit: null,
    };
  }

  // In-flight detection: Check if any newest deployment is in progress
  const inFlightDpl = deployments.find((d) =>
    IN_FLIGHT_STATES.includes(String(d.readyState || d.state).toUpperCase())
  );
  const readyDpl = deployments.find(
    (d) => String(d.readyState || d.state).toUpperCase() === 'READY'
  );

  const inFlightCommit = inFlightDpl ? extractCommitSha(inFlightDpl) : null;
  const inFlightState = inFlightDpl
    ? String(inFlightDpl.readyState || inFlightDpl.state).toUpperCase()
    : null;

  if (inFlightDpl) {
    return {
      commit: readyDpl ? extractCommitSha(readyDpl) : null,
      deploymentId: readyDpl ? readyDpl.uid || readyDpl.id : inFlightDpl.uid || inFlightDpl.id,
      url: readyDpl ? readyDpl.url : inFlightDpl.url,
      state: inFlightState, // 'BUILDING', 'INITIALIZING', or 'QUEUED'
      inFlightCommit,
    };
  }

  if (readyDpl) {
    return {
      commit: extractCommitSha(readyDpl),
      deploymentId: readyDpl.uid || readyDpl.id,
      url: readyDpl.url,
      state: 'READY',
      inFlightCommit: null,
    };
  }

  // No in-flight and no READY deployment (e.g. ERROR or CANCELED deployment)
  const latest = deployments[0];
  return {
    commit: extractCommitSha(latest),
    deploymentId: latest.uid || latest.id,
    url: latest.url,
    state: String(latest.readyState || latest.state || 'UNKNOWN').toUpperCase(),
    inFlightCommit: null,
  };
}
