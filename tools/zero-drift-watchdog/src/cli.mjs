// @ts-check
import { parseArgs } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

import {
  inspectLocalGit,
  discoverGitHubContext,
  inspectGitHubRemote,
  resolveGitHubToken,
} from './git-inspector.mjs';

import {
  discoverVercelContext,
  inspectVercelDeployment,
  resolveVercelToken,
} from './vercel-inspector.mjs';

import { evaluateDrift, resolveDrift, formatDriftReport } from './drift-engine.mjs';
import { WatchdogError, GitError, VercelApiError, GitHubApiError } from './errors.mjs';

export const CLI_OPTIONS = {
  'audit-only': { type: 'boolean', default: false },
  'allow-dirty': { type: 'boolean', default: false },
  'ignore-dirty': { type: 'boolean', default: false },
  fix: { type: 'boolean', default: false },
  dir: { type: 'string' },
  branch: { type: 'string' },
  repo: { type: 'string' },
  project: { type: 'string' },
  team: { type: 'string' },
  'poll-timeout': { type: 'string' },
  'poll-interval': { type: 'string' },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
};

/**
 * Parse command line arguments with zero dependencies.
 * @param {string[]} [argv]
 */
export function parseCommandLineArgs(argv = process.argv.slice(2)) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: CLI_OPTIONS,
      strict: true,
      allowPositionals: false,
    });
    return { success: true, values, positionals };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Return formatted help text containing all flags.
 * @returns {string}
 */
export function getHelpText() {
  return `Usage: zero-drift-watchdog [options]

CI/CD-agnostic anti-drift synchronization watchdog reconciling local Git, GitHub, and Vercel deployment states.

Options:
  --audit-only              Audit environment states and exit 1 if drift detected without attempting fix (default mode)
  --fix                     Automatically resolve detected drift (git push or trigger Vercel deployment)
  --dir <path>              Target repository root directory (default: current working directory)
  --branch <name>           Target git branch to inspect and synchronize (default: discovered from local git)
  --repo <owner/repo>       GitHub repository in owner/repo format (default: discovered from remote origin)
  --project <id|name>       Vercel project ID or name (default: discovered from .vercel/project.json)
  --team <id>               Vercel team/org ID for scoped operations (default: discovered from .vercel/project.json)
  --poll-timeout <seconds>  Maximum time in seconds to poll deployment completion (default: 300)
  --poll-interval <seconds> Interval in seconds between polling checks (default: 5)
  --json                    Output machine-readable JSON matching DriftReport schema
  -h, --help                Display this help message and exit
  -v, --version             Display version information and exit

Exit Codes:
  0  Parity confirmed (zero drift detected or fix successfully resolved)
  1  Drift detected (in --audit-only mode or unresolvable drift in --fix mode)
  2  Fatal error (missing tokens, 404 project/repo, network failure, git error)
`;
}

/**
 * Format a human-readable drift report for the terminal.
 * @param {any} report
 * @returns {string}
 */
export function formatConsoleOutput(report) {
  return formatDriftReport(report);
}

/**
 * Main programmatic CLI execution function.
 * @param {string[]} [args]
 * @param {object} [io]
 * @param {NodeJS.WritableStream} [io.stdout]
 * @param {NodeJS.WritableStream} [io.stderr]
 * @param {Record<string, string>} [io.env]
 * @returns {Promise<number>} Exit code (0, 1, or 2)
 */
