"use client";

import Link from "next/link";
import { Activity, CheckCircle2, AlertTriangle, Wrench, Power } from "lucide-react";
import { cn } from "../lib/utils";
import { TrustLogos } from "./TrustLogos";
import type { Panel } from "./HeroRotator";

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
  return (
    <div className="relative h-full w-full flex flex-row z-10 bg-white">
      {/* Left Column: Text & Controls */}
      <div className="relative z-20 flex flex-col justify-between w-[55%] h-full p-5 sm:p-7 bg-gradient-to-r from-white via-white to-white/95 backdrop-blur-md border-r border-black/5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono mb-4">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-black/5 bg-black/[0.03] text-[var(--text-secondary)] font-semibold">
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent-green animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                aria-hidden="true"
              />
              Sector-01
            </span>

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

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg shrink-0 flex items-center justify-center border border-black/5 shadow-sm transition-transform",
                  panel.iconBgColor,
                )}
              >
                {panel.icon}
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                {panel.category}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-heading)] leading-snug pr-4">
              {panel.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-[90%]">
              {panel.description}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={panel.primary.href}
              data-cta="primary-hero"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white font-medium text-xs shadow-sm border border-black/[0.08] hover:bg-[var(--accent-blue)]/90 hover:shadow-md transition-all duration-300 active:scale-95"
              tabIndex={isActive ? 0 : -1}
            >
              {panel.primary.icon}
              {panel.primary.label}
            </Link>
            {panel.secondary && (
              <Link
                href={panel.secondary.href}
                data-cta="secondary-hero"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[var(--text-heading)] font-medium text-xs border border-transparent transition-all duration-300 active:scale-95"
                tabIndex={isActive ? 0 : -1}
              >
                {panel.secondary.icon}
                {panel.secondary.label}
              </Link>
            )}
          </div>
        </div>

        {isActive && (
          <div className="mt-auto pt-4 opacity-70 origin-left scale-90 sm:scale-100">
            <TrustLogos />
          </div>
        )}
      </div>

      {/* Right Column: Full Bleed Image */}
      <div className="absolute top-0 right-0 w-[55%] h-full group/img overflow-hidden rounded-r-2xl z-10">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
        <img
          src={failedImages.has(panel.image) ? "/images/departments/overview.jpg" : panel.image}
          alt={`${panel.title} visual`}
          className="h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/img:scale-105"
          loading={isActive ? "eager" : "lazy"}
          onError={() => onImageError(panel.image)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
        
        {/* Floating Overlays */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none z-20">
          {panel.stats && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 shadow-sm text-xs backdrop-blur-md">
              <Activity className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="text-white/80 uppercase text-[10px] font-semibold tracking-wider">
                {panel.stats.label}:
              </span>
              <span className="font-bold text-white">{panel.stats.value}</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none z-20">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-[10px] font-semibold border border-white/10 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-accent-green drop-shadow-sm" />
            {panel.name.toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-white/70 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-md border border-white/10 shadow-sm">
            CAM-{String(idx + 1).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}

