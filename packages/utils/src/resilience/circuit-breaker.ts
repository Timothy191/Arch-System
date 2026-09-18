import { CircuitBreakerOpenError } from "@repo/errors";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions<T = unknown> {
  name: string;
  failureThresholdCount?: number;
  failureRateThresholdPercent?: number;
  resetTimeoutMs?: number;
  windowDurationMs?: number;
  halfOpenTrialCount?: number;
  fallback?: () => T | Promise<T>;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  totalCallsCount: number;
  successfulCallsCount: number;
  failedCallsCount: number;
  failureRatePercent: number;
  consecutiveFailuresCount: number;
  lastStateChangeTimestampMs: number;
}

const DEFAULT_FAILURE_THRESHOLD_COUNT = 5;
const DEFAULT_FAILURE_RATE_THRESHOLD_PERCENT = 50;
const DEFAULT_RESET_TIMEOUT_MS = 10000;
const DEFAULT_WINDOW_DURATION_MS = 60000;
const DEFAULT_HALF_OPEN_TRIAL_COUNT = 2;
const PERCENT_MULTIPLIER = 100;

interface CallRecord {
  timestampMs: number;
  success: boolean;
}

export class CircuitBreaker<T = unknown> {
  private readonly name: string;
  private readonly failureThresholdCount: number;
  private readonly failureRateThresholdPercent: number;
  private readonly resetTimeoutMs: number;
  private readonly windowDurationMs: number;
  private readonly halfOpenTrialCount: number;
  private readonly fallback?: () => T | Promise<T>;

  private state: CircuitState = "CLOSED";
  private consecutiveFailuresCount = 0;
  private halfOpenSuccessesCount = 0;
  private lastStateChangeTimestampMs: number = Date.now();
  private callHistory: CallRecord[] = [];

  constructor(options: CircuitBreakerOptions<T>) {
    this.name = options.name;
    this.failureThresholdCount = options.failureThresholdCount ?? DEFAULT_FAILURE_THRESHOLD_COUNT;
    this.failureRateThresholdPercent =
      options.failureRateThresholdPercent ?? DEFAULT_FAILURE_RATE_THRESHOLD_PERCENT;
    this.resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
    this.windowDurationMs = options.windowDurationMs ?? DEFAULT_WINDOW_DURATION_MS;
    this.halfOpenTrialCount = options.halfOpenTrialCount ?? DEFAULT_HALF_OPEN_TRIAL_COUNT;
    this.fallback = options.fallback;
  }

  public async execute(fn: () => Promise<T>): Promise<T> {
    this.checkStateTransition();

    if (this.state === "OPEN") {
      if (this.fallback) {
        return this.fallback();
      }
      throw new CircuitBreakerOpenError(
        `Circuit breaker '${this.name}' is OPEN. Request rejected to prevent cascading failure.`,
        {
          circuitName: this.name,
          resetTimeoutMs: this.resetTimeoutMs,
        }
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (this.fallback && (this.state as CircuitState) === "OPEN") {
        return this.fallback();
      }
      throw error;
    }
  }

  public getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  public getMetrics(): CircuitBreakerMetrics {
    this.pruneCallHistory();
    const totalCallsCount = this.callHistory.length;
    const successfulCallsCount = this.callHistory.filter((r) => r.success).length;
    const failedCallsCount = totalCallsCount - successfulCallsCount;
    const failureRatePercent =
      totalCallsCount === 0 ? 0 : (failedCallsCount / totalCallsCount) * PERCENT_MULTIPLIER;

    return {
      state: this.state,
      totalCallsCount,
      successfulCallsCount,
      failedCallsCount,
      failureRatePercent,
      consecutiveFailuresCount: this.consecutiveFailuresCount,
      lastStateChangeTimestampMs: this.lastStateChangeTimestampMs,
    };
  }

  private onSuccess(): void {
    const nowMs = Date.now();
    this.callHistory.push({ timestampMs: nowMs, success: true });
    this.pruneCallHistory();

    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccessesCount++;
      if (this.halfOpenSuccessesCount >= this.halfOpenTrialCount) {
        this.transitionTo("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      this.consecutiveFailuresCount = 0;
    }
  }

  private onFailure(): void {
    const nowMs = Date.now();
    this.callHistory.push({ timestampMs: nowMs, success: false });
    this.pruneCallHistory();
    this.consecutiveFailuresCount++;

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
      return;
    }

    if (this.state === "CLOSED") {
      const metrics = this.getMetrics();
      const exceedsConsecutive = this.consecutiveFailuresCount >= this.failureThresholdCount;
      const exceedsRate =
        metrics.totalCallsCount >= this.failureThresholdCount &&
        metrics.failureRatePercent >= this.failureRateThresholdPercent;

      if (exceedsConsecutive || exceedsRate) {
        this.transitionTo("OPEN");
      }
    }
  }

  private checkStateTransition(): void {
    if (this.state === "OPEN") {
      const nowMs = Date.now();
      const elapsedMs = nowMs - this.lastStateChangeTimestampMs;
      if (elapsedMs >= this.resetTimeoutMs) {
        this.transitionTo("HALF_OPEN");
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.lastStateChangeTimestampMs = Date.now();
    if (newState === "HALF_OPEN") {
      this.halfOpenSuccessesCount = 0;
    } else if (newState === "CLOSED") {
      this.consecutiveFailuresCount = 0;
      this.halfOpenSuccessesCount = 0;
    }
  }

  private pruneCallHistory(): void {
    const cutoffMs = Date.now() - this.windowDurationMs;
    this.callHistory = this.callHistory.filter((record) => record.timestampMs >= cutoffMs);
  }
}
