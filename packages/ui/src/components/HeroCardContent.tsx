'use client';

import { Activity, AlertTriangle, Power, TrendingUp, Wrench } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { cn } from '../lib/utils';
import type { Panel } from './hero-types';
import { Logo } from './Logo';

interface HeroTelemetrySeries {
  title: string;
  unit: string;
  currentValue: string;
  deltaBadge: string;
  peakValue: string;
  avgValue: string;
  strokeColor: string;
  fillId: string;
  points: number[];
}

function getHeroTelemetrySeries(
  panelName: string,
  stats?: { label: string; value: string }
): HeroTelemetrySeries {
  // System Gold Branding: #d4af37 (rich metallic gold) for all hero card telemetry graphs
  const goldStroke = '#d4af37';

  switch (panelName) {
    case 'admin':
      return {
        title: 'RBAC & Governance Throughput',
        unit: 'ops/min',
        currentValue: stats?.value || '249 ops/m',
        deltaBadge: '+12.4% Efficiency',
        peakValue: '264',
        avgValue: '245',
        strokeColor: goldStroke,
        fillId: 'grad-admin',
        points: [62, 68, 65, 74, 79, 83, 80, 88, 92, 89, 95, 98],
      };
    case 'control-room':
      return {
        title: 'SCADA Hourly Load Velocity',
        unit: 'loads/hr',
        currentValue: stats?.value || '384 Loads',
        deltaBadge: '+9.2% Shift Target',
        peakValue: '42/h',
        avgValue: '34/h',
        strokeColor: goldStroke,
        fillId: 'grad-control-room',
        points: [54, 62, 70, 66, 78, 84, 81, 89, 93, 87, 94, 97],
      };
    case 'access-control':
      return {
        title: 'Site Gate & Muster Telemetry',
        unit: 'personnel',
        currentValue: stats?.value || '142 On-Site',
        deltaBadge: '99.8% Gate SLA',
        peakValue: '156',
        avgValue: '139',
        strokeColor: goldStroke,
        fillId: 'grad-access-control',
        points: [48, 58, 72, 84, 88, 91, 89, 93, 95, 92, 94, 96],
      };
    case 'production':
      return {
        title: 'Coal & ROM Extraction Yield',
        unit: 'tonnes/hr',
        currentValue: stats?.value || '85% Yield',
        deltaBadge: '+6.8% vs Plan',
        peakValue: '1,420t',
        avgValue: '1,180t',
        strokeColor: goldStroke,
        fillId: 'grad-production',
        points: [58, 64, 61, 70, 75, 73, 82, 85, 88, 91, 89, 95],
      };
    case 'plant-processing':
      return {
        title: 'Wash Plant Throughput & Recovery',
        unit: 'tonnes/hr',
        currentValue: stats?.value || '91.4% Yield',
        deltaBadge: '+5.4% Recovery',
        peakValue: '94.2%',
        avgValue: '90.8%',
        strokeColor: goldStroke,
        fillId: 'grad-plant-processing',
        points: [64, 68, 71, 75, 78, 82, 80, 86, 89, 91, 93, 96],
      };
    case 'plant-inventory':
      return {
        title: 'Stockpile & Medium Inventory',
        unit: 'tonnes',
        currentValue: stats?.value || '48,200t',
        deltaBadge: '+3.8% Stock Buffer',
        peakValue: '51,400t',
        avgValue: '46,150t',
        strokeColor: goldStroke,
        fillId: 'grad-plant-inventory',
        points: [62, 66, 70, 73, 77, 81, 84, 88, 90, 92, 95, 97],
      };
    case 'drilling':
      return {
        title: 'Rig Penetration & Bit Depth',
        unit: 'meters',
        currentValue: stats?.value || '1,240m',
        deltaBadge: '+14.1% ROP',
        peakValue: '58m/h',
        avgValue: '49m/h',
        strokeColor: goldStroke,
        fillId: 'grad-drilling',
        points: [50, 55, 63, 68, 72, 77, 74, 83, 87, 90, 93, 97],
      };
    case 'engineering':
      return {
        title: 'Fleet Mechanical Availability',
        unit: 'uptime %',
        currentValue: stats?.value || '98% Ready',
        deltaBadge: 'MTBF +18.5%',
        peakValue: '99.2%',
        avgValue: '96.8%',
        strokeColor: goldStroke,
        fillId: 'grad-engineering',
        points: [76, 79, 75, 82, 85, 88, 86, 90, 92, 94, 95, 98],
      };
    case 'overview':
      return {
        title: 'Federation & Edge Node Health',
        unit: 'score',
        currentValue: stats?.value || '100% Optimal',
        deltaBadge: '0.42ms L1 p95',
        peakValue: '100%',
        avgValue: '99.9%',
        strokeColor: goldStroke,
        fillId: 'grad-overview',
        points: [82, 85, 87, 89, 91, 93, 94, 96, 97, 98, 99, 100],
      };
    case 'database':
      return {
        title: 'PostgreSQL 17 Query Throughput',
        unit: 'queries/s',
        currentValue: stats?.value || '342 qps',
        deltaBadge: '18ms Avg RTT',
        peakValue: '410/s',
        avgValue: '328/s',
        strokeColor: goldStroke,
        fillId: 'grad-database',
        points: [60, 66, 71, 68, 75, 80, 78, 85, 88, 92, 90, 96],
      };
    case 'availability-utilization':
    case 'reports':
      return {
        title: 'Fleet Availability & Utilization',
        unit: 'utilization',
        currentValue: stats?.value || '94.6% Util',
        deltaBadge: '+4.3% Shift OEE',
        peakValue: '98.1%',
        avgValue: '93.4%',
        strokeColor: goldStroke,
        fillId: 'grad-reports',
        points: [64, 69, 73, 76, 80, 84, 82, 88, 91, 93, 95, 97],
      };
    default:
      return {
        title: 'Central Operations Telemetry',
        unit: 'index',
        currentValue: stats?.value || '100% Optimal',
        deltaBadge: '+88% Cache Hit',
        peakValue: '99.95%',
        avgValue: '98.7%',
        strokeColor: goldStroke,
        fillId: `grad-${panelName || 'default'}`,
        points: [56, 63, 68, 72, 76, 81, 79, 86, 90, 93, 96, 99],
      };
  }
}

