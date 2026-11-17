import type {
  CiPipelineEntry,
  GrafanaDashboardEntry,
  ObservabilityCiResponse,
  ObservabilityServiceStatus,
  ObservabilitySummaryResponse,
  PrometheusMetricSample,
} from '@repo/contract';
import { getCacheStats } from '@repo/redis';

const PROBE_TIMEOUT_MS = 3_000;
const DEFAULT_GITHUB_REPO = 'Timothy191/Arch-System';
const PROMETHEUS_PRESETS = [
  {
    id: 'cache_hits_l1',
    label: 'L1 Cache Hits',
    query: 'portal_cache_hits_total{source="l1"}',
    unit: 'hits',
  },
  {
    id: 'cache_hits_l2',
    label: 'L2 Redis Hits',
    query: 'portal_cache_hits_total{source="l2"}',
    unit: 'hits',
  },
  {
    id: 'cache_misses',
    label: 'Cache Misses',
    query: 'portal_cache_misses_total',
    unit: 'misses',
  },
  {
    id: 'cache_latency_p95',
    label: 'Cache p95 Latency',
    query: 'portal_cache_latency_ms{metric="p95"}',
    unit: 'ms',
  },
] as const;

interface ProbeResult<T> {
  isReachable: boolean;
  latencyMs: number | null;
  payload: T | null;
  detail: string;
}

async function probeJson<T>(options: {
  url: string;
  headers?: Record<string, string>;
}): Promise<ProbeResult<T>> {
  const startedAt = Date.now();
  try {
    const response = await fetch(options.url, {
      headers: options.headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        isReachable: false,
        latencyMs,
        payload: null,
        detail: `HTTP ${response.status}`,
      };
    }
    const payload = (await response.json()) as T;
    return {
      isReachable: true,
      latencyMs,
      payload,
      detail: 'Connected',
    };
  } catch (err) {
    return {
      isReachable: false,
      latencyMs: null,
      payload: null,
      detail: err instanceof Error ? err.message : 'Unreachable',
    };
  }
}

async function queryPrometheusPreset(options: {
  prometheusUrl: string;
  preset: (typeof PROMETHEUS_PRESETS)[number];
}): Promise<PrometheusMetricSample | null> {
  const endpoint = `${options.prometheusUrl.replace(/\/$/, '')}/api/v1/query?query=${encodeURIComponent(options.preset.query)}`;
  const probe = await probeJson<{
    status?: string;
    data?: { result?: Array<{ value?: [number, string] }> };
  }>({ url: endpoint });

  if (!probe.isReachable || probe.payload?.status !== 'success') {
    return null;
  }

  const rawValue = probe.payload.data?.result?.[0]?.value?.[1];
  const numericValue = rawValue !== undefined ? Number(rawValue) : null;

  return {
    id: options.preset.id,
    label: options.preset.label,
    query: options.preset.query,
    value: Number.isFinite(numericValue) ? numericValue : null,
    unit: options.preset.unit,
    source: 'live',
  };
}

async function fetchGrafanaDashboards(options: {
  grafanaUrl: string;
  apiKey?: string;
  publicUrl?: string;
}): Promise<{ status: ObservabilityServiceStatus; dashboards: GrafanaDashboardEntry[] }> {
  const baseUrl = options.grafanaUrl.replace(/\/$/, '');
  const headers: Record<string, string> = options.apiKey
    ? { Authorization: `Bearer ${options.apiKey}` }
    : {};

  const health = await probeJson<{ database?: string }>({
    url: `${baseUrl}/api/health`,
    headers,
  });

  if (!health.isReachable) {
    return {
      status: {
        id: 'grafana',
        label: 'Grafana',
        mode: 'fallback',
        latencyMs: health.latencyMs,
        endpointConfigured: true,
        detail: `Fallback active (${health.detail})`,
      },
      dashboards: [],
    };
  }

  const search = await probeJson<
    Array<{ uid?: string; title?: string; folderTitle?: string; url?: string }>
  >({
    url: `${baseUrl}/api/search?type=dash-db&limit=6`,
    headers,
  });

  const embedBase = (options.publicUrl || baseUrl).replace(/\/$/, '');
  const dashboards: GrafanaDashboardEntry[] = (search.payload ?? [])
    .filter((entry): entry is { uid: string; title: string; folderTitle?: string; url?: string } =>
      Boolean(entry.uid && entry.title)
    )
    .map((entry) => ({
      uid: entry.uid,
      title: entry.title,
      folderTitle: entry.folderTitle ?? 'General',
      embedUrl: entry.url ? `${embedBase}${entry.url}?theme=light&kiosk` : null,
    }));

  return {
    status: {
      id: 'grafana',
      label: 'Grafana',
      mode: 'live',
      latencyMs: health.latencyMs,
      endpointConfigured: true,
      detail: `${dashboards.length} dashboard(s) available`,
    },
    dashboards,
  };
}

