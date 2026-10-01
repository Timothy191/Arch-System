// @ts-check

/**
 * Root error class for all zero-drift-watchdog operations.
 * Provides unified error codes, exit codes, and JSON serialization.
 */
export class WatchdogError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code='ERR_WATCHDOG']
   * @param {number} [options.exitCode=2]
   * @param {any} [options.details=null]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code || 'ERR_WATCHDOG';
    this.exitCode = options.exitCode ?? 2;
    this.details = options.details ?? null;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      exitCode: this.exitCode,
      details: this.details,
      cause: this.cause ? this.cause.message || String(this.cause) : undefined,
    };
  }
}

/**
 * Thrown when a Git command fails, working tree is in an invalid state,
 * or repository metadata cannot be determined.
 */
export class GitError extends WatchdogError {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code='ERR_GIT']
   * @param {number} [options.exitCode=2]
   * @param {string} [options.command]
   * @param {number|null} [options.gitExitCode]
   * @param {string} [options.stdout]
   * @param {string} [options.stderr]
   * @param {string} [options.cwd]
   * @param {any} [options.details]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_GIT',
      exitCode: options.exitCode ?? 2,
      cause: options.cause,
      details: options.details,
    });
    this.command = options.command || null;
    this.gitExitCode = options.gitExitCode ?? null;
    this.stdout = options.stdout || '';
    this.stderr = options.stderr || '';
    this.cwd = options.cwd || process.cwd();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      command: this.command,
      gitExitCode: this.gitExitCode,
      stdout: this.stdout,
      stderr: this.stderr,
      cwd: this.cwd,
    };
  }
}

/**
 * Thrown when git operations require a clean working tree, but uncommitted
 * (staged, unstaged, or untracked) changes are detected.
 */
export class UncommittedChangesError extends GitError {
  /**
   * @param {string[]} [uncommittedFiles=[]]
   * @param {object} [options]
   * @param {string} [options.message]
   * @param {string} [options.command='git status --porcelain']
   * @param {string} [options.cwd]
   * @param {number} [options.stagedCount]
   * @param {number} [options.unstagedCount]
   * @param {number} [options.untrackedCount]
   */
  constructor(uncommittedFiles = [], options = {}) {
    const fileCount = uncommittedFiles.length;
    const summary =
      uncommittedFiles.slice(0, 5).join(', ') + (fileCount > 5 ? ` (+${fileCount - 5} more)` : '');
    const message =
      options.message ||
      `Working tree has ${fileCount} uncommitted change(s): [${summary}]. Aborting operation to prevent loss or drift.`;

    super(message, {
      code: 'ERR_UNCOMMITTED_CHANGES',
      exitCode: 2,
      command: options.command || 'git status --porcelain',
      stdout: uncommittedFiles.join('\n'),
      stderr: '',
      cwd: options.cwd,
      details: {
        uncommittedFiles,
        count: fileCount,
      },
    });

    this.uncommittedFiles = uncommittedFiles;
    this.stagedCount =
      options.stagedCount ?? uncommittedFiles.filter((f) => /^[MADRC]/.test(f)).length;
    this.unstagedCount =
      options.unstagedCount ?? uncommittedFiles.filter((f) => /^.[MADRC]/.test(f)).length;
    this.untrackedCount =
      options.untrackedCount ?? uncommittedFiles.filter((f) => /^\?\?/.test(f)).length;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      uncommittedFiles: this.uncommittedFiles,
      stagedCount: this.stagedCount,
      unstagedCount: this.unstagedCount,
      untrackedCount: this.untrackedCount,
    };
  }
}

/**
 * Thrown when a specified or discovered branch does not exist
 * in the local repository or remote GitHub repository.
 */
export class BranchNotFoundError extends GitError {
  /**
   * @param {string} branch
   * @param {object} [options]
   * @param {'local'|'remote'} [options.target='local']
   * @param {string} [options.repository]
   * @param {string} [options.message]
   * @param {string} [options.command]
   * @param {string} [options.cwd]
   */
  constructor(branch, options = {}) {
    const target = options.target || 'local';
    const repoInfo = options.repository ? ` in repository '${options.repository}'` : '';
    const message = options.message || `Branch '${branch}' was not found on ${target}${repoInfo}.`;

    super(message, {
      code: target === 'remote' ? 'ERR_REMOTE_BRANCH_NOT_FOUND' : 'ERR_LOCAL_BRANCH_NOT_FOUND',
      exitCode: 2,
      command: options.command,
      cwd: options.cwd,
      details: {
        branch,
        target,
        repository: options.repository || null,
      },
    });

    this.branch = branch;
    this.target = target;
    this.repository = options.repository || null;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      branch: this.branch,
      target: this.target,
      repository: this.repository,
    };
  }
}

