'use client';

import { Activity, AlertTriangle, Power, Wrench } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../lib/utils';
import type { Panel } from './HeroRotator';
import { TrustLogos } from './TrustLogos';

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
  const assetOverline =
    panel.assetOverline ||
    (panel.name === 'drilling'
      ? 'FIELD OPERATIONS // UNIT-PV351'
      : panel.name === 'production'
        ? 'EXTRACTION & YIELD // PLANT-EXT01'
        : panel.name === 'access-control'
          ? 'SITE SECURITY // SEC-GATE01'
          : panel.name === 'engineering'
            ? 'PLANT MAINTENANCE // WORKSHOP-03'
            : panel.name === 'control-room'
              ? 'SCADA & TELEMETRY // DISPATCH-ROOM'
              : `${(panel.category || 'CENTRAL COMMAND').toUpperCase()} // SYS-MAIN`);

  const assetSubtitle =
    panel.assetSubtitle ||
    (panel.name === 'drilling'
      ? 'Epiroc Pit Viper 351 · Bit Depth Telemetry · Pattern B-14'
      : panel.description);

  const isViewLogs =
    panel.primary.label.toLowerCase().includes('log') ||
    panel.primary.label.toLowerCase().includes('view logs');

  const primaryBtnClass = isViewLogs
    ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 font-semibold shadow-xs'
    : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 font-medium shadow-xs';

  return (
    <div className="relative h-full w-full flex flex-row z-10 bg-white">
      {/* Left Column: Text, Controls & Telemetry Bus */}
      <div className="relative z-20 flex flex-col justify-between w-[55%] h-full p-5 sm:p-7 bg-white/90 backdrop-blur-md border-r border-slate-200/60">
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

          {/* Operational Asset Labeling & Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-slate-500 uppercase font-semibold">
              <div
                className={cn(
                  'w-5 h-5 rounded-md shrink-0 flex items-center justify-center border border-black/5 shadow-xs',
                  panel.iconBgColor
                )}
              >
                {panel.icon}
              </div>
              <span>{assetOverline}</span>
            </div>

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
              !isActive && 'opacity-0 pointer-events-none'
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

        {/* Telemetry Bus Footer (Active Card Only) */}
        {isActive && (
          <div className="mt-auto pt-3 opacity-90 origin-left scale-95 sm:scale-100">
            <TrustLogos />
          </div>
        )}
      </div>

      {/* Right Column: Full Bleed Image with Live Camera Feed HUD */}
      <div className="absolute top-0 right-0 w-[55%] h-full group/img overflow-hidden rounded-r-2xl z-10">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
        <img
          src={failedImages.has(panel.image) ? '/images/departments/overview.jpg' : panel.image}
          alt={`${panel.title} visual`}
          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover/img:scale-105"
          loading={isActive ? 'eager' : 'lazy'}
          onError={() => onImageError(panel.image)}
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
              <span className="tabular-nums font-semibold text-white/90">Target: 1,300m [95%]</span>
              <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: '95%' }} />
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