export async function runCli(args = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const env = io.env || process.env;

  // 1. Argument Parsing
  const parsed = parseCommandLineArgs(args);
  if (!parsed.success) {
    const errMsg = parsed.error?.message || 'Invalid command line arguments';
    stderr.write(`CLI Error: ${errMsg}\n\n`);
    stderr.write(getHelpText());
    return 2;
  }

  const values = parsed.values;
  const isJson = Boolean(values.json);
  const isFixMode = Boolean(values.fix);

  // 2. Help and Version flags
  if (values.help) {
    stdout.write(getHelpText());
    return 0;
  }

  if (values.version) {
    stdout.write('zero-drift-watchdog v1.0.0\n');
    return 0;
  }

  // 3. Pre-Flight Token Checks
  const ghToken = resolveGitHubToken({ env });
  if (!ghToken) {
    const msg =
      'Missing GitHub authentication token. Set GITHUB_TOKEN or GH_TOKEN environment variable.';
    if (isJson) {
      stdout.write(JSON.stringify({ error: 'GitHubAuthError', message: msg, exitCode: 2 }) + '\n');
    } else {
      stderr.write(`Error: ${msg}\n`);
    }
    return 2;
  }

  const vcToken = resolveVercelToken({ env });
  if (!vcToken) {
    const msg = 'Missing Vercel authentication token. Set VERCEL_TOKEN environment variable.';
    if (isJson) {
      stdout.write(JSON.stringify({ error: 'VercelAuthError', message: msg, exitCode: 2 }) + '\n');
    } else {
      stderr.write(`Error: ${msg}\n`);
    }
    return 2;
  }

  // 4. Validate Flag Formats
  let ghOwner = '';
  let ghRepoName = '';
  let targetBranch = values.branch || '';

  if (values.repo) {
    const parts = values.repo.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      ghOwner = parts[0];
      ghRepoName = parts[1];
    } else {
      stderr.write(`Invalid --repo format '${values.repo}'. Expected 'owner/repo'.\n`);
      return 2;
    }
  }

  // 5. Target Directory & Local Git State
  const targetDir = path.resolve(values.dir || process.cwd());
  let localGit;
  try {
    localGit = await inspectLocalGit(targetDir);
  } catch (err) {
    const msg = err.message || String(err);
    if (isJson) {
      stdout.write(
        JSON.stringify({ error: err.name || 'GitError', message: msg, exitCode: 2 }) + '\n'
      );
    } else {
      stderr.write(`Git Error: ${msg}\n`);
    }
    return 2;
  }

  // 6. GitHub Context Discovery & Remote State

  let ghContext;
  if (ghOwner && ghRepoName) {
    ghContext = {
      owner: ghOwner,
      repo: ghRepoName,
      branch: targetBranch || localGit.branch || 'main',
    };
  } else {
    try {
      ghContext = await discoverGitHubContext(targetDir, { env });
      if (targetBranch) {
        ghContext.branch = targetBranch;
      }
    } catch (err) {
      // Derive fallback context from project/team or detached state
      const teamCandidate = values.team || env.VERCEL_ORG_ID || env.VERCEL_TEAM_ID;
      const projCandidate = values.project || env.VERCEL_PROJECT_ID;
      if (teamCandidate || projCandidate || env.GITHUB_API_URL || localGit.isDetached) {
        if (!teamCandidate || !projCandidate) {
          throw new Error(
            'Unable to infer GitHub repository context. Please specify --repo or run inside a GitHub repository.'
          );
        }
        ghOwner = teamCandidate.replace(/^team_/, '');
        ghRepoName = projCandidate.replace(/^prj_/, '').replace(/_/g, '-');
        ghContext = {
          owner: ghOwner,
          repo: ghRepoName,
          branch: targetBranch || localGit.branch || 'main',
        };
      } else {
        const msg = err.message || String(err);
        if (isJson) {
          stdout.write(
            JSON.stringify({ error: err.name || 'GitError', message: msg, exitCode: 2 }) + '\n'
          );
        } else {
          stderr.write(`GitHub Discovery Error: ${msg}\n`);
        }
        return 2;
      }
    }
  }

  let ghState;
  try {
    ghState = await inspectGitHubRemote(ghContext, ghToken, {
      apiUrl: env.GITHUB_API_URL,
      localCommit: localGit.commit,
      timeoutMs: 4000,
    });
  } catch (err) {
    const msg = err.message || String(err);
    if (isJson) {
      stdout.write(
        JSON.stringify({
          error: err.name || 'GitHubApiError',
          message: msg,
          exitCode: err.exitCode || 2,
        }) + '\n'
      );
    } else {
      stderr.write(`GitHub Remote Error: ${msg}\n`);
    }
    return err.exitCode || 2;
  }

  // 6. Vercel Context Discovery & Remote State
  let vcContext;
  try {
    vcContext = await discoverVercelContext(targetDir, {
      projectId: values.project,
      teamId: values.team,
      repoName: ghContext?.repo,
      owner: ghContext?.owner,
      env,
    });
    if (values.team) {
      vcContext.teamId = values.team;
    } else if (!vcContext.teamId && ghContext?.owner) {
      vcContext.teamId = ghContext.owner.startsWith('team_')
        ? ghContext.owner
        : `team_${ghContext.owner}`;
    }
    if (values.project) {
      vcContext.projectId = values.project;
    }
  } catch (err) {
    const msg = err.message || String(err);
    if (isJson) {
      stdout.write(
        JSON.stringify({ error: err.name || 'VercelError', message: msg, exitCode: 2 }) + '\n'
      );
    } else {
      stderr.write(`Vercel Context Error: ${msg}\n`);
    }
    return 2;
  }

  let vcState;
  try {
    vcState = await inspectVercelDeployment({
      ...vcContext,
      token: vcToken,
      apiUrl: env.VERCEL_API_URL,
    });
  } catch (err) {
    const msg = err.message || String(err);
    if (isJson) {
      stdout.write(
        JSON.stringify({
          error: err.name || 'VercelApiError',
          message: msg,
          exitCode: err.exitCode || 2,
        }) + '\n'
      );
    } else {
      stderr.write(`Vercel Deployment Error: ${msg}\n`);
    }
    return err.exitCode || 2;
  }

  // 7. Tri-State Drift Evaluation
  // Adapt git-inspector compare status (where 'ahead' means local is ahead)
  // to canonical GitHubRemoteState (where 'behind' means remote is behind local)
  let adaptedGhState = ghState;
  if (ghState.statusWithLocal === 'ahead') {
    adaptedGhState = {
      ...ghState,
      statusWithLocal: 'behind',
      aheadBy: 0,
      behindBy: ghState.aheadBy || 1,
    };
  } else if (ghState.statusWithLocal === 'behind') {
    adaptedGhState = {
      ...ghState,
      statusWithLocal: 'ahead',
      aheadBy: ghState.behindBy || 1,
      behindBy: 0,
    };
  }

  const allowDirty = Boolean(values['allow-dirty'] || values['ignore-dirty']);
  let report = evaluateDrift(localGit, adaptedGhState, vcState, {
    allowDirty,
    target: {
      directory: targetDir,
      branch: ghContext.branch,
      repository: `${ghContext.owner}/${ghContext.repo}`,
      vercelProject: vcContext.projectId,
      allowDirty,
    },
  });

  // 8. Automated Remediation (when --fix requested and drift exists)
  if (isFixMode && report.drift.hasDrift) {
    // Safety guard: refuse to push if tree is dirty
    if (report.drift.dirtyWorkingTree && report.drift.localAhead) {
      const dirtyMsg = `Working tree has ${localGit.uncommittedFiles.length} uncommitted file(s). Automated push refused to prevent corrupting state.`;
      report.actionsTaken.push(dirtyMsg);
      report.resolved = false;

      if (isJson) {
        stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        stderr.write(`Drift Resolution Blocked: ${dirtyMsg}\n`);
        stderr.write(formatConsoleOutput(report));
      }
      return 1;
    }

    // Safety guard: refuse to push if diverged
    if (report.drift.diverged) {
      const divMsg =
        'Local and remote repositories have diverged. Automated resolution refused to prevent merge conflicts.';
      report.actionsTaken.push(divMsg);
      report.resolved = false;

      if (isJson) {
        stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        stderr.write(`Drift Resolution Blocked: ${divMsg}\n`);
        stderr.write(formatConsoleOutput(report));
      }
      return 1;
    }

    // Safety guard: local behind remote
    if (report.drift.localBehind) {
      const behindMsg =
        'Local HEAD is behind GitHub remote. Run "git pull" to synchronize changes.';
      report.actionsTaken.push(behindMsg);
      report.resolved = false;

      if (isJson) {
        stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        stderr.write(`Drift Resolution Blocked: ${behindMsg}\n`);
        stderr.write(formatConsoleOutput(report));
      }
      return 1;
    }

    // Execute remediation loop
    try {
      const pollTimeoutSec = values['poll-timeout'] ? parseInt(values['poll-timeout'], 10) : 300;
      const pollIntervalSec = values['poll-interval'] ? parseInt(values['poll-interval'], 10) : 5;

      report = await resolveDrift(report, {
        cwd: targetDir,
        branch: ghContext.branch,
        repoContext: ghContext,
        githubToken: ghToken,
        githubApiUrl: env.GITHUB_API_URL,
        vercelContext: { ...vcContext, token: vcToken, apiUrl: env.VERCEL_API_URL },
        vercelApiUrl: env.VERCEL_API_URL,
        pollTimeout: pollTimeoutSec,
        pollInterval: pollIntervalSec,
        deployHookUrl: env.VERCEL_DEPLOY_HOOK_URL,
      });
    } catch (err) {
      const msg = err.message || String(err);
      if (/timeout|timed out/i.test(msg)) {
        report.actionsTaken.push(`Deployment polling timed out: ${msg}`);
        report.resolved = false;
        if (isJson) {
          stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          stderr.write(`Deployment Timed Out: ${msg}\n`);
          stderr.write(formatConsoleOutput(report));
        }
        return 1;
      }

      if (isJson) {
        stdout.write(
          JSON.stringify({
            error: err.name || 'ResolutionError',
            message: msg,
            exitCode: err.exitCode || 2,
          }) + '\n'
        );
      } else {
        stderr.write(`Drift Resolution Fatal Error: ${msg}\n`);
      }
      return err.exitCode || 2;
    }
  }

  // 9. Output Generation
  if (isJson) {
    stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    stdout.write(formatConsoleOutput(report));
  }

  // 10. Exit Code Determination
  if (!report.drift.hasDrift || report.resolved) {
    return 0;
  }
  return 1;
}
