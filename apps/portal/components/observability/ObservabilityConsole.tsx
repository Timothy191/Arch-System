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

  const handleRefresh = () => {
    void summaryQuery.refetch();
    void ciQuery.refetch();
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-zinc-900">
                Native Observability &amp; CI Layer
              </h1>
              <p className="text-xs text-zinc-600">
                OTel Collector, Prometheus, Grafana &amp; Woodpecker CI unified in Arch-System light
                mode ({summary?.deploymentTarget ?? 'vercel'}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-medium text-xs text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Telemetry
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(summary?.services ?? []).map((service) => (
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
                  {summary.dashboards.map((dash) => (
                    <button
                      key={dash.uid}
                      type="button"
                      onClick={() => setSelectedEmbedUrl(dash.embedUrl)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-medium text-xs text-zinc-800 hover:bg-zinc-50"
                    >
                      <span>{dash.title}</span>
                      <ExternalLink className="h-3 w-3 text-zinc-400" />
                    </button>
                  ))}
                </div>
                {selectedEmbedUrl && (
                  <iframe
                    title="Grafana Light-Mode Dashboard"
                    src={selectedEmbedUrl}
                    className="h-[560px] w-full rounded-xl border border-zinc-200 bg-white"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-xs text-zinc-600">
                <p className="font-medium text-sm text-zinc-900">
                  Native Light-Mode Telemetry Active
                </p>
                <p>
                  Configure <code>GRAFANA_URL</code> and <code>GRAFANA_API_KEY</code> in Vercel to
                  stream Grafana dashboards in light-mode kiosk view alongside the native Golden
                  Signal cards above.
                </p>
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
