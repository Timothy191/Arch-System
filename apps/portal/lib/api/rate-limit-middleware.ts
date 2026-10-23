/**
 * API Rate Limiting Middleware
 *
 * Provides rate limiting for API endpoints using Redis-backed distributed limiting
 * with in-memory fallback. Supports different limit types per endpoint category.
 */

import { timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import { getRedisClient } from '@repo/redis';
import { type NextRequest, NextResponse } from 'next/server';
import { getRateLimitConfig } from './rate-limit-config';

// Simple in-memory store for rate limiting
class MemoryStore {
  private counters = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now > entry.resetTime) {
      const newEntry = { count: 1, resetTime: now + windowMs };
      this.counters.set(key, newEntry);
      return newEntry;
    }

    entry.count++;
    return entry;
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | undefined> {
    return this.counters.get(key);
  }

  clear(): void {
    this.counters.clear();
  }
}

// INCR and PEXPIRE must be atomic: a crash between the two leaves a key with
// no TTL, which permanently blocks the identifier once the count is exceeded.
const RATE_LIMIT_LUA_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
-- Repair keys left without a TTL by the old INCR/EXPIRE race.
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

// Simple Redis store for rate limiting
class RedisStore {
  constructor(private _redis: Awaited<ReturnType<typeof getRedisClient>>) {}

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();

    if (typeof this._redis.eval === 'function') {
      try {
        const raw = await this._redis.eval(RATE_LIMIT_LUA_SCRIPT, {
          keys: [key],
          arguments: [String(windowMs)],
        });
        if (Array.isArray(raw) && raw.length >= 2) {
          const count = Number(raw[0]);
          const ttl = Number(raw[1]);
          if (Number.isFinite(count)) {
            return {
              count,
              resetTime: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs),
            };
          }
        }
      } catch {
        // Fall back to non-atomic INCR/EXPIRE when scripts are unavailable
      }
    }

    const result = await this._redis.incr(key);
    if (result === 1) {
      await this._redis.expire(key, Math.ceil(windowMs / 1000));
    }

    return { count: result, resetTime: now + windowMs };
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | undefined> {
    const count = await this._redis.get(key);
    if (!count) return undefined;
    return { count: parseInt(count, 10), resetTime: Date.now() + 60000 };
  }
}

// Shared window-based counter strategy. Both "token bucket" and
// "sliding window" currently share the same fixed-window increment;
// they are kept as separate named instances only so the call site can
// describe intent (bursty vs steady traffic) without branching logic.
class WindowStrategy {
  constructor(readonly _kind: 'token-bucket' | 'sliding-window') {}

  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: MemoryStore | RedisStore
  ): Promise<RateLimitResult> {
    const result = await store.increment(key, windowMs);
    const allowed = result.count <= limit;
    const remaining = Math.max(0, limit - result.count);

    return {
      allowed,
      limit,
      remaining,
      resetTime: result.resetTime,
      retryAfter: Math.max(0, Math.ceil((result.resetTime - Date.now()) / 1000)),
    };
  }
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

const WHITELISTED_IPS = new Set(
  (process.env.RATE_LIMIT_IP_WHITELIST || '127.0.0.1,::1,::ffff:127.0.0.1')
    .split(',')
    .map((ip) => ip.trim())
);

function isIpWhitelisted(ip: string): boolean {
  return WHITELISTED_IPS.has(ip);
}

function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp =
    forwarded?.split(',')[0]?.trim() || ('ip' in request ? (request as any).ip : undefined);
  return realIp || 'unknown';
}

function isSystemUnderHighLoad(): boolean {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_LOAD_ADAPTIVE_TEST) return false;
  try {
    const load = os.loadavg()[0]; // 1-minute load average
    if (load === undefined) return false;
    const cpus = os.cpus().length;
    return load / cpus > 0.85; // System load is high if >85% CPU capacity
  } catch {
    return false;
  }
}

// Singleton stores and strategies for performance and connection pooling
const globalMemoryStore = new MemoryStore();
let globalRedisStore: RedisStore | null = null;

const slidingWindowStrategy = new WindowStrategy('sliding-window');
const tokenBucketStrategy = new WindowStrategy('token-bucket');

/**
 * Check rate limit for a given identifier and configuration.
 *
 * The counter is scoped to the endpoint path so unrelated routes (and the SSE
 * stream vs. its ingest route) never share a budget even when callers share an
 * IP address.
 */
export async function checkRateLimit(
  identifier: string,
  config: { windowMs: number; maxRequests: number },
  path: string
): Promise<RateLimitResult> {
  let store;
  try {
    const redisClient = await getRedisClient();
    if (!globalRedisStore && redisClient) {
      globalRedisStore = new RedisStore(redisClient);
    }
    store = globalRedisStore || globalMemoryStore;
  } catch {
    store = globalMemoryStore;
  }

  // Token Bucket Strategy for bursty AI calls, Sliding Window for all others
  const strategy = path.startsWith('/api/ai/') ? tokenBucketStrategy : slidingWindowStrategy;

  const key = `ratelimit:${normalizePath(path)}:${identifier}`;
  return strategy.check(key, config.maxRequests, config.windowMs, store);
}

function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Extract client identifier from request.
 *
 * Only the network identity is trusted. `x-user-id` is client-supplied on API
 * routes (the auth proxy does not run for `/api/*`), so using it here let any
 * caller reset their bucket by changing a header.
 */
function getClientIdentifier(request: Request | NextRequest): string {
  return `ip:${getClientIp(request)}`;
}

/**
 * Rate limiting middleware for API routes
 */
export async function withRateLimit(
  request: Request | NextRequest,
  handler: () => Promise<NextResponse>,
  options?: {
    customLimit?: { windowMs: number; maxRequests: number };
    skipIf?: (_request: Request | NextRequest) => boolean;
  }
): Promise<NextResponse> {
  // Allow disabling rate limit for load testing and development
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return handler();
  }

  // Skip rate limiting if condition is met
  if (options?.skipIf?.(request)) {
    return handler();
  }

  // 1. IP Whitelist Bypass check
  const clientIp = getClientIp(request);
  if (isIpWhitelisted(clientIp)) {
    return handler();
  }

  const path = new URL(request.url).pathname;
  let config = options?.customLimit || getRateLimitConfig(path);

  // 2. Load-Adaptive Throttling: Scale down the rate limit if system CPU load is high
  if (isSystemUnderHighLoad()) {
    config = {
      windowMs: config.windowMs,
      maxRequests: Math.max(1, Math.floor(config.maxRequests * 0.5)),
    };
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimit(identifier, config, path);

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${result.retryAfter || 60} seconds.`,
        retryAfter: result.retryAfter || 60,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': (result.retryAfter || 60).toString(),
        },
      }
    );
  }

  const response = await handler();

  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

  return response;
}

/**
 * Skip rate limiting for internal requests
 */
export function skipForInternal(request: Request | NextRequest): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return false;

  const internalSecret = request.headers.get('x-internal-secret') || '';
  if (internalSecret.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(internalSecret), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Reset middleware rate limits (for testing).
 */
export function resetMiddlewareRateLimits(): void {
  globalMemoryStore.clear();
}
