// -----------------------------------------------------------------------------
// Adaptive Circuit Breaker (BFE - Baidu Front End Pattern)
// -----------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Consecutive failures to trip open
  cooldownPeriodMs: number; // Duration to remain open before half-open probe
}

export class RedisCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastStateChange = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      cooldownPeriodMs: config.cooldownPeriodMs ?? 15_000,
    };
  }

  public getState(): CircuitState {
    const now = Date.now();
    if (this.state === 'OPEN' && now - this.lastStateChange >= this.config.cooldownPeriodMs) {
      this.state = 'HALF_OPEN';
      this.lastStateChange = now;
    }
    return this.state;
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures > 0) {
      this.state = 'CLOSED';
      this.consecutiveFailures = 0;
      this.lastStateChange = Date.now();
    }
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  public isOpen(): boolean {
    return this.getState() === 'OPEN';
  }
}

export const redisCircuitBreaker = new RedisCircuitBreaker();
