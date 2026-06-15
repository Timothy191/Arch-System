/**
 * Redis-backed rate limiter for AI endpoints.
 * Uses Token Bucket strategy for distributed rate limiting.
 * Falls back to in-memory if Redis is unavailable.
 *
 * Per-tool buckets (GAP-1): each tool category gets its own key prefix so a
 * heavy tool call cannot starve other endpoints on the same IP. The default
 * `checkRateLimit(ip)` keeps the original chat-only behaviour for backward
 * compatibility.
 */

import { getRedisClient } from "@repo/redis";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

// Simple in-memory store for rate limiting
class MemoryStore {
  private counters = new Map<string, { count: number; resetTime: number }>();

  async increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetTime: number }> {
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

  async get(
    key: string,
  ): Promise<{ count: number; resetTime: number } | undefined> {
    return this.counters.get(key);
  }

  clear(): void {
    this.counters.clear();
  }
}

// AGENT-TRACE: Simple Redis store for rate limiting
// Redis parameter prefixed with underscore to fix ESLint warning (currently unused placeholder)
// Full Redis integration pending - this is a placeholder for future implementation
class RedisStore {
  constructor(private _redis: Awaited<ReturnType<typeof getRedisClient>>) {}

  async increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const resetTime = now + windowMs;

    const result = await this._redis.incr(key);
    if (result === 1) {
      await this._redis.expire(key, Math.ceil(windowMs / 1000));
    }

    return { count: result, resetTime };
  }

  async get(
    key: string,
  ): Promise<{ count: number; resetTime: number } | undefined> {
    const count = await this._redis.get(key);
    if (!count) return undefined;
    return { count: parseInt(count, 10), resetTime: Date.now() + 60000 };
  }
}

// Token bucket strategy
class TokenBucketStrategy {
  async check(
    key: string,
    limit: number,
    windowMs: number,
    store: MemoryStore | RedisStore,
  ): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const result = await store.increment(key, windowMs);
    const allowed = result.count <= limit;
    const remaining = Math.max(0, limit - result.count);

    return {
      allowed,
      limit,
      remaining,
      resetTime: result.resetTime,
    };
  }
}

const globalMemoryStore = new MemoryStore();
let globalRedisStore: RedisStore | null = null;
const tokenBucketStrategy = new TokenBucketStrategy();

/**
 * Tool category. Each category gets an independent token bucket.
 *
 * - `chat`      — default LLM completions (current behaviour, kept for compat)
 * - `embedding` — vector generation, cheaper but DB-bound
 * - `tool`      — agent tools, override per-tool via `RATE_LIMIT_REGISTRY`
 */
type RateLimitCategory = "chat" | "embedding" | "tool";

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const DEFAULT_TOOL_CONFIG: RateLimitConfig = { limit: 60, windowMs: WINDOW_MS };
const DEFAULT_EMBEDDING_CONFIG: RateLimitConfig = {
  limit: 60,
  windowMs: WINDOW_MS,
};

/**
 * Per-tool overrides. Tools not listed here fall back to DEFAULT_TOOL_CONFIG.
 * Internal registry — add entries as needed.
 */
const RATE_LIMIT_REGISTRY: Record<string, RateLimitConfig> = {
  // Expensive or high-volume tools can be tuned here.
  // Example: machineStatusTool: { limit: 120, windowMs: 60_000 },
};

function getRateLimitConfig(
  category: RateLimitCategory,
  toolName?: string,
): RateLimitConfig {
  if (category === "embedding") return DEFAULT_EMBEDDING_CONFIG;
  if (category === "tool" && toolName && RATE_LIMIT_REGISTRY[toolName]) {
    return RATE_LIMIT_REGISTRY[toolName]!;
  }
  if (category === "tool") return DEFAULT_TOOL_CONFIG;
  return { limit: MAX_REQUESTS, windowMs: WINDOW_MS };
}

async function getStore() {
  try {
    const redis = await getRedisClient();
    if (!globalRedisStore && redis) {
      globalRedisStore = new RedisStore(redis);
    }
    return globalRedisStore || globalMemoryStore;
  } catch {
    return globalMemoryStore;
  }
}

function buildKey(
  category: RateLimitCategory,
  identifier: string,
  toolName?: string,
): string {
  if (category === "tool" && toolName) {
    return `ratelimit:${category}:${toolName}:${identifier}`;
  }
  return `ratelimit:${category}:${identifier}`;
} /**
 * Check whether a request from `ip` is within the chat rate limit.
 * Backward-compatible: same bucket as before (single `ratelimit:${ip}` key).
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const store = await getStore();
  const result = await tokenBucketStrategy.check(
    `ratelimit:${ip}`,
    MAX_REQUESTS,
    WINDOW_MS,
    store,
  );
  return result.allowed;
}

/**
 * Check the per-category (and optional per-tool) rate limit.
 *
 * - `category = "chat"` → same as `checkRateLimit(ip)` but with explicit category key.
 * - `category = "embedding"` → independent bucket from chat.
 * - `category = "tool"` with `toolName` → independent bucket per (ip, tool).
 */
export async function checkRateLimitForCategory(
  category: RateLimitCategory,
  ip: string,
  toolName?: string,
): Promise<boolean> {
  const cfg = getRateLimitConfig(category, toolName);
  const store = await getStore();
  const key = buildKey(category, ip, toolName);
  const result = await tokenBucketStrategy.check(
    key,
    cfg.limit,
    cfg.windowMs,
    store,
  );
  return result.allowed;
}

/**
 * Reset rate limits (for testing).
 */
export function resetRateLimits(): void {
  globalMemoryStore.clear();
}
