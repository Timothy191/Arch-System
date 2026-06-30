import { IStore, IStrategy, RateLimitResult } from "../interfaces";

interface FixedWindowData {
  count: number;
  windowStart: number;
}

export class FixedWindowStrategy implements IStrategy {
  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: IStore,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const cacheKey = `${key}:fixed:${windowStart}`;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    const stored = await store.get(cacheKey);
    let data: FixedWindowData;

    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch {
        data = { count: 0, windowStart };
      }
    } else {
      data = { count: 0, windowStart };
    }

    if (data.windowStart !== windowStart) {
      data = { count: 0, windowStart };
    }

    if (data.count >= limit) {
      const resetTime = windowStart + windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    data.count++;
    await store.set(cacheKey, JSON.stringify(data), ttlSeconds);

    return {
      allowed: true,
      limit,
      remaining: limit - data.count,
      resetTime: windowStart + windowMs,
    };
  }
}
