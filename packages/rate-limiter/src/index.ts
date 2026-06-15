import {
  IStore,
  IStrategy,
  RateLimitOptions,
  RateLimitResult,
} from "./interfaces";

export * from "./interfaces";
export * from "./stores/memory.store";
export * from "./stores/redis.store";
export * from "./strategies/fixed-window";
export * from "./strategies/sliding-window";
export * from "./strategies/token-bucket";

export class RateLimiter {
  private store: IStore;
  private strategy: IStrategy;
  private limit: number;
  private windowMs: number;
  private keyPrefix: string;

  constructor(options: RateLimitOptions) {
    this.store = options.store;
    this.strategy = options.strategy;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.keyPrefix = options.keyPrefix || "ratelimit:";
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}${identifier}`;
    return this.strategy.check(key, this.limit, this.windowMs, this.store);
  }
}
