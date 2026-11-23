'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, Clock, Code2, Database, GitBranch, Layers, Tag, Zap } from 'lucide-react';
import { useState } from 'react';

export interface HeartbeatTickVisual {
  readonly index: number;
  readonly status: 'UP' | 'DEGRADED' | 'DOWN';
  readonly latencyMs: number;
}

const TICK_BAR_CLASSES: Record<HeartbeatTickVisual['status'], string> = {
  UP: 'bg-emerald-500 hover:bg-emerald-400',
  DEGRADED: 'bg-amber-500 hover:bg-amber-400',
  DOWN: 'bg-rose-500 hover:bg-rose-400',
};

export function AnimatedUptimeStrip({
  ticks,
  slaPct,
}: {
  readonly ticks: readonly HeartbeatTickVisual[];
  readonly slaPct: number;
}) {
  const upCount = ticks.filter((t) => t.status === 'UP').length;
  const degradedCount = ticks.filter((t) => t.status === 'DEGRADED').length;
  const downCount = ticks.filter((t) => t.status === 'DOWN').length;
  const avgLatencyMs =
    ticks.length > 0
      ? Math.round(ticks.reduce((sum, t) => sum + t.latencyMs, 0) / ticks.length)
      : 0;
  const maxLatencyMs = Math.max(10, ...ticks.map((t) => t.latencyMs));

  const sparkPoints = ticks
    .map((tick, idx) => {
      const x = ticks.length > 1 ? (idx / (ticks.length - 1)) * 100 : 50;
      const y = 26 - Math.min(24, (tick.latencyMs / maxLatencyMs) * 22);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <GlassCard variant="window" className="p-4" data-testid="admin-redis-uptime-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <Activity className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm text-zinc-800">
            90-Tick Redis &amp; Runtime Uptime Heartbeat Strip
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
            Avg {avgLatencyMs}ms
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
            {upCount} UP{degradedCount > 0 ? ` · ${degradedCount} DEG` : ''}
            {downCount > 0 ? ` · ${downCount} DOWN` : ''}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-700 text-xs">
            24h SLA: {slaPct}%
          </span>
        </div>
      </div>

      <div
        className="grid auto-cols-fr grid-flow-col items-end gap-0.5 rounded-lg bg-zinc-900/[0.03] p-1.5"
        aria-label="90-tick Redis uptime heartbeat strip"
      >
        {ticks.map((tick) => {
          const heightPct = Math.max(45, Math.min(100, 45 + (tick.latencyMs / maxLatencyMs) * 55));
          return (
            <span
              key={tick.index}
              title={`Tick #${tick.index + 1}: ${tick.status} (${tick.latencyMs}ms)`}
              style={{ height: `${Math.round((heightPct / 100) * 28)}px` }}
              className={`rounded-xs transition-all duration-200 hover:scale-y-115 ${TICK_BAR_CLASSES[tick.status]}`}
            />
          );
        })}
      </div>

      {ticks.length > 1 && (
        <div className="mt-2.5 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] text-zinc-500 uppercase">
            Latency Trend
          </span>
          <svg
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            className="h-6 w-full overflow-visible"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="1.2"
              strokeLinejoin="round"
              points={sparkPoints}
            />
          </svg>
        </div>
      )}
    </GlassCard>
  );
}

function RadialGauge({
  valuePct,
  label,
  sublabel,
  strokeColor,
}: {
  readonly valuePct: number;
  readonly label: string;
  readonly sublabel: string;
  readonly strokeColor: string;
}) {
  const clamped = Math.max(0, Math.min(100, valuePct));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/70 p-3">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="rgba(161,161,170,0.22)"
            strokeWidth="5"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="absolute font-bold font-mono text-[11px] text-zinc-800">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-xs text-zinc-800">{label}</div>
        <div className="truncate font-mono text-[11px] text-zinc-500">{sublabel}</div>
      </div>
    </div>
  );
}

export function RedisTelemetryGauges({
  healthPct,
  usedMemoryMb,
  maxMemoryMb,
  l1HitRatePct,
  opsPerSecond,
}: {
  readonly healthPct: number;
  readonly usedMemoryMb: number;
  readonly maxMemoryMb: number;
  readonly l1HitRatePct: number;
  readonly opsPerSecond: number;
}) {
  const memPct = maxMemoryMb > 0 ? (usedMemoryMb / maxMemoryMb) * 100 : 0;
  const throughputPct = Math.min(100, (opsPerSecond / 1500) * 100);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <RadialGauge
        valuePct={healthPct}
        label="Cluster Health Gauge"
        sublabel={healthPct >= 90 ? 'Optimal SLA' : 'Degraded / Standby'}
        strokeColor={healthPct >= 90 ? '#10b981' : '#f59e0b'}
      />
      <RadialGauge
        valuePct={memPct}
        label="Memory Saturation"
        sublabel={`${usedMemoryMb.toFixed(1)} / ${maxMemoryMb.toFixed(0)} MB`}
        strokeColor="#3b82f6"
      />
      <RadialGauge
        valuePct={l1HitRatePct}
        label="L1/L2 Cache Efficiency"
        sublabel={`${l1HitRatePct.toFixed(1)}% hit ratio`}
        strokeColor="#8b5cf6"
      />
      <RadialGauge
        valuePct={throughputPct}
        label="Throughput Load"
        sublabel={`${opsPerSecond.toLocaleString('en-US')} ops/sec`}
        strokeColor="#06b6d4"
      />
    </div>
  );
}

