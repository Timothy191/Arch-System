'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, Flame, Gauge, PieChart, Scale, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { PlantHourlyRow } from './types';

export interface PlantHourlyTotals {
  totalRom: number;
  totalClean: number;
  totalDiscard: number;
  weightedYield: number;
  discardPct: number;
  avgAsh: number;
  avgRd: number;
  avgMoisture: number;
  totalRunMins: number;
  runHours: number;
  avgTph: number;
  latestHourRom: number;
  latestHourSlot: string;
  latestHourRd: number;
  nominalRomTph: number;
  romCapacityPct: number;
  priorShiftTph: number;
  throughputDeltaPct: number;
  peakHourRom: number;
}

interface PlantHourlyRollupSectionProps {
  rows: PlantHourlyRow[];
  totals: PlantHourlyTotals;
}

export function PlantHourlyRollupSection({ rows, totals }: PlantHourlyRollupSectionProps) {
  const recoveryDelta = Number((totals.weightedYield - 90.0).toFixed(1));
  const densityDelta = Number((totals.avgRd - 1.48).toFixed(2));

  // SVG Pulse Graph coordinates (Card 5) — Alternative Paired-Column & Smooth Spline Matrix Design
  const pulseChartGeometry = useMemo(() => {
    const width = 580;
    const height = 164;
    const padLeft = 38;
    const padRight = 14;
    const padTop = 18;
    const padBottom = 26;
    const usableW = width - padLeft - padRight;
    const usableH = height - padTop - padBottom;
    const minVal = 330;
    const maxVal = Math.max(510, totals.peakHourRom + 20);

    const toY = (val: number) => {
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const y = padTop + usableH - ((clamped - minVal) / (maxVal - minVal)) * usableH;
      return Number(y.toFixed(1));
    };

    const slotStep = usableW / Math.max(1, rows.length);
    const bars = rows.map((r, idx) => {
      const centerX = Number((padLeft + idx * slotStep + slotStep / 2).toFixed(1));
      const romY = toY(r.romFeedTonnes);
      const cleanY = toY(r.cleanCoalTonnes);
      const baselineY = padTop + usableH;
      return {
        hourLabel: r.hourSlot.split(' - ')[0] ?? `${idx + 6}:00`,
        centerX,
        romY,
        romH: Number(Math.max(4, baselineY - romY).toFixed(1)),
        cleanY,
        cleanH: Number(Math.max(4, baselineY - cleanY).toFixed(1)),
        romVal: r.romFeedTonnes,
        cleanVal: r.cleanCoalTonnes,
        yieldPct: r.yieldPct,
      };
    });

    // Smooth cubic bezier curve through ROM feed tops
    const smoothRomPath = bars
      .map((b, i) => {
        if (i === 0) return `M${b.centerX},${b.romY}`;
        const prev = bars[i - 1]!;
        const cpx = Number(((prev.centerX + b.centerX) / 2).toFixed(1));
        return `C${cpx},${prev.romY} ${cpx},${b.romY} ${b.centerX},${b.romY}`;
      })
      .join(' ');

    const priorY = toY(totals.priorShiftTph);
    const gridLevels = [500, 450, 400, 350].map((v) => ({
      val: v,
      y: toY(v),
    }));

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      baselineY: padTop + usableH,
      bars,
      smoothRomPath,
      priorY,
      gridLevels,
    };
  }, [rows, totals.peakHourRom, totals.priorShiftTph]);

  // SVG Pie / Donut Chart geometry for Production Mix (Card 6)
  const pieGeometry = useMemo(() => {
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    const recoveryFraction = Math.max(0, Math.min(1, totals.weightedYield / 100));
    const productArc = Number((recoveryFraction * circumference).toFixed(2));
    const discardArc = Number(((1 - recoveryFraction) * circumference).toFixed(2));
    return {
      radius,
      circumference: Number(circumference.toFixed(2)),
      productArc,
      discardArc,
    };
  }, [totals.weightedYield]);

  return (
    <>
      {/* ── 4 Primary Plant Telemetry GlassCards (ROM Scale, Product Yield, Product Ash, Running Density) ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: ROM Scale (t/latest hour + graphs and visuals) */}
        <GlassCard className="space-y-3 p-5" data-testid="card-rom-scale">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <Scale className="h-3.5 w-3.5 text-emerald-600" />
              ROM Scale (t / Latest Hour)
            </span>
            <Badge className="gold-steel-border gold-steel-border-slim border border-emerald-500/30 bg-emerald-500/15 font-mono text-emerald-700 text-xs">
              {totals.romCapacityPct}% of {totals.nominalRomTph} t/h
            </Badge>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {totals.latestHourRom.toLocaleString()} t/hr
              </p>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Shift Σ:{' '}
                <strong className="text-[var(--text-heading)]">
                  {totals.totalRom.toLocaleString()} t
                </strong>{' '}
                · Slot: {totals.latestHourSlot.split(' - ')[0]}
              </p>
            </div>

            {/* Mini 12-Hour ROM Scale Bar Graph Visual */}
            <svg
              viewBox="0 0 120 34"
              className="h-9 w-28 shrink-0 overflow-visible"
              aria-label="ROM Scale 12-hour mini bar graph"
            >
              {rows.map((r, idx) => {
                const barH = Math.max(4, Math.min(30, Math.round((r.romFeedTonnes / 520) * 30)));
                const x = idx * 9.8 + 2;
                const y = 32 - barH;
                const isLatest = idx === rows.length - 1;
                return (
                  <rect
                    key={r.hourSlot}
                    x={x}
                    y={y}
                    width={6.8}
                    height={barH}
                    rx={1.5}
                    className={isLatest ? 'fill-emerald-600' : 'fill-emerald-500/45'}
                  />
                );
              })}
            </svg>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, totals.romCapacityPct)}%` }}
            />
          </div>

          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            Avg Run-Rate: {totals.avgTph.toLocaleString()} t/hr · Peak: {totals.peakHourRom} t/hr
          </p>
        </GlassCard>

        {/* Card 2: Product Yield (% Recovery) */}
        <GlassCard className="space-y-3 p-5" data-testid="card-product-yield">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
              Product Yield (% Recovery)
            </span>
            <Badge className="gold-steel-border gold-steel-border-slim border border-blue-500/30 bg-blue-500/15 font-mono text-blue-700 text-xs">
              {recoveryDelta >= 0 ? `+${recoveryDelta}%` : `${recoveryDelta}%`} vs Target
            </Badge>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {totals.weightedYield.toFixed(1)}% Recovery
              </p>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Target: <strong className="text-[var(--text-heading)]">90.0%</strong> · Clean:{' '}
                {totals.totalClean.toLocaleString()} t
              </p>
            </div>

            {/* Mini Recovery Sparkline */}
            <svg
              viewBox="0 0 110 32"
              className="h-8 w-24 shrink-0"
              aria-label="Product Yield recovery trend sparkline"
            >
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rows
                  .map((r, i) => {
                    const x = (i / Math.max(1, rows.length - 1)) * 102 + 4;
                    const y = 28 - Math.max(0, Math.min(24, ((r.yieldPct - 75) / 25) * 24));
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, totals.weightedYield)}%` }}
            />
          </div>

          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            Clean Product: {totals.totalClean.toLocaleString()} t · Discard:{' '}
            {totals.totalDiscard.toLocaleString()} t
          </p>
        </GlassCard>

        {/* Card 3: Product Ash (% ADB) */}
        <GlassCard className="space-y-3 p-5" data-testid="card-product-ash">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <Flame className="h-3.5 w-3.5 text-indigo-600" />
              Product Ash (% ADB)
            </span>
            <Badge
              variant="outline"
              className={`gold-steel-border gold-steel-border-slim font-mono text-xs ${
                totals.avgAsh <= 15.0
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700'
                  : 'border-red-500/30 bg-red-500/15 text-red-700'
              }`}
            >
              Spec ≤ 15.0% Ash
            </Badge>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {totals.avgAsh.toFixed(1)}% Ash
              </p>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Raw Feed Ash: <strong className="text-[var(--text-heading)]">28.4%</strong> ·
                Moisture: {totals.avgMoisture.toFixed(1)}%
              </p>
            </div>

            {/* Mini Ash Profile Bars */}
            <svg
              viewBox="0 0 110 32"
              className="h-8 w-24 shrink-0"
              aria-label="Product Ash hourly quality profile"
            >
              {rows.map((r, i) => {
                const ash = r.productAshPct || 14.0;
                const h = Math.max(5, Math.min(28, Math.round(((ash - 10) / 8) * 28)));
                return (
                  <rect
                    key={r.hourSlot}
                    x={i * 8.8 + 2}
                    y={30 - h}
                    width={6}
                    height={h}
                    rx={1.5}
                    className={ash <= 15.0 ? 'fill-indigo-500/65' : 'fill-red-500/75'}
                  />
                );
              })}
            </svg>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(100, Math.round((totals.avgAsh / 20) * 100))}%` }}
            />
          </div>

          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            Ash Reduction: -{(28.4 - totals.avgAsh).toFixed(1)}% pts via DMS Cyclones
          </p>
        </GlassCard>

        {/* Card 4: Running Density (DMS RD g/cm³) */}
        <GlassCard className="space-y-3 p-5" data-testid="card-running-density">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <Gauge className="h-3.5 w-3.5 text-amber-600" />
              Running Density
            </span>
            <Badge
              variant="outline"
              className="gold-steel-border gold-steel-border-slim border-amber-500/30 bg-amber-500/15 font-mono text-amber-800 text-xs"
            >
              Setpoint: 1.48 g/cm³
            </Badge>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {totals.avgRd.toFixed(2)} g/cm³
              </p>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Latest Hour:{' '}
                <strong className="text-[var(--text-heading)]">
                  {totals.latestHourRd.toFixed(2)} g/cm³
                </strong>{' '}
                · Drift: {densityDelta >= 0 ? `+${densityDelta}` : densityDelta}
              </p>
            </div>

            {/* Mini Running Density Trace */}
            <svg
              viewBox="0 0 110 32"
              className="h-8 w-24 shrink-0"
              aria-label="Running Density hourly trace"
            >
              <line
                x1="2"
                y1="16"
                x2="108"
                y2="16"
                stroke="#d97706"
                strokeDasharray="3 2"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                stroke="#b45309"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rows
                  .map((r, i) => {
                    const x = (i / Math.max(1, rows.length - 1)) * 102 + 4;
                    const y = 16 - (r.cycloneRd - 1.48) * 180;
                    return `${x.toFixed(1)},${Math.max(4, Math.min(28, y)).toFixed(1)}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>

          <div className="flex items-center justify-between border-[var(--border-subtle)] border-t pt-1 text-xs">
            <span className="text-[var(--text-muted)]">Plant Operating Hours:</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {totals.runHours} / 12.0 hrs ({totals.totalRunMins} min)
            </span>
          </div>
        </GlassCard>
      </div>

      {/* ── Row 2: Live Production Pulse Graph (lg:col-span-7) & Production Mix Pie Chart (lg:col-span-5) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Card 5: Live Production Pulse Graph (Current throughput t/h + % vs prior shift) */}
        <GlassCard
          className="flex flex-col gap-3 p-5 lg:col-span-7"
          data-testid="card-live-production-pulse"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <Activity className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                Live Production Pulse Graph — Current Throughput (t/h)
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Hourly ROM belt scale feed vs. washed clean coal output across active shift windows
              </p>
            </div>

            <div className="-mt-1 flex items-center gap-2 self-start">
              <span
                className={`gold-steel-border gold-steel-border-slim rounded-full border px-2.5 py-1 font-bold font-mono text-xs ${
                  totals.throughputDeltaPct >= 0
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
                    : 'border-amber-500/30 bg-amber-500/15 text-amber-800'
                }`}
              >
                {totals.throughputDeltaPct >= 0
                  ? `+${totals.throughputDeltaPct}% vs Prior Shift`
                  : `${totals.throughputDeltaPct}% vs Prior Shift`}
              </span>
            </div>
          </div>

          {/* Alternative Design: Paired Hourly Column & Smooth Pulse Spline Telemetry Matrix */}
          <div className="gold-steel-border gold-steel-border-slim relative space-y-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/70 p-3.5 shadow-xs">
            {/* Top Legend & Benchmark Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-b pb-2 font-mono text-[10px]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                  ROM Throughput (t/h)
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-800">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-blue-600" />
                  Clean Coal (t/h)
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                  <span className="inline-block h-0 w-3 border-amber-600 border-t-2 border-dashed" />
                  Prior Shift Avg: {totals.priorShiftTph} t/h
                </span>
              </div>
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-0.5 font-semibold text-[var(--text-secondary)]">
                Peak: {totals.peakHourRom} t/h
              </span>
            </div>

            {/* Paired Hourly Columns + Cubic Bezier Pulse Spline SVG */}
            <svg
              viewBox={`0 0 ${pulseChartGeometry.width} ${pulseChartGeometry.height}`}
              className="h-40 w-full overflow-visible"
              role="img"
              aria-label="Live Production Pulse Graph showing hourly throughput in tonnes per hour"
            >
              <defs>
                <linearGradient id="romColGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.38" />
                </linearGradient>
                <linearGradient id="cleanColGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.38" />
                </linearGradient>
              </defs>

              {/* Horizontal Y-Axis Gridlines & Labels */}
              {pulseChartGeometry.gridLevels.map((lvl) => (
                <g key={lvl.val}>
                  <line
                    x1={pulseChartGeometry.padLeft}
                    y1={lvl.y}
                    x2={pulseChartGeometry.width - pulseChartGeometry.padRight}
                    y2={lvl.y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeWidth="1"
                  />
                  <text
                    x={pulseChartGeometry.padLeft - 6}
                    y={lvl.y + 3}
                    textAnchor="end"
                    className="fill-[var(--text-muted)] font-mono text-[9px]"
                  >
                    {lvl.val}
                  </text>
                </g>
              ))}

              {/* Paired Hourly Columns (ROM Feed + Clean Coal) */}
              {pulseChartGeometry.bars.map((b, idx) => {
                const isLatest = idx === pulseChartGeometry.bars.length - 1;
                return (
                  <g key={b.hourLabel}>
                    {/* Subtle slot hover/active column backdrop */}
                    {isLatest && (
                      <rect
                        x={b.centerX - 15}
                        y={pulseChartGeometry.padTop - 4}
                        width={30}
                        height={pulseChartGeometry.baselineY - pulseChartGeometry.padTop + 6}
                        rx={5}
                        className="fill-emerald-500/8 stroke-emerald-500/25"
                        strokeWidth="1"
                      />
                    )}
                    {/* ROM Feed Bar */}
                    <rect
                      x={b.centerX - 10.5}
                      y={b.romY}
                      width={9.5}
                      height={b.romH}
                      rx={2.5}
                      fill="url(#romColGrad)"
                    />
                    {/* Clean Coal Bar */}
                    <rect
                      x={b.centerX + 1}
                      y={b.cleanY}
                      width={9.5}
                      height={b.cleanH}
                      rx={2.5}
                      fill="url(#cleanColGrad)"
                    />
                    {/* X-Axis Hour Label */}
                    <text
                      x={b.centerX}
                      y={pulseChartGeometry.baselineY + 15}
                      textAnchor="middle"
                      className={`font-mono text-[9px] ${
                        isLatest ? 'fill-emerald-700 font-bold' : 'fill-[var(--text-muted)]'
                      }`}
                    >
                      {b.hourLabel}
                    </text>
                  </g>
                );
              })}

              {/* Prior Shift Average Benchmark Dashed Line */}
              <line
                x1={pulseChartGeometry.padLeft}
                y1={pulseChartGeometry.priorY}
                x2={pulseChartGeometry.width - pulseChartGeometry.padRight}
                y2={pulseChartGeometry.priorY}
                stroke="#d97706"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />

              {/* Smooth Cubic Bezier ROM Pulse Trend Line + Nodes */}
              <path
                d={pulseChartGeometry.smoothRomPath}
                fill="none"
                stroke="#047857"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {pulseChartGeometry.bars.map((b, idx) => {
                const isLatest = idx === pulseChartGeometry.bars.length - 1;
                return (
                  <circle
                    key={`node-${b.hourLabel}`}
                    cx={b.centerX - 5.75}
                    cy={b.romY}
                    r={isLatest ? 3.8 : 2.2}
                    className={
                      isLatest ? 'fill-emerald-600 stroke-2 stroke-white' : 'fill-emerald-700'
                    }
                  />
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-0.5 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                Current Throughput
              </p>
              <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)]">
                {totals.avgTph.toLocaleString()} t/h
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                Latest Hour Scale
              </p>
              <p className="mt-0.5 font-bold font-mono text-emerald-700">
                {totals.latestHourRom.toLocaleString()} t/h
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                Prior Shift Avg
              </p>
              <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)]">
                {totals.priorShiftTph.toLocaleString()} t/h
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                vs Prior Shift
              </p>
              <p
                className={`mt-0.5 font-bold font-mono ${
                  totals.throughputDeltaPct >= 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {totals.throughputDeltaPct >= 0
                  ? `+${totals.throughputDeltaPct}%`
                  : `${totals.throughputDeltaPct}%`}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Card 6: Production Mix (Pie Chart with Product, Discard, Recovery) */}
        <GlassCard
          className="flex flex-col justify-between gap-4 p-5 lg:col-span-5"
          data-testid="card-production-mix"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <PieChart className="h-3.5 w-3.5 text-emerald-600" />
                Production Mix — Product, Discard &amp; Recovery
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Wash plant mass-balance split across Clean Product, Rejects Discard, and % Recovery
              </p>
            </div>
            <Badge className="gold-steel-border gold-steel-border-slim border border-emerald-500/30 bg-emerald-500/15 font-mono text-emerald-800 text-xs">
              {totals.weightedYield.toFixed(1)}% Recovery
            </Badge>
          </div>

          {/* Pie Chart + Mass Balance Breakdown */}
          <div className="my-auto flex flex-col items-center gap-5 py-1 sm:flex-row">
            {/* SVG Donut / Pie Chart */}
            <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
              <svg
                viewBox="0 0 110 110"
                className="h-32 w-32 -rotate-90"
                role="img"
                aria-label={`Production Mix Pie Chart: Product ${totals.weightedYield.toFixed(1)}%, Discard ${totals.discardPct.toFixed(1)}%`}
              >
                {/* Background / Discard Ring */}
                <circle
                  cx="55"
                  cy="55"
                  r={pieGeometry.radius}
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="16"
                />
                {/* Foreground / Clean Coal Product Slice */}
                <circle
                  cx="55"
                  cy="55"
                  r={pieGeometry.radius}
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="16"
                  strokeDasharray={`${pieGeometry.productArc} ${pieGeometry.circumference}`}
                  strokeLinecap="butt"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Recovery
                </span>
                <span className="font-bold font-mono text-[var(--text-heading)] text-base">
                  {totals.weightedYield.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Product / Discard / Recovery Breakdown Pills */}
            <div className="w-full flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-[var(--text-heading)]">
                    Product (Clean Coal)
                  </span>
                </div>
                <span className="font-bold font-mono text-emerald-700">
                  {totals.totalClean.toLocaleString()} t ({totals.weightedYield.toFixed(1)}%)
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="font-semibold text-[var(--text-heading)]">
                    Discard (Rejects)
                  </span>
                </div>
                <span className="font-bold font-mono text-amber-800">
                  {totals.totalDiscard.toLocaleString()} t ({totals.discardPct.toFixed(1)}%)
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
                  <span className="font-semibold text-[var(--text-heading)]">Recovery Yield</span>
                </div>
                <span className="font-bold font-mono text-blue-700">
                  {totals.weightedYield.toFixed(1)}% (Ash {totals.avgAsh.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-[var(--border-subtle)] border-t pt-1">
            <Link
              className="rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-medium text-white text-xs transition-all hover:bg-[var(--accent-blue)]/90"
              href="/plant-processing/hourly-sheet"
            >
              + Open Hourly Sheet
            </Link>
            <Link
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all"
              href="/plant-processing/delays"
            >
              Log Plant Delays
            </Link>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
