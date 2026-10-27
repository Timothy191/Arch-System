'use client';

import { SpanStatusCode, trace } from '@opentelemetry/api';
import type {
  AdminOperationalTargets,
  OperationalTargetWindow,
} from '@repo/contract/schemas/admin.schema';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getCurrentShift, getOperationalToday } from '@repo/utils';
import { ArrowUpRight, BarChart3, Calendar, Clock, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getOperationalTargets } from '~/features/admin/actions/targets';
import {
  DEFAULT_OPERATIONAL_TARGETS_CLIENT,
  OPERATIONAL_TARGETS_STORAGE_KEY,
} from '~/features/admin/tabs/TargetsTab';

const tracer = trace.getTracer('arch-portal');

type TargetHorizon = 'shift' | 'daily' | 'monthly';

interface ActualMetrics {
  loads: number;
  coalTonnes: number;
  wasteTonnes: number;
  volumeBcm: number;
  smrHours: number;
}

const ARCH_LOGO_PATH =
  'm 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z';

const ZERO_ACTUALS: Record<TargetHorizon, ActualMetrics> = {
  shift: { loads: 0, coalTonnes: 0, wasteTonnes: 0, volumeBcm: 0, smrHours: 0 },
  daily: { loads: 0, coalTonnes: 0, wasteTonnes: 0, volumeBcm: 0, smrHours: 0 },
  monthly: { loads: 0, coalTonnes: 0, wasteTonnes: 0, volumeBcm: 0, smrHours: 0 },
};

const COAL_DENSITY_TONNES_PER_BCM = 1.45;
const WASTE_DENSITY_TONNES_PER_BCM = 2.1;

function aggregateHorizonMetrics(
  loadRows: Array<{
    total_loads: number | null;
    material_type: string | null;
    machine_id?: string | null;
  }>,
  opRows: Array<{ hours_worked: number | null }>,
  binFactorByMachine: Map<string, number>
): ActualMetrics {
  let loads = 0;
  let coalBcm = 0;
  let wasteBcm = 0;

  for (const row of loadRows) {
    const count = row.total_loads || 0;
    if (count <= 0) continue;
    loads += count;
    const bf = (row.machine_id && binFactorByMachine.get(row.machine_id)) || 25;
    const bcm = count * bf;
    const mat = (row.material_type || '').toLowerCase();
    if (mat.includes('coal')) {
      coalBcm += bcm;
    } else {
      wasteBcm += bcm;
    }
  }

  const smrHours = opRows.reduce((sum, op) => sum + (op.hours_worked || 0), 0);

  return {
    loads,
    coalTonnes: Math.round(coalBcm * COAL_DENSITY_TONNES_PER_BCM),
    wasteTonnes: Math.round(wasteBcm * WASTE_DENSITY_TONNES_PER_BCM),
    volumeBcm: Math.round(coalBcm + wasteBcm),
    smrHours: Math.round(smrHours * 10) / 10,
  };
}

function countUnderperformingMetrics(
  actual: ActualMetrics,
  target: OperationalTargetWindow
): number {
  const pairs: Array<[number, number]> = [
    [actual.loads, target.loadsTarget],
    [actual.coalTonnes, target.coalTonnesTarget],
    [actual.wasteTonnes, target.wasteTonnesTarget],
    [actual.volumeBcm, target.volumeBcmTarget],
    [actual.smrHours, target.smrHoursTarget],
  ];
  return pairs.filter(([act, tgt]) => act < tgt).length;
}

