'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import { fetchClient } from '@repo/utils/client';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bot,
  Bug,
  CheckCircle2,
  Coins,
  Cpu,
  Database,
  GitCommit,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { BuildTelemetrySummary } from '@/lib/ai-metrics-types';

const AUTO_POLL_INTERVAL_MS = 30_000;
const SKELETON_CARD_COUNT = 4;
const TOKENS_PER_MILLION = 1_000_000;
const TOKENS_PER_THOUSAND = 1_000;
const FULL_PERCENT = 100;
const TENTHS_ROUNDING = 10;
const CENTS_PER_DOLLAR = 100;
const DEFAULT_USD_TO_ZAR = 18.52;
const MIN_BAR_WIDTH_PCT = 4;
const RECENT_FEED_DISPLAY_LIMIT = 10;

interface RuntimeSubsystem {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs: number | null;
  readonly detail: string;
}

interface RuntimeSystemHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly healthScore?: number;
  readonly uptimePct?: number;
  readonly subsystems: readonly RuntimeSubsystem[];
}

interface AIMetrics {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  cacheHitRatio: number;
  tokensSaved: number;
  totalCostUSD: number;
  totalCostZAR: number;
  totalRequests: number;
  avgLatency: number;
  byModel: Array<{
    name: string;
    tokens: number;
    cost: number;
    requests: number;
    cachedTokens: number;
    percentage: number;
  }>;
  recentUsage: Array<{
    id: string;
    timestamp: string;
    model: string;
    tokens: number;
    costCents: number;
    latency: number;
    status: string;
  }>;
  pagination?: {
    limit: number;
    offset: number;
    returnedRows: number;
    totalCount: number | null;
    hasMore: boolean;
  };
  systemHealth?: RuntimeSystemHealth;
  dbError?: string | null;
  buildTelemetry?: BuildTelemetrySummary;
}

type MetricsScope = 'session' | '24h' | '7d' | '30d' | 'all-time';

const SCOPE_LABELS: Record<MetricsScope, string> = {
  session: 'Today (Session)',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  'all-time': 'All-Time',
};

