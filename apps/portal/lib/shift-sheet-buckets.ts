/**
 * Client-safe definitions for the machine-operations shift sheet.
 *
 * This module is intentionally dependency-free. The shift sheet is rendered by a
 * client component, and importing these values from `lib/shift-completeness.ts`
 * would pull `@repo/redis` (and the Node Redis driver) into the browser bundle —
 * Next's client-boundary build fails on that. `lib/shift-completeness.ts`
 * imports from here; never the other way round.
 *
 * Buckets are backed by `delay_categories` names (seeded in migration
 * 195_machine_operations_delay_categories.sql) and aggregated from
 * `delay_entries`, not from per-bucket numeric columns.
 */
export const DELAY_BUCKET_KEYS = [
  'blasting',
  'natural',
  'noOperator',
  'otherProduction',
  'greasingStartup',
  'maintenanceGet',
  'breakdown',
] as const;

export type DelayBucketKey = (typeof DELAY_BUCKET_KEYS)[number];

export type DelayBucketMinutes = Record<DelayBucketKey, number>;

/**
 * Category-name → sheet bucket. Lowercased keys; aliases keep the historic
 * generic categories (seeded before the sheet buckets existed) landing in the
 * column a supervisor would expect. Unmapped categories (e.g. `External`) are
 * intentionally excluded so they never inflate a production bucket.
 */
export const DELAY_BUCKET_BY_CATEGORY: Record<string, DelayBucketKey> = {
  blasting: 'blasting',
  natural: 'natural',
  weather: 'natural',
  'no operator': 'noOperator',
  'operator unavailable': 'noOperator',
  'other production delay': 'otherProduction',
  production: 'otherProduction',
  other: 'otherProduction',
  'greasing & startup': 'greasingStartup',
  'greasing and startup': 'greasingStartup',
  'maintenance & get': 'maintenanceGet',
  maintenance: 'maintenanceGet',
  engineering: 'maintenanceGet',
  breakdown: 'breakdown',
  'equipment breakdown': 'breakdown',
};

export function emptyDelayBuckets(): DelayBucketMinutes {
  return {
    blasting: 0,
    natural: 0,
    noOperator: 0,
    otherProduction: 0,
    greasingStartup: 0,
    maintenanceGet: 0,
    breakdown: 0,
  };
}
