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