function formatRand(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AIMetricsDashboard() {
  const [scope, setScope] = useState<MetricsScope>('all-time');
  const [refreshing, setRefreshing] = useState(false);
  const [autoPoll, setAutoPoll] = useState(false);

  const {
    data: metricsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ai-metrics', scope],
    queryFn: async () => {
      const json = await fetchClient.get<{ success: boolean; error?: string; metrics: AIMetrics }>(
        `/api/ai/metrics?scope=${scope}`
      );
      if (!json.success) throw new Error(json.error || 'Failed to fetch AI metrics');
      return json.metrics;
    },
    refetchInterval: autoPoll ? AUTO_POLL_INTERVAL_MS : false,
  });

  const handleRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: SKELETON_CARD_COUNT }).map((_, idx) => (
            <div
              key={`ai-metrics-skeleton-${idx}`}
              className="h-32 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !metricsData) {
    return (
      <GlassCard accent="red">
        <p className="font-medium text-accent-red">Failed to load AI metrics</p>
        <p className="mt-1 text-[var(--text-secondary)] text-sm">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-3 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-sm text-white"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  const metrics = metricsData;
  const bt = metrics.buildTelemetry;
  const exchangeRateZAR = bt?.exchangeRateZAR ?? DEFAULT_USD_TO_ZAR;
  const resolvedHealth: RuntimeSystemHealth | undefined = metrics.systemHealth ?? bt?.systemHealth;
  const healthStatus = resolvedHealth?.status ?? 'healthy';

  const displayCostZAR =
    metrics.totalCostZAR > 0 ? metrics.totalCostZAR : (bt?.claudeCodeCost.totalCostZAR ?? 0);
  const displayCostUSD =
    metrics.totalCostUSD > 0 ? metrics.totalCostUSD : (bt?.claudeCodeCost.totalCostUSD ?? 0);
  const displayTotalTokens = metrics.totalTokens > 0 ? metrics.totalTokens : (bt?.totalTokens ?? 0);
  const displayInputTokens =
    metrics.totalPromptTokens > 0 ? metrics.totalPromptTokens : (bt?.totalInputTokens ?? 0);
  const displayOutputTokens =
    metrics.totalCompletionTokens > 0
      ? metrics.totalCompletionTokens
      : (bt?.totalOutputTokens ?? 0);

  const hasPromptSamples = metrics.totalPromptTokens > 0 || Boolean(bt);
  const displayCacheHitPct = hasPromptSamples
    ? metrics.totalPromptTokens > 0
      ? metrics.cacheHitRatio
      : (bt?.avgUsage.cacheHitRatePct ?? 0)
    : null;
  const displayCacheMissPct =
    displayCacheHitPct !== null
      ? Math.round((FULL_PERCENT - displayCacheHitPct) * TENTHS_ROUNDING) / TENTHS_ROUNDING
      : null;

  const displayAvgLatency =
    metrics.totalRequests > 0 ? metrics.avgLatency : (bt?.avgUsage.avgLatencyMs ?? null);

  const isZeroScopeState = metrics.totalRequests === 0 && !bt;

  return (
    <div className="space-y-6">
      {/* Executive Header Panel */}
      <GlassCard variant="window" className="p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3.5">
            <div className="gold-steel-border gold-steel-border-slim flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <PageHeader title="Executive AI Build & Runtime Intelligence" />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold text-xs ${
                    healthStatus === 'healthy'
                      ? 'border-accent-green/30 bg-accent-green/15 text-accent-green'
                      : healthStatus === 'degraded'
                        ? 'border-accent-amber/30 bg-accent-amber/15 text-accent-amber'
                        : 'border-accent-red/30 bg-accent-red/15 text-accent-red'
                  }`}
                >
                  {healthStatus === 'healthy' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  AI System {healthStatus.toUpperCase()}
                  {typeof resolvedHealth?.healthScore === 'number'
                    ? ` (${resolvedHealth.healthScore}%)`
                    : ''}
                </span>
              </div>
              <p className="mt-1 text-[var(--text-secondary)] text-sm">
                Live AI token usage ledger from Supabase (R {exchangeRateZAR}/USD), prompt cache
                efficiency &amp; runtime request telemetry
              </p>
              {bt && (
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--text-secondary)]">
                  <span className="rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5">
                    {bt.totalSessions} Sessions
                  </span>
                  <span className="rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5">
                    {bt.totalTurns.toLocaleString('en-US')} Turns
                  </span>
                  <span className="rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5">
                    {bt.engineeringVelocity.sqlMigrations} Migrations
                  </span>
                  <span className="rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5">
                    {bt.engineeringVelocity.retrospectivesCount} Retrospectives
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
              {(['session', '24h', '7d', '30d', 'all-time'] as const).map((scopeItem) => (
                <button
                  type="button"
                  key={scopeItem}
                  onClick={() => setScope(scopeItem)}
                  className={`rounded-md px-3 py-1.5 font-medium text-xs transition-all ${
                    scope === scopeItem
                      ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {scopeItem === 'all-time' ? 'All-Time' : scopeItem.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAutoPoll((prev) => !prev)}
              className={`rounded-lg border px-2.5 py-1.5 font-medium text-xs transition-colors ${
                autoPoll
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-[var(--border-subtle)] bg-white/70 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {autoPoll ? 'Auto-Poll 30s' : 'Manual Poll'}
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg border border-[var(--border-subtle)] bg-white/70 p-2 transition-colors hover:bg-[var(--bg-tertiary)]"
              title="Refresh metrics"
            >
              <RefreshCw
                className={`h-4 w-4 text-[var(--text-secondary)] ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </GlassCard>

      {metrics.dbError && (
        <GlassCard accent="alert">
          <div className="flex items-center gap-2.5 text-accent-amber text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Supabase telemetry query degraded:{' '}
              <code className="font-mono">{metrics.dbError}</code>
            </span>
          </div>
        </GlassCard>
      )}

      {isZeroScopeState && (
        <GlassCard className="p-5" data-testid="ai-metrics-empty-scope">
          <p className="font-semibold text-[var(--text-heading)] text-sm">
            No AI token usage recorded in {SCOPE_LABELS[scope]}
          </p>
          <p className="mt-1 text-[var(--text-secondary)] text-xs">
            0 rows matched in <code className="font-mono">public.ai_token_usage</code> for the
            selected window. Metrics below show real zeroed counters rather than synthetic
            estimates.
          </p>
        </GlassCard>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard hover accent="green">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              AI Token Cost (ZAR)
            </span>
            <div className="rounded-lg bg-accent-green/10 p-2 text-accent-green">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {formatRand(displayCostZAR)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              USD ${displayCostUSD.toFixed(2)}
              {bt ? (
                <>
                  {' '}
                  • Saved{' '}
                  <span className="font-semibold text-accent-green">
                    {formatRand(bt.claudeCodeCost.cacheSavingsZAR)}
                  </span>{' '}
                  via caching
                </>
              ) : (
                ` • ${Math.round(metrics.tokensSaved).toLocaleString('en-US')} tokens saved`
              )}
            </p>
          </div>
        </GlassCard>

        <GlassCard hover accent="blue">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Total Tokens ({scope === 'all-time' ? 'All-Time' : scope.toUpperCase()})
            </span>
            <div className="rounded-lg bg-[var(--accent-blue)]/10 p-2 text-[var(--accent-blue)]">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {displayTotalTokens >= TOKENS_PER_MILLION
                ? `${(displayTotalTokens / TOKENS_PER_MILLION).toFixed(2)}M`
                : displayTotalTokens.toLocaleString('en-US')}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {displayInputTokens.toLocaleString('en-US')} in •{' '}
              {displayOutputTokens.toLocaleString('en-US')} out •{' '}
              {bt
                ? `${bt.totalTurns.toLocaleString('en-US')} turns`
                : `${metrics.totalRequests.toLocaleString('en-US')} requests`}
            </p>
          </div>
        </GlassCard>

        <GlassCard hover accent="none">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              {bt ? 'Bugs Resolved & Velocity' : 'Recorded Requests'}
            </span>
            <div className="rounded-lg bg-accent-green/10 p-2 text-accent-green">
              <Bug className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {bt
                ? `${bt.engineeringVelocity.bugsResolved} Bugs Fixed`
                : `${metrics.totalRequests.toLocaleString('en-US')} Requests`}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {bt
                ? `${bt.engineeringVelocity.totalCommits} commits • ${formatRand(bt.claudeCodeCost.costPerBugResolvedZAR)}/bug`
                : metrics.pagination?.totalCount !== null &&
                    metrics.pagination?.totalCount !== undefined
                  ? `Showing ${metrics.pagination.returnedRows} of ${metrics.pagination.totalCount} row(s)`
                  : `${metrics.byModel.length} active model(s)`}
            </p>
          </div>
        </GlassCard>

        <GlassCard hover accent="none">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Cache Hit &amp; Turn Latency
            </span>
            <div className="rounded-lg bg-accent-amber/10 p-2 text-accent-amber">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--accent-blue)]">
              {displayCacheHitPct !== null && displayCacheMissPct !== null ? (
                <>
                  {displayCacheHitPct}% Hit{' '}
                  <span className="font-normal text-[var(--text-secondary)] text-sm">
                    / {displayCacheMissPct}% Miss
                  </span>
                </>
              ) : (
                'No samples yet'
              )}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {displayAvgLatency !== null ? `Avg ${displayAvgLatency}ms` : 'Avg N/A'}
              {bt
                ? ` • p95 ${bt.avgUsage.p95LatencyMs}ms • ${bt.avgUsage.tokensPerSecond} tok/s`
                : ''}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Average Usage Breakdown & Rate Card when buildTelemetry is provided */}
      {bt && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-[var(--accent-blue)]" />
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Average Per-Turn Usage &amp; Cache Telemetry
                </h3>
              </div>
              <span className="font-mono text-[var(--text-secondary)] text-xs">
                {bt.totalSessions} sessions • {bt.totalTurns.toLocaleString('en-US')} turns
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Avg Input / Turn</div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                  {bt.avgUsage.avgInputTokensPerTurn.toLocaleString('en-US')} tok
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Avg Output / Turn</div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                  {bt.avgUsage.avgOutputTokensPerTurn.toLocaleString('en-US')} tok
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Avg Total / Turn</div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                  {bt.avgUsage.avgTotalTokensPerTurn.toLocaleString('en-US')} tok
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Prompt Cache Hit</div>
                <div className="mt-1 font-bold font-mono text-accent-green text-base">
                  {bt.avgUsage.cacheHitRatePct}% (
                  {(bt.cacheReadTokens / TOKENS_PER_MILLION).toFixed(1)}M)
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Cache Miss / Write</div>
                <div className="mt-1 font-bold font-mono text-accent-amber text-base">
                  {bt.avgUsage.cacheMissRatePct}% (
                  {((bt.uncachedInputTokens + bt.cacheWriteTokens) / TOKENS_PER_MILLION).toFixed(1)}
                  M)
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">L1/L2 Redis Latency</div>
                <div className="mt-1 font-bold font-mono text-[var(--accent-blue)] text-base">
                  {bt.redisCacheStats.avgLatencyMs}ms (p95 {bt.redisCacheStats.p95LatencyMs}ms)
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-accent-green" />
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Claude Code Cost Valuation (South African Rand — ZAR)
                </h3>
              </div>
              <span className="font-mono text-[var(--text-secondary)] text-xs">
                1 USD = R {bt.exchangeRateZAR}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Uncached In (${bt.claudeCodeRatesUSDPerMTok.inputUncached}/M)
                </div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {formatRand(bt.claudeCodeCost.breakdownZAR.uncachedInputZAR)}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Cache Write (${bt.claudeCodeRatesUSDPerMTok.cacheWrite}/M)
                </div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {formatRand(bt.claudeCodeCost.breakdownZAR.cacheWriteZAR)}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Cache Read (${bt.claudeCodeRatesUSDPerMTok.cacheRead}/M)
                </div>
                <div className="mt-1 font-bold font-mono text-accent-green text-sm">
                  {formatRand(bt.claudeCodeCost.breakdownZAR.cacheReadZAR)}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Output (${bt.claudeCodeRatesUSDPerMTok.output}/M)
                </div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {formatRand(bt.claudeCodeCost.breakdownZAR.outputZAR)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-t pt-3 font-mono text-xs">
              <span className="text-[var(--text-secondary)]">
                Uncached Baseline: {formatRand(bt.claudeCodeCost.uncachedBaselineZAR)} ($
                {bt.claudeCodeCost.uncachedBaselineUSD.toFixed(2)})
              </span>
              <span className="font-semibold text-accent-green">
                Net Cost per Commit: {formatRand(bt.claudeCodeCost.costPerCommitZAR)} • Per Bug:{' '}
                {formatRand(bt.claudeCodeCost.costPerBugResolvedZAR)}
              </span>
            </div>
          </GlassCard>
        </div>
      )}

      {/* AI & Data Infrastructure Health Status */}
      {resolvedHealth && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent-green" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                AI System &amp; Persistence Health Status
              </h3>
            </div>
            {typeof resolvedHealth.uptimePct === 'number' &&
              typeof resolvedHealth.healthScore === 'number' && (
                <span className="font-mono font-semibold text-accent-green text-xs">
                  Uptime {resolvedHealth.uptimePct}% • Health Score {resolvedHealth.healthScore}%
                </span>
              )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {resolvedHealth.subsystems.map((sub) => (
              <div
                key={sub.name}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--text-heading)] text-xs">
                    {sub.name}
                  </span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      sub.status === 'healthy'
                        ? 'bg-accent-green'
                        : sub.status === 'degraded'
                          ? 'bg-accent-amber'
                          : 'bg-accent-red'
                    }`}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{sub.detail}</p>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[var(--text-secondary)]">
                  <span>Status: {sub.status.toUpperCase()}</span>
                  <span>
                    Latency: {sub.latencyMs !== null ? `${sub.latencyMs}ms` : 'Not reported'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Coding Agent Fleet Breakdown & Build Phase Ledger */}
      {bt && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[var(--accent-blue)]/10 p-1.5 text-[var(--accent-blue)]">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                    Coding Agent Fleet Token &amp; ZAR Breakdown
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Multi-provider token share, prompt caching &amp; defect resolution attribution
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="rounded-full bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-[var(--text-heading)]">
                  {bt.agentFleetBreakdown.length} Agents
                </span>
                <span className="rounded-full bg-accent-green/15 px-2.5 py-0.5 font-semibold text-accent-green">
                  {formatRand(bt.claudeCodeCost.totalCostZAR)}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {bt.agentFleetBreakdown.map((agent) => {
                const cacheRatio =
                  agent.tokens > 0
                    ? Math.round((agent.cachedTokens / agent.tokens) * FULL_PERCENT)
                    : 0;
                return (
                  <div
                    key={agent.agent}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-3.5 transition-colors hover:bg-[var(--bg-tertiary)]/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[var(--text-heading)] text-xs">
                          {agent.agent}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{agent.role}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-accent-green text-xs">
                          {formatRand(agent.costZAR)}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">
                          {agent.sharePct}% share • {agent.bugsResolved} bugs fixed
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80">
                      <div
                        className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-500"
                        style={{
                          width: `${Math.min(FULL_PERCENT, Math.max(MIN_BAR_WIDTH_PCT, agent.sharePct))}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2 border-[var(--border-subtle)] border-t pt-2 font-mono text-[10px] text-[var(--text-secondary)]">
                      <span>{(agent.tokens / TOKENS_PER_MILLION).toFixed(2)}M total</span>
                      <span className="text-center text-accent-green">
                        {(agent.cachedTokens / TOKENS_PER_MILLION).toFixed(2)}M cached ({cacheRatio}
                        %)
                      </span>
                      <span className="text-right">Avg {agent.avgLatencyMs}ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5 text-[var(--accent-blue)]" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                System Build Phase &amp; Engineering Output Ledger
              </h3>
            </div>
            <div className="space-y-3">
              {bt.phaseBreakdown.map((phase) => (
                <div
                  key={phase.phase}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-[var(--text-heading)] text-xs">
                      {phase.phase}
                    </div>
                    <div className="whitespace-nowrap font-bold font-mono text-accent-green text-xs">
                      {formatRand(phase.costZAR)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                    <span>{(phase.tokens / TOKENS_PER_MILLION).toFixed(2)}M tokens</span>
                    <span className="inline-flex items-center gap-1">
                      <GitCommit className="h-3 w-3" /> {phase.commits} commits
                    </span>
                    <span className="inline-flex items-center gap-1 text-accent-green">
                      <Bug className="h-3 w-3" /> {phase.bugsResolved} bugs resolved
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-[var(--border-subtle)] border-t pt-3 text-center font-mono text-xs">
              <div>
                <div className="text-[10px] text-[var(--text-secondary)]">SQL Migrations</div>
                <div className="font-bold text-[var(--text-heading)]">
                  {bt.engineeringVelocity.sqlMigrations}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-secondary)]">Lines Inserted</div>
                <div className="font-bold text-accent-green">
                  +{bt.engineeringVelocity.linesInserted.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-secondary)]">Retrospectives</div>
                <div className="font-bold text-[var(--text-heading)]">
                  {bt.engineeringVelocity.retrospectivesCount}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Runtime Model Breakdown */}
      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-[var(--accent-blue)]" />
          <h3 className="font-semibold text-[var(--text-heading)] text-sm">
            Runtime Portal AI Model Breakdown ({scope.toUpperCase()})
          </h3>
        </div>

        {metrics.byModel.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 p-5 text-center">
            <p className="font-medium text-[var(--text-secondary)] text-xs">
              No live portal user AI invocations in this window.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {metrics.byModel.map((model) => (
              <div
                key={model.name}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold font-mono text-[var(--text-heading)] text-xs">
                      {model.name}
                    </h4>
                    <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                      {model.requests} requests
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono text-accent-green text-xs">
                      R {((model.cost / CENTS_PER_DOLLAR) * exchangeRateZAR).toFixed(2)}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-secondary)]">
                      {model.percentage}% share
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-2.5 font-mono text-[10px]">
                  <span className="text-[var(--text-secondary)]">
                    {(model.tokens / TOKENS_PER_MILLION).toFixed(3)}M tokens
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {(model.cachedTokens / TOKENS_PER_THOUSAND).toFixed(1)}K cached
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Recent Usage Feed */}
      {metrics.recentUsage.length > 0 && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[var(--accent-blue)]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Recent Runtime AI Requests
            </h3>
          </div>
          <div className="space-y-2">
            {metrics.recentUsage.slice(0, RECENT_FEED_DISPLAY_LIMIT).map((usage) => (
              <div
                key={usage.id}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)]/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      usage.status === 'success' ? 'bg-accent-green' : 'bg-accent-red'
                    }`}
                  />
                  <div>
                    <p className="font-mono text-[var(--text-heading)] text-xs">{usage.model}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {usage.timestamp
                        ? new Date(usage.timestamp).toLocaleString('en-ZA')
                        : 'Timestamp unavailable'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className="text-[var(--text-secondary)]">
                    {(usage.tokens / TOKENS_PER_THOUSAND).toFixed(1)}K tokens
                  </span>
                  <span className="text-[var(--text-secondary)]">{usage.latency}ms</span>
                  <span className="text-accent-green">
                    R {((usage.costCents / CENTS_PER_DOLLAR) * exchangeRateZAR).toFixed(3)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