export async function fetchObservabilitySummary(): Promise<ObservabilitySummaryResponse> {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const prometheusUrl = process.env.PROMETHEUS_URL;
  const grafanaUrl = process.env.GRAFANA_URL;
  const grafanaPublicUrl = process.env.GRAFANA_PUBLIC_URL;
  const grafanaApiKey = process.env.GRAFANA_API_KEY;
  const woodpeckerUrl = process.env.WOODPECKER_URL;

  const cacheStats = await getCacheStats().catch(() => ({
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    redisErrors: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
  }));

  const [otelProbe, promProbe, grafanaResult, woodpeckerProbe] = await Promise.all([
    otelEndpoint
      ? probeJson<Record<string, unknown>>({ url: otelEndpoint.replace(/\/$/, '') })
      : Promise.resolve(null),
    prometheusUrl
      ? probeJson<{ status?: string }>({
          url: `${prometheusUrl.replace(/\/$/, '')}/-/ready`,
        })
      : Promise.resolve(null),
    grafanaUrl
      ? fetchGrafanaDashboards({
          grafanaUrl,
          apiKey: grafanaApiKey,
          publicUrl: grafanaPublicUrl,
        })
      : Promise.resolve(null),
    woodpeckerUrl
      ? probeJson<Record<string, unknown>>({
          url: `${woodpeckerUrl.replace(/\/$/, '')}/healthz`,
        })
      : Promise.resolve(null),
  ]);

  const services: ObservabilityServiceStatus[] = [
    {
      id: 'otel-collector',
      label: 'OTel Collector',
      mode: !otelEndpoint ? 'fallback' : otelProbe?.isReachable ? 'live' : 'fallback',
      latencyMs: otelProbe?.latencyMs ?? null,
      endpointConfigured: Boolean(otelEndpoint),
      detail: !otelEndpoint
        ? 'Using Next.js instrumentation fallback'
        : otelProbe?.isReachable
          ? 'OTLP receiver active'
          : `Fallback active (${otelProbe?.detail ?? 'unreachable'})`,
    },
    {
      id: 'prometheus',
      label: 'Prometheus',
      mode: !prometheusUrl ? 'fallback' : promProbe?.isReachable ? 'live' : 'fallback',
      latencyMs: promProbe?.latencyMs ?? null,
      endpointConfigured: Boolean(prometheusUrl),
      detail: !prometheusUrl
        ? 'Using native /api/metrics snapshot'
        : promProbe?.isReachable
          ? 'PromQL engine ready'
          : `Fallback active (${promProbe?.detail ?? 'unreachable'})`,
    },
    grafanaResult?.status ?? {
      id: 'grafana',
      label: 'Grafana',
      mode: 'fallback',
      latencyMs: null,
      endpointConfigured: false,
      detail: 'Rendering native light-mode GlassCard panels',
    },
    {
      id: 'woodpecker',
      label: 'Woodpecker CI',
      mode: !woodpeckerUrl ? 'fallback' : woodpeckerProbe?.isReachable ? 'live' : 'fallback',
      latencyMs: woodpeckerProbe?.latencyMs ?? null,
      endpointConfigured: Boolean(woodpeckerUrl),
      detail: !woodpeckerUrl
        ? 'Using GitHub Status / local 28-gate feed'
        : woodpeckerProbe?.isReachable
          ? 'Runner online'
          : `Fallback active (${woodpeckerProbe?.detail ?? 'unreachable'})`,
    },
  ];

  const liveMetrics =
    prometheusUrl && promProbe?.isReachable
      ? await Promise.all(
          PROMETHEUS_PRESETS.map((preset) => queryPrometheusPreset({ prometheusUrl, preset }))
        )
      : [];

  const fallbackValues: Record<(typeof PROMETHEUS_PRESETS)[number]['id'], number> = {
    cache_hits_l1: cacheStats.l1Hits,
    cache_hits_l2: cacheStats.l2Hits,
    cache_misses: cacheStats.misses,
    cache_latency_p95: cacheStats.p95LatencyMs,
  };

  const metrics: PrometheusMetricSample[] = PROMETHEUS_PRESETS.map((preset, index) => {
    const liveSample = liveMetrics[index];
    if (liveSample) {
      return liveSample;
    }
    return {
      id: preset.id,
      label: preset.label,
      query: preset.query,
      value: fallbackValues[preset.id],
      unit: preset.unit,
      source: 'fallback',
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    deploymentTarget: process.env.VERCEL ? 'vercel' : 'local',
    services,
    metrics,
    dashboards: grafanaResult?.dashboards ?? [],
    cacheSnapshot: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      l1Hits: cacheStats.l1Hits,
      l2Hits: cacheStats.l2Hits,
      avgLatencyMs: cacheStats.avgLatencyMs,
      p95LatencyMs: cacheStats.p95LatencyMs,
    },
  };
}

function mapCiStatus(rawStatus: string | undefined): CiPipelineEntry['status'] {
  const normalized = (rawStatus ?? '').toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failure' || normalized === 'error' || normalized === 'killed') {
    return 'failure';
  }
  if (normalized === 'running') return 'running';
  if (normalized === 'skipped') return 'skipped';
  return 'pending';
}

