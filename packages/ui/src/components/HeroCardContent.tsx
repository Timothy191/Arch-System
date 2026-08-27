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
    <div className="relative h-full flex flex-col justify-between px-5 py-3.5 sm:px-7 sm:py-4 z-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-black/5 bg-white/80 shadow-sm backdrop-blur-sm font-semibold tracking-wider text-[var(--text-secondary)]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent-green animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                aria-hidden="true"
              />
              Sector-01 Active
            </span>
            <span className="text-[var(--text-muted)] tracking-widest font-medium">
              PORTAL v1.5.1
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {incidentCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-red/10 text-accent-red border border-accent-red/20 font-medium">
                <AlertTriangle className="w-3 h-3" />
                {incidentCount} Open
              </span>
            )}
            {breakdownCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-amber/10 text-accent-amber border border-accent-amber/20 font-medium">
                <Wrench className="w-3 h-3" />
                {breakdownCount} Breakdown{breakdownCount !== 1 ? "s" : ""}
              </span>
            )}
            {offlineMachineCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.04] text-[var(--text-secondary)] border border-black/10 font-medium">
                <Power className="w-3 h-3" />
                {offlineMachineCount} Offline
              </span>
            )}
            {incidentCount === 0 && breakdownCount === 0 && offlineMachineCount === 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20 font-medium">
                Nominal
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1">
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

          <h2 className="text-fluid-xl sm:text-fluid-2xl font-bold tracking-tight text-[var(--text-heading)] leading-snug text-balance">
            {panel.title}
          </h2>
          <p className="text-fluid-xs text-[var(--text-secondary)] leading-relaxed line-clamp-1 sm:line-clamp-2 max-w-xl">
            {panel.description}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {panel.stats && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 border border-black/5 shadow-sm text-xs backdrop-blur-sm">
              <Activity className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0" />
              <span className="text-[var(--text-muted)] uppercase text-[10px] font-semibold tracking-wider">
                {panel.stats.label}:
              </span>
              <span className="font-bold text-[var(--text-heading)]">{panel.stats.value}</span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 ml-auto">
            <Link
              href={panel.primary.href}
              data-cta="primary-hero"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white font-medium text-xs shadow-sm border border-black/[0.08] hover:bg-[var(--accent-blue)]/90 hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98]"
              tabIndex={isActive ? 0 : -1}
            >
              {panel.primary.icon}
              {panel.primary.label}
            </Link>
            {panel.secondary && (
              <Link
                href={panel.secondary.href}
                data-cta="secondary-hero"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/50 hover:bg-white text-[var(--text-heading)] font-medium text-xs border border-black/[0.08] shadow-sm hover:shadow transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95"
                tabIndex={isActive ? 0 : -1}
              >
                {panel.secondary.icon}
                {panel.secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-2.5 flex-shrink-0 h-24 sm:h-28 w-full overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.02] shadow-inner group/img">
        <img
          src={failedImages.has(panel.image) ? "/images/departments/overview.jpg" : panel.image}
          alt={`${panel.title} visual`}
          className="h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/img:scale-105"
          loading={isActive ? "eager" : "lazy"}
          onError={() => onImageError(panel.image)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none rounded-xl" />
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-[9px] font-semibold border border-white/10 shadow-sm">
            <CheckCircle2 className="w-2.5 h-2.5 text-accent-green drop-shadow-sm" />
            {panel.name.toUpperCase()}
          </span>
          <span className="text-[8px] font-mono text-white/80 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-md border border-white/10 shadow-sm">
            CAM-{String(idx + 1).padStart(2, "0")}
          </span>
        </div>
      </div>

      {isActive && (
        <div className="mt-1.5 opacity-70">
          <TrustLogos />
        </div>
      )}
    </div>
  );
}