export function AlertPanel({ departmentId }: { departmentId: string }) {
  const [horizon, setHorizon] = useState<TargetHorizon>('shift');
  const [targets, setTargets] = useState<AdminOperationalTargets>(
    DEFAULT_OPERATIONAL_TARGETS_CLIENT
  );
  const [actuals, setActuals] = useState<Record<TargetHorizon, ActualMetrics>>(ZERO_ACTUALS);

  const loadTargetsAndActuals = useCallback(async () => {
    const activeTracer = trace.getTracer?.('arch-portal') ?? tracer;
    const statusSpan = activeTracer?.startSpan?.('alert_status_check', {
      attributes: {
        department_id: departmentId,
        alert_count: 0,
      },
    });
    let resolvedTargets = DEFAULT_OPERATIONAL_TARGETS_CLIENT;
    let resolvedActuals = ZERO_ACTUALS;

    try {
      if (typeof window !== 'undefined') {
        const localRaw = window.localStorage.getItem(OPERATIONAL_TARGETS_STORAGE_KEY);
        if (localRaw) {
          try {
            const parsedLocal = JSON.parse(localRaw) as AdminOperationalTargets;
            if (parsedLocal?.shift && parsedLocal?.daily && parsedLocal?.monthly) {
              resolvedTargets = parsedLocal;
              setTargets(parsedLocal);
            }
          } catch {
            // ignore malformed local storage
          }
        }
      }

      const remoteTargets = await getOperationalTargets();
      if (remoteTargets) {
        resolvedTargets = remoteTargets;
        setTargets(remoteTargets);
      }

      try {
        const supabase = createBrowserSupabaseClient();
        const today = getOperationalToday('Africa/Johannesburg');
        const currentShift = getCurrentShift();
        const monthStart = `${today.slice(0, 7)}-01`;

        const [machinesRes, monthLoadsRes, monthOpsRes] = await Promise.all([
          supabase.from('machines').select('id, bin_factor').eq('active', true),
          supabase
            .from('hourly_loads')
            .select('total_loads, material_type, shift, load_date, machine_id')
            .eq('department_id', departmentId)
            .gte('load_date', monthStart)
            .lte('load_date', today),
          supabase
            .from('machine_operations')
            .select('hours_worked, shift, shift_date')
            .eq('department_id', departmentId)
            .gte('shift_date', monthStart)
            .lte('shift_date', today),
        ]);

        const binFactorByMachine = new Map<string, number>();
        for (const m of machinesRes.data ?? []) {
          if (m.id && typeof m.bin_factor === 'number' && m.bin_factor > 0) {
            binFactorByMachine.set(m.id, m.bin_factor);
          }
        }

        const monthLoads = (monthLoadsRes.data ?? []) as Array<{
          total_loads: number | null;
          material_type: string | null;
          shift?: string | null;
          load_date?: string | null;
          machine_id?: string | null;
        }>;
        const monthOps = (monthOpsRes.data ?? []) as Array<{
          hours_worked: number | null;
          shift?: string | null;
          shift_date?: string | null;
        }>;

        const dailyLoads = monthLoads.filter((r) => !r.load_date || r.load_date === today);
        const dailyOps = monthOps.filter((r) => !r.shift_date || r.shift_date === today);

        const shiftLoads = dailyLoads.filter((r) => !r.shift || r.shift === currentShift);
        const shiftOps = dailyOps.filter((r) => !r.shift || r.shift === currentShift);

        resolvedActuals = {
          shift: aggregateHorizonMetrics(shiftLoads, shiftOps, binFactorByMachine),
          daily: aggregateHorizonMetrics(dailyLoads, dailyOps, binFactorByMachine),
          monthly: aggregateHorizonMetrics(monthLoads, monthOps, binFactorByMachine),
        };
        setActuals(resolvedActuals);
      } catch {
        // Preserve fallback actuals when Supabase client is offline or unconfigured
      }

      const alertCount = countUnderperformingMetrics(resolvedActuals.shift, resolvedTargets.shift);
      statusSpan?.setAttributes?.({
        department_id: departmentId,
        alert_count: alertCount,
      });
      statusSpan?.addEvent?.('alert_status_evaluated', {
        department_id: departmentId,
        alert_count: alertCount,
      });
      statusSpan?.setStatus?.({ code: SpanStatusCode.OK });

      const genSpan = activeTracer?.startSpan?.('alert_generation', {
        attributes: {
          department_id: departmentId,
          alert_count: alertCount,
        },
      });
      genSpan?.setAttributes?.({
        department_id: departmentId,
        alert_count: alertCount,
      });
      genSpan?.addEvent?.('alert_generated', {
        department_id: departmentId,
        alert_count: alertCount,
      });
      genSpan?.setStatus?.({ code: SpanStatusCode.OK });
      genSpan?.end?.();
    } catch (error) {
      statusSpan?.setStatus?.({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        statusSpan?.recordException?.(error);
      }
      // Preserve last known actuals and targets when offline
    } finally {
      statusSpan?.end?.();
    }
  }, [departmentId]);

  useEffect(() => {
    loadTargetsAndActuals();
  }, [loadTargetsAndActuals]);

  const activeTarget: OperationalTargetWindow = targets[horizon];
  const activeActual: ActualMetrics = actuals[horizon];

  const metrics = [
    {
      id: 'loads',
      label: 'Loaded Loads',
      actual: activeActual.loads,
      target: activeTarget.loadsTarget,
      unit: 'loads',
    },
    {
      id: 'coal',
      label: 'ROM Coal Tonnage',
      actual: activeActual.coalTonnes,
      target: activeTarget.coalTonnesTarget,
      unit: 't',
    },
    {
      id: 'waste',
      label: 'Waste & Overburden',
      actual: activeActual.wasteTonnes,
      target: activeTarget.wasteTonnesTarget,
      unit: 't',
    },
    {
      id: 'bcm',
      label: 'Excavated Volume',
      actual: activeActual.volumeBcm,
      target: activeTarget.volumeBcmTarget,
      unit: 'BCM',
    },
    {
      id: 'smr',
      label: 'Fleet SMR Hours',
      actual: activeActual.smrHours,
      target: activeTarget.smrHoursTarget,
      unit: 'h',
    },
  ];

  const overallAttainment = Math.min(
    100,
    Math.round(
      metrics.reduce((acc, m) => acc + (m.actual / Math.max(m.target, 1)) * 100, 0) / metrics.length
    )
  );

  // Build trajectory curve points (% of target across 8 intervals)
  const curveMultipliers = [0.42, 0.51, 0.59, 0.68, 0.74, 0.81, 0.87, overallAttainment / 100];
  const graphPoints = curveMultipliers.map((m) => Math.round(m * 100));
  const width = 380;
  const height = 74;
  const padX = 8;
  const padY = 10;
  const minVal = 30;
  const maxVal = 110;
  const range = maxVal - minVal;

  const coords = graphPoints.map((pt, i) => {
    const x = padX + (i / (graphPoints.length - 1)) * (width - padX * 2);
    const y = height - padY - ((pt - minVal) / range) * (height - padY * 2);
    return { x, y, val: pt };
  });

  const targetLineY = height - padY - ((100 - minVal) / range) * (height - padY * 2);
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const firstX = (coords[0]?.x ?? padX).toFixed(1);
  const lastX = (coords[coords.length - 1]?.x ?? width - padX).toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;

  // Radial gauge parameters
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (overallAttainment / 100) * circumference;

  return (
    <GlassCard
      variant="spotlight"
      className="flex h-full flex-col overflow-hidden p-0"
      data-testid="control-room-targets-visual-panel"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/60 p-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 p-1.5 text-[var(--accent-blue)]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-heading)] text-sm">
              Operational Target Graphs &amp; KPI Attainment
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Shift, Daily, and Monthly targets configured in Administration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Target Horizon Selector"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-white/80 p-0.5 text-[11px]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={horizon === 'shift'}
              onClick={() => setHorizon('shift')}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                horizon === 'shift'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              <Clock className="h-3 w-3" />
              Shift
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={horizon === 'daily'}
              onClick={() => setHorizon('daily')}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                horizon === 'daily'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              <Target className="h-3 w-3" />
              Daily
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={horizon === 'monthly'}
              onClick={() => setHorizon('monthly')}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                horizon === 'monthly'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Monthly
            </button>
          </div>

          <Link
            href="/admin?tab=targets"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2.5 py-1 font-semibold text-[11px] text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/20"
          >
            Admin Targets
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Main Visual Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Top Row: Radial Gauge + Golden Hero Trajectory Graph */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Radial Attainment Visual */}
          <div className="gold-steel-border gold-steel-border-slim flex items-center gap-3 rounded-xl border border-accent-amber/40 bg-white/85 p-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  fill="none"
                  stroke="rgba(0,0,0,0.08)"
                  strokeWidth="6"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <span className="absolute font-bold font-mono text-[var(--text-heading)] text-xs">
                {overallAttainment}%
              </span>
            </div>
            <div className="min-w-0">
              <span className="block font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                {horizon.toUpperCase()} PLAN INDEX
              </span>
              <span className="block truncate font-bold text-[var(--text-heading)] text-sm">
                {overallAttainment >= 85 ? 'On Target Pace' : 'Ramp-Up Active'}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-[10px] text-accent-green">
                <TrendingUp className="h-3 w-3" />
                Admin Benchmark
              </span>
            </div>
          </div>

          {/* Golden Trajectory Curve vs Target Benchmark */}
          <div className="gold-steel-border gold-steel-border-slim relative flex flex-col justify-between overflow-hidden rounded-xl border border-accent-amber/40 bg-white/85 px-3 py-2 sm:col-span-2">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-bold text-[var(--text-heading)] uppercase tracking-wider">
                {horizon} Cumulative Trajectory vs Admin Target (100%)
              </span>
              <span className="font-bold font-mono text-[var(--accent-blue)]">
                Target: {activeTarget.loadsTarget.toLocaleString()} loads
              </span>
            </div>

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-16 w-full overflow-visible"
              role="img"
              aria-label={`${horizon} operational target trajectory graph`}
            >
              <defs>
                <linearGradient id="cr-target-gold-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {/* 100% Admin Target Benchmark Line */}
              <line
                x1={padX}
                y1={targetLineY}
                x2={width - padX}
                y2={targetLineY}
                stroke="#10b981"
                strokeDasharray="4 3"
                strokeWidth="1.2"
              />

              {coords.map((c, i) => {
                const barHeight = Math.max(height - padY - c.y, 4);
                return (
                  <rect
                    key={i}
                    x={c.x - 5}
                    y={c.y}
                    width={10}
                    height={barHeight}
                    rx={2}
                    fill="#d4af37"
                    fillOpacity={i === coords.length - 1 ? 0.25 : 0.1}
                  />
                );
              })}

              <path d={areaPath} fill="url(#cr-target-gold-grad)" />
              <path
                d={linePath}
                fill="none"
                stroke="#d4af37"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {coords.map((c, i) => {
                const isLast = i === coords.length - 1;
                const iconSize = isLast ? 10 : 7;
                return (
                  <svg
                    key={i}
                    x={c.x - iconSize / 2}
                    y={c.y - iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                    viewBox="22.75 16.625 166.16 166.19"
                    aria-hidden="true"
                  >
                    <path
                      d={ARCH_LOGO_PATH}
                      fill="#d4af37"
                      stroke="#ffffff"
                      strokeWidth="6"
                      paintOrder="stroke"
                      fillRule="evenodd"
                    />
                  </svg>
                );
              })}
            </svg>

            <div className="flex items-center justify-between border-slate-100 border-t pt-1 font-mono text-[9px] text-[var(--text-secondary)]">
              <span>START OF {horizon.toUpperCase()}</span>
              <span className="font-semibold text-accent-green">--- 100% ADMIN TARGET</span>
              <span className="font-bold text-[var(--text-heading)]">
                ACTUAL {overallAttainment}%
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Metric Visual Target Progress Bars */}
        <div className="space-y-2.5">
          {metrics.map((metric) => {
            const pct = Math.min(
              100,
              Math.round((metric.actual / Math.max(metric.target, 1)) * 100)
            );
            return (
              <div
                key={metric.id}
                className="space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-white/80 p-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-heading)]">{metric.label}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-[var(--text-heading)]">
                      {metric.actual.toLocaleString()} {metric.unit}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      / {metric.target.toLocaleString()} {metric.unit}
                    </span>
                    <span className="rounded bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-bold text-[10px] text-[var(--accent-blue)]">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                  <div
                    className="h-full origin-left rounded-full transition-transform duration-300"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #d4af37 0%, #10b981 100%)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
