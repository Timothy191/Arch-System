// @ts-check
import path from 'node:path';
import {
  runGit,
  inspectLocalGit,
  discoverGitHubContext,
  inspectGitHubRemote,
  resolveGitHubToken,
} from './git-inspector.mjs';
import {
  discoverVercelContext,
  inspectVercelDeployment,
  triggerDeployHook,
  resolveDeployHookUrl,
  createVercelHeaders,
  resolveVercelToken,
  IN_FLIGHT_STATES,
  DEFAULT_VERCEL_API_URL,
} from './vercel-inspector.mjs';
import {
  WatchdogError,
  GitError,
  UncommittedChangesError,
  VercelApiError,
  VercelAuthError,
  VercelProjectNotFoundError,
  TimeoutError,
} from './errors.mjs';

export { IN_FLIGHT_STATES, TimeoutError };

/**
 * @typedef {Object} LocalGitState
 * @property {string} commit
 * @property {string} branch
 * @property {boolean} isClean
 * @property {string[]} uncommittedFiles
 * @property {boolean} isDetached
 * @property {boolean} [isUnborn]
 */

/**
 * @typedef {Object} GitHubRemoteState
 * @property {string} commit
 * @property {string} branch
 * @property {'identical'|'ahead'|'behind'|'diverged'} [statusWithLocal]
 * @property {number} [aheadBy]
 * @property {number} [behindBy]
 */

/**
 * @typedef {Object} VercelDeploymentState
 * @property {string|null} commit
 * @property {string|null} deploymentId
 * @property {string|null} url
 * @property {'READY'|'BUILDING'|'INITIALIZING'|'QUEUED'|'ERROR'|'UNKNOWN'|string} state
 * @property {string|null} [inFlightCommit]
 */

/**
 * @typedef {Object} DriftTargetContext
 * @property {string} directory
 * @property {string} branch
 * @property {string} repository
 * @property {string} vercelProject
 */

/**
 * @typedef {Object} DriftClassification
 * @property {boolean} hasDrift
 * @property {boolean} localAhead
 * @property {boolean} localBehind
 * @property {boolean} githubBehind
 * @property {boolean} vercelBehind
 * @property {boolean} dirtyWorkingTree
 * @property {boolean} isDirty
 * @property {boolean} diverged
 * @property {boolean} inFlight
 */

/**
 * @typedef {Object} DriftReport
 * @property {string} timestamp
 * @property {DriftTargetContext} target
 * @property {{ local: LocalGitState, github: GitHubRemoteState, vercel: VercelDeploymentState }} state
 * @property {DriftClassification} drift
 * @property {string[]} actionsTaken
 * @property {boolean} resolved
 */

/**
 * Evaluate Tri-State Drift across Local Git, GitHub Remote, and Vercel Deployment states.
 *
 * @param {LocalGitState} [local]
 * @param {GitHubRemoteState} [github]
 * @param {VercelDeploymentState} [vercel]
 * @param {Partial<DriftTargetContext>} [targetContext={}]
 * @returns {DriftReport}
 */