/**
 * Thrown when a GitHub REST API request or `gh` CLI invocation fails.
 */
export class GitHubApiError extends WatchdogError {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code='ERR_GITHUB_API']
   * @param {number} [options.exitCode=2]
   * @param {number} [options.statusCode]
   * @param {string} [options.statusText]
   * @param {string} [options.endpoint]
   * @param {string} [options.documentationUrl]
   * @param {any} [options.responseBody]
   * @param {any} [options.headers]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_GITHUB_API',
      exitCode: options.exitCode ?? 2,
      cause: options.cause,
      details: options.responseBody,
    });

    this.statusCode = options.statusCode ?? null;
    this.statusText = options.statusText || '';
    this.endpoint = options.endpoint || '';
    this.documentationUrl = options.documentationUrl || null;
    this.responseBody = options.responseBody ?? null;
    this.headers = options.headers || null;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      statusText: this.statusText,
      endpoint: this.endpoint,
      documentationUrl: this.documentationUrl,
      responseBody: this.responseBody,
    };
  }
}

/**
 * Thrown when GitHub API rate limits (primary quota or secondary abuse limit) are hit.
 */
export class RateLimitError extends GitHubApiError {
  /**
   * @param {string} [message]
   * @param {object} [options]
   * @param {boolean} [options.isSecondary=false]
   * @param {number} [options.limit]
   * @param {number} [options.remaining=0]
   * @param {number} [options.resetEpoch]
   * @param {number|null} [options.retryAfterSec]
   * @param {string} [options.endpoint]
   * @param {any} [options.headers]
   * @param {any} [options.responseBody]
   */
  constructor(message, options = {}) {
    const isSecondary = options.isSecondary || Boolean(options.retryAfterSec);
    const defaultMsg = isSecondary
      ? `GitHub secondary rate limit exceeded. Retry after ${options.retryAfterSec || 60}s.`
      : `GitHub API hourly rate limit exceeded (0 remaining). Resets at ${
          options.resetEpoch ? new Date(options.resetEpoch * 1000).toISOString() : 'unknown'
        }.`;

    super(message || defaultMsg, {
      code: isSecondary ? 'ERR_GITHUB_SECONDARY_RATE_LIMIT' : 'ERR_GITHUB_RATE_LIMIT',
      statusCode: isSecondary ? 429 : 403,
      statusText: isSecondary ? 'Too Many Requests' : 'Forbidden',
      endpoint: options.endpoint,
      documentationUrl:
        'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
      responseBody: options.responseBody,
      headers: options.headers,
    });

    this.isSecondary = isSecondary;
    this.limit = options.limit ?? null;
    this.remaining = options.remaining ?? 0;
    this.resetEpoch = options.resetEpoch ?? null;
    this.resetDate = options.resetEpoch ? new Date(options.resetEpoch * 1000) : null;
    this.retryAfterSec = options.retryAfterSec ?? null;

    if (this.retryAfterSec != null) {
      this.suggestedWaitMs = this.retryAfterSec * 1000;
    } else if (this.resetEpoch != null) {
      const diffMs = this.resetEpoch * 1000 - Date.now();
      this.suggestedWaitMs = Math.max(0, diffMs);
    } else {
      this.suggestedWaitMs = 60000;
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      isSecondary: this.isSecondary,
      limit: this.limit,
      remaining: this.remaining,
      resetEpoch: this.resetEpoch,
      resetDate: this.resetDate ? this.resetDate.toISOString() : null,
      retryAfterSec: this.retryAfterSec,
      suggestedWaitMs: this.suggestedWaitMs,
    };
  }
}

/**
 * Thrown when a Vercel REST API request fails.
 */
export class VercelApiError extends WatchdogError {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code='ERR_VERCEL_API']
   * @param {number} [options.exitCode=2]
   * @param {number|null} [options.statusCode]
   * @param {string} [options.statusText]
   * @param {string} [options.endpoint]
   * @param {any} [options.responseBody]
   * @param {any} [options.headers]
   * @param {boolean} [options.missingToken=false]
   * @param {boolean} [options.invalidToken=false]
   * @param {string|null} [options.projectId=null]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_VERCEL_API',
      exitCode: options.exitCode ?? 2,
      cause: options.cause,
      details: options.responseBody ?? options.details,
    });

    this.statusCode = options.statusCode ?? null;
    this.statusText = options.statusText || '';
    this.endpoint = options.endpoint || '';
    this.responseBody = options.responseBody ?? null;
    this.headers = options.headers || null;
    this.missingToken = options.missingToken ?? false;
    this.invalidToken = options.invalidToken ?? false;
    this.projectId = options.projectId || null;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      statusText: this.statusText,
      endpoint: this.endpoint,
      missingToken: this.missingToken,
      invalidToken: this.invalidToken,
      projectId: this.projectId,
      responseBody: this.responseBody,
    };
  }
}

