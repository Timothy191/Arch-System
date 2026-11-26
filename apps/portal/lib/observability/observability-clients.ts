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
  {
    id: 'cache_hit_ratio',
    label: 'Cache Hit Ratio',
    query:
      '(sum(portal_cache_hits_total) / clamp_min(sum(portal_cache_hits_total) + portal_cache_misses_total, 1)) * 100',
    unit: '%',
  },
  {
    id: 'cache_latency_avg',
    label: 'Cache Avg Latency',
    query: 'portal_cache_latency_ms{metric="avg"}',
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
  acceptStatuses?: readonly number[];
}): Promise<ProbeResult<T>> {
  const startedAt = Date.now();
  try {
    const response = await fetch(options.url, {
      headers: options.headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok && !options.acceptStatuses?.includes(response.status)) {
      return {
        isReachable: false,
        latencyMs,
        payload: null,
        detail: `HTTP ${response.status}`,
      };
    }
    const payload = response.ok ? ((await response.json().catch(() => null)) as T | null) : null;
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
  if (rawValue === undefined) {
    return null;
  }
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return {
    id: options.preset.id,
    label: options.preset.label,
    query: options.preset.query,
    value: numericValue,
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

  if (!search.isReachable) {
    const isAuthError = search.detail === 'HTTP 401' || search.detail === 'HTTP 403';
    return {
      status: {
        id: 'grafana',
        label: 'Grafana',
        mode: 'fallback',
        latencyMs: health.latencyMs,
        endpointConfigured: true,
        detail: isAuthError
          ? 'Grafana reachable — configure GRAFANA_API_KEY with Viewer/Admin role for dashboards'
          : `Grafana reachable — dashboard search failed (${search.detail})`,
      },
      dashboards: [],
    };
  }

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
      ? probeJson<Record<string, unknown>>({
          url: (process.env.OTEL_HEALTHCHECK_URL || otelEndpoint).replace(/\/$/, ''),
          acceptStatuses: [404, 405],
        })
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
      mode: !otelEndpoint ? 'unconfigured' : otelProbe?.isReachable ? 'live' : 'fallback',
      latencyMs: otelProbe?.latencyMs ?? null,
      endpointConfigured: Boolean(otelEndpoint),
      detail: !otelEndpoint
        ? 'OTEL_EXPORTER_OTLP_ENDPOINT not configured — using Next.js instrumentation fallback'
        : otelProbe?.isReachable
          ? 'OTLP receiver active'
          : `Fallback active (${otelProbe?.detail ?? 'unreachable'})`,
    },
    {
      id: 'prometheus',
      label: 'Prometheus',
      mode: !prometheusUrl ? 'unconfigured' : promProbe?.isReachable ? 'live' : 'fallback',
      latencyMs: promProbe?.latencyMs ?? null,
      endpointConfigured: Boolean(prometheusUrl),
      detail: !prometheusUrl
        ? 'PROMETHEUS_URL not configured — using native /api/metrics snapshot'
        : promProbe?.isReachable
          ? 'PromQL engine ready'
          : `Fallback active (${promProbe?.detail ?? 'unreachable'})`,
    },
    grafanaResult?.status ?? {
      id: 'grafana',
      label: 'Grafana',
      mode: 'unconfigured',
      latencyMs: null,
      endpointConfigured: false,
      detail: 'GRAFANA_URL not configured — rendering native light-mode GlassCard panels',
    },
    {
      id: 'woodpecker',
      label: 'Woodpecker CI',
      mode: !woodpeckerUrl ? 'unconfigured' : woodpeckerProbe?.isReachable ? 'live' : 'fallback',
      latencyMs: woodpeckerProbe?.latencyMs ?? null,
      endpointConfigured: Boolean(woodpeckerUrl),
      detail: !woodpeckerUrl
        ? 'WOODPECKER_URL not configured — using GitHub Status / local 28-gate feed'
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

  const totalCacheRequests = cacheStats.hits + cacheStats.misses;
  const hitRatioPct =
    totalCacheRequests > 0 ? Math.round((cacheStats.hits / totalCacheRequests) * 1000) / 10 : null;

  const fallbackValues: Record<(typeof PROMETHEUS_PRESETS)[number]['id'], number | null> = {
    cache_hits_l1: cacheStats.l1Hits,
    cache_hits_l2: cacheStats.l2Hits,
    cache_misses: cacheStats.misses,
    cache_latency_p95: cacheStats.p95LatencyMs,
    cache_hit_ratio: hitRatioPct,
    cache_latency_avg: cacheStats.avgLatencyMs,
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

  if (pipelines.length === 0) {
    const actionsProbe = await probeJson<{
      workflow_runs?: Array<{
        id: number;
        run_number: number;
        head_branch: string;
        head_sha: string;
        display_title?: string;
        name?: string;
        status?: string;
        conclusion?: string | null;
        created_at?: string;
        html_url?: string;
      }>;
    }>({
      url: `https://api.github.com/repos/${repoSlug}/actions/runs?per_page=6`,
      headers: githubHeaders,
    });

    for (const run of actionsProbe.payload?.workflow_runs ?? []) {
      const derivedStatus = run.conclusion ?? run.status;
      pipelines.push({
        id: run.id,
        number: run.run_number,
        branch: run.head_branch || 'main',
        commitSha: (run.head_sha || 'main').slice(0, 8),
        message: run.display_title || run.name || 'GitHub Actions Workflow',
        status: mapCiStatus(derivedStatus),
        source: 'github-status',
        startedAt: run.created_at ?? null,
        url: run.html_url ?? null,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'fallback',
    pipelines,
  };
}
