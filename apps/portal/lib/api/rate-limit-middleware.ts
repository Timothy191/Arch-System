/**
 * API Rate Limiting Middleware
 *
 * Provides rate limiting for API endpoints using Redis-backed distributed limiting
 * with in-memory fallback. Supports different limit types per endpoint category.
 */

import { timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import { getRedisClient, incrWithExpire } from '@repo/redis';
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
// `incrWithExpire` is the shared primitive that guarantees this on both the TCP
// and the serverless REST transport (Lua when the server allows it).
interface CounterStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
}

const redisCounterStore: CounterStore = {
  async increment(key: string, windowMs: number) {
    const { value, resetMs } = await incrWithExpire(key, { ttlMs: windowMs });
    return { count: value, resetTime: Date.now() + resetMs };
  },
};

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
    store: CounterStore
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

/**
 * RFC 9210 headers (`RateLimit`, `RateLimit-Policy`) are the standard clients
 * will converge on; the legacy `X-RateLimit-*` triplet is kept because existing
 * dashboards and the mobile app still read it. `reset` is seconds until the
 * window rolls over.
 */
const MS_PER_SECOND = 1000;

function rateLimitHeaders(result: RateLimitResult, windowMs: number): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((result.resetTime - Date.now()) / MS_PER_SECOND));
  return {
    RateLimit: `limit=${result.limit}, remaining=${result.remaining}, reset=${resetSeconds}`,
    'RateLimit-Policy': `${result.limit};w=${Math.ceil(windowMs / MS_PER_SECOND)}`,
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  };
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
  let store: CounterStore;
  try {
    await getRedisClient();
    store = redisCounterStore;
  } catch {
    store = globalMemoryStore;
  }

  // Token Bucket Strategy for bursty AI calls, Sliding Window for all others
  const strategy = path.startsWith('/api/ai/') ? tokenBucketStrategy : slidingWindowStrategy;

  const key = `ratelimit:${normalizePath(path)}:${identifier}`;
  try {
    return await strategy.check(key, config.maxRequests, config.windowMs, store);
  } catch {
    // Redis dropped mid-request: this instance still limits traffic locally.
    return strategy.check(key, config.maxRequests, config.windowMs, globalMemoryStore);
  }
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
          'Retry-After': (result.retryAfter || 60).toString(),
          ...rateLimitHeaders({ ...result, remaining: 0 }, config.windowMs),
        },
      }
    );
  }

  const response = await handler();
  const headers = rateLimitHeaders(result, config.windowMs);
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }

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