function HeroTelemetryGraph({
  panelName,
  stats,
}: {
  panelName: string;
  stats?: { label: string; value: string };
}) {
  const series = getHeroTelemetrySeries(panelName, stats);
  const width = 360;
  const height = 68;
  const padX = 6;
  const padY = 8;
  const minVal = Math.min(...series.points) - 8;
  const maxVal = Math.max(...series.points) + 4;
  const range = Math.max(maxVal - minVal, 1);

  const coords = series.points.map((pt, i) => {
    const x = padX + (i / (series.points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((pt - minVal) / range) * (height - padY * 2);
    return { x, y, val: pt };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const firstX = (coords[0]?.x ?? padX).toFixed(1);
  const lastX = (coords[coords.length - 1]?.x ?? width - padX).toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;

  return (
    <div
      className="mt-auto border-slate-200/70 border-t pt-2.5"
      data-testid={`hero-telemetry-graph-${panelName}`}
    >
      <div
        className="gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-xl border border-accent-amber/40 bg-white/85 px-3 py-2 shadow-2xs backdrop-blur-md"
        data-testid={`hero-telemetry-box-${panelName}`}
      >
        <div className="relative z-10 mb-1 flex items-center justify-between gap-2 border-slate-100/90 border-b pb-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-green"
              aria-hidden="true"
            />
            <h3
              className="truncate font-anurati font-bold text-[var(--text-heading)] text-xs uppercase leading-snug tracking-wider sm:text-sm"
              style={{
                fontFamily:
                  "var(--font-outfit), var(--font-sans), 'IBM Plex Sans', system-ui, sans-serif",
              }}
            >
              {series.title}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-emerald-700">
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
              {series.deltaBadge}
            </span>
            <span className="hidden items-center rounded-full border border-slate-300/60 bg-slate-900/5 px-1.5 py-0.5 font-bold font-mono text-[9px] text-slate-800 tabular-nums sm:inline-flex">
              {series.currentValue}
            </span>
          </div>
        </div>

        {/* Animated scanline effect */}
        <div
          className="pointer-events-none absolute inset-0 animate-scanline opacity-30"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(212,175,55,0.1) 50%, transparent 100%)',
          }}
        />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="relative z-10 h-14 w-full overflow-visible"
          role="img"
          aria-label={`${series.title} telemetry trend graph`}
        >
          <defs>
            <linearGradient id={series.fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.strokeColor} stopOpacity="0.32" />
              <stop offset="100%" stopColor={series.strokeColor} stopOpacity="0.02" />
            </linearGradient>
            {/* Glow filter for neon effect */}
            <filter id={`glow-${series.fillId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle horizontal reference grid lines */}
          <line
            x1={padX}
            y1={height * 0.25}
            x2={width - padX}
            y2={height * 0.25}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />
          <line
            x1={padX}
            y1={height * 0.6}
            x2={width - padX}
            y2={height * 0.6}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />

          {/* Animated background telemetry bars */}
          {coords.map((c, i) => {
            const barHeight = Math.max(height - padY - c.y, 4);
            return (
              <rect
                key={i}
                x={c.x - 4}
                y={c.y}
                width={8}
                height={barHeight}
                rx={2}
                fill={series.strokeColor}
                fillOpacity={i === coords.length - 1 ? 0.22 : 0.08}
                className={i === coords.length - 1 ? 'motion-safe:animate-pulse' : ''}
                style={{
                  animationDuration: '2s',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            );
          })}

          {/* Shaded area under curve */}
          <path
            d={areaPath}
            fill={`url(#${series.fillId})`}
            className="motion-safe:animate-telemetry-fade-in"
          />

          {/* Smooth telemetry polyline with glow and draw animation */}
          <path
            d={linePath}
            fill="none"
            stroke={series.strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${series.fillId})`}
            className="motion-safe:animate-draw-line"
          />

          {/* Data nodes: Small Arch-System logo icons with pulse */}
          {coords.map((c, i) => {
            const isLast = i === coords.length - 1;
            const iconSize = isLast ? 11 : 8;
            return (
              <svg
                key={i}
                x={c.x - iconSize / 2}
                y={c.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                viewBox="22.75 16.625 166.16 166.19"
                aria-hidden="true"
                data-testid="hero-graph-arch-node"
                className={isLast ? 'motion-safe:animate-pulse' : ''}
                style={{
                  animationDuration: '1.5s',
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                <path
                  d="m 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z"
                  fill={series.strokeColor}
                  fillOpacity={isLast ? 1 : 0.9}
                  stroke="#ffffff"
                  strokeWidth="6"
                  paintOrder="stroke"
                  fillRule="evenodd"
                />
              </svg>
            );
          })}
        </svg>

        <div className="relative z-10 flex items-center justify-between border-slate-100 border-t pt-1 font-mono text-[9px] text-slate-500 tabular-nums">
          <span>00:00 SHIFT START</span>
          <span>AVG {series.avgValue}</span>
          <span>PEAK {series.peakValue}</span>
          <span className="font-semibold text-emerald-700 motion-safe:animate-pulse">
            LIVE · NOW
          </span>
        </div>
      </div>
    </div>
  );
}

export interface HeroKpiTile {
  label: string;
  value: string;
  subtext: string;
}

export function getHeroKpiTiles(
  panelName: string
): readonly [HeroKpiTile, HeroKpiTile, HeroKpiTile] {
  switch (panelName) {
    case 'plant-inventory':
      return [
        { label: 'Equipment Units', value: '7 Tracked', subtext: 'CR · SC · DM · TH' },
        { label: 'Par Compliance', value: '87.5%', subtext: '14.2d Autonomy' },
        { label: 'Replenish Queue', value: '4 Lines', subtext: 'Active Reorder' },
      ];
    case 'plant-processing':
      return [
        { label: 'Feed Rate', value: '1,140 t/h', subtext: 'DMC Module A/B' },
        { label: 'Clean Yield', value: '91.4%', subtext: 'CV 27.4 MJ/kg' },
        { label: 'Medium Density', value: '1.48 SG', subtext: 'Silo 1 & 2 Nominal' },
      ];
    case 'production':
      return [
        { label: 'ROM Tonnage', value: '12,480 t', subtext: 'Shift Cumulative' },
        { label: 'Haul Fleet', value: '18 / 19', subtext: '94.7% Active' },
        { label: 'Strip Ratio', value: '2.8 : 1', subtext: 'Within Plan' },
      ];
    case 'drilling':
      return [
        { label: 'Active Rigs', value: '6 / 6', subtext: 'Pit Viper 351' },
        { label: 'Penetration', value: '52.4 m/h', subtext: '+14.1% ROP' },
        { label: 'Blast Pattern', value: 'Pattern B-14', subtext: '92% Drilled' },
      ];
    case 'admin':
      return [
        { label: 'Active Operators', value: '124 Users', subtext: 'RBAC Enforced' },
        { label: 'RLS Matrix', value: '100%', subtext: 'Zero Policy Drift' },
        { label: 'Audit Ledger', value: 'Live CDC', subtext: 'Tamper-Proof' },
      ];
    case 'access-control':
      return [
        { label: 'Site Muster', value: '142 Crew', subtext: 'Biometric Verified' },
        { label: 'Gate SLA', value: '99.8%', subtext: 'Gates 1–4 Active' },
        { label: 'Clearance', value: '100% Valid', subtext: '0 Holds' },
      ];
    case 'engineering':
      return [
        { label: 'Availability', value: '98.0%', subtext: 'MTBF 142h' },
        { label: 'Work Orders', value: '3 Open', subtext: '0 Critical' },
        { label: 'PM Schedule', value: '99.1%', subtext: 'On Target' },
      ];
    case 'control-room':
      return [
        { label: 'Hourly Loads', value: '384 Loads', subtext: '+9.2% Shift Plan' },
        { label: 'SCADA Tags', value: '1,240 Live', subtext: 'Modbus TCP' },
        { label: 'Dispatch Sync', value: '0.4 ms', subtext: 'Realtime CDC' },
      ];
    case 'overview':
      return [
        { label: 'Edge Cache', value: '0.42 ms', subtext: 'Redis L1/L2' },
        { label: 'Uptime SLA', value: '99.98%', subtext: '30d Rolling' },
        { label: 'Tri-State Sync', value: '100% Parity', subtext: 'Zero Drift' },
      ];
    case 'database':
      return [
        { label: 'Schema State', value: '142 Applied', subtext: 'PostgreSQL 17' },
        { label: 'Replica RTT', value: '18 ms', subtext: 'Pool Healthy' },
        { label: 'WAL Stream', value: 'Active', subtext: 'Realtime CDC' },
      ];
    case 'availability-utilization':
    case 'reports':
      return [
        { label: 'Availability', value: '96.2%', subtext: 'Fleet Mean' },
        { label: 'Utilization', value: '94.6%', subtext: '+4.3% OEE' },
        { label: 'Closeout SLA', value: '100%', subtext: 'Shift Verified' },
      ];
    default:
      return [
        { label: 'Active Modules', value: '11 / 11', subtext: 'All Systems Nominal' },
        { label: 'SCADA Nodes', value: '128 PLC', subtext: '0.4ms Telemetry' },
        { label: 'Shift OEE', value: '94.6%', subtext: '+2.4% vs Plan' },
      ];
  }
}

export function HeroOperationalKpiStrip({
  panelName,
  className,
}: {
  panelName: string;
  className?: string;
}) {
  const tiles = getHeroKpiTiles(panelName);
  return (
    <div
      className={cn(
        'liquid-glass-light gold-steel-border gold-steel-border-slim grid grid-cols-1 gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 shadow-2xs backdrop-blur-md sm:grid-cols-3 sm:gap-3',
        className
      )}
      data-testid={`hero-kpi-strip-${panelName}`}
      aria-label="Operational subsystem indicators"
    >
      {tiles.map((tile, index) => (
        <div key={tile.label} className="flex min-w-0 items-center justify-between gap-2 py-0.5">
          <div className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <span
                aria-hidden="true"
                data-testid="hero-kpi-gold-separator"
                className="hidden shrink-0 select-none items-center justify-center font-bold font-mono text-accent-amber text-xs drop-shadow-[0_0_4px_rgba(212,175,55,0.45)] sm:inline-flex"
              >
                |
              </span>
            )}
            <span className="truncate font-mono font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
              {tile.label}
            </span>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5">
            <span className="font-bold font-mono text-[var(--text-heading)] text-xs tabular-nums sm:text-[13px]">
              {tile.value}
            </span>
            <span
              aria-hidden="true"
              className="select-none font-bold font-mono text-[10px] text-accent-amber"
            >
              |
            </span>
            <span className="font-mono font-semibold text-[10px] text-[var(--accent-blue)]">
              {tile.subtext}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface HeroCardContentProps {
  panel: Panel;
  idx: number;
  isActive: boolean;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

export function HeroCardContent({
  panel,
  idx,
  isActive,
  failedImages,
  onImageError,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: HeroCardContentProps) {
  const assetSubtitle =
    panel.assetSubtitle ||
    (panel.name === 'drilling'
      ? 'Epiroc Pit Viper 351 · Bit Depth Telemetry · Pattern B-14'
      : panel.description);

  const targetMeta =
    panel.name === 'production'
      ? { label: 'Shift Target: 12,500t [94%]', width: '94%' }
      : panel.name === 'plant-processing'
        ? { label: 'Plant Target: 8,500t [92%]', width: '92%' }
        : panel.name === 'plant-inventory'
          ? { label: 'Stockpile Capacity: 55,000t [88%]', width: '88%' }
          : panel.name === 'access-control'
            ? { label: 'Gate Uptime: 99.8% [99%]', width: '99%' }
            : panel.name === 'engineering'
              ? { label: 'Fleet Readiness: 92% [92%]', width: '92%' }
              : panel.name === 'control-room'
                ? { label: 'SCADA Telemetry: 99.9% [99%]', width: '99%' }
                : panel.name === 'availability-utilization' || panel.name === 'reports'
                  ? { label: 'Availability Target: 95.0% [95%]', width: '95%' }
                  : panel.name === 'admin'
                    ? { label: 'System Compliance: 100% [100%]', width: '100%' }
                    : { label: 'Target: 1,300m [95%]', width: '95%' };

  const isViewLogs =
    panel.primary.label.toLowerCase().includes('log') ||
    panel.primary.label.toLowerCase().includes('view logs');

  const primaryBtnClass = isViewLogs
    ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 font-semibold shadow-xs'
    : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 font-medium shadow-xs';

  const hasUrgentTelemetry = incidentCount > 0 || breakdownCount > 0 || offlineMachineCount > 0;

  return (
    <div className="relative z-10 flex h-full w-full flex-row">
      {/* Left Column: Text, Controls & Live Telemetry Graph */}
      <div className="liquid-glass-light relative z-20 flex h-full w-[52%] flex-col justify-between rounded-r-none rounded-l-2xl border border-white/20 p-5 shadow-window sm:w-[50%] sm:p-7">
        <div>
          {/* Urgent Telemetry Readouts (only shown when active incidents/breakdowns/offline exist) */}
          {hasUrgentTelemetry && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px] tabular-nums">
              {incidentCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-red/10 px-2 py-0.5 font-medium text-accent-red">
                  <AlertTriangle className="h-3 w-3" />
                  {incidentCount} Open
                </span>
              )}
              {breakdownCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-amber/10 px-2 py-0.5 font-medium text-accent-amber">
                  <Wrench className="h-3 w-3" />
                  {breakdownCount} Breakdown
                </span>
              )}
              {offlineMachineCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
                  <Power className="h-3 w-3" />
                  {offlineMachineCount} Offline
                </span>
              )}
            </div>
          )}

          {/* Operational Title with Canonical Department Icon, Header Separator & Subtitle */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="gold-steel-border gold-steel-border-slim inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-amber/40 bg-accent-amber/10 text-accent-amber shadow-2xs"
                aria-hidden="true"
                data-testid={`hero-dept-icon-${panel.name}`}
              >
                <Logo variant="gold" className="h-4 w-4 text-accent-amber" />
              </span>
              <h2
                className="pr-4 font-anurati font-bold text-[var(--text-heading)] text-xl uppercase leading-snug tracking-[0.04em] sm:text-2xl"
                style={{
                  fontFamily:
                    "var(--font-outfit), var(--font-sans), 'IBM Plex Sans', system-ui, sans-serif",
                }}
              >
                {panel.title}
              </h2>
            </div>
            <div
              data-testid={`hero-header-separator-${panel.name}`}
              aria-hidden="true"
              className="h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-300/80 to-transparent"
            />
            <p className="max-w-[95%] text-[var(--text-secondary)] text-xs leading-relaxed sm:text-sm">
              {assetSubtitle}
            </p>
          </div>

          {/* Action CTAs (Cleaned and Accessible, visually decluttered on flanks) */}
          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-2',
              !isActive && 'pointer-events-none opacity-60'
            )}
          >
            <Link
              href={panel.primary.href}
              data-cta="primary-hero"
              className={cn(
                'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3.5 py-1.5 text-xs transition-all duration-300 active:scale-95',
                primaryBtnClass
              )}
              tabIndex={isActive ? 0 : -1}
            >
              {panel.primary.icon}
              {panel.primary.label}
            </Link>
            {panel.secondary && (
              <Link
                href={panel.secondary.href}
                data-cta="secondary-hero"
                className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-black/[0.04] px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all duration-300 hover:bg-black/[0.08] active:scale-95"
                tabIndex={isActive ? 0 : -1}
              >
                {panel.secondary.icon}
                {panel.secondary.label}
              </Link>
            )}
          </div>
        </div>

        {/* Live Telemetry Graph Across All Hero Cards */}
        <HeroTelemetryGraph panelName={panel.name} stats={panel.stats} />
      </div>

      {/* Right Column: Full Bleed Looping MP4 Video with Live Camera Feed HUD */}
      <div className="group/img absolute top-0 right-0 z-10 h-full w-[48%] overflow-hidden rounded-r-2xl sm:w-[50%]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white/20 to-transparent" />
        {(() => {
          const posterSrc = failedImages.has(panel.image)
            ? '/images/departments/overview.jpg'
            : panel.image || '/images/departments/overview.jpg';
          const rawVideoSrc =
            panel.video ||
            (panel.image
              ? panel.image.replace(/\.(jpg|jpeg|png|webp)$/i, '.mp4')
              : '/images/departments/overview.mp4');
          const resolvedVideoSrc = failedImages.has(rawVideoSrc)
            ? '/images/departments/overview.mp4'
            : rawVideoSrc;

          return (
            <video
              key={resolvedVideoSrc}
              src={resolvedVideoSrc}
              poster={posterSrc}
              aria-label={`${panel.title} visual`}
              data-testid={`hero-video-${panel.name}`}
              autoPlay
              loop
              muted
              playsInline
              preload={isActive ? 'auto' : 'metadata'}
              className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover/img:scale-105"
              onError={() => {
                if (!failedImages.has(rawVideoSrc)) {
                  onImageError(rawVideoSrc);
                }
              }}
            />
          );
        })()}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Live Video HUD Pill (Top Left of Feed) */}
        {isActive && (
          <div className="pointer-events-none absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[10px] text-white shadow-sm backdrop-blur-md">
            <span
              className="h-1.5 w-1.5 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full bg-emerald-400"
              aria-hidden="true"
            />
            <span className="font-bold text-emerald-300 tracking-wider">LIVE</span>
            <span className="text-white/30">·</span>
            <span className="font-medium text-white/90 tabular-nums">30 FPS</span>
            <span className="text-white/30">·</span>
            <span className="font-medium text-white/90">1080p</span>
          </div>
        )}

        {/* Telemetry HUD & Target Progress Delta Bar (Top Right) */}
        <div className="pointer-events-none absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs shadow-sm backdrop-blur-md">
            <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="font-medium font-mono text-[10px] text-white/70 uppercase tracking-wider">
              {panel.stats?.label || 'DEPTH'}:
            </span>
            <span className="font-bold font-mono text-white tabular-nums">
              {panel.stats?.value || '1,240m'}
            </span>
          </div>

          {isActive && (
            <div className="flex flex-col items-end gap-0.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[9px] text-white/80 backdrop-blur-md">
              <span className="font-semibold text-white/90 tabular-nums">{targetMeta.label}</span>
              <div className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: targetMeta.width }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Machine Status & CAM Overlay (Bottom Right) */}
        <div className="pointer-events-none absolute right-4 bottom-4 z-20 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono font-semibold text-[10px] text-white/95 shadow-sm backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />●{' '}
              {panel.name === 'drilling' ? 'DRILLING' : panel.name.toUpperCase()}
            </span>
            <span className="rounded-md border border-white/15 bg-black/60 px-2 py-1 font-mono text-[10px] text-white/90 tabular-nums shadow-sm backdrop-blur-md">
              CAM-{String(idx + 1).padStart(2, '0')}
            </span>
          </div>
          {isActive && (
            <span className="rounded border border-white/10 bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-white/70 tabular-nums backdrop-blur-sm">
              UTC 08:30:12
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
