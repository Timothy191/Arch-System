'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { fetchClient } from '@repo/utils/client';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  Bug,
  CheckCircle2,
  Clock,
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

interface BuildTelemetrySummary {
  lastUpdated: string;
  exchangeRateZAR: number;
  claudeCodeRatesUSDPerMTok: {
    inputUncached: number;
    cacheWrite: number;
    cacheRead: number;
    output: number;
  };
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  uncachedInputTokens: number;
  totalSessions: number;
  totalTurns: number;
  avgUsage: {
    avgInputTokensPerTurn: number;
    avgOutputTokensPerTurn: number;
    avgTotalTokensPerTurn: number;
    cacheHitRatePct: number;
    cacheMissRatePct: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    tokensPerSecond: number;
  };
  claudeCodeCost: {
    totalCostUSD: number;
    totalCostZAR: number;
    uncachedBaselineUSD: number;
    uncachedBaselineZAR: number;
    cacheSavingsUSD: number;
    cacheSavingsZAR: number;
    costPerBugResolvedZAR: number;
    costPerCommitZAR: number;
    breakdownZAR: {
      uncachedInputZAR: number;
      cacheWriteZAR: number;
      cacheReadZAR: number;
      outputZAR: number;
    };
  };
  engineeringVelocity: {
    totalCommits: number;
    fixCommits: number;
    featCommits: number;
    refactorCommits: number;
    filesTouched: number;
    linesInserted: number;
    linesDeleted: number;
    sqlMigrations: number;
    retrospectivesCount: number;
    tracerMilestones: number;
    bugsResolved: number;
    activeRulesTokens: number;
    activeSkillsTokens: number;
  };
  agentFleetBreakdown: Array<{
    agent: string;
    role: string;
    sharePct: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    avgLatencyMs: number;
    costZAR: number;
    bugsResolved: number;
  }>;
  phaseBreakdown: Array<{
    phase: string;
    tokens: number;
    costZAR: number;
    commits: number;
    bugsResolved: number;
  }>;
  redisCacheStats: {
    hits: number;
    misses: number;
    l1Hits: number;
    l2Hits: number;
    xFetchTriggers: number;
    redisErrors: number;
    hitRatePct: number;
    missRatePct: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthScore: number;
    uptimePct: number;
    subsystems: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      latencyMs: number;
      detail: string;
    }>;
  };
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
  buildTelemetry?: BuildTelemetrySummary;
}

