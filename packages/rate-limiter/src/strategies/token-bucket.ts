import { IStore, IStrategy, RateLimitResult } from "../interfaces";

interface TokenBucketData {
  tokens: number;
  lastRefilled: number;
}

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local weight = tonumber(ARGV[4]) or 1

local stored = redis.call('get', key)
local tokens = limit
local last_refilled = now

if stored then
    local data = cjson.decode(stored)
    tokens = tonumber(data.tokens)
    last_refilled = tonumber(data.lastRefilled)
end

local elapsed = now - last_refilled
local refill = elapsed * (limit / window_ms)
local new_tokens = math.min(limit, tokens + refill)

local allowed = false
local remaining = 0
local reset_time = now

if new_tokens >= weight then
    tokens = new_tokens - weight
    last_refilled = now
    allowed = true
    remaining = math.floor(tokens)
    reset_time = now + math.ceil((limit - tokens) * (window_ms / limit))
    local new_data = { tokens = tokens, lastRefilled = last_refilled }
    local ttl = math.ceil(window_ms / 1000)
    redis.call('setex', key, ttl, cjson.encode(new_data))
else
    tokens = new_tokens
    local needed = weight - tokens
    local time_to_refill = needed * (window_ms / limit)
    reset_time = now + math.ceil(time_to_refill)
    remaining = 0
end

local result = {
    allowed = allowed and 1 or 0,
    limit = limit,
    remaining = remaining,
    reset_time = reset_time
}
return cjson.encode(result)
`;

export class TokenBucketStrategy implements IStrategy {
  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: IStore,
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // 1. Try atomic execution via Lua script if store supports eval
    if (typeof store.eval === "function") {
      try {
        const resultString = (await store.eval(
          LUA_TOKEN_BUCKET,
          [key],
          [limit.toString(), windowMs.toString(), now.toString(), "1"],
        )) as string;

        const res = JSON.parse(resultString);
        const allowed = res.allowed === 1;
        const resetTime = tonumberOr(res.reset_time, now);

        if (!allowed) {
          const retryAfter = Math.ceil((resetTime - now) / 1000);
          return {
            allowed: false,
            limit,
            remaining: 0,
            resetTime,
            retryAfter: Math.max(1, retryAfter),
          };
        }

        return {
          allowed: true,
          limit,
          remaining: res.remaining,
          resetTime,
        };
      } catch {
        // Fall back to JavaScript read-modify-write on script/redis errors
      }
    }

    // 2. Fallback to JavaScript read-modify-write
    const cacheKey = `${key}:tokenbucket`;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    const stored = await store.get(cacheKey);
    let data: TokenBucketData;

    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch {
        data = { tokens: limit, lastRefilled: now };
      }
    } else {
      data = { tokens: limit, lastRefilled: now };
    }

    const elapsedTime = now - data.lastRefilled;
    const refillAmount = elapsedTime * (limit / windowMs);
    const newTokens = Math.min(limit, data.tokens + refillAmount);

    if (newTokens >= 1) {
      data.tokens = newTokens - 1;
      data.lastRefilled = now;
      await store.set(cacheKey, JSON.stringify(data), ttlSeconds);

      return {
        allowed: true,
        limit,
        remaining: Math.floor(data.tokens),
        resetTime: now + Math.ceil((limit - data.tokens) * (windowMs / limit)),
      };
    }

    const needed = 1 - newTokens;
    const timeToRefillMs = needed * (windowMs / limit);
    const retryAfter = Math.ceil(timeToRefillMs / 1000);

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime: now + Math.ceil(timeToRefillMs),
      retryAfter: Math.max(1, retryAfter),
    };
  }
}

function tonumberOr(val: any, fallback: number): number {
  const parsed = Number(val);
  return isNaN(parsed) ? fallback : parsed;
}
