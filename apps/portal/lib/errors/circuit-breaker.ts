/**
 * Circuit breaker pattern for external service failures.
 *
 * Prevents cascading failures when an external service (Supabase, Redis, etc.)
 * is down. The circuit transitions through three states:
 *
 *  CLOSED → (failures exceed threshold) → OPEN → (timeout elapses) → HALF_OPEN
 *    - CLOSED: Requests flow through normally. Failures are counted.
 *    - OPEN: Requests fail fast (return cached/fallback data) without calling the service.
 *    - HALF_OPEN: A trial request is allowed through; success closes the circuit,
 *      failure re-opens it.
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker('supabase', { threshold: 5, timeoutMs: 30000 });
 *
 * const result = await breaker.call(async () => {
 *   return await supabase.from('users').select('*');
 * });
 * ```
 *
 * For automatic cache fallback, provide a `fallback` function in options.
 */

import { isAppError } from '@/lib/errors/error-classes';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions<T = unknown> {
  /** Number of failures in CLOSED state before opening (default: 5). */
  failureThreshold?: number;
  /** How long the circuit stays OPEN before transitioning to HALF_OPEN (ms, default: 30000). */
  timeoutMs?: number;
  /** Minimum number of requests in HALF_OPEN before evaluating (default: 1). */
  halfOpenSuccessThreshold?: number;
  /** Error context to include in fallback error. */
  context?: string;
  /** Fallback function to call when circuit is OPEN (returns cached/fallback data). */
  fallback?: () => Promise<T> | T;
  /** Whether to log errors to console (dev only by default). */
  logErrors?: boolean;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_HALF_OPEN_SUCCESS_THRESHOLD = 1;

/**
 * Circuit breaker for protecting against cascading failures.
 */
export class CircuitBreaker<T = unknown> {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly timeoutMs: number;
  private readonly halfOpenSuccessThreshold: number;
  private fallback?: () => Promise<T> | T;
  private readonly logErrors: boolean;
  private readonly context?: string;

  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  constructor(name: string, options: CircuitBreakerOptions<T> = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.halfOpenSuccessThreshold =
      options.halfOpenSuccessThreshold ?? DEFAULT_HALF_OPEN_SUCCESS_THRESHOLD;
    this.fallback = options.fallback;
    this.logErrors = options.logErrors ?? process.env.NODE_ENV === 'development';
    this.context = options.context;
  }

  /**
   * Current circuit state.
   */
  get currentState(): CircuitState {
    return this.state;
  }

  /**
   * Current failure count.
   */
  get currentFailures(): number {
    return this.failureCount;
  }

  /**
   * Whether the circuit is currently CLOSED (requests allowed through).
   */
  get isClosed(): boolean {
    return this.state === 'CLOSED';
  }

  /**
   * Whether the circuit is OPEN or HALF_OPEN (calls will fail-fast).
   */
  get isForcedOpen(): boolean {
    return this.state === 'OPEN' || this.state === 'HALF_OPEN';
  }

  /**
   * Determine if a request should be allowed through the circuit.
   *
   * In CLOSED state, all requests pass.
   * In OPEN state, all requests fail-fast after timeout.
   * In HALF_OPEN state, limited trial requests pass.
   */
  private shouldAllowRequest(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (this.lastFailureTime === null) return false;
      const now = Date.now();
      if (now - this.lastFailureTime >= this.timeoutMs) {
        this.transitionTo('HALF_OPEN');
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN: only allow one trial request
    return true;
  }

  /**
   * Determine if an error is a "hard" failure that should trip the circuit.
   * Retryable errors (network, rate-limit, timeout) are hard failures.
   * 4xx errors (except 429) are considered client errors, not service failures.
   */
  private isFailureError(error: Error): boolean {
    if (isAppError(error)) {
      const status = error.statusCode ?? 0;

      // 5xx and 429 (rate limit) are service failures
      if (status >= 500 || status === 429) return true;

      // 4xx (except 401/403 which are auth errors) are not circuit-trip failures
      if (status >= 400 && status < 500) return false;
    }

    // Network and timeout errors are always failures
    return true;
  }

  /**
   * Transition circuit to a new state, logging the transition.
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState && this.logErrors) {
      // eslint-disable-next-line no-console
      console.info(
        `[CircuitBreaker:${this.name}] State transition: ${oldState} → ${newState}` +
          (this.context ? ` (context: ${this.context})` : '')
      );
    }

    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.lastFailureTime = null;
      this.nextAttemptTime = null;
    }

    if (newState === 'OPEN') {
      this.lastFailureTime = Date.now();
      this.nextAttemptTime = Date.now() + this.timeoutMs;
    }
  }

  /**
   * Record a failure and potentially trip the circuit.
   */
  private recordFailure(error: Error): void {
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
      return;
    }

    this.failureCount++;

    if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Record a success and potentially close a half-open circuit.
   */
  private recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      if (this.failureCount > 0) {
        this.failureCount = 0;
      }
    }
  }

  /**
   * Reset the circuit to CLOSED state.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Execute an operation through the circuit breaker.
   *
   * @param operation The async operation to execute
   * @returns Result on success, or fallback result if circuit is open
   * @throws Error if circuit is open and no fallback provided, or if operation fails
   */
  async call(operation: () => Promise<T>): Promise<T> {
    if (!this.shouldAllowRequest()) {
      if (this.fallback) {
        if (this.logErrors) {
          // eslint-disable-next-line no-console
          console.warn(
            `[CircuitBreaker:${this.name}] CIRCUIT OPEN — using fallback instead of calling service` +
              (this.nextAttemptTime
                ? ` (retry after: ${new Date(this.nextAttemptTime).toISOString()})`
                : '')
          );
        }
        return await this.fallback();
      }

      const error = new Error(
        `Circuit breaker "${this.name}" is OPEN — service unavailable` +
          (this.context ? ` (${this.context})` : '')
      );
      (error as { code?: string }).code = 'CIRCUIT_OPEN';
      throw error;
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (this.isFailureError(err)) {
        this.recordFailure(err);
      }

      // If circuit just opened and we have a fallback, use it
      if (this.state === 'OPEN' && this.fallback) {
        if (this.logErrors) {
          // eslint-disable-next-line no-console
          console.warn(
            `[CircuitBreaker:${this.name}] Circuit opened, falling back: ${err.message}`
          );
        }
        return await this.fallback();
      }

      throw err;
    }
  }

  /**
   * Execute an operation through the circuit breaker with a per-call fallback.
   * The per-call fallback overrides any circuit-level fallback.
   */
  async callWithFallback(operation: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
    const originalFallback = this.fallback;
    this.fallback = fallback;

    try {
      return await this.call(operation);
    } finally {
      this.fallback = originalFallback;
    }
  }

  /**
   * Get circuit breaker statistics for monitoring.
   */
  getStats(): {
    name: string;
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    nextAttemptTime: number | null;
    context?: string;
  } {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      context: this.context,
    };
  }
}

/**
 * Registry of circuit breakers for global inspection and management.
 */
const circuitRegistry = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker by name.
 * If a breaker with the given name already exists, it is returned.
 */
export function getCircuitBreaker<T = unknown>(
  name: string,
  options?: CircuitBreakerOptions<T>
): CircuitBreaker<T> {
  if (circuitRegistry.has(name)) {
    return circuitRegistry.get(name)! as CircuitBreaker<T>;
  }

  const breaker = new CircuitBreaker<T>(name, options);
  circuitRegistry.set(name, breaker as CircuitBreaker);
  return breaker;
}

/**
 * Get statistics for all registered circuit breakers.
 */
export function getAllCircuitBreakerStats(): ReturnType<CircuitBreaker['getStats']>[] {
  return Array.from(circuitRegistry.values()).map((b) => b.getStats());
}

/**
 * Reset all circuit breakers (useful for testing or recovery).
 */
export function resetAllCircuitBreakers(): void {
  for (const breaker of circuitRegistry.values()) {
    breaker.reset();
  }
}