export function RedisKeyInspectorVisual({
  selectedKey,
  keyType,
  ttlSeconds,
  ttlExpiresIso,
  lastInspected,
  selectedKeyRecord,
  sampleTtlSeconds,
  sampleReadCount,
  sampleWriteCount,
  sampleCommandCount,
}: {
  readonly selectedKey: string;
  readonly keyType: string;
  readonly ttlSeconds: number;
  readonly ttlExpiresIso: string;
  readonly lastInspected: string;
  readonly selectedKeyRecord: unknown;
  readonly sampleTtlSeconds: number;
  readonly sampleReadCount: number;
  readonly sampleWriteCount: number;
  readonly sampleCommandCount: number;
}) {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');

  const keySegments = (selectedKey || 'arch:unselected').split(':').filter(Boolean);
  const recordObj =
    selectedKeyRecord && typeof selectedKeyRecord === 'object' && !Array.isArray(selectedKeyRecord)
      ? (selectedKeyRecord as Record<string, unknown>)
      : null;

  const fullPayload = {
    ...(recordObj ?? (selectedKeyRecord !== null ? { value: selectedKeyRecord } : {})),
    lastInspected,
    metadata: {
      ttl: ttlSeconds > 0 ? ttlSeconds : sampleTtlSeconds,
      expires: ttlExpiresIso,
      usage: {
        reads: sampleReadCount,
        writes: sampleWriteCount,
        commands: sampleCommandCount,
      },
      tags: ['production', 'mining', 'operational'],
    },
  };

  return (
    <div className="flex flex-1 flex-col bg-white/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
          <GitBranch className="h-3.5 w-3.5 text-indigo-600" />
          <span>Key Structure &amp; Metadata Graph</span>
        </div>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('visual')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
              viewMode === 'visual'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Layers className="h-3 w-3" />
            Visual Flow
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
              viewMode === 'json' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Code2 className="h-3 w-3" />
            Raw JSON
          </button>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="space-y-4">
          {/* Mermaid-style Namespace Hierarchy Flow */}
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3">
            <div className="mb-2 font-mono text-[10px] text-indigo-700 uppercase tracking-wider">
              Namespace Hierarchy
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {keySegments.map((segment, idx) => (
                <div key={`${segment}-${idx}`} className="flex items-center gap-2">
                  <div className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-800 shadow-2xs">
                    <span className="mr-1.5 text-[10px] text-indigo-500">#{idx + 1}</span>
                    {segment}
                  </div>
                  {idx < keySegments.length - 1 && (
                    <span className="font-mono text-indigo-400">──▶</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Metadata & Usage Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                TTL &amp; Expiration
              </div>
              <div className="mt-1 font-bold font-mono text-sm text-zinc-900">
                {ttlSeconds > 0 ? `${ttlSeconds}s` : `${sampleTtlSeconds}s (est)`}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                Expires: {ttlExpiresIso}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Zap className="h-3.5 w-3.5 text-cyan-600" />
                Command Activity
              </div>
              <div className="mt-1 font-bold font-mono text-sm text-zinc-900">
                {sampleCommandCount.toLocaleString('en-US')} ops
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                {sampleReadCount.toLocaleString('en-US')} reads ·{' '}
                {sampleWriteCount.toLocaleString('en-US')} writes
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                Type &amp; Scope Tags
              </div>
              <div className="mt-1 font-bold font-mono text-sm text-zinc-900 uppercase">
                {keyType}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {fullPayload.metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Inspected Value Nodes */}
          <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-zinc-600">
              <Database className="h-3.5 w-3.5 text-indigo-600" />
              Inspected Key Payload
            </div>
            {recordObj ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(recordObj).map(([fieldKey, fieldValue]) => (
                  <div
                    key={fieldKey}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/70 px-3 py-2 font-mono text-xs"
                  >
                    <span className="text-zinc-500">{fieldKey}</span>
                    <span className="truncate font-semibold text-zinc-800">
                      {typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="overflow-auto rounded-lg bg-zinc-50 p-2.5 font-mono text-xs text-zinc-800">
                {JSON.stringify(fullPayload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <pre className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 font-mono text-xs text-zinc-800">
          {JSON.stringify(fullPayload, null, 2)}
        </pre>
      )}
    </div>
  );
}