export function evaluateDrift(local, github, vercel, targetContext = {}) {
  const safeLocal = local || {
    commit: '',
    branch: '',
    isClean: true,
    uncommittedFiles: [],
    isDetached: false,
    isUnborn: false,
  };

  const safeGithub = github || {
    commit: '',
    branch: safeLocal.branch || 'main',
    statusWithLocal: 'identical',
    aheadBy: 0,
    behindBy: 0,
  };

  const safeVercel = vercel || {
    commit: null,
    deploymentId: null,
    url: null,
    state: 'UNKNOWN',
    inFlightCommit: null,
  };

  // 1. Working tree cleanliness
  const isDirty =
    safeLocal.isClean === false ||
    (Array.isArray(safeLocal.uncommittedFiles) && safeLocal.uncommittedFiles.length > 0);
  const dirtyWorkingTree = isDirty;
  const isClean = !isDirty;

  // 2. In-flight build detection
  const vercelStateUpper = String(safeVercel.state || '').toUpperCase();
  const isInFlightState = IN_FLIGHT_STATES.includes(vercelStateUpper);
  const inFlight = Boolean(
    (safeVercel.inFlightCommit &&
      safeGithub.commit &&
      safeVercel.inFlightCommit === safeGithub.commit) ||
      (isInFlightState &&
        safeVercel.inFlightCommit &&
        safeVercel.inFlightCommit === safeGithub.commit) ||
      (isInFlightState && !safeVercel.commit && safeVercel.inFlightCommit) ||
      (isInFlightState &&
        safeVercel.inFlightCommit &&
        safeVercel.inFlightCommit === safeLocal.commit)
  );

  // 3. Git tri-state relative positioning
  // In GitHubRemoteState convention:
  // 'behind'   = remote is behind local (local has unpushed commits -> localAhead = true)
  // 'ahead'    = remote is ahead of local (local is behind remote -> localBehind = true)
  // 'diverged' = remote and local have diverged (diverged = true)
  const status = safeGithub.statusWithLocal || 'identical';
  const aheadBy = Number(safeGithub.aheadBy || 0);
  const behindBy = Number(safeGithub.behindBy || 0);

  const isDiverged = status === 'diverged' || (aheadBy > 0 && behindBy > 0);

  let isLocalAhead = false;
  let isLocalBehind = false;

  if (safeGithub.commit && safeLocal.commit && safeGithub.commit === safeLocal.commit) {
    isLocalAhead = false;
    isLocalBehind = false;
  } else if (!isDiverged) {
    if (status === 'behind' || (behindBy > 0 && aheadBy === 0)) {
      isLocalAhead = true;
    } else if (status === 'ahead' || (aheadBy > 0 && behindBy === 0)) {
      isLocalBehind = true;
    } else if (safeLocal.commit && !safeGithub.commit) {
      isLocalAhead = true;
    } else if (safeGithub.commit && !safeLocal.commit) {
      isLocalBehind = true;
    } else if (safeLocal.commit && safeGithub.commit && safeLocal.commit !== safeGithub.commit) {
      isLocalAhead = true;
    }
  }

  // 4. Vercel deployment parity
  const isVercelBehind = Boolean(safeGithub.commit && safeVercel.commit !== safeGithub.commit);

  // 5. Parity evaluation
  const isParity = Boolean(
    safeLocal.commit &&
      safeGithub.commit &&
      safeVercel.commit &&
      safeLocal.commit === safeGithub.commit &&
      safeGithub.commit === safeVercel.commit &&
      isClean &&
      !isDiverged &&
      !isLocalAhead &&
      !isLocalBehind &&
      !inFlight
  );

  const hasDrift = !isParity;

  // 6. Target Context Resolution
  const target = targetContext?.target || targetContext || {};
  const resolvedTarget = {
    directory: target.directory || (typeof process !== 'undefined' ? process.cwd() : '.'),
    branch: target.branch || safeLocal.branch || safeGithub.branch || 'main',
    repository:
      target.repository ||
      (safeGithub['owner'] && safeGithub['repo']
        ? `${safeGithub['owner']}/${safeGithub['repo']}`
        : 'plantcor/arch-system'),
    vercelProject: target.vercelProject || target['project'] || 'prj_arch_system',
  };

  return {
    timestamp: new Date().toISOString(),
    target: resolvedTarget,
    state: {
      local: {
        commit: safeLocal.commit,
        branch: safeLocal.branch,
        isClean,
        uncommittedFiles: safeLocal.uncommittedFiles || [],
        isDetached: Boolean(safeLocal.isDetached),
        ...(safeLocal.isUnborn !== undefined ? { isUnborn: safeLocal.isUnborn } : {}),
      },
      github: {
        commit: safeGithub.commit,
        branch: safeGithub.branch,
        statusWithLocal: safeGithub.statusWithLocal,
        ...(safeGithub.aheadBy !== undefined ? { aheadBy: safeGithub.aheadBy } : {}),
        ...(safeGithub.behindBy !== undefined ? { behindBy: safeGithub.behindBy } : {}),
      },
      vercel: {
        commit: safeVercel.commit,
        deploymentId: safeVercel.deploymentId,
        url: safeVercel.url,
        state: safeVercel.state,
        inFlightCommit: safeVercel.inFlightCommit ?? null,
      },
    },
    drift: {
      hasDrift,
      localAhead: isLocalAhead,
      localBehind: isLocalBehind,
      githubBehind: isLocalAhead,
      vercelBehind: isVercelBehind,
      dirtyWorkingTree,
      isDirty,
      diverged: isDiverged,
      inFlight,
    },
    actionsTaken: [],
    resolved: !hasDrift,
  };
}

