"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Coins, Clock, Zap, Bot, RefreshCw, TrendingUp } from "lucide-react";
import { GlassCard } from "@repo/ui/GlassCard";

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
}

export default function AIMetricsDashboard() {
  const [scope, setScope] = useState<"session" | "24h" | "7d" | "30d" | "all-time">("session");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch AI metrics from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ai-metrics", scope],
    queryFn: async () => {
      const response = await fetch(`/api/ai/metrics?scope=${scope}`);
      if (!response.ok) throw new Error("Failed to fetch AI metrics");
      const json = await response.json();
      if (!json.success) throw new Error(json.error);
      return json.metrics as AIMetrics;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard accent="red">
        <p className="text-accent-red font-medium">Failed to load AI metrics</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm font-medium"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  const metrics = data as AIMetrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)]/50 backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent-blue)]/10 rounded-xl">
              <Activity className="w-6 h-6 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-heading)]">
                AI Token Usage Monitor
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Real-time Google AI API telemetry & cost tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Scope Toggle */}
            <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg">
              {(["session", "24h", "7d", "30d", "all-time"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    scope === s
                      ? "bg-[var(--accent-blue)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                  }`}
                >
                  {s === "all-time" ? "All-Time" : s.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              title="Refresh metrics"
            >
              <RefreshCw
                className={`w-4 h-4 text-[var(--text-secondary)] ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cost in ZAR */}
        <GlassCard hover accent="green">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Total Cost (ZAR)
            </span>
            <div className="p-2 bg-accent-green/10 rounded-lg text-accent-green">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[var(--text-heading)]">
              R {metrics.totalCostZAR.toFixed(2)}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">
              USD ${metrics.totalCostUSD.toFixed(2)} • {metrics.totalRequests} requests
            </p>
          </div>
        </GlassCard>

        {/* Cache Hit Ratio */}
        <GlassCard hover accent="blue">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Cache Efficiency
            </span>
            <div className="p-2 bg-[var(--accent-blue)]/10 rounded-lg text-[var(--accent-blue)]">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[var(--accent-blue)]">
              {metrics.cacheHitRatio}%
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">
              {(metrics.tokensSaved / 1_000_000).toFixed(2)}M tokens saved
            </p>
          </div>
        </GlassCard>

        {/* Token Volume */}
        <GlassCard hover accent="none">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Tokens Processed
            </span>
            <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-heading)]">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[var(--text-heading)]">
              {(metrics.totalTokens / 1_000_000).toFixed(2)}M
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">
              {(metrics.totalPromptTokens / 1_000_000).toFixed(2)}M in •{" "}
              {(metrics.totalCompletionTokens / 1_000_000).toFixed(2)}M out
            </p>
          </div>
        </GlassCard>

        {/* Latency */}
        <GlassCard hover accent="none">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Avg Response Time
            </span>
            <div className="p-2 bg-accent-amber/10 rounded-lg text-accent-amber">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-accent-amber">
              {metrics.avgLatency}ms
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">End-to-end latency</p>
          </div>
        </GlassCard>
      </div>

      {/* Model Breakdown */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-[var(--accent-blue)]" />
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            Model Usage Breakdown
          </h3>
        </div>

        {/* Stacked bar */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Token Share by Model</span>
            <span>Total: {(metrics.totalTokens / 1_000_000).toFixed(2)}M tokens</span>
          </div>
          <div className="h-3 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
            {metrics.byModel.map((model) => (
              <div
                key={model.name}
                style={{ width: `${model.percentage}%` }}
                className="h-full transition-all duration-500"
                title={`${model.name}: ${model.percentage}%`}
              />
            ))}
          </div>
        </div>

        {/* Model cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.byModel.map((model) => (
            <div
              key={model.name}
              className="p-4 bg-[var(--bg-tertiary)]/50 rounded-xl border border-[var(--border-subtle)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold font-mono text-[var(--text-heading)]">
                    {model.name}
                  </h4>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {model.requests} requests
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-accent-green">
                    R {(model.cost / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                    {model.percentage}% share
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono">
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
      </GlassCard>

      {/* Recent Usage Feed */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[var(--accent-blue)]" />
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">Recent AI Requests</h3>
        </div>

        <div className="space-y-2">
          {metrics.recentUsage.slice(0, 10).map((usage) => (
            <div
              key={usage.id}
              className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)]/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    usage.status === "success" ? "bg-accent-green" : "bg-accent-red"
                  }`}
                />
                <div>
                  <p className="text-xs font-mono text-[var(--text-heading)]">{usage.model}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {new Date(usage.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-[var(--text-secondary)]">
                  {(usage.tokens / 1_000).toFixed(1)}K tokens
                </span>
                <span className="text-[var(--text-secondary)]">{usage.latency}ms</span>
                <span className="text-accent-green">R {(usage.costCents / 100).toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