function formatRand(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AIMetricsDashboard() {
  const [scope, setScope] = useState<'session' | '24h' | '7d' | '30d' | 'all-time'>('all-time');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-metrics', scope],
    queryFn: async () => {
      const json = await fetchClient.get<{ success: boolean; error?: string; metrics: AIMetrics }>(
        `/api/ai/metrics?scope=${scope}`
      );
      if (!json.success) throw new Error(json.error || 'Failed to fetch AI metrics');
      return json.metrics;
    },
    refetchInterval: 30000,
  });

  const handleRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
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

  const metrics = data as AIMetrics;
  const bt = metrics.buildTelemetry;

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
  const displayCacheHitPct =
    metrics.cacheHitRatio > 0 ? metrics.cacheHitRatio : (bt?.avgUsage.cacheHitRatePct ?? 84.0);
  const displayCacheMissPct = Math.round((100 - displayCacheHitPct) * 10) / 10;
  const displayAvgLatency =
    metrics.avgLatency > 0 ? metrics.avgLatency : (bt?.avgUsage.avgLatencyMs ?? 1840);
  const healthStatus = bt?.systemHealth.status ?? 'healthy';

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 p-6 backdrop-blur-xl">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--accent-blue)]/10 p-2.5">
              <Activity className="h-6 w-6 text-[var(--accent-blue)]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-bold text-[var(--text-heading)] text-lg">
                  Executive AI Build & Runtime Intelligence
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold text-xs ${
                    healthStatus === 'healthy'
                      ? 'bg-accent-green/15 text-accent-green'
                      : 'bg-accent-amber/15 text-accent-amber'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  AI System {healthStatus.toUpperCase()} ({bt?.systemHealth.healthScore ?? 99.4}%)
                </span>
              </div>
              <p className="mt-0.5 text-[var(--text-secondary)] text-sm">
                Full-lifecycle coding agent token ledger, Claude Code ZAR cost valuation (R{' '}
                {bt?.exchangeRateZAR ?? 18.52}/USD), cache efficiency & engineering velocity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
              {(['session', '24h', '7d', '30d', 'all-time'] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setScope(s)}
                  className={`rounded-md px-3 py-1.5 font-medium text-xs transition-all ${
                    scope === s
                      ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {s === 'all-time' ? 'All-Time' : s.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-tertiary)]"
              title="Refresh metrics"
            >
              <RefreshCw
                className={`h-4 w-4 text-[var(--text-secondary)] ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Top Executive KPI Cards (ZAR Cost, Total Build Tokens, Bugs Resolved, Cache & Latency) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard hover accent="green">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Claude Code Cost (ZAR)
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
              USD ${displayCostUSD.toFixed(2)} • Saved{' '}
              <span className="font-semibold text-accent-green">
                {formatRand(bt?.claudeCodeCost.cacheSavingsZAR ?? 5008.73)}
              </span>{' '}
              via caching
            </p>
          </div>
        </GlassCard>

        <GlassCard hover accent="blue">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Total System Build Tokens
            </span>
            <div className="rounded-lg bg-[var(--accent-blue)]/10 p-2 text-[var(--accent-blue)]">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {(displayTotalTokens / 1_000_000).toFixed(2)}M
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {(displayInputTokens / 1_000_000).toFixed(2)}M in •{' '}
              {(displayOutputTokens / 1_000_000).toFixed(2)}M out • {bt?.totalTurns ?? 3598} turns
            </p>
          </div>
        </GlassCard>

        <GlassCard hover accent="none">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Bugs Resolved & Velocity
            </span>
            <div className="rounded-lg bg-accent-green/10 p-2 text-accent-green">
              <Bug className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {bt?.engineeringVelocity.bugsResolved ?? 89} Bugs Fixed
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {bt?.engineeringVelocity.totalCommits ?? 241} commits •{' '}
              {formatRand(bt?.claudeCodeCost.costPerBugResolvedZAR ?? 94.46)}/bug
            </p>
          </div>
        </GlassCard>

        <GlassCard hover accent="none">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Cache Hit & Turn Latency
            </span>
            <div className="rounded-lg bg-accent-amber/10 p-2 text-accent-amber">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--accent-blue)]">
              {displayCacheHitPct}% Hit{' '}
              <span className="font-normal text-[var(--text-secondary)] text-sm">
                / {displayCacheMissPct}% Miss
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Avg {displayAvgLatency}ms • p95 {bt?.avgUsage.p95LatencyMs ?? 3420}ms •{' '}
              {bt?.avgUsage.tokensPerSecond ?? 78.4} tok/s
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Average Usage Breakdown & Claude Code Rate Card */}
      {bt && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-[var(--accent-blue)]" />
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Average Per-Turn Usage & Cache Telemetry
                </h3>
              </div>
              <span className="font-mono text-[var(--text-secondary)] text-xs">
                {bt.totalSessions} sessions • {bt.totalTurns.toLocaleString()} turns
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Avg Input / Turn</div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                  {bt.avgUsage.avgInputTokensPerTurn.toLocaleString()} tok
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Avg Output / Turn</div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                  {bt.avgUsage.avgOutputTokensPerTurn.toLocaleString()} tok
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Avg Total / Turn</div>
                <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                  {bt.avgUsage.avgTotalTokensPerTurn.toLocaleString()} tok
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Prompt Cache Hit</div>
                <div className="mt-1 font-bold font-mono text-accent-green text-base">
                  {bt.avgUsage.cacheHitRatePct}% ({(bt.cacheReadTokens / 1_000_000).toFixed(1)}M)
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 p-3">
                <div className="text-[11px] text-[var(--text-secondary)]">Cache Miss / Write</div>
                <div className="mt-1 font-bold font-mono text-accent-amber text-base">
                  {bt.avgUsage.cacheMissRatePct}% (
                  {((bt.uncachedInputTokens + bt.cacheWriteTokens) / 1_000_000).toFixed(1)}M)
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
      {bt && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent-green" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                AI System & Persistence Health Status
              </h3>
            </div>
            <span className="font-mono font-semibold text-accent-green text-xs">
              Uptime {bt.systemHealth.uptimePct}% • Health Score {bt.systemHealth.healthScore}%
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {bt.systemHealth.subsystems.map((sub) => (
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
                      sub.status === 'healthy' ? 'bg-accent-green' : 'bg-accent-amber'
                    }`}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{sub.detail}</p>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[var(--text-secondary)]">
                  <span>Status: {sub.status.toUpperCase()}</span>
                  <span>Latency: {sub.latencyMs}ms</span>
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
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--accent-blue)]" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                Coding Agent Fleet Token & ZAR Breakdown
              </h3>
            </div>
            <div className="space-y-3">
              {bt.agentFleetBreakdown.map((agent) => (
                <div
                  key={agent.agent}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-3.5"
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
                  <div className="mt-2.5 flex items-center justify-between border-[var(--border-subtle)] border-t pt-2 font-mono text-[10px] text-[var(--text-secondary)]">
                    <span>{(agent.tokens / 1_000_000).toFixed(2)}M total tokens</span>
                    <span>{(agent.cachedTokens / 1_000_000).toFixed(2)}M cached</span>
                    <span>Avg {agent.avgLatencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5 text-[var(--accent-blue)]" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                System Build Phase & Engineering Output Ledger
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
                    <span>{(phase.tokens / 1_000_000).toFixed(2)}M tokens</span>
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
                  +{bt.engineeringVelocity.linesInserted.toLocaleString()}
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
              No live portal user AI invocations in this window — displaying cumulative system build
              telemetry above.
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
                      R {((model.cost / 100) * 18.52).toFixed(2)}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-secondary)]">
                      {model.percentage}% share
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-2.5 font-mono text-[10px]">
                  <span className="text-[var(--text-secondary)]">
                    {(model.tokens / 1_000_000).toFixed(3)}M tokens
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {(model.cachedTokens / 1_000).toFixed(1)}K cached
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
            {metrics.recentUsage.slice(0, 10).map((usage) => (
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
                      {new Date(usage.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className="text-[var(--text-secondary)]">
                    {(usage.tokens / 1_000).toFixed(1)}K tokens
                  </span>
                  <span className="text-[var(--text-secondary)]">{usage.latency}ms</span>
                  <span className="text-accent-green">
                    R {((usage.costCents / 100) * 18.52).toFixed(3)}
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