/**
 * Format a human-readable drift report for the terminal.
 *
 * @param {DriftReport} report
 * @returns {string}
 */
export function formatDriftReport(report) {
  const { target, state, drift, timestamp } = report;
  const lines = [];

  if (!drift.hasDrift) {
    lines.push('='.repeat(70));
    lines.push('  ZERO DRIFT WATCHDOG - PARITY CONFIRMED');
    lines.push('='.repeat(70));
    lines.push(`Status:     Zero drift across all environments`);
    lines.push(
      `Target:     ${target.repository} [${target.branch}] (Vercel: ${target.vercelProject})`
    );
    lines.push(`Directory:  ${target.directory}`);
    lines.push(`Timestamp:  ${timestamp}`);
    lines.push('-'.repeat(70));
    lines.push(`• Local HEAD:    ${state.local.commit} (${state.local.branch}, clean)`);
    lines.push(`• GitHub HEAD:   ${state.github.commit} (${state.github.branch})`);
    lines.push(
      `• Vercel Prod:   ${state.vercel.commit} (${state.vercel.url || 'production'}, READY)`
    );
    lines.push('-'.repeat(70));
    lines.push('Tri-state parity confirmed. Zero drift detected.');
    return lines.join('\n');
  }

  lines.push('='.repeat(70));
  lines.push('  ZERO DRIFT WATCHDOG - DRIFT DETECTED');
  lines.push('='.repeat(70));
  lines.push(`Status:     Drift detected across monitored environments`);
  lines.push(
    `Target:     ${target.repository} [${target.branch}] (Vercel: ${target.vercelProject})`
  );
  lines.push(`Directory:  ${target.directory}`);
  lines.push(`Timestamp:  ${timestamp}`);
  lines.push('-'.repeat(70));
  lines.push('Current Environment State:');
  const dirtyTag = drift.isDirty
    ? `dirty (${state.local.uncommittedFiles.length} uncommitted files)`
    : 'clean';
  lines.push(
    `  • Local Git:   ${state.local.commit || '(none)'} [${state.local.branch}] (${dirtyTag})`
  );
  lines.push(`  • GitHub:      ${state.github.commit || '(none)'} [${state.github.branch}]`);
  lines.push(
    `  • Vercel Prod: ${state.vercel.commit || '(none)'} [${state.vercel.state || 'UNKNOWN'}] (${state.vercel.url || 'no url'})`
  );

  if (state.vercel.inFlightCommit) {
    lines.push(
      `  • Vercel Build: in-flight deployment actively building ${state.vercel.inFlightCommit} [${state.vercel.state}] (build in progress)`
    );
  }

  lines.push('-'.repeat(70));
  lines.push('Drift Classifications:');
  if (drift.localAhead) {
    lines.push('  • Local Ahead: Local repository has unpushed commits ahead of GitHub');
  }
  if (drift.localBehind) {
    lines.push('  • Local Behind: Local repository is behind remote GitHub (git pull recommended)');
  }
  if (drift.diverged) {
    lines.push('  • Diverged: Local and GitHub branches have diverged with independent commits');
  }
  if (drift.dirtyWorkingTree) {
    lines.push(
      `  • Dirty Working Tree: Working tree has ${state.local.uncommittedFiles.length} uncommitted change(s)`
    );
  }
  if (drift.vercelBehind) {
    lines.push('  • Vercel Behind: Vercel production deployment is behind GitHub HEAD');
  }
  if (drift.inFlight) {
    lines.push('  • In-Flight Build: Deployment is in-flight and actively building target commit');
  }

  lines.push('-'.repeat(70));
  lines.push(`Resolution Status: ${report.resolved ? 'RESOLVED' : 'UNRESOLVED'}`);
  if (report.actionsTaken && report.actionsTaken.length > 0) {
    lines.push('Actions Taken:');
    for (const act of report.actionsTaken) {
      lines.push(`  - ${act}`);
    }
  } else {
    lines.push('Actions Taken: None (audit mode or manual resolution required)');
  }

  return lines.join('\n');
}

