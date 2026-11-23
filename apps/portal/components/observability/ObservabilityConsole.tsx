'use client';

import type {
  CiPipelineEntry,
  ObservabilityCiResponse,
  ObservabilityServiceStatus,
  ObservabilitySummaryResponse,
  ServiceConnectionMode,
} from '@repo/contract';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { GlassCard } from '@repo/ui/GlassCard';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitBranch,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';

const MODE_BADGE_MAP: Record<ServiceConnectionMode, { label: string; className: string }> = {
  live: {
    label: 'Live Cluster',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  fallback: {
    label: 'Native Fallback',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  unconfigured: {
    label: 'Unconfigured',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  },
};

const CI_STATUS_CLASS_MAP: Record<CiPipelineEntry['status'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failure: 'border-rose-200 bg-rose-50 text-rose-700',
  running: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  skipped: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function ServiceStatusCard({ service }: { service: ObservabilityServiceStatus }) {
  const badge = MODE_BADGE_MAP[service.mode];
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-indigo-600" />
          <h3 className="font-semibold text-sm text-zinc-900">{service.label}</h3>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-600">{service.detail}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{service.endpointConfigured ? 'Endpoint set' : 'Local / Fallback'}</span>
        <span>{service.latencyMs !== null ? `${service.latencyMs} ms` : 'In-process'}</span>
      </div>
    </GlassCard>
  );
}

export function ObservabilityConsole() {
  const [selectedEmbedUrl, setSelectedEmbedUrl] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['observability', 'summary'],
    queryFn: () => fetchJson<ObservabilitySummaryResponse>('/api/observability/summary'),
  });

  const ciQuery = useQuery({
    queryKey: ['observability', 'ci'],
    queryFn: () => fetchJson<ObservabilityCiResponse>('/api/observability/ci'),
  });

  const summary = summaryQuery.data;
  const ciData = ciQuery.data;
  const isRefreshing = summaryQuery.isFetching || ciQuery.isFetching;
  const activeEmbedUrl = selectedEmbedUrl ?? summary?.dashboards[0]?.embedUrl ?? null;

  const totalCacheRequests =
    (summary?.cacheSnapshot.hits ?? 0) + (summary?.cacheSnapshot.misses ?? 0);
  const cacheHitRatePct =
    totalCacheRequests > 0
      ? Math.round(((summary?.cacheSnapshot.hits ?? 0) / totalCacheRequests) * 1000) / 10
      : 100;
  const l1SharePct =
    (summary?.cacheSnapshot.hits ?? 0) > 0
      ? Math.round(
          ((summary?.cacheSnapshot.l1Hits ?? 0) / (summary?.cacheSnapshot.hits ?? 1)) * 100
        )
      : 0;

  const handleRefresh = () => {
    void summaryQuery.refetch();
    void ciQuery.refetch();
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-gold/30 bg-accent-gold/10 text-accent-gold">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--text-heading)] text-lg">
                Native Observability &amp; CI Layer
              </h1>
              <p className="text-[var(--text-secondary)] text-xs">
                OTel Collector, Prometheus, Grafana &amp; Woodpecker CI unified in Arch-System light
                mode ({summary?.deploymentTarget ?? 'vercel'}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {summary?.generatedAt && (
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                Synced {new Date(summary.generatedAt).toLocaleTimeString('en-ZA')}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </button>
          </div>
        </div>
      </GlassCard>

      {summaryQuery.isError && (
        <GlassCard className="border-rose-200 bg-rose-50/70 p-4">
          <div className="flex items-center justify-between gap-3 text-rose-700 text-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                Unable to load observability summary. Check session permissions or retry telemetry
                sync.
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-md border border-rose-300 bg-white px-2.5 py-1 font-medium text-rose-700 hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryQuery.isLoading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <GlassCard key={`obs-skeleton-${idx}`} className="animate-pulse p-4">
                <div className="h-4 w-28 rounded bg-zinc-200/80" />
                <div className="mt-3 h-3 w-full rounded bg-zinc-100" />
                <div className="mt-4 h-3 w-20 rounded bg-zinc-100" />
              </GlassCard>
            ))
          : (summary?.services ?? []).map((service) => (
              <ServiceStatusCard key={service.id} service={service} />
            ))}
      </div>

      <Tabs defaultValue="golden-signals" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 bg-white/80">
          <TabsTrigger value="golden-signals" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            Golden Signals &amp; PromQL
          </TabsTrigger>
          <TabsTrigger value="grafana" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            Grafana Native Layer
          </TabsTrigger>
          <TabsTrigger value="ci" className="gap-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5" />
            Woodpecker &amp; CI Gates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="golden-signals" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(summary?.metrics ?? []).map((metric) => {
              const badge = MODE_BADGE_MAP[metric.source];
              return (
                <GlassCard key={metric.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-xs text-zinc-600">{metric.label}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-2 font-mono font-semibold text-2xl text-zinc-900">
                    {metric.value !== null ? metric.value : '—'}{' '}
                    <span className="font-normal text-xs text-zinc-500">{metric.unit}</span>
                  </div>
                  <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">
                    {metric.query}
                  </p>
                </GlassCard>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="grafana" className="mt-4">
          <GlassCard className="p-5">
            {summary?.dashboards.length ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {summary.dashboards.map((dash) => {
                    const isSelected = activeEmbedUrl === dash.embedUrl;
                    return (
                      <button
                        key={dash.uid}
                        type="button"
                        onClick={() => setSelectedEmbedUrl(dash.embedUrl)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-xs transition-colors ${
                          isSelected
                            ? 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                            : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                        }`}
                      >
                        <span>{dash.title}</span>
                        <ExternalLink className="h-3 w-3 text-zinc-400" />
                      </button>
                    );
                  })}
                </div>
                {activeEmbedUrl && (
                  <iframe
                    title="Grafana Light-Mode Dashboard"
                    src={activeEmbedUrl}
                    className="h-[560px] w-full rounded-xl border border-zinc-200 bg-white"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 text-xs text-zinc-700">
                  <p className="font-semibold text-sm text-zinc-900">
                    Native Light-Mode Telemetry Active
                  </p>
                  <p>
                    Configure <code>GRAFANA_URL</code> and <code>GRAFANA_API_KEY</code> (plus
                    optional <code>GRAFANA_PUBLIC_URL</code>) in Vercel to stream external Grafana
                    dashboards in light-mode kiosk view alongside the native telemetry panels below.
                  </p>
                </div>

                {summary && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
                      <p className="font-medium text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                        Cache Hit Efficiency
                      </p>
                      <p className="mt-1 font-mono font-semibold text-2xl text-[var(--text-heading)]">
                        {cacheHitRatePct}%
                      </p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(100, cacheHitRatePct)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                        {summary.cacheSnapshot.hits} hits · {summary.cacheSnapshot.misses} misses
                      </p>
                    </div>

                    <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
                      <p className="font-medium text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                        L1 / L2 Cache Tier Split
                      </p>
                      <p className="mt-1 font-mono font-semibold text-2xl text-[var(--text-heading)]">
                        {l1SharePct}% L1
                      </p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${l1SharePct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                        L1: {summary.cacheSnapshot.l1Hits} · L2 Redis:{' '}
                        {summary.cacheSnapshot.l2Hits}
                      </p>
                    </div>

                    <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
                      <p className="font-medium text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                        Cache Latency Profile
                      </p>
                      <p className="mt-1 font-mono font-semibold text-2xl text-[var(--text-heading)]">
                        {summary.cacheSnapshot.p95LatencyMs.toFixed(1)} ms
                      </p>
                      <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                        Avg: {summary.cacheSnapshot.avgLatencyMs.toFixed(1)} ms · p95:{' '}
                        {summary.cacheSnapshot.p95LatencyMs.toFixed(1)} ms
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="ci" className="mt-4">
          <GlassCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-zinc-900">
                Recent Pipeline &amp; Gatekeeper Runs
              </h2>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] text-zinc-600">
                {ciData?.mode === 'live' ? 'Woodpecker CI Live' : 'GitHub Commit Status Feed'}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-zinc-200">
              {(ciData?.pipelines ?? []).map((pipeline) => (
                <div
                  key={pipeline.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {pipeline.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : pipeline.status === 'failure' ? (
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                    <div>
                      <p className="font-medium text-zinc-900">{pipeline.message}</p>
                      <p className="font-mono text-[11px] text-zinc-500">
                        {pipeline.branch} · {pipeline.commitSha} · {pipeline.source}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${CI_STATUS_CLASS_MAP[pipeline.status]}`}
                  >
                    {pipeline.status}
                  </span>
                </div>
              ))}
              {!ciData?.pipelines.length && (
                <p className="py-4 text-xs text-zinc-500">
                  No pipeline runs reported yet. Run <code>pnpm ci:gatekeeper --from-evidence</code>{' '}
                  or start Woodpecker CI.
                </p>
              )}
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
