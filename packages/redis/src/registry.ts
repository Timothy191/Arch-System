export const CacheCategory = {
  AUTH: "auth",
  METRICS: "metrics",
  SHIFT: "shift",
  AI_MEMORY: "ai_memory",
  DEPARTMENT: "dept",
  EQUIPMENT: "equipment",
} as const;

// eslint-disable-next-line no-redeclare
export type CacheCategory = (typeof CacheCategory)[keyof typeof CacheCategory];

export interface CacheTtlConfig {
  l1Seconds: number;
  l2Seconds: number;
}

export const CACHE_TTL_REGISTRY: Record<CacheCategory, CacheTtlConfig> = {
  [CacheCategory.AUTH]: { l1Seconds: 60, l2Seconds: 3600 },
  [CacheCategory.METRICS]: { l1Seconds: 15, l2Seconds: 300 },
  [CacheCategory.SHIFT]: { l1Seconds: 30, l2Seconds: 120 },
  [CacheCategory.AI_MEMORY]: { l1Seconds: 10, l2Seconds: 60 },
  [CacheCategory.DEPARTMENT]: { l1Seconds: 60, l2Seconds: 3600 },
  [CacheCategory.EQUIPMENT]: { l1Seconds: 30, l2Seconds: 300 },
};

export function buildCacheKey(
  category: CacheCategory,
  ...parts: (string | number | undefined)[]
): string {
  const clean = parts.filter((p): p is string | number => p !== undefined);
  return `arch:${category}:${clean.join(":")}`;
}
