'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, Clock, Code2, Database, GitBranch, Layers, Tag } from 'lucide-react';
import { useState } from 'react';

export interface HeartbeatTickVisual {
  readonly index: number;
  readonly status: 'UP' | 'DEGRADED' | 'DOWN';
  readonly latencyMs: number;
}

const MIN_SPARKLINE_MAX_MS = 10;
const SPARKLINE_VIEWBOX_WIDTH = 100;
const SPARKLINE_MIDPOINT = 50;
const SPARKLINE_BASELINE_Y = 26;
const SPARKLINE_MAX_HEIGHT = 24;
const SPARKLINE_SCALE_HEIGHT = 22;
const MIN_TICK_HEIGHT_PCT = 45;
const TICK_DYNAMIC_HEIGHT_PCT = 55;
const FULL_PERCENT = 100;
const MAX_TICK_BAR_PX = 28;
const GAUGE_RADIUS_PX = 22;
const HEALTH_OPTIMAL_PCT = 90;
const OPS_GAUGE_CEILING = 1500;

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
  readonly slaPct: number | null;
}) {
  const upCount = ticks.filter((tick) => tick.status === 'UP').length;
  const degradedCount = ticks.filter((tick) => tick.status === 'DEGRADED').length;
  const downCount = ticks.filter((tick) => tick.status === 'DOWN').length;
  const avgLatencyMs =
    ticks.length > 0
      ? Math.round(ticks.reduce((sum, tick) => sum + tick.latencyMs, 0) / ticks.length)
      : null;
  const maxLatencyMs = Math.max(MIN_SPARKLINE_MAX_MS, ...ticks.map((tick) => tick.latencyMs));

  const sparkPoints = ticks
    .map((tick, idx) => {
      const posX =
        ticks.length > 1
          ? (idx / (ticks.length - 1)) * SPARKLINE_VIEWBOX_WIDTH
          : SPARKLINE_MIDPOINT;
      const posY =
        SPARKLINE_BASELINE_Y -
        Math.min(SPARKLINE_MAX_HEIGHT, (tick.latencyMs / maxLatencyMs) * SPARKLINE_SCALE_HEIGHT);
      return `${posX.toFixed(1)},${posY.toFixed(1)}`;
    })
    .join(' ');

  return (
    <GlassCard variant="window" className="p-4" data-testid="admin-redis-uptime-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {ticks.length > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                ticks.length > 0 ? 'bg-emerald-500' : 'bg-zinc-400'
              }`}
            />
          </span>
          <Activity className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm text-zinc-800">
            Redis &amp; Runtime Uptime Heartbeat Strip
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
            {avgLatencyMs !== null ? `Avg ${avgLatencyMs}ms` : 'Avg N/A'}
          </span>
          {ticks.length > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              {upCount} UP{degradedCount > 0 ? ` · ${degradedCount} DEG` : ''}
              {downCount > 0 ? ` · ${downCount} DOWN` : ''}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
              No samples yet
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-700 text-xs">
            24h SLA: {slaPct !== null ? `${slaPct}%` : 'No samples yet'}
          </span>
        </div>
      </div>

      {ticks.length > 0 ? (
        <div
          className="grid auto-cols-fr grid-flow-col items-end gap-0.5 rounded-lg bg-zinc-900/[0.03] p-1.5"
          aria-label="Redis uptime heartbeat strip"
        >
          {ticks.map((tick) => {
            const heightPct = Math.max(
              MIN_TICK_HEIGHT_PCT,
              Math.min(
                FULL_PERCENT,
                MIN_TICK_HEIGHT_PCT + (tick.latencyMs / maxLatencyMs) * TICK_DYNAMIC_HEIGHT_PCT
              )
            );
            return (
              <span
                key={tick.index}
                title={`Tick #${tick.index + 1}: ${tick.status} (${tick.latencyMs}ms)`}
                style={{ height: `${Math.round((heightPct / FULL_PERCENT) * MAX_TICK_BAR_PX)}px` }}
                className={`rounded-xs transition-all duration-200 hover:scale-y-115 ${TICK_BAR_CLASSES[tick.status]}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-3 text-center font-mono text-xs text-zinc-500">
          No persisted SLO heartbeat ticks recorded yet. Scheduled probes write samples to
          public.slo_metrics.
        </div>
      )}

      {ticks.length > 1 && (
        <div className="mt-2.5 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] text-zinc-500 uppercase">
            Latency Trend
          </span>
          <svg
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            className="h-6 w-full overflow-visible text-emerald-500"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke="currentColor"
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
  toneClassName,
}: {
  readonly valuePct: number | null;
  readonly label: string;
  readonly sublabel: string;
  readonly toneClassName: string;
}) {
  const clamped = valuePct !== null ? Math.max(0, Math.min(FULL_PERCENT, valuePct)) : 0;
  const circumference = 2 * Math.PI * GAUGE_RADIUS_PX;
  const dashOffset = circumference - (clamped / FULL_PERCENT) * circumference;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/70 p-3">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="28"
            r={GAUGE_RADIUS_PX}
            fill="none"
            stroke="currentColor"
            className="text-zinc-200"
            strokeWidth="5"
          />
          {valuePct !== null && (
            <circle
              cx="28"
              cy="28"
              r={GAUGE_RADIUS_PX}
              fill="none"
              stroke="currentColor"
              className={toneClassName}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>
        <span className="absolute font-bold font-mono text-[11px] text-zinc-800">
          {valuePct !== null ? `${Math.round(clamped)}%` : 'N/A'}
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
  slaPct,
  usedMemoryMb,
  maxMemoryMb,
  l1HitRatePct,
  opsPerSecond,
}: {
  readonly slaPct: number | null;
  readonly usedMemoryMb: number | null;
  readonly maxMemoryMb: number | null;
  readonly l1HitRatePct: number | null;
  readonly opsPerSecond: number | null;
}) {
  const memPct =
    usedMemoryMb !== null && maxMemoryMb !== null && maxMemoryMb > 0
      ? (usedMemoryMb / maxMemoryMb) * FULL_PERCENT
      : null;
  const throughputPct =
    opsPerSecond !== null
      ? Math.min(FULL_PERCENT, (opsPerSecond / OPS_GAUGE_CEILING) * FULL_PERCENT)
      : null;

  const memorySublabel =
    usedMemoryMb === null
      ? 'Not reported'
      : maxMemoryMb !== null && maxMemoryMb > 0
        ? `${usedMemoryMb.toFixed(1)} / ${maxMemoryMb.toFixed(0)} MB`
        : `${usedMemoryMb.toFixed(1)} MB (no cap)`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <RadialGauge
        valuePct={slaPct}
        label="24h Uptime SLA"
        sublabel={
          slaPct === null
            ? 'No samples yet'
            : slaPct >= HEALTH_OPTIMAL_PCT
              ? 'Within SLO budget'
              : 'Degraded / Breach'
        }
        toneClassName={
          slaPct !== null && slaPct >= HEALTH_OPTIMAL_PCT ? 'text-emerald-500' : 'text-amber-500'
        }
      />
      <RadialGauge
        valuePct={memPct}
        label="Memory Saturation"
        sublabel={memorySublabel}
        toneClassName="text-blue-500"
      />
      <RadialGauge
        valuePct={l1HitRatePct}
        label="L1/L2 Cache Efficiency"
        sublabel={
          l1HitRatePct !== null ? `${l1HitRatePct.toFixed(1)}% hit ratio` : 'No lookups yet'
        }
        toneClassName="text-violet-500"
      />
      <RadialGauge
        valuePct={throughputPct}
        label="Throughput Load"
        sublabel={
          opsPerSecond !== null ? `${opsPerSecond.toLocaleString('en-US')} ops/sec` : 'Not reported'
        }
        toneClassName="text-cyan-500"
      />
    </div>
  );
}

function summarizePayloadCount(keyPayload: unknown): string {
  if (keyPayload === null || keyPayload === undefined) return 'No value loaded';
  if (Array.isArray(keyPayload)) return `${keyPayload.length.toLocaleString('en-US')} entries`;
  if (typeof keyPayload === 'object') {
    return `${Object.keys(keyPayload as Record<string, unknown>).length.toLocaleString('en-US')} fields`;
  }
  if (typeof keyPayload === 'string') return `${keyPayload.length.toLocaleString('en-US')} chars`;
  return 'Scalar value';
}

function formatTtlLabel(ttlSeconds: number | null): string {
  if (ttlSeconds === null) return 'N/A';
  if (ttlSeconds === -1) return 'Persistent (no expiry)';
  if (ttlSeconds === -2) return 'Expired / missing';
  if (ttlSeconds > 0) return `${ttlSeconds}s`;
  return 'N/A';
}

export function RedisKeyInspectorVisual({
  selectedKey,
  keyType,
  ttlSeconds,
  ttlExpiresIso,
  lastInspected,
  selectedKeyRecord,
}: {
  readonly selectedKey: string;
  readonly keyType: string;
  readonly ttlSeconds: number | null;
  readonly ttlExpiresIso: string;
  readonly lastInspected: string;
  readonly selectedKeyRecord: unknown;
}) {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');

  const keySegments = selectedKey ? selectedKey.split(':').filter(Boolean) : [];
  const recordObj =
    selectedKeyRecord && typeof selectedKeyRecord === 'object' && !Array.isArray(selectedKeyRecord)
      ? (selectedKeyRecord as Record<string, unknown>)
      : null;

  const persistenceBadge =
    ttlSeconds === null
      ? 'uninspected'
      : ttlSeconds > 0
        ? 'volatile-ttl'
        : ttlSeconds === -1
          ? 'persistent'
          : 'missing';

  const fullPayload = {
    key: selectedKey || null,
    type: keyType,
    ttlSeconds,
    expires: ttlExpiresIso,
    lastInspected: lastInspected || null,
    value: selectedKeyRecord,
  };

  return (
    <div className="flex flex-1 flex-col bg-white/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
          <GitBranch className="h-3.5 w-3.5 text-indigo-600" />
          <span>Key Structure &amp; Live Metadata</span>
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
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3">
            <div className="mb-2 font-mono text-[10px] text-indigo-700 uppercase tracking-wider">
              Namespace Hierarchy
            </div>
            {keySegments.length > 0 ? (
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
            ) : (
              <p className="font-mono text-xs text-zinc-500">Select a live key to inspect.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                TTL &amp; Expiration
              </div>
              <div className="mt-1 font-bold font-mono text-sm text-zinc-900">
                {formatTtlLabel(ttlSeconds)}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                Expires: {ttlExpiresIso}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Database className="h-3.5 w-3.5 text-cyan-600" />
                Payload Cardinality
              </div>
              <div className="mt-1 font-bold font-mono text-sm text-zinc-900">
                {summarizePayloadCount(selectedKeyRecord)}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                Inspected: {lastInspected || 'Not synced'}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                Redis Data Type
              </div>
              <div className="mt-1 font-bold font-mono text-sm text-zinc-900 uppercase">
                {keyType}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                  {persistenceBadge}
                </span>
              </div>
            </div>
          </div>

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
            ) : selectedKeyRecord !== null && selectedKeyRecord !== undefined ? (
              <pre className="overflow-auto rounded-lg bg-zinc-50 p-2.5 font-mono text-xs text-zinc-800">
                {JSON.stringify(selectedKeyRecord, null, 2)}
              </pre>
            ) : (
              <p className="font-mono text-xs text-zinc-500">
                {selectedKey
                  ? 'Press Inspect or click a key to load its live value.'
                  : 'No Redis key selected.'}
              </p>
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