/**
 * Safely push local commits to remote git origin.
 *
 * @param {object} context
 * @param {string} [context.cwd=process.cwd()] - Repository directory
 * @param {string} context.branch - Active branch name
 * @param {string} [context.remote='origin'] - Git remote name
 * @param {boolean} [context.isClean=true]
 * @param {string[]} [context.uncommittedFiles=[]]
 * @param {boolean} [context.isDetached=false]
 * @param {object} [options={}]
 * @param {boolean} [options.skipCleanCheck=false]
 * @param {Function} [options.execFn] - Subprocess DI
 * @param {Record<string, string>} [options.env]
 * @returns {Promise<{ pushed: boolean, output: string }>}
 */
export async function triggerGitPush(context, options = {}) {
  const cwd = context.cwd || process.cwd();
  const branch = context.branch;
  const remote = context.remote || 'origin';

  if (!branch || branch === 'HEAD' || context.isDetached) {
    throw new GitError(
      'Cannot push from detached HEAD state. Switch to a named branch before remediation.',
      {
        code: 'ERR_GIT_DETACHED_HEAD',
        exitCode: 2,
        cwd,
      }
    );
  }

  // Safety Pre-Check: Working Tree Hygiene
  if (!options.skipCleanCheck) {
    if (
      context.isClean === false ||
      (context.uncommittedFiles && context.uncommittedFiles.length > 0)
    ) {
      throw new UncommittedChangesError(context.uncommittedFiles || [], {
        cwd,
        message: `Cannot push to remote: working tree has ${(context.uncommittedFiles || []).length} uncommitted change(s).`,
      });
    }

    const local = await inspectLocalGit(cwd, options);
    if (!local.isClean) {
      throw new UncommittedChangesError(local.uncommittedFiles, {
        cwd,
        message: `Cannot push to remote: working tree has ${local.uncommittedFiles.length} uncommitted change(s).`,
      });
    }
    if (local.isDetached) {
      throw new GitError('Cannot push from detached HEAD state.', {
        code: 'ERR_GIT_DETACHED_HEAD',
        exitCode: 2,
        cwd,
      });
    }
  }

  // Execute git push origin <branch>
  const pushRes = await runGit(['push', remote, branch], cwd, options);
  if (!pushRes.success) {
    const stderr = pushRes.stderr || '';
    if (/non-fast-forward|rejected/i.test(stderr)) {
      throw new GitError(`Git push rejected (non-fast-forward): ${stderr}`, {
        code: 'ERR_GIT_PUSH_REJECTED',
        exitCode: 1,
        cwd,
        stderr,
        stdout: pushRes.stdout,
      });
    }
    if (/permission denied|authentication failed/i.test(stderr)) {
      throw new GitError(`Git push authentication failed: ${stderr}`, {
        code: 'ERR_GIT_PUSH_AUTH',
        exitCode: 2,
        cwd,
        stderr,
      });
    }
    throw new GitError(`Git push failed: ${stderr || pushRes.stdout}`, {
      code: 'ERR_GIT_PUSH_FAILED',
      exitCode: 2,
      cwd,
      stderr,
      stdout: pushRes.stdout,
    });
  }

  return {
    pushed: true,
    output: pushRes.stdout || pushRes.stderr,
  };
}

