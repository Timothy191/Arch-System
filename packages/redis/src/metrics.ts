// packages/redis/src/metrics.ts
const COUNTERS: Record<string, number> = {};
const LABELS: Record<string, Record<string, string>> = {};

export type MetricName =
  | 'hit'
  | 'miss'
  | 'negative_hit'
  | 'lock_wait'
  | 'lock_timeout'
  | 'stampede_prevented'
  | 'eviction_observed'
  | 'ttl_jittered'
  | 'l1_eviction'
  | 'l2_round_trip'
  | 'privilege_version_change'
  | 'write_through_delay_ms';

export function incrementMetric(name: MetricName, labels?: Record<string, string>): void {
  const key = labels ? `${name}:${JSON.stringify(labels)}` : name;
  COUNTERS[key] = (COUNTERS[key] ?? 0) + 1;
  if (labels) LABELS[key] = labels;
}

export function getMetric(name: MetricName, labels?: Record<string, string>): number {
  const key = labels ? `${name}:${JSON.stringify(labels)}` : name;
  return COUNTERS[key] ?? 0;
}

export function resetMetrics(): void {
  for (const k of Object.keys(COUNTERS)) delete COUNTERS[k];
  for (const k of Object.keys(LABELS)) delete LABELS[k];
}

export async function withCacheMetrics<T>(keyPattern: string, fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function renderMetrics(): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(COUNTERS)) {
    const name = key.split(':')[0] as string;
    const labels = LABELS[key];
    const prefix = labels?.key_prefix ?? (labels ? Object.values(labels)[0] : '');
    const labelStr = prefix ? `{key_prefix="${prefix}"}` : '';
    lines.push(`redis_cache_${name}_total${labelStr} ${value}`);
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

export function keyPrefix(key: string): string {
  const idx = key.indexOf(':');
  return idx === -1 ? key : key.slice(0, idx);
}
