'use client';

import type { Department } from '@repo/departments/data-access';
import { cn } from '@repo/ui/lib/utils';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface HubLiveTelemetryPulseProps {
  readonly departments: readonly Department[];
}

type TelemetryMetricMode = 'pulse' | 'readiness' | 'throughput';

interface GraphSeriesPoint {
  readonly key: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: number;
  readonly status: 'active' | 'maintenance' | 'alert';
  readonly statLabel: string;
  readonly statValue: string;
}

const REBUILD_INTERVAL_MS = 4500;
const BANNER_ROTATE_INTERVAL_MS = 3800;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 176;
const CHART_PAD_X = 28;
const CHART_PAD_TOP = 18;
const CHART_PAD_BOTTOM = 26;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
const MAX_RENDERED_POINTS = 10;

const MODE_OPTIONS: ReadonlyArray<{
  readonly id: TelemetryMetricMode;
  readonly label: string;
  readonly unit: string;
}> = [
  { id: 'pulse', label: 'Operations Pulse', unit: '% sync' },
  { id: 'readiness', label: 'Module Readiness', unit: '% health' },
  { id: 'throughput', label: 'Site Throughput', unit: 'idx' },
];

const PANEL_SURFACE_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-2xl border border-accent-gold/55 bg-white shadow-sm';

function deriveSeedValue(name: string, cycle: number, index: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  const wave = Math.sin((cycle + 1) * 0.95 + index * 0.72) * 11;
  const ripple = Math.cos((cycle + 2) * 0.55 + (hash % 17)) * 6;
  return Math.round(74 + ((hash % 18) - 6) + wave + ripple);
}

function clampMetric(raw: number): number {
  return Math.max(24, Math.min(99, raw));
}

function buildTelemetrySeries(
  departments: readonly Department[],
  mode: TelemetryMetricMode,
  cycle: number
): readonly GraphSeriesPoint[] {
  const sourceDepts =
    departments.length > 0
      ? departments.slice(0, MAX_RENDERED_POINTS)
      : [
          {
            name: 'control-room',
            displayName: 'Control Room',
            route: '/control-room',
            icon: 'Radio',
            description: 'SCADA Telemetry',
            color: 'blue' as const,
            type: 'control_room' as const,
            status: 'active' as const,
          },
          {
            name: 'drilling',
            displayName: 'Drilling Ops',
            route: '/drilling',
            icon: 'Pickaxe',
            description: 'Drilling Telemetry',
            color: 'blue' as const,
            type: 'standard' as const,
            status: 'active' as const,
          },
          {
            name: 'production',
            displayName: 'Production',
            route: '/production',
            icon: 'TrendingUp',
            description: 'Extraction Yield',
            color: 'emerald' as const,
            type: 'standard' as const,
            status: 'active' as const,
          },
          {
            name: 'plant-processing',
            displayName: 'Plant Processing',
            route: '/plant-processing',
            icon: 'Factory',
            description: 'Wash Plant',
            color: 'amber' as const,
            type: 'standard' as const,
            status: 'active' as const,
          },
          {
            name: 'access-control',
            displayName: 'Access Control',
            route: '/access-control',
            icon: 'ShieldCheck',
            description: 'Site Gates',
            color: 'blue' as const,
            type: 'standard' as const,
            status: 'active' as const,
          },
        ];

  return sourceDepts.map((dept, index) => {
    const baseTrend = dept.trend?.length
      ? (dept.trend[(cycle + index) % dept.trend.length] ?? 86)
      : deriveSeedValue(dept.name, cycle, index);
    const normalizedBase = baseTrend > 100 ? (baseTrend % 45) + 52 : baseTrend;
    const modeOffset = mode === 'readiness' ? 6 : mode === 'throughput' ? -4 : 0;
    const resolvedStatus: GraphSeriesPoint['status'] = dept.status ?? 'active';
    const statusPenalty =
      resolvedStatus === 'alert' ? -22 : resolvedStatus === 'maintenance' ? -10 : 0;
    const value = clampMetric(Math.round(normalizedBase + modeOffset + statusPenalty));

    const compactName = dept.displayName
      .replace(/Department|Operations|& Utilization/gi, '')
      .trim()
      .slice(0, 11);

    return {
      key: dept.name,
      label: dept.displayName,
      shortLabel: compactName || dept.name.slice(0, 10),
      value,
      status: resolvedStatus,
      statLabel: dept.stats?.label ?? 'Sync Rate',
      statValue: dept.stats?.value ?? `${value}%`,
    };
  });
}

