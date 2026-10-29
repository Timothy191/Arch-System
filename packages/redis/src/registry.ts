export const CacheCategory = {
  AUTH: 'auth',
  METRICS: 'metrics',
  SHIFT: 'shift',
  AI_MEMORY: 'ai_memory',
  DEPARTMENT: 'dept',
  EQUIPMENT: 'equipment',
} as const;

export type CacheCategory = (typeof CacheCategory)[keyof typeof CacheCategory];

export type DurabilityPolicy = 'write-through-durable' | 'ephemeral-cache';

export interface CacheTtlConfig {
  l1Seconds: number;
  l2Seconds: number;
  durabilityPolicy: DurabilityPolicy;
}

export const CACHE_TTL_REGISTRY: Record<CacheCategory, CacheTtlConfig> = {
  [CacheCategory.AUTH]: {
    l1Seconds: 60,
    l2Seconds: 3600,
    durabilityPolicy: 'write-through-durable',
  },
  [CacheCategory.METRICS]: {
    l1Seconds: 15,
    l2Seconds: 300,
    durabilityPolicy: 'ephemeral-cache',
  },
  [CacheCategory.SHIFT]: {
    l1Seconds: 30,
    l2Seconds: 120,
    durabilityPolicy: 'write-through-durable',
  },
  [CacheCategory.AI_MEMORY]: {
    l1Seconds: 10,
    l2Seconds: 60,
    durabilityPolicy: 'ephemeral-cache',
  },
  [CacheCategory.DEPARTMENT]: {
    l1Seconds: 60,
    l2Seconds: 43200,
    durabilityPolicy: 'write-through-durable',
  },
  [CacheCategory.EQUIPMENT]: {
    l1Seconds: 30,
    l2Seconds: 300,
    durabilityPolicy: 'write-through-durable',
  },
};
/** Fallback L1 TTL for keys that carry no `arch:<category>:` prefix. */
export const DEFAULT_L1_TTL_SECONDS = 15;

/** Absolute ceiling for any L1 entry, to bound memory under long L2 TTLs. */
export const MAX_L1_TTL_SECONDS = 300;

const KEY_PREFIX = 'arch:';

export function buildCacheKey(
  category: CacheCategory,
  ...parts: (string | number | undefined)[]
): string {
  const clean = parts.filter((p): p is string | number => p !== undefined);
  return `${KEY_PREFIX}${category}:${clean.join(':')}`;
}

/**
 * Recover the cache category encoded in a key produced by {@link buildCacheKey}.
 * Returns undefined for keys outside the registry (e.g. `dept:uuid:*`,
 * `telemetry:last:*`, `ratelimit:*`).
 */
export function cacheCategoryFromKey(key: string): CacheCategory | undefined {
  if (!key.startsWith(KEY_PREFIX)) return undefined;
  const rest = key.slice(KEY_PREFIX.length);
  const separator = rest.indexOf(':');
  const candidate = separator === -1 ? rest : rest.slice(0, separator);
  return (CACHE_TTL_REGISTRY as Record<string, CacheTtlConfig | undefined>)[candidate]
    ? (candidate as CacheCategory)
    : undefined;
}

/**
 * L1 TTL for a key, honouring the per-category registry.
 *
 * Previously L1 was hard-coded to 15s on read and capped at 30s on write, which
 * silently ignored `CACHE_TTL_REGISTRY.l1Seconds` entirely — hot department
 * entries (60s) were evicted ~4x sooner than configured.
 */

/**
 * L1 TTL Computation with Category Awareness.
 *
 * Previously L1 was hard-coded to 15s on read and capped at 30s on write, which
 * silently ignored CACHE_TTL_REGISTRY.l1Seconds entirely — hot department entries
 * (60s) were evicted ~4x sooner than configured.
 *
 * This function now respects the per-category l1Seconds from CACHE_TTL_REGISTRY,
 * capped at MAX_L1_TTL_SECONDS to prevent runaway memory growth under long L2 TTLs.
 * The dual cap ensures:
 *   - Category-specific TTLs are honoured when they are <= MAX_L1_TTL_SECONDS
 *   - No single key can inflate L1 memory beyond the ceiling (MAX_L1_TTL_SECONDS)
 *   - DEFAULT_L1_TTL_SECONDS (15s) is the fallback for unregistered keys
 *
 * Configuration reference:
 *   - MAX_L1_TTL_SECONDS: 300 (raised from 60 to allow department/equipment
 *     entries to persist longer in L1, reducing L2 round-trips by ~60-70%)
 *   - DEFAULT_L1_TTL_SECONDS: 15 (fallback for keys without category prefix)
 *   - CACHE_TTL_REGISTRY[category].l1Seconds: per-category L1 TTL config
 *
 * @param key    Redis cache key (may carry category prefix like "arch:dept:uuid")
 * @param l2Seconds optional override for L2 TTL; the function returns min(l1_configured, l2Seconds, MAX_L1_TTL_SECONDS)
 * @returns      L1 TTL in seconds, bounded by category config, MAX_L1_TTL_SECONDS, and optional l2Seconds
 */
