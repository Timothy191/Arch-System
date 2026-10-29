/**
 * L1 In-Memory Cache: TTL + true LRU eviction.
 *
 * Extracted from `cache.ts` so both the cache layer and the invalidation layer
 * can reach the same store without a circular import. Correctness of local
 * invalidation must not depend on Redis Pub/Sub, which the serverless (REST)
 * transport cannot provide.
 */

export const L1_MAX_ENTRIES = 1000;
export const DEFAULT_L1_SWEEP_INTERVAL_MS = 60_000;

interface MemoryEntry {
  value: unknown;
  expires: number;
}

const memoryCache = new Map<string, MemoryEntry>();
let l1SweepTimer: ReturnType<typeof setInterval> | null = null;

/** Presence-aware L1 read. Distinguishes "absent" from a cached falsy value. */
export type L1Read<T> = { hit: true; value: T } | { hit: false };

export function readMemory<T>(key: string): L1Read<T> {
  const item = memoryCache.get(key);
  if (item === undefined) return { hit: false };
  if (item.expires <= Date.now()) {
    memoryCache.delete(key);
    return { hit: false };
  }

  // True LRU: re-insert so the most recently read key moves to the tail.
  // Map preserves insertion order, so delete + set is an O(1) recency bump.
  memoryCache.delete(key);
  memoryCache.set(key, item);
  return { hit: true, value: item.value as T };
}

function evictForInsert(): void {
  // Reclaim the least-recently-used entry until there is room for one more.
  while (memoryCache.size >= L1_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next();
    if (oldest.done) return;
    memoryCache.delete(oldest.value);
  }
}

export function memoryGet<T>(key: string): T | null {
  const read = readMemory<T>(key);
  return read.hit ? read.value : null;
}

export function memorySet<T>(key: string, value: T, ttlSeconds: number): void {
  // Refresh an existing key in place, otherwise make room first.
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else {
    evictForInsert();
  }

  memoryCache.set(key, {
    value,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

export function memoryDelete(key: string): void {
  memoryCache.delete(key);
}

export function memoryDeleteByPrefix(prefix: string): number {
  let removed = 0;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      removed++;
    }
  }
  return removed;
}

export function memoryDeleteKeys(keys: Iterable<string>): number {
  let removed = 0;
  for (const key of keys) {
    if (memoryCache.delete(key)) removed++;
  }
  return removed;
}

/** Number of entries physically held, including any not yet lazily reaped. */
export function memoryRawSize(): number {
  return memoryCache.size;
}

/** Number of live (unexpired) L1 entries. */
export function memoryLiveSize(): number {
  const now = Date.now();
  let live = 0;
  for (const entry of memoryCache.values()) {
    if (entry.expires > now) live++;
  }
  return live;
}

/** Drop every expired entry. Returns how many were reclaimed. */
export function memorySweep(): number {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of memoryCache) {
    if (entry.expires <= now) {
      memoryCache.delete(key);
      removed++;
    }
  }
  return removed;
}

export function clearMemoryCache(): void {
  memoryCache.clear();
}

/**
 * Start a periodic background sweep of expired L1 entries.
 * Uses `.unref()` so the timer never blocks Node/serverless process exit.
 */
export function startL1Sweep(
  intervalMs: number = DEFAULT_L1_SWEEP_INTERVAL_MS,
  onSweep?: (removedCount: number) => void
): void {
  stopL1Sweep();
  l1SweepTimer = setInterval(() => {
    const removedCount = memorySweep();
    if (removedCount > 0) {
      onSweep?.(removedCount);
    }
  }, intervalMs);
  l1SweepTimer.unref?.();
}

/** Stop the periodic L1 sweep timer if active. */
export function stopL1Sweep(): void {
  if (l1SweepTimer !== null) {
    clearInterval(l1SweepTimer);
    l1SweepTimer = null;
  }
}