function buildSystemUpdateMessages(
  departments: readonly Department[],
  cycle: number
): readonly { readonly tag: string; readonly text: string }[] {
  const activeCount = departments.filter((d) => d.status === 'active').length;
  const alertCount = departments.filter((d) => d.status !== 'active').length;
  const total = departments.length || activeCount;
  const highlightDept =
    departments.length > 0 ? departments[cycle % departments.length] : undefined;

  const baseMessages: Array<{ readonly tag: string; readonly text: string }> = [
    {
      tag: 'SYS SYNC',
      text: `${activeCount}/${total} operational modules streaming nominal live site telemetry (Cycle #${cycle + 1}).`,
    },
    {
      tag: 'TELEMETRY',
      text: highlightDept
        ? `${highlightDept.displayName}: ${highlightDept.stats?.label ?? 'Status'} reported at ${highlightDept.stats?.value ?? 'Nominal'}.`
        : 'Control Room & Access Perimeter CDC channels synchronized across all site zones.',
    },
    {
      tag: alertCount > 0 ? 'ALERT WATCH' : 'SAFETY',
      text:
        alertCount > 0
          ? `${alertCount} operational module threshold notification(s) flagged for shift supervisor verification.`
          : 'Zero tolerance perimeter interlocks, breathalyzer gates, and shift logs operating at full readiness.',
    },
    {
      tag: 'DISPATCH',
      text: `Live mining analytics pipeline rebuilt automatically — next telemetry sweep queued in ${(REBUILD_INTERVAL_MS / 1000).toFixed(1)}s.`,
    },
  ];

  return baseMessages;
}