/**
 * Triggers deployment build on Vercel via Deploy Hook, REST API, or CLI.
 *
 * @param {object} context
 * @param {string} context.projectId - Vercel project ID or name
 * @param {string} [context.teamId] - Team or Org ID
 * @param {string} [context.token] - Vercel bearer token
 * @param {string} [context.deployHookUrl] - Deploy hook URL
 * @param {string} [context.branch='main'] - Branch to deploy
 * @param {string} [context.commitSha] - Target commit SHA
 * @param {object} [options={}]
 * @param {string} [options.apiUrl]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<{ triggered: boolean, method: 'deploy_hook'|'rest_api'|'cli', deploymentId?: string, job?: any }>}
 */
export async function triggerVercelDeploy(context, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 15000;

  // 1. Primary: Deploy Hook URL
  let hookUrl =
    context.deployHookUrl || options.deployHookUrl || process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl && context.token) {
    try {
      hookUrl = await resolveDeployHookUrl(context, {
        ...options,
        branch: context.branch || 'main',
      });
    } catch {}
  }

  if (hookUrl && typeof hookUrl === 'string' && hookUrl.trim()) {
    const res = await triggerDeployHook(hookUrl.trim(), { fetchImpl, timeoutMs });
    return {
      triggered: true,
      method: 'deploy_hook',
      job: res?.job || res,
    };
  }

  // 2. Secondary: Vercel REST API POST /v13/deployments
  const token = context.token || options.token || process.env.VERCEL_TOKEN;
  if (token && typeof token === 'string' && token.trim()) {
    const baseUrl =
      options.apiUrl || context.apiUrl || process.env.VERCEL_API_URL || DEFAULT_VERCEL_API_URL;
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/v13/deployments`);
    if (context.teamId) url.searchParams.set('teamId', context.teamId);
    url.searchParams.set('forceNew', '1');

    const payload = {
      name: context.projectId,
      project: context.projectId,
      target: 'production',
    };
    if (context.commitSha) {
      payload.gitSource = {
        type: 'github',
        ref: context.branch || 'main',
        sha: context.commitSha,
      };
    }

    const apiRes = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        ...createVercelHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      return {
        triggered: true,
        method: 'rest_api',
        deploymentId: data.id || data.uid,
        job: data,
      };
    }

    if (apiRes.status === 401 || apiRes.status === 403) {
      throw new VercelAuthError('Vercel API deployment trigger forbidden or unauthorized.', {
        endpoint: url.toString(),
      });
    }
    if (apiRes.status === 404) {
      throw new VercelProjectNotFoundError(context.projectId, {
        teamId: context.teamId,
        endpoint: url.toString(),
      });
    }
  }

  // 3. Tertiary: Vercel CLI Fallback
  if (options.allowCliFallback !== false) {
    try {
      const { execFileSync } = await import('node:child_process');
      const args = ['deploy', '--prod', '--yes'];
      if (token) args.push('--token', token);
      if (context.teamId) args.push('--scope', context.teamId);

      const out = execFileSync('vercel', args, {
        cwd: options.cwd || process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      });
      return {
        triggered: true,
        method: 'cli',
        job: { output: out.trim() },
      };
    } catch {}
  }

  throw new VercelApiError(
    'Unable to trigger Vercel deployment: No Deploy Hook URL configured and API deployment trigger failed or token missing.',
    { code: 'ERR_VERCEL_NO_TRIGGER_METHOD', exitCode: 2 }
  );
}

/**
 * Polls Vercel deployment until it reaches READY state matching target commit SHA.
 *
 * @param {string} targetSha - Expected 40-char commit SHA
 * @param {object} context - Vercel context
 * @param {object} [options={}]
 * @param {number} [options.pollTimeoutMs=300000]
 * @param {number} [options.pollIntervalMs=5000]
 * @param {number} [options.pollTimeout]
 * @param {number} [options.pollInterval]
 * @param {Function} [options.sleepFn]
 * @param {Function} [options.onPoll]
 * @returns {Promise<{ converged: boolean, deploymentState: VercelDeploymentState, pollCount: number, durationMs: number }>}
 */
export async function pollVercelDeploymentConvergence(targetSha, context, options = {}) {
  const pollIntervalMs =
    options.pollInterval !== undefined
      ? Number(options.pollInterval) * 1000
      : options.pollIntervalMs
        ? Number(options.pollIntervalMs)
        : 5000;

  const pollTimeoutMs =
    options.pollTimeout !== undefined
      ? Number(options.pollTimeout) * 1000
      : options.pollTimeoutMs
        ? Number(options.pollTimeoutMs)
        : 300000;

  const sleep = options.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const onPoll = options.onPoll || (() => {});

  const startTime = Date.now();
  let pollCount = 0;
  let lastState = null;

  while (true) {
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs >= pollTimeoutMs) {
      const timeoutSec = Math.round(pollTimeoutMs / 1000);
      throw new TimeoutError(
        `Vercel deployment polling timed out after ${timeoutSec}s. Target commit: ${targetSha}, last state: ${lastState?.state || 'UNKNOWN'}`,
        {
          timeoutMs: pollTimeoutMs,
          operation: 'vercel_convergence',
          exitCode: 1,
        }
      );
    }

    pollCount++;
    const vcState = await inspectVercelDeployment(context, options);
    lastState = vcState;
    onPoll({ count: pollCount, pollCount, state: vcState, elapsedMs });

    const rawState = String(vcState.state || '').toUpperCase();
    if (rawState === 'ERROR' || rawState === 'CANCELED') {
      throw new VercelApiError(
        `Vercel deployment failed with state '${rawState}' (deployment: ${vcState.deploymentId || 'unknown'}). Target: ${targetSha}`,
        {
          code: 'ERR_VERCEL_DEPLOYMENT_FAILED',
          exitCode: 2,
          details: { state: vcState, targetSha },
        }
      );
    }

    const vcCommit = (vcState.commit || '').toLowerCase().trim();
    const expectedSha = (targetSha || '').toLowerCase().trim();

    if (rawState === 'READY' && vcCommit === expectedSha) {
      return {
        converged: true,
        deploymentState: vcState,
        pollCount,
        durationMs: Date.now() - startTime,
      };
    }

    const remainingTime = pollTimeoutMs - (Date.now() - startTime);
    if (remainingTime <= 0) continue;
    const waitTime = Math.min(pollIntervalMs, remainingTime);
    await sleep(waitTime);
  }
}

/**
 * Resolves detected drift from an existing DriftReport.
 *
 * @param {DriftReport} report
 * @param {object} [options={}]
 * @returns {Promise<DriftReport>}
 */
export async function resolveDrift(report, options = {}) {
  const cwd = options.cwd || report.target.directory || process.cwd();
  const branch = options.branch || report.target.branch || 'main';
  const actionsTaken = [...(report.actionsTaken || [])];

  if (!report.drift.hasDrift) {
    return {
      ...report,
      resolved: true,
      actionsTaken: [...actionsTaken, 'Parity verified (no drift)'],
    };
  }

  // Safety Guard: Refuse push if dirty
  if (report.drift.dirtyWorkingTree || !report.state.local.isClean) {
    throw new UncommittedChangesError(report.state.local.uncommittedFiles, {
      cwd,
      message: 'Cannot resolve drift: working tree has uncommitted changes.',
    });
  }

  // Safety Guard: Refuse push if diverged
  if (report.drift.diverged) {
    throw new GitError('Cannot resolve drift: Local and GitHub branches have diverged.', {
      code: 'ERR_GIT_DIVERGED',
      exitCode: 1,
      cwd,
    });
  }

  // Safety Guard: Local behind remote
  if (report.drift.localBehind) {
    throw new GitError(
      'Cannot resolve drift: Local repository is behind remote GitHub branch. Run `git pull`.',
      {
        code: 'ERR_GIT_LOCAL_BEHIND',
        exitCode: 1,
        cwd,
      }
    );
  }

  let currentTargetSha = report.state.local.commit;
  let pushedToOrigin = false;

  // 1. Local ahead -> Push to GitHub origin
  if (report.drift.localAhead) {
    await triggerGitPush(
      {
        cwd,
        branch,
        isClean: report.state.local.isClean,
        uncommittedFiles: report.state.local.uncommittedFiles,
        isDetached: report.state.local.isDetached,
      },
      options
    );
    actionsTaken.push(`git push origin ${branch}`);
    pushedToOrigin = true;
  }

  // 2. Vercel deployment check / trigger
  const vercelCtx = options.vercelContext || {};
  const deployHookUrl =
    options.deployHookUrl || vercelCtx.deployHookUrl || process.env.VERCEL_DEPLOY_HOOK_URL;
  const vercelState = report.state.vercel || {};

  const currentVercelCommit = (vercelState.commit || '').toLowerCase().trim();
  const currentInFlightCommit = (vercelState.inFlightCommit || '').toLowerCase().trim();
  const targetLower = (currentTargetSha || '').toLowerCase().trim();

  const isAlreadyInFlightForTarget =
    currentInFlightCommit === targetLower &&
    IN_FLIGHT_STATES.includes(String(vercelState.state || '').toUpperCase());

  const isAlreadyReadyForTarget =
    currentVercelCommit === targetLower &&
    String(vercelState.state || '').toUpperCase() === 'READY';

  if (isAlreadyReadyForTarget) {
    // Vercel is already deployed and ready for the target commit!
  } else if (isAlreadyInFlightForTarget) {
    actionsTaken.push(`wait for in-flight Vercel build for commit ${currentTargetSha}`);
    await pollVercelDeploymentConvergence(
      currentTargetSha,
      {
        ...vercelCtx,
        projectId: report.target.vercelProject,
      },
      options
    );
  } else if (currentVercelCommit !== targetLower || vercelState.state !== 'READY') {
    const triggerRes = await triggerVercelDeploy(
      {
        ...vercelCtx,
        projectId: report.target.vercelProject,
        branch,
        commitSha: currentTargetSha,
        deployHookUrl,
      },
      options
    );
    actionsTaken.push(
      `trigger Vercel deployment (${triggerRes.method}) for commit ${currentTargetSha}`
    );
    await pollVercelDeploymentConvergence(
      currentTargetSha,
      {
        ...vercelCtx,
        projectId: report.target.vercelProject,
      },
      options
    );
  }

  // 3. Final re-check verification
  const finalLocal = await inspectLocalGit(cwd, options);
  const finalVercel = await inspectVercelDeployment(
    {
      ...vercelCtx,
      projectId: report.target.vercelProject,
      apiUrl: options.vercelApiUrl || process.env.VERCEL_API_URL,
      token: options.vercelToken || vercelCtx.token || process.env.VERCEL_TOKEN,
    },
    options
  );

  let finalGitHub;
  if (pushedToOrigin) {
    // When git push succeeded, remote origin branch was pushed with currentTargetSha
    finalGitHub = {
      commit: currentTargetSha,
      branch,
      statusWithLocal: 'identical',
      aheadBy: 0,
      behindBy: 0,
    };
  } else {
    finalGitHub = await inspectGitHubRemote(
      options.repoContext || {
        owner: report.target.repository.split('/')[0] || 'plantcor',
        repo: report.target.repository.split('/')[1] || 'arch-system',
        branch,
      },
      options.githubToken || process.env.GITHUB_TOKEN || '',
      {
        apiUrl: options.githubApiUrl || process.env.GITHUB_API_URL,
        localCommit: finalLocal.commit,
        cwd,
        fallbackToGh: false,
      }
    );
  }

  const finalReport = evaluateDrift(finalLocal, finalGitHub, finalVercel, {
    target: report.target,
  });
  finalReport.actionsTaken = actionsTaken;
  finalReport.resolved = !finalReport.drift.hasDrift;

  return finalReport;
}

/**
 * Top-level reconciliation runner: inspects tri-state, evaluates drift,
 * executes remediation if requested, and returns final report.
 *
 * @param {object} [options={}]
 * @returns {Promise<DriftReport>}
 */
export async function reconcileDrift(options = {}) {
  const cwd = options.cwd || options.dir || process.cwd();

  // 1. Inspect Local Git
  const localGit = await inspectLocalGit(cwd, options);

  // 2. Discover & Inspect GitHub
  let githubContext = await discoverGitHubContext(cwd, options).catch(() => ({
    owner: options.team ? options.team.replace(/^team[_-]/, '') : 'plantcor',
    repo: options.project
      ? options.project.replace(/^prj[_-]/, '').replace(/_/g, '-')
      : 'arch-system',
    branch: options.branch || localGit.branch || 'main',
  }));
  if (options.branch) githubContext.branch = options.branch;
  if (options.repo && options.repo.includes('/')) {
    const [o, r] = options.repo.split('/');
    githubContext.owner = o;
    githubContext.repo = r;
  }
  const githubToken = options.githubToken || options.token || resolveGitHubToken(options);
  const githubRemote = await inspectGitHubRemote(githubContext, githubToken, {
    localCommit: localGit.commit,
    cwd,
    apiUrl: options.apiUrl || options.githubApiUrl || process.env.GITHUB_API_URL,
    fallbackToGh: false,
    ...options,
  });

  // 3. Discover & Inspect Vercel
  const vercelContext = await discoverVercelContext(cwd, {
    projectId: options.project || options.projectId,
    teamId: options.team || options.teamId,
    token: options.vercelToken || options.token || resolveVercelToken(options),
    deployHookUrl: options.deployHookUrl,
    fallbackToDirName: false,
    ...options,
  }).catch(() => ({
    projectId: options.project || options.projectId || 'prj_arch_system',
    teamId: options.team || options.teamId || 'team_plantcor',
    token: options.vercelToken || options.token || resolveVercelToken(options),
    deployHookUrl: options.deployHookUrl,
  }));

  const vercelDeployment = await inspectVercelDeployment(
    {
      ...vercelContext,
      token: options.vercelToken || vercelContext.token || resolveVercelToken(options),
      apiUrl: options.vercelApiUrl || process.env.VERCEL_API_URL,
    },
    options
  );

  // 4. Initial Drift Evaluation
  const initialReport = evaluateDrift(localGit, githubRemote, vercelDeployment, {
    target: {
      directory: path.resolve(cwd),
      branch: localGit.branch,
      repository: `${githubContext.owner}/${githubContext.repo}`,
      vercelProject: vercelContext.projectId,
    },
  });

  // If audit-only or already clean parity, return immediately
  if (!options.fix || !initialReport.drift.hasDrift) {
    return initialReport;
  }

  // 5. Execute Remediation Loop
  return await resolveDrift(initialReport, {
    cwd,
    branch: githubContext.branch,
    repoContext: githubContext,
    githubToken,
    githubApiUrl: options.githubApiUrl || process.env.GITHUB_API_URL,
    vercelContext,
    vercelToken: vercelContext.token,
    vercelApiUrl: options.vercelApiUrl || process.env.VERCEL_API_URL,
    deployHookUrl: options.deployHookUrl || vercelContext.deployHookUrl,
    pollTimeout: options.pollTimeout,
    pollInterval: options.pollInterval,
    ...options,
  });
}
