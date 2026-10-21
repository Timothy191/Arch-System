'use client';

import { Activity, AlertTriangle, Power, TrendingUp, Wrench } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { cn } from '../lib/utils';
import type { Panel } from './HeroRotator';

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
      className="mt-auto pt-2.5 border-t border-slate-200/70"
      data-testid={`hero-telemetry-graph-${panelName}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span className="text-[10px] uppercase tracking-wider text-slate-700 font-mono font-semibold truncate">
            {series.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono font-semibold text-emerald-700">
            <TrendingUp className="w-2.5 h-2.5" aria-hidden="true" />
            {series.deltaBadge}
          </span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-900/5 border border-slate-300/60 text-[9px] font-mono font-bold text-slate-800 tabular-nums">
            {series.currentValue}
          </span>
        </div>
      </div>

      <div className="relative rounded-xl bg-white/85 backdrop-blur-md border border-slate-200/80 px-3 py-2 shadow-2xs">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-14 overflow-visible"
          role="img"
          aria-label={`${series.title} telemetry trend graph`}
        >
          <defs>
            <linearGradient id={series.fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.strokeColor} stopOpacity="0.32" />
              <stop offset="100%" stopColor={series.strokeColor} stopOpacity="0.02" />
            </linearGradient>
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

          {/* Subtle background telemetry bars */}
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
              />
            );
          })}

          {/* Shaded area under curve */}
          <path d={areaPath} fill={`url(#${series.fillId})`} />

          {/* Smooth telemetry polyline */}
          <path
            d={linePath}
            fill="none"
            stroke={series.strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data nodes */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={i === coords.length - 1 ? 3.5 : 2}
              fill={i === coords.length - 1 ? series.strokeColor : '#ffffff'}
              stroke={series.strokeColor}
              strokeWidth={i === coords.length - 1 ? 2 : 1.5}
            />
          ))}
        </svg>

        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-100 tabular-nums">
          <span>00:00 SHIFT START</span>
          <span>AVG {series.avgValue}</span>
          <span>PEAK {series.peakValue}</span>
          <span className="text-emerald-700 font-semibold">LIVE · NOW</span>
        </div>
      </div>
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
                : panel.name === 'admin'
                  ? { label: 'System Compliance: 100% [100%]', width: '100%' }
                  : { label: 'Target: 1,300m [95%]', width: '95%' };

  const isViewLogs =
    panel.primary.label.toLowerCase().includes('log') ||
    panel.primary.label.toLowerCase().includes('view logs');

  const primaryBtnClass = isViewLogs
    ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 font-semibold shadow-xs'
    : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 font-medium shadow-xs';

  return (
    <div className="relative h-full w-full flex flex-row z-10">
      {/* Left Column: Text, Controls & Live Telemetry Graph */}
      <div className="relative z-20 flex flex-col justify-between w-[52%] sm:w-[50%] h-full p-5 sm:p-7 liquid-glass-light border border-white/20 shadow-window rounded-l-2xl rounded-r-none">
        <div>
          {/* Top Status Bar with Monospace Readouts */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono tabular-nums mb-3.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-black/5 bg-black/[0.03] text-[var(--text-secondary)] font-semibold">
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent-green animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                aria-hidden="true"
              />
              Sector-01
            </span>

            {/* Conditionally show urgent telemetry on active slide, or minimal on preview */}
            {incidentCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-red/10 text-accent-red font-medium">
                <AlertTriangle className="w-3 h-3" />
                {incidentCount} Open
              </span>
            )}
            {breakdownCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-amber/10 text-accent-amber font-medium">
                <Wrench className="w-3 h-3" />
                {breakdownCount} Breakdown
              </span>
            )}
            {offlineMachineCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.04] text-[var(--text-secondary)] font-medium">
                <Power className="w-3 h-3" />
                {offlineMachineCount} Offline
              </span>
            )}
            {incidentCount === 0 && breakdownCount === 0 && offlineMachineCount === 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green font-medium">
                Nominal
              </span>
            )}
          </div>

          {/* Operational Title & Subtitle (Asset Overline Removed per Design Feedback) */}
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-heading)] leading-snug pr-4">
              {panel.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-[95%]">
              {assetSubtitle}
            </p>
          </div>

          {/* Action CTAs (Cleaned and Accessible, visually decluttered on flanks) */}
          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-2',
              !isActive && 'opacity-60 pointer-events-none'
            )}
          >
            <Link
              href={panel.primary.href}
              data-cta="primary-hero"
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs border border-black/[0.08] transition-all duration-300 active:scale-95',
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[var(--text-heading)] font-medium text-xs border border-transparent transition-all duration-300 active:scale-95"
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

      {/* Right Column: Full Bleed Image with Live Camera Feed HUD */}
      <div className="absolute top-0 right-0 w-[48%] sm:w-[50%] h-full group/img overflow-hidden rounded-r-2xl z-10">
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white/20 to-transparent z-10 pointer-events-none" />
        <img
          src={
            failedImages.has(panel.image)
              ? '/images/departments/overview.jpg'
              : panel.image || '/images/departments/overview.jpg'
          }
          alt={`${panel.title} visual`}
          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover/img:scale-105"
          loading={isActive ? 'eager' : 'lazy'}
          onError={() => {
            if (!failedImages.has(panel.image)) {
              onImageError(panel.image);
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Live Video HUD Pill (Top Left of Feed) */}
        {isActive && (
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white shadow-sm z-20 pointer-events-none">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite]"
              aria-hidden="true"
            />
            <span className="font-bold text-emerald-300 tracking-wider">LIVE</span>
            <span className="text-white/30">·</span>
            <span className="tabular-nums font-medium text-white/90">30 FPS</span>
            <span className="text-white/30">·</span>
            <span className="font-medium text-white/90">1080p</span>
          </div>
        )}

        {/* Telemetry HUD & Target Progress Delta Bar (Top Right) */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none z-20">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/15 shadow-sm text-xs backdrop-blur-md">
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-white/70 uppercase text-[10px] font-mono font-medium tracking-wider">
              {panel.stats?.label || 'DEPTH'}:
            </span>
            <span className="font-mono tabular-nums font-bold text-white">
              {panel.stats?.value || '1,240m'}
            </span>
          </div>

          {isActive && (
            <div className="flex flex-col items-end gap-0.5 px-2 py-1 rounded-md bg-black/50 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/80">
              <span className="tabular-nums font-semibold text-white/90">{targetMeta.label}</span>
              <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: targetMeta.width }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Machine Status & CAM Overlay (Bottom Right) */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 pointer-events-none z-20">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/95 text-[10px] font-mono font-semibold border border-white/15 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />●{' '}
              {panel.name === 'drilling' ? 'DRILLING' : panel.name.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-white/90 bg-black/60 px-2 py-1 rounded-md backdrop-blur-md border border-white/15 shadow-sm">
              CAM-{String(idx + 1).padStart(2, '0')}
            </span>
          </div>
          {isActive && (
            <span className="text-[9px] font-mono tabular-nums text-white/70 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
              UTC 08:30:12
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