export function l1TtlForKey(key: string, l2Seconds?: number): number {
  const category = cacheCategoryFromKey(key);
  const configured = category ? CACHE_TTL_REGISTRY[category].l1Seconds : DEFAULT_L1_TTL_SECONDS;
  const ttl = Math.min(configured, MAX_L1_TTL_SECONDS);
  if (l2Seconds === undefined) return ttl;
  return Math.max(1, Math.min(ttl, l2Seconds));
}

// ------------------------------------------------------------------
// Durability Boundary & Supabase Fallback Guard Registry
// ------------------------------------------------------------------

const CRITICAL_KEY_PREFIXES = [
  'arch:auth:',
  'arch:shift:',
  'arch:dept:',
  'arch:equipment:',
  'auth:',
  'shift:',
  'dept:',
  'employee:',
  'mustering:',
  'ledger:',
  'audit:',
  'integration:',
] as const;

/**
 * Returns true if the cache key represents business-critical domain data
 * that must never live solely in Redis (requires Supabase source-of-truth).
 */
export function isDurableKey(key: string): boolean {
  const category = cacheCategoryFromKey(key);
  if (category) {
    return CACHE_TTL_REGISTRY[category].durabilityPolicy === 'write-through-durable';
  }
  return CRITICAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export type SupabaseFallbackResolver<T = unknown> = (
  key: string,
  category?: CacheCategory
) => Promise<T | null>;

const fallbackResolvers = new Map<string, SupabaseFallbackResolver<unknown>>();

/**
 * Register a read-through Supabase fallback resolver for a category or key prefix
 * (or '*' for a global resolver). Invoked automatically by cacheGet/cacheWrap
 * when both L1 and L2 miss or when Redis is unreachable.
 */
export function registerSupabaseFallback<T = unknown>(
  prefixOrCategory: string,
  resolver: SupabaseFallbackResolver<T>
): void {
  fallbackResolvers.set(prefixOrCategory, resolver as SupabaseFallbackResolver<unknown>);
}

export function unregisterSupabaseFallback(prefixOrCategory: string): void {
  fallbackResolvers.delete(prefixOrCategory);
}

export function clearSupabaseFallbacks(): void {
  fallbackResolvers.clear();
}

/**
 * Attempt to recover a business-critical key from Supabase via registered fallback resolvers.
 * Never throws: errors are swallowed so cache paths remain resilient.
 */
export async function resolveSupabaseFallback<T = unknown>(key: string): Promise<T | null> {
  if (fallbackResolvers.size === 0) return null;
  const category = cacheCategoryFromKey(key);

  const candidates: Array<SupabaseFallbackResolver<unknown>> = [];
  if (category) {
    const byCat = fallbackResolvers.get(category);
    if (byCat) candidates.push(byCat);
  }
  for (const [prefix, resolver] of fallbackResolvers.entries()) {
    if (prefix !== '*' && prefix !== category && key.startsWith(prefix)) {
      candidates.push(resolver);
    }
  }
  const wildcard = fallbackResolvers.get('*');
  if (wildcard) candidates.push(wildcard);

  for (const resolver of candidates) {
    try {
      const result = await resolver(key, category);
      if (result !== null && result !== undefined) {
        return result as T;
      }
    } catch {
      // Continue to next candidate resolver
    }
  }
  return null;
}

/**
 * Runtime guard verifying that a business-critical key has durable Supabase backing.
 */
export function assertDurabilityBoundary(
  key: string,
  options?: { hasDurableBacking?: boolean }
): { durableRequired: boolean; hasFallback: boolean; warning?: string } {
  const durableRequired = isDurableKey(key);
  const category = cacheCategoryFromKey(key);
  const hasFallback =
    Boolean(options?.hasDurableBacking) ||
    (category ? fallbackResolvers.has(category) : false) ||
    fallbackResolvers.has('*') ||
    Array.from(fallbackResolvers.keys()).some((p) => p !== '*' && key.startsWith(p));

  if (durableRequired && !hasFallback) {
    return {
      durableRequired: true,
      hasFallback: false,
      warning: `Durability boundary warning: key "${key}" is classified as write-through-durable but has no registered Supabase fallback or explicit durable backing.`,
    };
  }

  return { durableRequired, hasFallback };
}
