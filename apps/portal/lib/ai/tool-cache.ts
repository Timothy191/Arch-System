/**
 * In-memory LRU cache for tool results.
 *
 * Prevents redundant Supabase queries when a user asks follow-up
 * questions about the same data (common pattern: "show fleet" → "which are down?").
 *
 * TTL is deliberately short (5 seconds) to avoid serving stale data
 * for time-sensitive queries like fleet status.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: unknown;
  expiry: number;
}

// ────────────────────────────────────────────────────────────────────────────
// LRU Cache implementation
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5_000;
const MAX_ENTRIES = 100;

const cache = new Map<string, CacheEntry>();

function buildKey(toolName: string, args: Record<string, unknown>): string {
  return `${toolName}:${JSON.stringify(args)}`;
}

/**
 * Get a cached tool result, or undefined if not found / expired.
 */
export function getCachedToolResult(
  toolName: string,
  args: Record<string, unknown>,
): unknown | undefined {
  const key = buildKey(toolName, args);
  const entry = cache.get(key);

  if (!entry) return undefined;

  // Check expiry
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }

  // Move to end (most recently used) by re-inserting
  cache.delete(key);
  cache.set(key, entry);

  return entry.result;
}

/**
 * Store a tool result in cache.
 */
export function setCachedToolResult(
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  ttlMs = DEFAULT_TTL_MS,
): void {
  const key = buildKey(toolName, args);

  // Evict oldest entry if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  cache.set(key, {
    result,
    expiry: Date.now() + ttlMs,
  });
}

/**
 * Invalidate all cache entries for a given tool name.
 * Useful after a write-path tool execution that could change the data.
 */
export function invalidateToolCache(toolName: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${toolName}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cached tool results.
 */
export function clearToolCache(): void {
  cache.clear();
}

/**
 * Get the number of entries currently in cache (for testing/monitoring).
 */
export function getToolCacheSize(): number {
  return cache.size;
}
