import type { IStore, IStrategy, RateLimitResult } from '../interfaces';

interface FixedWindowData {
  count: number;
  windowStart: number;
}

const FIXED_WINDOW_LUA_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
-- Repair keys left without a TTL by the old INCR/EXPIRE race.
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

export class FixedWindowStrategy implements IStrategy {
  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: IStore
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const cacheKey = `${key}:fixed:${windowStart}`;
    const ttlSeconds = Math.ceil(windowMs / 1000);
    const resetTime = windowStart + windowMs;

    // Attempt atomic Lua evaluation first if store provides eval. The
    // read-modify-write branch below lets concurrent requests both pass a
    // limit check; INCR inside Redis removes that race.
    if (typeof store.eval === 'function') {
      try {
        const luaRes = await store.eval(
          FIXED_WINDOW_LUA_SCRIPT,
          [cacheKey],
          [String(Math.max(1, resetTime - now))]
        );
        if (Array.isArray(luaRes) && luaRes.length >= 2) {
          const count = Number(luaRes[0]);
          if (!Number.isFinite(count)) {
            throw new Error('Fixed window script returned a non-numeric count');
          }
          if (count > limit) {
            return {
              allowed: false,
              limit,
              remaining: 0,
              resetTime,
              retryAfter: Math.max(1, Math.ceil((resetTime - now) / 1000)),
            };
          }
          return {
            allowed: true,
            limit,
            remaining: Math.max(0, limit - count),
            resetTime,
          };
        }
      } catch {
        // Fallback to standard get/set when Redis lacks eval or scripts are blocked
      }
    }

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
      resetTime,
    };
  }
}
