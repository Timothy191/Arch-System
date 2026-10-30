/**
 * Retry Strategy with Exponential Backoff and Jitter
 *
 * Provides configurable retry logic with exponential backoff, jitter, and
 * error classification for determining retryability.
 */

import {
  DatabaseError,
  FetchTimeoutError,
  isAppError,
  isFetchTimeoutError,
  isNetworkError,
  NetworkError,
  RateLimitError,
} from '@/lib/errors/error-classes';

/** Default retry configuration constants. */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;
const DEFAULT_JITTER_FACTOR = 0.3;

/**
 * Retry configuration options.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000). */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000). */
  maxDelayMs?: number;
  /** Jitter factor 0-1 (default: 0.3). */
  jitterFactor?: number;
  /** Custom function to determine if an error is retryable. */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on each retry attempt. */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  /** Abort signal to cancel retries. */
  signal?: AbortSignal;
}

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded. */
  success: boolean;
  /** The result value on success. */
  data?: T;
  /** The error on failure. */
  error?: Error;
  /** Number of attempts made. */
  attempts: number;
  /** Total time spent retrying in milliseconds. */
  totalTimeMs: number;
}

/**
 * Determine if an error is a network-related error (connection failure, DNS, etc.).
 */
export function isNetworkErrorLike(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  if (error instanceof TypeError && error.message.includes('Network')) return true;
  if (error instanceof DOMException && error.name === 'NetworkError') return true;
  return false;
}

/**
 * Determine if an error is a timeout error.
 */
export function isTimeoutErrorLike(error: unknown): boolean {
  if (isFetchTimeoutError(error)) return true;
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  if (error instanceof Error && error.message.includes('timeout')) return true;
  return false;
}

/**
 * Determine if an error is a rate limit error (429).
 */
export function isRateLimitErrorLike(error: unknown): boolean {
  if (isAppError(error)) {
    return error.statusCode === 429 || error instanceof RateLimitError;
  }
  return false;
}

/**
 * Determine if an error is a database error (500 from DB).
 */
export function isDatabaseErrorLike(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.statusCode !== undefined && error.statusCode >= 500 && error instanceof DatabaseError
    );
  }
  return false;
}

/**
 * Default retryability check.
 * Retries on: network errors, timeouts, rate limits, 5xx errors.
 * Does NOT retry on: 4xx errors (except 429), validation errors, auth errors.
 */
export function isRetryableErrorDefault(error: unknown): boolean {
  // Network and timeout errors are always retryable
  if (isNetworkErrorLike(error) || isTimeoutErrorLike(error)) return true;

  // Rate limit errors are retryable
  if (isRateLimitErrorLike(error)) return true;

  // Check AppError status codes
  if (isAppError(error)) {
    const status = error.statusCode ?? 0;

    // 5xx errors are retryable
    if (status >= 500) return true;

    // 429 is retryable
    if (status === 429) return true;

    // 4xx errors (except 429) are NOT retryable
    if (status >= 400 && status < 500) return false;
  }

  // Unknown errors: conservative approach - don't retry
  return false;
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function calculateDelay(attempt: number, options: MergedRetryOptions): number {
  const { baseDelayMs, maxDelayMs, jitterFactor } = options;

  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * 2 ** attempt;

  // Add jitter: random value between -jitterFactor and +jitterFactor
  const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor;

  const delay = Math.min(exponentialDelay * jitter, maxDelayMs);

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }
  });
}

/**
 * Execute an async operation with retry logic.
 *
 * @param operation The async operation to execute
 * @param options Retry configuration options
 * @returns RetryResult with success status, data, error, attempts, and total time
 */
type MergedRetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  isRetryable: (error: unknown) => boolean;
  onRetry: (attempt: number, error: Error, delayMs: number) => void;
  signal?: AbortSignal;
};

export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const mergedOptions: MergedRetryOptions = {
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    baseDelayMs: options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    jitterFactor: options.jitterFactor ?? DEFAULT_JITTER_FACTOR,
    isRetryable: options.isRetryable ?? isRetryableErrorDefault,
    onRetry: options.onRetry ?? (() => {}),
    signal: options.signal,
  };

  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (attempts = 0; attempts <= mergedOptions.maxRetries; attempts++) {
    // Check for abort signal
    if (mergedOptions.signal?.aborted) {
      const error = new DOMException('Aborted', 'AbortError');
      return {
        success: false,
        error,
        attempts,
        totalTimeMs: Date.now() - startTime,
      };
    }

    try {
      const data = await operation();
      return {
        success: true,
        data,
        attempts: attempts + 1,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, don't retry
      if (attempts >= mergedOptions.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!mergedOptions.isRetryable(lastError)) {
        break;
      }

      // Calculate delay and wait
      const delayMs = calculateDelay(attempts, mergedOptions);
      mergedOptions.onRetry(attempts + 1, lastError, delayMs);

      try {
        await sleep(delayMs, mergedOptions.signal as AbortSignal | undefined);
      } catch (sleepError) {
        // Aborted during sleep
        if (sleepError instanceof DOMException && sleepError.name === 'AbortError') {
          return {
            success: false,
            error: lastError,
            attempts: attempts + 1,
            totalTimeMs: Date.now() - startTime,
          };
        }
        throw sleepError;
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: attempts + 1,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Execute an async operation with retry logic, throwing on failure.
 *
 * @param operation The async operation to execute
 * @param options Retry configuration options
 * @returns The operation result on success
 * @throws The last error if all retries exhausted
 */
export async function retryAsyncThrowing<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await retryAsync(operation, options);

  if (result.success) {
    return result.data!;
  }

  throw result.error!;
}

/**
 * Create a retryable version of a function with preset options.
 */
export function withRetry<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    return retryAsyncThrowing(() => fn(...args), options);
  }) as T;
}