export async function fetchObservabilityCi(): Promise<ObservabilityCiResponse> {
  const woodpeckerUrl = process.env.WOODPECKER_URL;
  const woodpeckerToken = process.env.WOODPECKER_TOKEN;
  const repoSlug = process.env.GITHUB_REPOSITORY || DEFAULT_GITHUB_REPO;

  if (woodpeckerUrl && woodpeckerToken) {
    const baseUrl = woodpeckerUrl.replace(/\/$/, '');
    const probe = await probeJson<
      Array<{
        id: number;
        number: number;
        branch: string;
        commit: string;
        message: string;
        status: string;
        started?: number;
      }>
    >({
      url: `${baseUrl}/api/repos/${repoSlug}/pipelines?perPage=8`,
      headers: { Authorization: `Bearer ${woodpeckerToken}` },
    });

    if (probe.isReachable && Array.isArray(probe.payload)) {
      return {
        generatedAt: new Date().toISOString(),
        mode: 'live',
        pipelines: probe.payload.map((entry) => ({
          id: entry.id,
          number: entry.number,
          branch: entry.branch,
          commitSha: entry.commit.slice(0, 8),
          message: entry.message,
          status: mapCiStatus(entry.status),
          source: 'woodpecker',
          startedAt: entry.started ? new Date(entry.started * 1000).toISOString() : null,
          url: `${baseUrl}/repos/${repoSlug}/pipeline/${entry.number}`,
        })),
      };
    }
  }

  const githubHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) {
    githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const ghProbe = await probeJson<{
    sha?: string;
    statuses?: Array<{
      id: number;
      context: string;
      state: string;
      description?: string;
      updated_at?: string;
      target_url?: string;
    }>;
  }>({
    url: `https://api.github.com/repos/${repoSlug}/commits/main/status`,
    headers: githubHeaders,
  });

  const pipelines: CiPipelineEntry[] = (ghProbe.payload?.statuses ?? []).map((entry) => ({
    id: entry.id,
    number: null,
    branch: 'main',
    commitSha: (ghProbe.payload?.sha ?? 'main').slice(0, 8),
    message: `${entry.context}${entry.description ? ` — ${entry.description}` : ''}`,
    status: mapCiStatus(entry.state),
    source: 'github-status',
    startedAt: entry.updated_at ?? null,
    url: entry.target_url ?? null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    mode: 'fallback',
    pipelines,
  };
}
