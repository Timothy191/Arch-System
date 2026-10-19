'use client';

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Layers,
  Power,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { cn } from '../lib/utils';
import type { Panel } from './HeroRotator';

interface HeroBannerFeature {
  label: string;
  badge: string;
  href: string;
  icon: React.ReactNode;
}

function getHeroBannerFeatures(panelName: string, primaryHref: string): HeroBannerFeature[] {
  switch (panelName) {
    case 'admin':
      return [
        {
          label: 'Users & RBAC Sync',
          badge: 'RLS Active',
          href: '/admin?tab=users',
          icon: <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'Fleet & Bin Factors',
          badge: 'Live Fleet',
          href: '/admin?tab=machinery',
          icon: <Layers className="w-3 h-3 text-amber-600 shrink-0" />,
        },
        {
          label: 'AI & ZAR Telemetry',
          badge: '84% Cache',
          href: '/admin/ai-metrics',
          icon: <Cpu className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
      ];
    case 'control-room':
      return [
        {
          label: 'Hourly Loads Grid',
          badge: 'Live Sync',
          href: '/control-room/hourly-loads',
          icon: <Layers className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'Machine SMR & Ops',
          badge: '250 BCM/h',
          href: '/control-room/machine-operations',
          icon: <Activity className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
        {
          label: 'Atomic Shift Closeout',
          badge: 'RPC Locked',
          href: '/control-room/shift-closeout',
          icon: <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />,
        },
      ];
    case 'access-control':
      return [
        {
          label: 'Muster Roll Call',
          badge: 'Real-Time',
          href: '/access-control/roll-call',
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'C66 Key Interlocks',
          badge: '2-Step Scan',
          href: '/access-control/key-control',
          icon: <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />,
        },
        {
          label: 'CR80 Badge Studio',
          badge: '300 DPI',
          href: '/access-control/card-maker',
          icon: <Sparkles className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
      ];
    case 'production':
      return [
        {
          label: 'Daily Yield & Tonnage',
          badge: 'Coal/Waste',
          href: '/production/daily-log',
          icon: <Activity className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'Excavator Activity',
          badge: 'BCM/Hr',
          href: '/production/excavator-activity',
          icon: <Layers className="w-3 h-3 text-amber-600 shrink-0" />,
        },
        {
          label: 'Dozer Roll-Over',
          badge: 'Fixed BCM',
          href: '/production/roll-over',
          icon: <CheckCircle2 className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
      ];
    case 'drilling':
      return [
        {
          label: 'Rig Shift Operations',
          badge: 'Day/Night',
          href: '/drilling/drilling-operations',
          icon: <Activity className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
        {
          label: 'Pattern & Blast Plan',
          badge: 'B-14 Grid',
          href: '/drilling/blast-schedule',
          icon: <Layers className="w-3 h-3 text-amber-600 shrink-0" />,
        },
        {
          label: 'Down-Hole Telemetry',
          badge: 'Sub-ms',
          href: '/drilling/machine-telemetry',
          icon: <Cpu className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
      ];
    case 'engineering':
      return [
        {
          label: 'Breakdown Dispatch',
          badge: 'Live SLA',
          href: '/engineering/breakdowns',
          icon: <Wrench className="w-3 h-3 text-amber-600 shrink-0" />,
        },
        {
          label: 'Tire Life & Pressure',
          badge: 'Fleet Guard',
          href: '/engineering/tires',
          icon: <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'MTBF & Reliability',
          badge: 'Predictive',
          href: '/engineering/reports',
          icon: <Activity className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
      ];
    case 'overview':
      return [
        {
          label: '8 Core Departments',
          badge: 'Architecture',
          href: '/overview',
          icon: <Layers className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
        {
          label: 'Next.js 16 + Supabase',
          badge: 'Tech Stack',
          href: '/overview',
          icon: <Cpu className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'Zero-Trust RLS & Cache',
          badge: '100% Verified',
          href: '/overview',
          icon: <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />,
        },
      ];
    case 'database':
      return [
        {
          label: 'Supabase PostgreSQL 17',
          badge: '186 Migrations',
          href: '/database',
          icon: <Layers className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'Schema & RLS Catalog',
          badge: '100% InitPlan',
          href: '/database/schemas',
          icon: <ShieldCheck className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
        {
          label: 'Telemetry & Replica Sync',
          badge: 'Live Panels',
          href: '/database/panels',
          icon: <Activity className="w-3 h-3 text-amber-600 shrink-0" />,
        },
      ];
    default:
      return [
        {
          label: 'SCADA Control Room',
          badge: '24/7 Live',
          href: '/control-room',
          icon: <Activity className="w-3 h-3 text-emerald-600 shrink-0" />,
        },
        {
          label: 'AI & ZAR Intelligence',
          badge: '+88% Cache',
          href: '/admin/ai-metrics',
          icon: <Cpu className="w-3 h-3 text-cyan-600 shrink-0" />,
        },
        {
          label: 'Shift & Fleet Reports',
          badge: 'Direct Launch',
          href: primaryHref || '/control-room/reports',
          icon: <Layers className="w-3 h-3 text-amber-600 shrink-0" />,
        },
      ];
  }
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
              : panel.name === 'admin'
                ? 'ENTERPRISE GOVERNANCE // ADM-CORE'
                : `${(panel.category || 'CENTRAL COMMAND').toUpperCase()} // SYS-MAIN`);

  const assetSubtitle =
    panel.assetSubtitle ||
    (panel.name === 'drilling'
      ? 'Epiroc Pit Viper 351 · Bit Depth Telemetry · Pattern B-14'
      : panel.description);

  const targetMeta =
    panel.name === 'production'
      ? { label: 'Shift Target: 12,500t [94%]', width: '94%' }
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

  const bannerFeatures = getHeroBannerFeatures(panel.name, panel.primary.href);

  return (
    <div className="relative h-full w-full flex flex-row z-10">
      {/* Left Column: Text, Controls & Enterprise Hero Banner Features */}
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

        {/* Enterprise Hero Banner Feature Strip (Active Card Only) */}
        {isActive && (
          <div className="mt-auto pt-2.5 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[9px] uppercase tracking-wider text-slate-600 font-mono font-semibold flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"
                  aria-hidden="true"
                />
                MODULE CAPABILITIES & DIRECT ACCESS
              </p>
              <span className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono font-semibold text-emerald-700">
                99.95% SLA · 24/7 Shift Ready
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {bannerFeatures.map((feat) => (
                <Link
                  key={feat.label}
                  href={feat.href}
                  className="group/feat flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white backdrop-blur-md border border-slate-200/80 hover:border-[var(--accent-blue)]/45 shadow-2xs transition-all duration-200"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {feat.icon}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-semibold text-slate-800 group-hover/feat:text-[var(--text-heading)] truncate leading-tight">
                        {feat.label}
                      </span>
                      <span className="text-[8.5px] font-mono text-slate-500 truncate leading-tight">
                        {feat.badge}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-2.5 h-2.5 text-slate-400 group-hover/feat:text-[var(--accent-blue)] group-hover/feat:translate-x-0.5 group-hover/feat:-translate-y-0.5 transition-transform shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
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
