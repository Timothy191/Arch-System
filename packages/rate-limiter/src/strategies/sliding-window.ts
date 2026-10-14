import type { IStore, IStrategy, RateLimitResult } from '../interfaces';

const SLIDING_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttlSeconds = tonumber(ARGV[4])
local cutoff = now - windowMs

local raw = redis.call('GET', key)
local timestamps = {}
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if ok and type(decoded) == 'table' then
    for _, ts in ipairs(decoded) do
      if ts > cutoff then
        table.insert(timestamps, ts)
      end
    end
  end
end

if #timestamps >= limit then
  local oldest = timestamps[1] or cutoff
  local resetTime = oldest + windowMs
  return {0, 0, resetTime}
end

table.insert(timestamps, now)
redis.call('SET', key, cjson.encode(timestamps), 'EX', ttlSeconds)
local oldest = timestamps[1] or now
local resetTime = oldest + windowMs
return {1, limit - #timestamps, resetTime}
`;

export class SlidingWindowStrategy implements IStrategy {
  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: IStore
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const cacheKey = `${key}:sliding`;
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    // Attempt atomic Lua evaluation first if store provides eval
    if (typeof store.eval === 'function') {
      try {
        const luaRes = await store.eval(
          SLIDING_WINDOW_LUA_SCRIPT,
          [cacheKey],
          [String(now), String(windowMs), String(limit), String(ttlSeconds)]
        );
        if (Array.isArray(luaRes) && luaRes.length >= 3) {
          const allowed = Number(luaRes[0]) === 1;
          const remaining = Math.max(0, Number(luaRes[1]));
          const resetTime = Number(luaRes[2]);
          if (!allowed) {
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
            remaining,
            resetTime,
          };
        }
      } catch {
        // Fallback to standard get/set below when Redis client lacks eval or during transient fallback
      }
    }

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
