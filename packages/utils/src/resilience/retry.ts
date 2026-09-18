import { AuthError, ValidationError } from "@repo/errors";

export interface RetryOptions<T = unknown> {
  maxRetriesCount?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  isIdempotent?: boolean;
  allowNonIdempotentRetry?: boolean;
  shouldRetry?: (error: unknown, attemptCount: number) => boolean;
  onRetry?: (error: unknown, attemptCount: number, delayMs: number) => void;
}

const DEFAULT_MAX_RETRIES_COUNT = 3;
const DEFAULT_INITIAL_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_BACKOFF_FACTOR = 2;

export function isNonRetryableError(error: unknown): boolean {
  if (error instanceof AuthError || error instanceof ValidationError) {
    return true;
  }
  return false;
}

export function calculateBackoffDelay(options: {
  attemptIndex: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: boolean;
}): number {
  const { attemptIndex, initialDelayMs, maxDelayMs, backoffFactor, jitter } = options;
  const calculatedMs = initialDelayMs * backoffFactor ** attemptIndex;
  const cappedMs = Math.min(calculatedMs, maxDelayMs);

  if (jitter) {
    return Math.floor(Math.random() * cappedMs);
  }
  return Math.floor(cappedMs);
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const maxRetriesCount = options.maxRetriesCount ?? DEFAULT_MAX_RETRIES_COUNT;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const jitter = options.jitter ?? true;
  const isIdempotent = options.isIdempotent ?? true;
  const allowNonIdempotentRetry = options.allowNonIdempotentRetry ?? false;

  if (!isIdempotent && !allowNonIdempotentRetry) {
    return operation();
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetriesCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetriesCount) {
        break;
      }

      if (isNonRetryableError(error)) {
        throw error;
      }

      if (options.shouldRetry && !options.shouldRetry(error, attempt + 1)) {
        throw error;
      }

      const delayMs = calculateBackoffDelay({
        attemptIndex: attempt,
        initialDelayMs,
        maxDelayMs,
        backoffFactor,
        jitter,
      });

      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