/**
 * Alias for VercelApiError for general Vercel operations.
 */
export { VercelApiError as VercelError };

/**
 * Thrown when Vercel API authentication fails (missing token or invalid/expired token).
 */
export class VercelAuthError extends VercelApiError {
  /**
   * @param {string} [message]
   * @param {object} [options]
   * @param {boolean} [options.missingToken]
   * @param {boolean} [options.invalidToken]
   * @param {string} [options.endpoint]
   * @param {any} [options.responseBody]
   * @param {any} [options.headers]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    const missingToken = options.missingToken ?? false;
    const invalidToken = options.invalidToken ?? !missingToken;
    const defaultMsg = missingToken
      ? 'Vercel API request failed: Missing authentication token (HTTP 403 Forbidden). Set VERCEL_TOKEN environment variable.'
      : 'Vercel API request failed: Not authorized or invalid token (HTTP 403 Forbidden). Verify VERCEL_TOKEN credentials.';

    super(message || defaultMsg, {
      code: missingToken ? 'ERR_VERCEL_MISSING_TOKEN' : 'ERR_VERCEL_INVALID_TOKEN',
      exitCode: 2,
      statusCode: 403,
      statusText: 'Forbidden',
      endpoint: options.endpoint,
      responseBody: options.responseBody,
      headers: options.headers,
      missingToken,
      invalidToken,
      cause: options.cause,
    });
  }
}

/**
 * Thrown when a specified Vercel project cannot be found (HTTP 404).
 */
export class VercelProjectNotFoundError extends VercelApiError {
  /**
   * @param {string} projectId
   * @param {object} [options]
   * @param {string} [options.teamId]
   * @param {string} [options.endpoint]
   * @param {any} [options.responseBody]
   * @param {any} [options.headers]
   * @param {Error} [options.cause]
   */
  constructor(projectId, options = {}) {
    const teamInfo = options.teamId ? ` within team '${options.teamId}'` : '';
    const message = `Vercel project '${projectId}' was not found (HTTP 404)${teamInfo}. Verify project ID/name and team scoping.`;

    super(message, {
      code: 'ERR_VERCEL_PROJECT_NOT_FOUND',
      exitCode: 2,
      statusCode: 404,
      statusText: 'Not Found',
      endpoint: options.endpoint,
      responseBody: options.responseBody,
      headers: options.headers,
      projectId,
      cause: options.cause,
    });

    this.teamId = options.teamId || null;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      teamId: this.teamId,
    };
  }
}

/**
 * Thrown when Vercel API rate limits are exceeded (HTTP 429).
 */
export class VercelRateLimitError extends VercelApiError {
  /**
   * @param {string} [message]
   * @param {object} [options]
   * @param {number|null} [options.retryAfterSec]
   * @param {number|null} [options.resetEpoch]
   * @param {string} [options.endpoint]
   * @param {any} [options.responseBody]
   * @param {any} [options.headers]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    const retryAfterSec = options.retryAfterSec ?? 60;
    const defaultMsg =
      message || `Vercel API rate limit exceeded (HTTP 429). Retry after ${retryAfterSec}s.`;

    super(defaultMsg, {
      code: 'ERR_VERCEL_RATE_LIMIT',
      exitCode: 2,
      statusCode: 429,
      statusText: 'Too Many Requests',
      endpoint: options.endpoint,
      responseBody: options.responseBody,
      headers: options.headers,
      cause: options.cause,
    });

    this.retryAfterSec = retryAfterSec;
    this.resetEpoch = options.resetEpoch ?? null;
    this.suggestedWaitMs = retryAfterSec ? retryAfterSec * 1000 : 60000;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfterSec: this.retryAfterSec,
      resetEpoch: this.resetEpoch,
      suggestedWaitMs: this.suggestedWaitMs,
    };
  }
}

/**
 * Thrown when an asynchronous polling or convergence operation times out.
 */
export class TimeoutError extends WatchdogError {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code='ERR_TIMEOUT']
   * @param {number} [options.exitCode=1]
   * @param {number} [options.timeoutMs]
   * @param {string} [options.operation]
   * @param {any} [options.details]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_TIMEOUT',
      exitCode: options.exitCode ?? 1,
      details: options.details || { timeoutMs: options.timeoutMs, operation: options.operation },
      cause: options.cause,
    });
    this.timeoutMs = options.timeoutMs;
    this.operation = options.operation;
  }
}
