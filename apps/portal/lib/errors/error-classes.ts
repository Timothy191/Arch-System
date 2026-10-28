// Re-export canonical AppError hierarchy from @repo/errors so instanceof checks
// pass across package boundaries (prevents split-brain error sanitization).
import {
  AppError,
  AuthError,
  DatabaseError,
  FetchTimeoutError,
  isAppError,
  isAuthError,
  isFetchTimeoutError,
  isNetworkError,
  isNotFoundError,
  isValidationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  APIError as RepoAPIError,
  ConflictError as RepoConflictError,
  ForbiddenError as RepoForbiddenError,
  ValidationError,
} from '@repo/errors';

export {
  AppError,
  AuthError,
  DatabaseError,
  FetchTimeoutError,
  isAppError,
  isAuthError,
  isFetchTimeoutError,
  isNetworkError,
  isNotFoundError,
  isValidationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ValidationError,
};

type APIErrorOptions = {
  statusCode?: number;
  context?: Record<string, unknown>;
  cause?: unknown;
  [key: string]: unknown;
};

function isResponseLike(candidate: Response | APIErrorOptions | undefined): candidate is Response {
  if (!candidate) {
    return false;
  }
  if (typeof Response !== 'undefined' && candidate instanceof Response) {
    return true;
  }
  return 'status' in candidate && typeof candidate.status === 'number';
}

export class APIError extends RepoAPIError {
  constructor(message: string, response?: Response);
  constructor(message: string, options?: APIErrorOptions);
  constructor(message: string, responseOrOptions?: Response | APIErrorOptions) {
    if (isResponseLike(responseOrOptions)) {
      super(message, responseOrOptions);
    } else {
      super(message, responseOrOptions);
      if (this.statusCode === undefined) {
        this.statusCode = 500;
      }
    }
    this.name = 'APIError';
  }
}

export class ConflictError extends RepoConflictError {
  constructor(
    message: string = 'Resource conflict',
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: unknown;
    }
  ) {
    super(message, options);
    this.name = 'ConflictError';
    this.code = 'CONFLICT';
  }
}

export class ForbiddenError extends RepoForbiddenError {
  constructor(
    message: string = 'Access forbidden',
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: unknown;
    }
  ) {
    super(message, options);
    this.name = 'ForbiddenError';
    this.code = 'FORBIDDEN';
  }
}
