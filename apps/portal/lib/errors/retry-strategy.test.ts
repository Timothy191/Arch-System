/**
 * @jest-environment node
 */
import {
  APIError,
  AuthError,
  DatabaseError,
  FetchTimeoutError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from './error-classes';
import {
  isDatabaseErrorLike,
  isNetworkErrorLike,
  isRateLimitErrorLike,
  isRetryableErrorDefault,
  isTimeoutErrorLike,
  retryAsync,
  retryAsyncThrowing,
  withRetry,
} from './retry-strategy';

describe('retry-strategy', () => {
  describe('error classifiers', () => {
    it('identifies network errors correctly', () => {
      expect(isNetworkErrorLike(new NetworkError('Network request failed'))).toBe(true);
      expect(isNetworkErrorLike(new TypeError('Network error occurred'))).toBe(true);
      expect(isNetworkErrorLike(new Error('Normal error'))).toBe(false);
    });

    it('identifies timeout errors correctly', () => {
      expect(isTimeoutErrorLike(new FetchTimeoutError('Fetch timed out'))).toBe(true);
      expect(isTimeoutErrorLike(new Error('Connection timeout'))).toBe(true);
      expect(isTimeoutErrorLike(new Error('Unrelated'))).toBe(false);
    });

    it('identifies rate limit errors correctly', () => {
      expect(isRateLimitErrorLike(new RateLimitError('Too many requests'))).toBe(true);
      expect(isRateLimitErrorLike(new APIError('Limited', { statusCode: 429 }))).toBe(true);
      expect(isRateLimitErrorLike(new AuthError('Forbidden'))).toBe(false);
    });

    it('identifies database errors correctly', () => {
      expect(isDatabaseErrorLike(new DatabaseError('Connection dropped'))).toBe(true);
      expect(isDatabaseErrorLike(new ValidationError('Invalid parameter'))).toBe(false);
    });

    it('determines default retryability accurately', () => {
      expect(isRetryableErrorDefault(new NetworkError('Failed to fetch'))).toBe(true);
      expect(isRetryableErrorDefault(new FetchTimeoutError('Timed out'))).toBe(true);
      expect(isRetryableErrorDefault(new RateLimitError('Rate limit exceeded'))).toBe(true);
      expect(isRetryableErrorDefault(new APIError('Server Error', { statusCode: 503 }))).toBe(true);

      // Non-retryable
      expect(isRetryableErrorDefault(new ValidationError('Bad request'))).toBe(false);
      expect(isRetryableErrorDefault(new AuthError('Unauthorized'))).toBe(false);
      expect(isRetryableErrorDefault(new APIError('Not Found', { statusCode: 404 }))).toBe(false);
    });
  });

  describe('retryAsync', () => {
    it('returns data immediately if operation succeeds on first attempt', async () => {
      const op = jest.fn().mockResolvedValue('success-payload');

      const result = await retryAsync(op, { maxRetries: 3, baseDelayMs: 10 });
      expect(result.success).toBe(true);
      expect(result.data).toBe('success-payload');
      expect(result.attempts).toBe(1);
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('retries up to maxRetries on retryable errors and succeeds when resolved', async () => {
      let attempts = 0;
      const op = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError(`Temporary glitch ${attempts}`);
        }
        return 'recovered';
      });

      const onRetry = jest.fn();
      const result = await retryAsync(op, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
        onRetry,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('recovered');
      expect(result.attempts).toBe(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(op).toHaveBeenCalledTimes(3);
    });

    it('aborts early on non-retryable errors', async () => {
      const op = jest.fn().mockRejectedValue(new ValidationError('Validation failed'));
      const onRetry = jest.fn();

      const result = await retryAsync(op, {
        maxRetries: 3,
        baseDelayMs: 10,
        onRetry,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Validation failed');
      expect(result.attempts).toBe(1);
      expect(onRetry).not.toHaveBeenCalled();
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('stops retrying when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const op = jest.fn().mockResolvedValue('should-not-run');
      const result = await retryAsync(op, {
        maxRetries: 2,
        signal: controller.signal,
      });

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('AbortError');
      expect(op).not.toHaveBeenCalled();
    });
  });

  describe('retryAsyncThrowing & withRetry', () => {
    it('throws error when retries exhausted', async () => {
      const op = jest.fn().mockRejectedValue(new NetworkError('Network down'));

      await expect(
        retryAsyncThrowing(op, { maxRetries: 2, baseDelayMs: 5, maxDelayMs: 10 })
      ).rejects.toThrow('Network down');
    });

    it('wraps an async function with withRetry', async () => {
      let counter = 0;
      const fn = async (multiplier: number) => {
        counter++;
        if (counter < 2) {
          throw new NetworkError('Glitch');
        }
        return 42 * multiplier;
      };

      const wrapped = withRetry(fn, { maxRetries: 2, baseDelayMs: 5 });
      const val = await wrapped(2);
      expect(val).toBe(84);
      expect(counter).toBe(2);
    });
  });
});
