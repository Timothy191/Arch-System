import { IStore, IStrategy, RateLimitResult } from "../interfaces";

export class SlidingWindowStrategy implements IStrategy {
  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: IStore,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const cacheKey = `${key}:sliding`;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    const stored = await store.get(cacheKey);
    let timestamps: number[] = [];

    if (stored) {
      try {
        timestamps = JSON.parse(stored);
      } catch {
        timestamps = [];
      }
    }

    // Filter out expired timestamps
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      const oldestActive = timestamps[0] || cutoff;
      const resetTime = oldestActive + windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    timestamps.push(now);
    await store.set(cacheKey, JSON.stringify(timestamps), ttlSeconds);

    const oldestActive = timestamps[0] || now;
    const nextReset = oldestActive + windowMs;

    return {
      allowed: true,
      limit,
      remaining: limit - timestamps.length,
      resetTime: nextReset,
    };
  }
}
