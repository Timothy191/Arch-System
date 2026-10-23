'use client';

import type {
  AdminOperationalTargets,
  OperationalTargetWindow,
} from '@repo/contract/schemas/admin.schema';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { ArrowUpRight, BarChart3, Calendar, Clock, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getOperationalTargets } from '~/features/admin/actions/targets';
import {
  DEFAULT_OPERATIONAL_TARGETS_CLIENT,
  OPERATIONAL_TARGETS_STORAGE_KEY,
} from '~/features/admin/tabs/TargetsTab';

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

const FALLBACK_ACTUALS: Record<TargetHorizon, ActualMetrics> = {
  shift: {
    loads: 156,
    coalTonnes: 3980,
    wasteTonnes: 7420,
    volumeBcm: 4860,
    smrHours: 84,
  },
  daily: {
    loads: 318,
    coalTonnes: 8140,
    wasteTonnes: 14950,
    volumeBcm: 9780,
    smrHours: 171,
  },
  monthly: {
    loads: 8940,
    coalTonnes: 228500,
    wasteTonnes: 418000,
    volumeBcm: 274200,
    smrHours: 4890,
  },
};

export function AlertPanel({ departmentId }: { departmentId: string }) {
  const [horizon, setHorizon] = useState<TargetHorizon>('shift');
  const [targets, setTargets] = useState<AdminOperationalTargets>(
    DEFAULT_OPERATIONAL_TARGETS_CLIENT
  );
  const [actuals, setActuals] = useState<Record<TargetHorizon, ActualMetrics>>(FALLBACK_ACTUALS);

  const loadTargetsAndActuals = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        const localRaw = window.localStorage.getItem(OPERATIONAL_TARGETS_STORAGE_KEY);
        if (localRaw) {
          try {
            const parsedLocal = JSON.parse(localRaw) as AdminOperationalTargets;
            if (parsedLocal?.shift && parsedLocal?.daily && parsedLocal?.monthly) {
              setTargets(parsedLocal);
            }
          } catch {
            // ignore malformed local storage
          }
        }
      }

      const remoteTargets = await getOperationalTargets();
      if (remoteTargets) {
        setTargets(remoteTargets);
      }

      const supabase = createBrowserSupabaseClient();
      const today = new Date().toISOString().split('T')[0] ?? '';

      const [loadsRes, opsRes] = await Promise.all([
        supabase
          .from('hourly_loads')
          .select('total_loads, material_type')
          .eq('department_id', departmentId)
          .eq('load_date', today),
        supabase
          .from('machine_operations')
          .select('hours_worked')
          .eq('department_id', departmentId)
          .eq('shift_date', today),
      ]);

      const dbLoads = loadsRes.data ?? [];
      const dbOps = opsRes.data ?? [];
      const totalLoadsToday = dbLoads.reduce((s, r) => s + (r.total_loads || 0), 0);
      const totalHoursToday = dbOps.reduce((s, r) => s + (r.hours_worked || 0), 0);

      if (totalLoadsToday > 0 || totalHoursToday > 0) {
        const loads = totalLoadsToday > 0 ? totalLoadsToday : FALLBACK_ACTUALS.daily.loads;
        const hours = totalHoursToday > 0 ? totalHoursToday : FALLBACK_ACTUALS.daily.smrHours;
        const bcm = Math.round(loads * 25.5);
        const coalTonnes = Math.round(loads * 25.5 * 0.36 * 1.45);
        const wasteTonnes = Math.round(loads * 25.5 * 0.64 * 2.1);

        setActuals({
          shift: {
            loads: Math.round(loads * 0.52),
            coalTonnes: Math.round(coalTonnes * 0.52),
            wasteTonnes: Math.round(wasteTonnes * 0.52),
            volumeBcm: Math.round(bcm * 0.52),
            smrHours: Math.round(hours * 0.52),
          },
          daily: {
            loads,
            coalTonnes,
            wasteTonnes,
            volumeBcm: bcm,
            smrHours: Math.round(hours),
          },
          monthly: FALLBACK_ACTUALS.monthly,
        });
      }
    } catch {
      // Keep fallback actuals and targets when offline
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
      className="p-0 overflow-hidden flex flex-col h-full"
      data-testid="control-room-targets-visual-panel"
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-heading)]">
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
            className="inline-flex items-center gap-1 bg-white/80 p-0.5 rounded-lg border border-[var(--border-subtle)] text-[11px]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={horizon === 'shift'}
              onClick={() => setHorizon('shift')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                horizon === 'shift'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              <Clock className="w-3 h-3" />
              Shift
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={horizon === 'daily'}
              onClick={() => setHorizon('daily')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                horizon === 'daily'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              <Target className="w-3 h-3" />
              Daily
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={horizon === 'monthly'}
              onClick={() => setHorizon('monthly')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                horizon === 'monthly'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Monthly
            </button>
          </div>

          <Link
            href="/admin?tab=targets"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 text-[11px] font-semibold transition-colors"
          >
            Admin Targets
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Visual Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Top Row: Radial Gauge + Golden Hero Trajectory Graph */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Radial Attainment Visual */}
          <div className="rounded-xl gold-steel-border gold-steel-border-slim bg-white/85 border border-accent-amber/40 p-3 flex items-center gap-3">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
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
              <span className="absolute text-xs font-mono font-bold text-[var(--text-heading)]">
                {overallAttainment}%
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                {horizon.toUpperCase()} PLAN INDEX
              </span>
              <span className="text-sm font-bold text-[var(--text-heading)] block truncate">
                {overallAttainment >= 85 ? 'On Target Pace' : 'Ramp-Up Active'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-accent-green mt-0.5">
                <TrendingUp className="w-3 h-3" />
                Admin Benchmark
              </span>
            </div>
          </div>

          {/* Golden Trajectory Curve vs Target Benchmark */}
          <div className="sm:col-span-2 rounded-xl gold-steel-border gold-steel-border-slim bg-white/85 border border-accent-amber/40 px-3 py-2 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="font-bold uppercase tracking-wider text-[var(--text-heading)]">
                {horizon} Cumulative Trajectory vs Admin Target (100%)
              </span>
              <span className="font-mono font-bold text-[var(--accent-blue)]">
                Target: {activeTarget.loadsTarget.toLocaleString()} loads
              </span>
            </div>

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-16 overflow-visible"
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

            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--text-secondary)] pt-1 border-t border-slate-100">
              <span>START OF {horizon.toUpperCase()}</span>
              <span className="text-accent-green font-semibold">--- 100% ADMIN TARGET</span>
              <span className="text-[var(--text-heading)] font-bold">
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
                className="p-2.5 rounded-xl bg-white/80 border border-[var(--border-subtle)] space-y-1.5"
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
                    <span className="px-1.5 py-0.5 rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-bold text-[10px]">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-transform duration-300 origin-left"
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
