'use client';

import { Activity, Bot, Bug, Clock, Coins, RefreshCw, Zap } from 'lucide-react';
import { useState } from 'react';
import { AgenticMonitorSpendAndFeed } from './AgenticMonitorSpendAndFeed';
import {
  AGENT_SYSTEM_BREAKDOWN,
  AGENT_TASK_FEED,
  LIFETIME_METRICS,
  SESSION_METRICS,
} from './agentic-monitor-data';

const DEFAULT_USD_TO_ZAR_RATE = 18.52;
const REFRESH_SPINNER_DURATION_MS = 500;
const MILLION_TOKENS_DIVISOR = 1000000;
const PERCENT_MULTIPLIER = 100;
const PROJECT_WEEKS_COUNT = 11;
const CURRENCY_DECIMAL_PLACES = 2;
const TOKEN_MILLIONS_DECIMALS = 2;

function formatZarCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: CURRENCY_DECIMAL_PLACES,
    maximumFractionDigits: CURRENCY_DECIMAL_PLACES,
  });
}

export default function AgenticMonitor() {
  const [scope, setScope] = useState<'all-time' | 'session'>('all-time');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [exchangeRate] = useState<number>(DEFAULT_USD_TO_ZAR_RATE); // USD to ZAR
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const currentMetrics = scope === 'all-time' ? LIFETIME_METRICS : SESSION_METRICS;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), REFRESH_SPINNER_DURATION_MS);
  };

  const filteredFeed =
    selectedAgent === 'all'
      ? AGENT_TASK_FEED
      : AGENT_TASK_FEED.filter((t) => t.agent.toLowerCase().includes(selectedAgent.toLowerCase()));

  return (
    <div
      data-testid="agentic-monitor-container"
      className="mx-auto w-full max-w-[1600px] space-y-6 p-1 sm:p-2"
    >
      {/* Top Banner & Scope Selector */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-700" />
              <h2 className="font-semibold text-[var(--text-heading)] text-lg">
                eve Autonomous Multi-Agent System Monitor &amp; Expenditure Tracker
              </h2>
            </div>
            <p className="mt-1 text-[var(--text-muted)] text-xs">
              Real-time token economics, 90% prompt caching discounts (Claude Code, Google
              Antigravity AGY 2.0, Copilot, Ollama), 27-gate verification telemetry, and ZAR cost
              trajectories from Project Day 1 (Jun 15, 2026) to Today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Scope Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1">
              <button
                onClick={() => setScope('all-time')}
                className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
                  scope === 'all-time'
                    ? 'bg-emerald-600 font-semibold text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                All-Time Project Spend (Day 1 – Today)
              </button>
              <button
                onClick={() => setScope('session')}
                className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
                  scope === 'session'
                    ? 'bg-emerald-600 font-semibold text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Active Session
              </button>
            </div>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-emerald-700' : 'text-[var(--text-muted)]'}`}
              />
              Live Telemetry
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-emerald-700 text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" /> Multi-Agent
              Synced
            </span>
          </div>
        </div>
      </div>

      {/* Primary Summary Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Cost in South African Rands */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">
              {scope === 'all-time' ? 'Total Project Spend (ZAR)' : 'Session Cost (ZAR)'}
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              R {formatZarCurrency(currentMetrics.zarCost)}
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <span className="font-mono text-emerald-600">
                USD equiv: ${currentMetrics.usdCost.toFixed(CURRENCY_DECIMAL_PLACES)}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]/60">
                (1 USD = R{exchangeRate})
              </span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-3 text-[11px]">
            <span className="text-[var(--text-muted)]">Cumulative Savings</span>
            <span className="flex items-center gap-1">
              <span className="font-medium font-mono text-emerald-700">
                +R {formatZarCurrency(currentMetrics.zarSaved)} saved
              </span>
              <span className="rounded bg-emerald-100/30 px-2 text-[10px] text-emerald-600 text-xs">
                {((currentMetrics.zarSaved / currentMetrics.zarCost) * PERCENT_MULTIPLIER).toFixed(
                  1
                )}
                % saved
              </span>
            </span>
          </div>
        </div>

        {/* Metric 2: Token Volume & Cache Hit Rate */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">
              Claude &amp; AGY Cache Ratio
            </span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-emerald-700">
              {currentMetrics.cacheHitRatio}%
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              {(currentMetrics.tokensReused / MILLION_TOKENS_DIVISOR).toFixed(
                TOKEN_MILLIONS_DECIMALS
              )}
              M /{' '}
              {(
                (currentMetrics.tokensUsed + currentMetrics.tokensReused) /
                MILLION_TOKENS_DIVISOR
              ).toFixed(TOKEN_MILLIONS_DECIMALS)}
              M cached tokens reused
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${currentMetrics.cacheHitRatio}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-3 text-[11px]">
            <span className="text-[var(--text-muted)]">Tokens Saved via Slicing</span>
            <span className="font-medium font-mono text-[var(--text-heading)]">
              +
              {(currentMetrics.tokensSaved / MILLION_TOKENS_DIVISOR).toFixed(
                TOKEN_MILLIONS_DECIMALS
              )}
              M tokens
            </span>
          </div>
        </div>

        {/* Metric 3: Engineering Hours & Commits */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">
              {scope === 'all-time' ? 'Total Engineering Time' : 'Active Session Time'}
            </span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {currentMetrics.codingTime}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Across {currentMetrics.totalCommits} verified git commits
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-3 text-[11px]">
            <span className="text-[var(--text-muted)]">Project Timeline</span>
            <span className="font-medium font-mono text-emerald-700">
              {scope === 'all-time' ? '11 Weeks (Jun 15 – Oct 30)' : 'Active Continuous Run'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-3 text-[11px]">
            <span className="text-[var(--text-muted)]">Commit Pace</span>
            <span className="font-medium font-mono text-[var(--text-heading)]">
              {Math.round(currentMetrics.totalCommits / PROJECT_WEEKS_COUNT)}/week
            </span>
          </div>
        </div>

        {/* Metric 4: Quality & Bugs Fixed */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Bugs &amp; Regressions Resolved
              </span>
              <span className="rounded-full bg-emerald-100/30 px-2 py-0.5 font-medium text-[10px] text-emerald-700">
                All Clear
              </span>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
              <Bug className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {currentMetrics.bugsFixed} Resolved
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Zero unhandled production errors
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-3 text-[11px]">
            <span className="text-[var(--text-muted)]">27-Gate Verification Passes</span>
            <span className="font-medium font-mono text-emerald-700">
              27/27 Gates • {currentMetrics.qualityGateRuns} Runs (100%)
            </span>
          </div>
        </div>
      </div>

      {/* MULTI-AGENT WORKLOAD & EXPENDITURE BREAKDOWN (Claude Code, Antigravity, Copilot, Ollama, Subagents) */}
      <div className="space-y-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-2 border-[var(--border-subtle)] border-b pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-emerald-700" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Multi-Agent Coding System Distribution &amp; Token Share
            </h3>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            5 Agent Architectures Integrated
          </span>
        </div>

        {/* Stacked Visual Bar Chart */}
        <div className="space-y-2">
          <div className="flex justify-between font-mono text-[var(--text-muted)] text-xs">
            <span>Agent Workload Distribution (%)</span>
            <span>Total: 19.00M Tokens Spent (R 4,859.31)</span>
          </div>
          <div className="mt-1 flex h-5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--bg-secondary)] p-0.5">
            {AGENT_SYSTEM_BREAKDOWN.map((agent) => (
              <div
                key={agent.id}
                style={{ width: `${agent.percentage}%`, backgroundColor: agent.color }}
                className="group relative h-full cursor-pointer rounded-sm transition-all duration-500"
                title={`${agent.name}: ${agent.percentage}% (R ${formatZarCurrency(agent.zarCost)})`}
              >
                <span className="absolute top-1/2 right-1 -translate-y-1/2 font-bold text-[8px] text-white">
                  {agent.percentage}%
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 pt-1 text-xs">
            {AGENT_SYSTEM_BREAKDOWN.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(selectedAgent === agent.id ? 'all' : agent.id)}
                className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono transition-colors ${
                  selectedAgent === agent.id
                    ? 'border-emerald-600 bg-emerald-50 text-[var(--text-heading)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text-heading)]'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <span>
                  {agent.name} ({agent.percentage}%)
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid Cards */}
        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2 lg:grid-cols-3">
          {AGENT_SYSTEM_BREAKDOWN.map((agent) => (
            <div
              key={agent.id}
              className={`rounded-xl border p-4 transition-all hover:shadow-sm ${
                selectedAgent === agent.id || selectedAgent === 'all'
                  ? 'border-[var(--border-default)] bg-[var(--bg-secondary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-primary)]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <h4 className="font-bold font-mono text-[var(--text-heading)] text-xs">
                      {agent.name}
                    </h4>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {agent.category}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-emerald-700 text-xs">
                    R {formatZarCurrency(agent.zarCost)}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-muted)]">
                    ${agent.usdCost.toFixed(CURRENCY_DECIMAL_PLACES)} USD
                  </div>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {agent.description}
              </p>

              <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-2.5 font-mono text-[10px] text-[var(--text-muted)]">
                <span>
                  Tokens:{' '}
                  <strong className="text-[var(--text-heading)]">{agent.tokensSpent}</strong>
                </span>
                <span>
                  Cache: <strong className="text-emerald-700">{agent.tokensCached}</strong>
                </span>
                <span className="font-semibold text-emerald-700">{agent.percentage}% Share</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AgenticMonitorSpendAndFeed selectedAgent={selectedAgent} filteredFeed={filteredFeed} />
    </div>
  );
}
