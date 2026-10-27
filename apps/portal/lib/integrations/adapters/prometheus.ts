import { APIError } from '@/lib/errors/error-classes';
import { assertSafeUrl } from '../ssrf-guard';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MS_PER_SECOND = 1_000;

const ALLOWLISTED_METRICS = [
  'up',
  'node_cpu_seconds_total',
  'node_memory_MemAvailable_bytes',
  'process_resident_memory_bytes',
  'arch_haul_truck_smr_hours',
  'arch_compressor_temperature_celsius',
] as const;

type AllowlistedMetric = (typeof ALLOWLISTED_METRICS)[number];

interface PrometheusQueryOptions {
  baseUrl: string;
  metric: string;
  timeoutMs?: number;
}

interface PrometheusQueryResult {
  metricValue: number | null;
  timestampMs: number;
}

export async function checkPrometheusHealth(baseUrl: string): Promise<boolean> {
  assertSafeUrl(baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/-/healthy`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function queryPrometheus(
  options: PrometheusQueryOptions
): Promise<PrometheusQueryResult> {
  assertSafeUrl(options.baseUrl);
  if (!ALLOWLISTED_METRICS.includes(options.metric as AllowlistedMetric)) {
    throw new APIError('Metric is not allowlisted', {
      statusCode: 400,
      context: { component: 'prometheus_adapter', metric: options.metric },
    });
  }
  const timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(`${options.baseUrl.replace(/\/$/, '')}/api/v1/query`);
    url.searchParams.set('query', options.metric);
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return { metricValue: null, timestampMs: Date.now() };
    const body = (await response.json()) as {
      data?: { result?: Array<{ value?: [number, string] }> };
    };
    const sample = body.data?.result?.[0]?.value;
    if (!sample) return { metricValue: null, timestampMs: Date.now() };
    return {
      metricValue: Number(sample[1]),
      timestampMs: Math.round(sample[0] * MS_PER_SECOND),
    };
  } catch {
    return { metricValue: null, timestampMs: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}
