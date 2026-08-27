/**
 * Universal Edge Telemetry Circuit Breaker
 *
 * Resilient circuit breaker and exponential backoff engine for industrial
 * mining telemetry streams, SCADA Modbus ingest, and InSAR satellite pipelines.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 3) */
  failureThreshold?: number;
  /** Cooldown time in ms before attempting trial execution (default: 10000ms) */
  resetTimeoutMs?: number;
  /** Base backoff duration in ms (default: 500ms) */
  baseBackoffMs?: number;
  /** Maximum backoff duration in ms (default: 10000ms) */
  maxBackoffMs?: number;
  /** Max retry attempts before failing (default: 3) */
  maxRetries?: number;
  /** Name of the telemetry stream for structured logging */
  streamName?: string;
  /** State change listener callback */
  onStateChange?: (from: CircuitState, to: CircuitState, streamName?: string) => void;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalExecutions: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class TelemetryCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private totalExecutions = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextTrialTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly maxRetries: number;
  private readonly streamName: string;
  private readonly onStateChange?: (
    from: CircuitState,
    to: CircuitState,
    streamName?: string,
  ) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
    this.baseBackoffMs = options.baseBackoffMs ?? 500;
    this.maxBackoffMs = options.maxBackoffMs ?? 10000;
    this.maxRetries = options.maxRetries ?? 3;
    this.streamName = options.streamName ?? "telemetry-stream";
    this.onStateChange = options.onStateChange;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextTrialTime) {
      this.transitionTo("HALF_OPEN");
    }
    return this.state;
  }

  public getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalExecutions: this.totalExecutions,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  public reset(): void {
    this.failureCount = 0;
    this.transitionTo("CLOSED");
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.onStateChange?.(oldState, newState, this.streamName);
    }
  }

  /**
   * Calculates exponential backoff with full jitter to avoid thundering herd.
   */
  public calculateBackoff(attempt: number): number {
    const exponential = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, attempt));
    // Full jitter: random duration between 0 and exponential
    return Math.floor(Math.random() * exponential);
  }

  /**
   * Executes an asynchronous telemetry task with circuit breaker and retry protection.
   */
  public async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T,
  ): Promise<T> {
    this.totalExecutions++;
    const currentState = this.getState();

    if (currentState === "OPEN") {
      if (fallback) {
        return await fallback();
      }
      throw new Error(
        `[TelemetryCircuitBreaker] Stream "${this.streamName}" circuit is OPEN. Request rejected to prevent service saturation.`,
      );
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.handleSuccess();
        return result;
      } catch (err) {
        lastError = err;
        this.handleFailure();

        if (attempt < this.maxRetries && this.getState() !== "OPEN") {
          const delay = this.calculateBackoff(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (fallback) {
      return await fallback();
    }
    throw lastError;
  }

  private handleSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    if (this.state === "HALF_OPEN" || this.failureCount > 0) {
      this.failureCount = 0;
      this.transitionTo("CLOSED");
    }
  }

  private handleFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      this.nextTrialTime = Date.now() + this.resetTimeoutMs;
      this.transitionTo("OPEN");
    }
  }
}
