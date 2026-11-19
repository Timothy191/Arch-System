'use client';

import type { CloudflareConnectionMode, CloudflareSummaryResponse } from '@repo/contract';
import { GlassCard } from '@repo/ui/GlassCard';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  Clock,
  Cloud,
  Database,
  Globe,
  KeyRound,
  Layers,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  ShieldX,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';

const MODE_BADGE_MAP: Record<CloudflareConnectionMode, { label: string; className: string }> = {
  live: {
    label: 'Live',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  fallback: {
    label: 'Metrics unavailable',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  unconfigured: {
    label: 'Not connected',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  },
  insufficient: {
    label: 'Insufficient permissions',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

/** Human-readable empty state for a section whose data is not available. */
function SectionEmptyState({ mode }: { mode: CloudflareConnectionMode }) {
  if (mode === 'unconfigured') {
    return (
      <p className="text-xs text-zinc-500">Not connected — set CLOUDFLARE_API_TOKEN to enable.</p>
    );
  }
  if (mode === 'insufficient') {
    return (
      <p className="text-rose-600 text-xs">
        Insufficient permissions — the API token lacks the required read scopes.
      </p>
    );
  }
  return (
    <p className="text-xs text-zinc-500">Metrics unavailable — Cloudflare API is unreachable.</p>
  );
}

function ModeBadge({ mode }: { mode: CloudflareConnectionMode }) {
  const badge = MODE_BADGE_MAP[mode];
  return (
    <span className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  mode,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  mode: CloudflareConnectionMode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className="font-semibold text-sm text-zinc-900">{title}</h3>
          <p className="text-[11px] text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <ModeBadge mode={mode} />
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function _SectionCard({
  mode,
  children,
}: {
  mode: CloudflareConnectionMode;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5">
      {children}
      {mode !== 'live' && <SectionEmptyState mode={mode} />}
    </GlassCard>
  );
}

export function CloudflareInfrastructureConsole() {
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['cloudflare', 'summary'],
    queryFn: () => fetchJson<CloudflareSummaryResponse>('/api/cloudflare/summary'),
  });

  const summary = summaryQuery.data;

  const handleRefresh = () => {
    void summaryQuery.refetch();
    setLastRefresh(new Date().toISOString());
  };

  const isLoading = summaryQuery.isLoading;
  const isError = summaryQuery.isError;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-zinc-900">
                Cloudflare Infrastructure &amp; Edge Security Centre
              </h1>
              <p className="text-xs text-zinc-600">
                Zero Trust, Tunnel, Workers, Queues, Turnstile, AI Gateway, R2 &amp; WAF — read-only
                ({summary?.deploymentTarget ?? 'vercel'}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[11px] text-zinc-500">
                Refreshed {new Date(lastRefresh).toLocaleTimeString('en-ZA')}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-medium text-xs text-zinc-700 hover:bg-zinc-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </GlassCard>

      {isLoading && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading Cloudflare platform status…
          </div>
        </GlassCard>
      )}

      {isError && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 text-rose-600 text-sm">
            <ShieldX className="h-4 w-4" />
            Unable to load Cloudflare platform status. The summary API returned an error.
          </div>
        </GlassCard>
      )}

      {summary && (
        <>
          {/* Section A — Account & edge overview */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Globe className="h-4 w-4 text-orange-600" />}
              title="Edge Overview"
              subtitle="Account connectivity & latency"
              mode={summary.account.mode}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-zinc-500">Endpoint configured</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.account.endpointConfigured ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">API latency</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.account.latencyMs !== null ? `${summary.account.latencyMs} ms` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Last synced</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.account.lastSyncedAt
                    ? new Date(summary.account.lastSyncedAt).toLocaleString('en-ZA')
                    : '—'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-600">{summary.account.detail}</p>
          </GlassCard>

          {/* Section B — Zero Trust */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Lock className="h-4 w-4 text-indigo-600" />}
              title="Zero Trust Access"
              subtitle="Access policies, applications & service tokens"
              mode={summary.zeroTrust.mode}
            />
            {summary.zeroTrust.mode === 'live' ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] text-zinc-500">Access policies</p>
                    <p className="font-mono text-sm text-zinc-900">
                      {summary.zeroTrust.policies.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">Applications</p>
                    <p className="font-mono text-sm text-zinc-900">
                      {summary.zeroTrust.applications.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">Service tokens</p>
                    <p className="font-mono text-sm text-zinc-900">
                      {summary.zeroTrust.serviceTokens.length}
                    </p>
                  </div>
                </div>
                {summary.zeroTrust.policies.length > 0 && (
                  <div className="flex flex-col divide-y divide-zinc-200">
                    {summary.zeroTrust.policies.map((policy) => (
                      <div
                        key={policy.id}
                        className="flex items-center justify-between py-2 text-xs"
                      >
                        <span className="font-medium text-zinc-900">{policy.name}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${
                            policy.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {policy.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <SectionEmptyState mode={summary.zeroTrust.mode} />
            )}
          </GlassCard>

          {/* Section C — Tunnel */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Server className="h-4 w-4 text-blue-600" />}
              title="Cloudflare Tunnel"
              subtitle="Tunnel inventory & origin health"
              mode={summary.tunnel.mode}
            />
            {summary.tunnel.mode === 'live' ? (
              summary.tunnel.tunnels.length > 0 ? (
                <div className="flex flex-col divide-y divide-zinc-200">
                  {summary.tunnel.tunnels.map((tunnel) => (
                    <div key={tunnel.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <p className="font-medium text-zinc-900">{tunnel.name}</p>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {tunnel.id} · {tunnel.routes.length} route(s)
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${
                          tunnel.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : tunnel.status === 'pending'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {tunnel.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No tunnels found for this account. See the runbook to create one.
                </p>
              )
            ) : (
              <SectionEmptyState mode={summary.tunnel.mode} />
            )}
          </GlassCard>

          {/* Section D — Workers */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Workflow className="h-4 w-4 text-violet-600" />}
              title="Workers"
              subtitle="Serverless functions at the edge"
              mode={summary.workers.mode}
            />
            {summary.workers.mode === 'live' ? (
              summary.workers.workers.length > 0 ? (
                <div className="flex flex-col divide-y divide-zinc-200">
                  {summary.workers.workers.map((worker) => (
                    <div key={worker.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <p className="font-medium text-zinc-900">{worker.name}</p>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {worker.version ?? 'no version'} · {worker.deploymentStatus ?? 'unknown'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${
                          worker.hasDeployments
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {worker.hasDeployments ? 'Deployed' : 'No deployments'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No Workers deployed. See the Workers runbook for the ingress webhook pattern.
                </p>
              )
            ) : (
              <SectionEmptyState mode={summary.workers.mode} />
            )}
          </GlassCard>

          {/* Section E — Queues */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Layers className="h-4 w-4 text-cyan-600" />}
              title="Queues"
              subtitle="Durable message queues & DLQ depth"
              mode={summary.queues.mode}
            />
            {summary.queues.mode === 'live' ? (
              summary.queues.queues.length > 0 ? (
                <div className="flex flex-col divide-y divide-zinc-200">
                  {summary.queues.queues.map((queue) => (
                    <div key={queue.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <p className="font-medium text-zinc-900">{queue.name}</p>
                        <p className="font-mono text-[11px] text-zinc-500">
                          DLQ attached: {queue.hasDlq ? 'yes' : 'no'}
                        </p>
                      </div>
                      <div className="text-right font-mono text-[11px] text-zinc-500">
                        {queue.pendingMessages !== null ? `${queue.pendingMessages} pending` : '—'}
                        {queue.dlqDepth !== null ? ` · ${queue.dlqDepth} DLQ` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No Queues provisioned. Queues never trigger plant control — see the runbook.
                </p>
              )
            ) : (
              <SectionEmptyState mode={summary.queues.mode} />
            )}
          </GlassCard>

          {/* Section F — Turnstile */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
              title="Turnstile"
              subtitle="CAPTCHA-free human verification"
              mode={summary.turnstile.mode}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-zinc-500">Site key configured</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.turnstile.siteKeyConfigured ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Secret key configured</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.turnstile.secretKeyConfigured ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Verification health</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.turnstile.verificationHealthy === null
                    ? '—'
                    : summary.turnstile.verificationHealthy
                      ? 'Healthy'
                      : 'Failing'}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Section G — AI Gateway */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Bot className="h-4 w-4 text-pink-600" />}
              title="AI Gateway"
              subtitle="Opt-in LLM routing, caching & cost control"
              mode={summary.aiGateway.mode}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-zinc-500">Feature enabled</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.aiGateway.featureEnabled ? 'Yes' : 'No (opt-in)'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Requests (24h)</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.aiGateway.requestCount24h !== null
                    ? summary.aiGateway.requestCount24h
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Avg latency</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.aiGateway.avgLatencyMs !== null
                    ? `${summary.aiGateway.avgLatencyMs} ms`
                    : '—'}
                </p>
              </div>
            </div>
            {!summary.aiGateway.featureEnabled && (
              <p className="mt-3 text-xs text-zinc-500">
                AI Gateway is opt-in. Set <code>CLOUDFLARE_AI_GATEWAY_ENABLED=true</code> to route
                LLM traffic — no rerouting happens by default.
              </p>
            )}
          </GlassCard>

          {/* Section H — R2 */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Database className="h-4 w-4 text-teal-600" />}
              title="R2 Object Storage"
              subtitle="Private buckets with signed URLs"
              mode={summary.r2.mode}
            />
            {summary.r2.mode === 'live' ? (
              summary.r2.buckets.length > 0 ? (
                <div className="flex flex-col divide-y divide-zinc-200">
                  {summary.r2.buckets.map((bucket) => (
                    <div key={bucket.id} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-zinc-900">{bucket.name}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${
                          bucket.isPublic
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {bucket.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No R2 buckets provisioned. Buckets stay private; access is via signed URLs only.
                </p>
              )
            ) : (
              <SectionEmptyState mode={summary.r2.mode} />
            )}
          </GlassCard>

          {/* Section I — Security Centre */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<ShieldCheck className="h-4 w-4 text-rose-600" />}
              title="Security Centre"
              subtitle="WAF, rate limits & configuration warnings"
              mode={summary.securityCentre.mode}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-zinc-500">WAF rules</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.securityCentre.wafRules !== null ? summary.securityCentre.wafRules : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Rate-limit rules</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.securityCentre.rateLimitRules !== null
                    ? summary.securityCentre.rateLimitRules
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Access policies</p>
                <p className="font-mono text-sm text-zinc-900">
                  {summary.securityCentre.accessPolicies !== null
                    ? summary.securityCentre.accessPolicies
                    : '—'}
                </p>
              </div>
            </div>
            {summary.securityCentre.warnings.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {summary.securityCentre.warnings.map((warning, index) => (
                  <p key={index} className="flex items-start gap-1.5 text-amber-700 text-xs">
                    <Activity className="mt-0.5 h-3 w-3 shrink-0" />
                    {warning}
                  </p>
                ))}
              </div>
            )}
            {summary.securityCentre.mode !== 'live' && (
              <SectionEmptyState mode={summary.securityCentre.mode} />
            )}
          </GlassCard>

          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Generated {new Date(summary.generatedAt).toLocaleString('en-ZA')}
            </span>
            <span className="flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" />
              Credentials are never displayed; only presence booleans are reported.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