export function HubLiveTelemetryPulse({ departments }: HubLiveTelemetryPulseProps) {
  const prefersReducedMotion = useReducedMotion();
  const [metricMode, setMetricMode] = useState<TelemetryMetricMode>('pulse');
  const [cycleCount, setCycleCount] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || isPaused) return;
    const rebuildTimer = window.setInterval(() => {
      setCycleCount((prev) => prev + 1);
    }, REBUILD_INTERVAL_MS);
    return () => window.clearInterval(rebuildTimer);
  }, [isPaused]);

  useEffect(() => {
    if (typeof window === 'undefined' || isPaused) return;
    const bannerTimer = window.setInterval(() => {
      setBannerIndex((prev) => prev + 1);
    }, BANNER_ROTATE_INTERVAL_MS);
    return () => window.clearInterval(bannerTimer);
  }, [isPaused]);

  const series = useMemo(
    () => buildTelemetrySeries(departments, metricMode, cycleCount),
    [departments, metricMode, cycleCount]
  );

  const messages = useMemo(
    () => buildSystemUpdateMessages(departments, cycleCount),
    [departments, cycleCount]
  );

  const activeMessage = messages[bannerIndex % messages.length] ?? messages[0]!;
  const focusedIndex = hoveredIdx !== null && series[hoveredIdx] ? hoveredIdx : 0;
  const focusedPoint = series[focusedIndex];
  const averageScore = useMemo(() => {
    if (series.length === 0) return 0;
    return Math.round(series.reduce((sum, pt) => sum + pt.value, 0) / series.length);
  }, [series]);

  const handleManualRebuild = useCallback(() => {
    setCycleCount((prev) => prev + 1);
    setBannerIndex((prev) => prev + 1);
  }, []);

  const coords = useMemo(() => {
    const count = Math.max(series.length, 1);
    const usableWidth = CHART_WIDTH - CHART_PAD_X * 2;
    const stepX = count > 1 ? usableWidth / (count - 1) : 0;
    return series.map((pt, idx) => {
      const x = count === 1 ? CHART_WIDTH / 2 : CHART_PAD_X + idx * stepX;
      const y = CHART_PAD_TOP + ((100 - pt.value) / 100) * PLOT_HEIGHT;
      return { x, y, pt };
    });
  }, [series]);

  const linePath = useMemo(() => {
    if (coords.length === 0) return '';
    return coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  }, [coords]);

  const areaPath = useMemo(() => {
    if (coords.length === 0) return '';
    const baselineY = CHART_HEIGHT - CHART_PAD_BOTTOM;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }, [coords, linePath]);

  const currentModeMeta = MODE_OPTIONS.find((opt) => opt.id === metricMode) ?? MODE_OPTIONS[0]!;

  return (
    <div data-testid="hub-live-telemetry-pulse" className="space-y-3">
      {/* Animated System Updates Ticker Banner */}
      <div
        data-testid="hub-system-updates-banner"
        className={cn(
          PANEL_SURFACE_CLASS,
          'flex flex-wrap items-center justify-between gap-3 px-4 py-2.5'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-bold font-mono text-[10px] text-emerald-700 tracking-wider">
            <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
            LIVE SYSTEM FEED
          </span>

          <div className="min-w-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <m.div
                key={`${bannerIndex % messages.length}-${cycleCount}`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="flex items-center gap-2 truncate"
              >
                <span className="shrink-0 rounded border border-accent-gold/45 bg-amber-50 px-1.5 py-0.5 font-bold font-mono text-[10px] text-amber-800">
                  {activeMessage.tag}
                </span>
                <p className="truncate font-medium text-slate-800 text-xs sm:text-[13px]">
                  {activeMessage.text}
                </p>
              </m.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous system update"
            onClick={() => setBannerIndex((prev) => (prev - 1 + messages.length) % messages.length)}
            className="rounded-lg border border-black/[0.08] bg-white p-1.5 text-slate-700 transition-colors hover:border-accent-gold/60 hover:text-accent-gold"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next system update"
            onClick={() => setBannerIndex((prev) => prev + 1)}
            className="rounded-lg border border-black/[0.08] bg-white p-1.5 text-slate-700 transition-colors hover:border-accent-gold/60 hover:text-accent-gold"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Rebuilding Telemetry Graph Card */}
      <div data-testid="hub-rebuilding-graph-card" className={cn(PANEL_SURFACE_CLASS, 'p-4')}>
        <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent-gold/45 bg-amber-50 text-accent-gold">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Live Site Operations Telemetry Stream
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-gold/50 bg-white px-2 py-0.5 font-bold font-mono text-[10px] text-amber-700">
                  <Sparkles className="h-3 w-3 text-accent-gold" />
                  Sweep #{cycleCount + 1} • Avg {averageScore}%
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Interactive graph auto-rebuilds every 4.5s across active operational divisions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Telemetry graph metric mode"
              className="inline-flex items-center rounded-xl border border-black/[0.08] bg-slate-50 p-0.5"
            >
              {MODE_OPTIONS.map((option) => {
                const isSelected = metricMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setMetricMode(option.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 font-semibold text-[11px] transition-all',
                      isSelected
                        ? 'gold-steel-border gold-steel-border-slim bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? 'Resume live graph rebuild' : 'Pause live graph rebuild'}
              className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 font-semibold text-[11px] text-slate-700 transition-colors hover:border-accent-gold/60"
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualRebuild}
              aria-label="Rebuild graph now"
              className="inline-flex items-center gap-1 rounded-lg border border-accent-gold/55 bg-white px-2.5 py-1.5 font-semibold text-[11px] text-amber-800 shadow-2xs transition-colors hover:bg-amber-50"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Rebuild</span>
            </button>
          </div>
        </div>

        {/* Interactive Focus Readout */}
        {focusedPoint && (
          <div
            data-testid="hub-graph-focus-readout"
            className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-slate-50/80 px-3 py-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-bold text-slate-900">{focusedPoint.label}</span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-[11px] text-slate-700">
                {focusedPoint.statLabel}: {focusedPoint.statValue}
              </span>
            </div>
            <span className="font-bold font-mono text-amber-700 tabular-nums">
              {focusedPoint.value} {currentModeMeta.unit}
            </span>
          </div>
        )}

        {/* Animated Multi-Layer SVG Chart */}
        <div className="relative overflow-hidden rounded-xl border border-black/[0.06] bg-gradient-to-b from-slate-50/70 to-white p-2">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-44 w-full overflow-visible"
            role="img"
            aria-label="Live operational telemetry trend chart"
          >
            <defs>
              <linearGradient id="hub-pulse-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold, currentColor)" stopOpacity="0.34" />
                <stop offset="70%" stopColor="var(--accent-blue, currentColor)" stopOpacity="0.1" />
                <stop
                  offset="100%"
                  stopColor="var(--accent-blue, currentColor)"
                  stopOpacity="0.01"
                />
              </linearGradient>
              <linearGradient id="hub-pulse-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent-blue, currentColor)" />
                <stop offset="50%" stopColor="var(--accent-gold, currentColor)" />
                <stop offset="100%" stopColor="var(--accent-green, currentColor)" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[25, 50, 75, 100].map((tick) => {
              const y = CHART_PAD_TOP + ((100 - tick) / 100) * PLOT_HEIGHT;
              return (
                <g key={tick}>
                  <line
                    x1={CHART_PAD_X}
                    y1={y}
                    x2={CHART_WIDTH - CHART_PAD_X}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={4}
                    y={y + 3}
                    fontSize="9"
                    fontFamily="monospace"
                    fill="currentColor"
                    opacity="0.45"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Area Fill & Bars */}
            {areaPath && <path d={areaPath} fill="url(#hub-pulse-area-fill)" />}

            {coords.map(({ x, y, pt }, idx) => {
              const baselineY = CHART_HEIGHT - CHART_PAD_BOTTOM;
              const barHeight = Math.max(4, baselineY - y);
              const isFocused = idx === focusedIndex;
              return (
                <g
                  key={`${pt.key}-${cycleCount}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                  className="cursor-pointer"
                >
                  <m.rect
                    x={x - 10}
                    y={y}
                    width={20}
                    height={barHeight}
                    rx={5}
                    style={{ transformOrigin: '50% 100%', transformBox: 'fill-box' }}
                    initial={prefersReducedMotion ? false : { scaleY: 0, opacity: 0.4 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.55, delay: idx * 0.03 }}
                    fill={
                      isFocused
                        ? 'var(--accent-gold, currentColor)'
                        : 'var(--accent-blue, currentColor)'
                    }
                    fillOpacity={isFocused ? 0.32 : 0.16}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={isFocused ? 5.5 : 3.8}
                    fill="white"
                    stroke={
                      pt.status === 'alert'
                        ? 'var(--accent-red, currentColor)'
                        : pt.status === 'maintenance'
                          ? 'var(--accent-amber, currentColor)'
                          : 'var(--accent-gold, currentColor)'
                    }
                    strokeWidth={isFocused ? 2.5 : 2}
                  />
                  <text
                    x={x}
                    y={CHART_HEIGHT - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={isFocused ? '700' : '600'}
                    fill="currentColor"
                    opacity={isFocused ? 0.95 : 0.65}
                  >
                    {pt.shortLabel}
                  </text>
                </g>
              );
            })}

            {/* Animated Polyline */}
            {linePath && (
              <m.path
                key={`${metricMode}-${cycleCount}`}
                d={linePath}
                fill="none"
                stroke="url(#hub-pulse-stroke)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={prefersReducedMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
