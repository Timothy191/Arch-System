"use client";

import { useState } from "react";
import type { MultiSiteShiftReport } from "@repo/contract/types/multi-site-production.types";
import { GlassCard } from "@repo/ui/GlassCard";
import { MapPin, Pickaxe, Truck, Wrench, Shield, AlertCircle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface MultiSiteShiftReportClientProps {
  initialReport: MultiSiteShiftReport;
}

// AGENT-TRACE: Production multi-site shift compilation view with BKF, EXT, PLANT, and Bredell filtering.
export function MultiSiteShiftReportClient({ initialReport }: MultiSiteShiftReportClientProps) {
  const [activeSite, setActiveSite] = useState<"ALL" | "BKF" | "EXT" | "PLANT">("ALL");
  const { production, rollover, breakdowns, bredell_workshop, meta } = initialReport;

  const sites = ["ALL", "BKF", "EXT", "PLANT"] as const;

  return (
    <div className="space-y-6">
      {/* Top Banner: Shift Meta & Site Selector */}
      <GlassCard
        variant="default"
        padding
        className="flex flex-wrap items-center justify-between gap-4 bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-card"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold uppercase tracking-tight text-arch-text-primary">
              Multi-Site Production & Engineering Report
            </h1>
            <span className="rounded-md bg-arch-brand-blue/10 px-2.5 py-0.5 text-xs font-semibold text-arch-brand-blue">
              {meta.shift_date} — {meta.shift_type.toUpperCase()} SHIFT
            </span>
          </div>
          <p className="text-xs text-arch-text-secondary mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-arch-accent-blue" />
            Brakfontein Pit (BKF) • Extension Pit (EXT) • Coal Processing Plant (PLANT)
          </p>
        </div>

        {/* Site Segmented Control */}
        <div className="flex rounded-lg border border-arch-border-subtle bg-arch-surface-secondary/60 p-1">
          {sites.map((site) => (
            <button
              key={site}
              onClick={() => setActiveSite(site)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                activeSite === site
                  ? "bg-white text-arch-text-primary shadow-card font-semibold"
                  : "text-arch-text-tertiary hover:text-arch-text-secondary",
              )}
            >
              {site}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 1. Excavator Production Blocks */}
      {(activeSite === "ALL" || activeSite === "BKF" || activeSite === "EXT") && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-arch-border-subtle pb-2">
            <Pickaxe className="w-4 h-4 text-arch-accent-blue" />
            <h2 className="text-sm font-semibold tracking-wider text-arch-text-primary uppercase">
              Excavator Production & Hauling
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Object.entries(production || {})
              .filter(([site]) => activeSite === "ALL" || activeSite === site)
              .flatMap(([site, excavators]) =>
                excavators.map((exc) => (
                  <GlassCard
                    key={`${site}-${exc.excavator_name}-${exc.block_id}`}
                    variant="default"
                    padding
                    className="bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-card"
                  >
                    <div className="flex items-start justify-between border-b border-arch-border-subtle/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-arch-text-primary">
                            {exc.excavator_name}
                          </span>
                          <span className="rounded bg-arch-surface-tertiary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-arch-text-secondary">
                            {site}
                          </span>
                          <span className="text-xs text-arch-text-tertiary">
                            ({exc.operator_name})
                          </span>
                        </div>
                        <p className="text-xs text-arch-accent-blue font-medium mt-0.5">
                          {exc.material_type} • Block {exc.block_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-mono font-bold text-arch-text-primary">
                          {exc.material_type === "TOPSOIL"
                            ? `${exc.total_bcm.toLocaleString()} m³`
                            : `${exc.total_tonnes.toLocaleString()} t`}
                        </span>
                        <p className="text-[11px] text-arch-text-tertiary">
                          {exc.total_loads} Total Loads
                        </p>
                      </div>
                    </div>

                    {/* Truck Haul Tally Matrix */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {exc.trucks.map((trk) => (
                        <div
                          key={trk.truck_name}
                          className="flex items-center gap-1.5 rounded-md border border-arch-border-subtle bg-arch-surface-secondary/50 px-2 py-1 text-xs font-mono"
                        >
                          <Truck className="w-3 h-3 text-arch-text-tertiary" />
                          <span className="text-arch-text-secondary">{trk.truck_name}:</span>
                          <span className="font-semibold text-arch-text-primary">{trk.loads}</span>
                        </div>
                      ))}
                    </div>

                    {/* Performance Metric Footer */}
                    <div className="mt-3 flex items-center justify-between border-t border-arch-border-subtle/60 pt-2 text-xs">
                      <span className="text-arch-text-secondary">
                        Operating:{" "}
                        <strong className="text-arch-text-primary">{exc.operating_hours}h</strong>
                      </span>
                      <span className="text-arch-text-secondary">
                        Rate:{" "}
                        <strong className="text-arch-text-primary">
                          {exc.rate_per_hour} {exc.material_type === "TOPSOIL" ? "m³/h" : "t/h"}
                        </strong>
                      </span>
                      {exc.delays ? (
                        <span
                          className="text-accent-amber truncate max-w-[200px]"
                          title={exc.delays}
                        >
                          ⚠️ {exc.delays}
                        </span>
                      ) : (
                        <span className="text-accent-green font-medium">Optimal Flow</span>
                      )}
                    </div>
                  </GlassCard>
                )),
              )}
          </div>
        </div>
      )}

      {/* 2. Dozer Rollover Volume Section */}
      {(activeSite === "ALL" || activeSite === "EXT") &&
        rollover &&
        rollover.entries &&
        rollover.entries.length > 0 && (
          <GlassCard
            variant="default"
            padding
            className="bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-card"
          >
            <div className="flex items-center justify-between border-b border-arch-border-subtle pb-2">
              <h3 className="text-sm font-semibold uppercase text-arch-text-primary flex items-center gap-2">
                <Shield className="w-4 h-4 text-arch-accent-blue" />
                Bulldozer Rollover Operations (Push Factor: 250 m³/h)
              </h3>
              <span className="font-mono text-sm font-bold text-accent-green">
                Total: {rollover.total_bcm.toLocaleString()} BCM
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {rollover.entries.map((item) => (
                <div
                  key={item.machine_name}
                  className="rounded-lg border border-arch-border-subtle bg-arch-surface-secondary/40 p-2.5 text-xs"
                >
                  <span className="font-bold text-arch-text-primary">{item.machine_name}</span>
                  <p className="font-mono text-[11px] text-arch-text-secondary mt-0.5">
                    {item.start_smu} - {item.end_smu} ({item.hours}h × {item.push_factor})
                  </p>
                  <p className="font-mono font-semibold text-arch-brand-blue mt-1">
                    {item.total_bcm.toLocaleString()} BCM
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

      {/* 3. Engineering Breakdowns & Bredell Workshop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard
          variant="default"
          padding
          className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-card"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-arch-text-primary mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-accent-amber" />
            Engineering Downtime & Faults
          </h3>
          <div className="divide-y divide-arch-border-subtle/60">
            {breakdowns && breakdowns.length > 0 ? (
              breakdowns.map((b) => (
                <div key={b.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-arch-text-primary">
                        {b.machine_name}
                      </span>
                      <span className="rounded bg-arch-surface-tertiary px-1.5 py-0.2 text-[10px] text-arch-text-secondary font-semibold">
                        {b.site_code}
                      </span>
                      {b.is_operational_defect && (
                        <span className="rounded bg-accent-amber/10 text-accent-amber text-[10px] px-1 font-medium">
                          Working with defect
                        </span>
                      )}
                    </div>
                    <p className="text-arch-text-secondary mt-0.5">{b.reason}</p>
                    {b.repair_notes && (
                      <p className="text-arch-text-tertiary text-[11px] italic mt-0.5">
                        Note: {b.repair_notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right font-mono">
                    <span
                      className={
                        b.duration_hours >= 10
                          ? "text-accent-red font-bold"
                          : "text-arch-text-primary font-medium"
                      }
                    >
                      {b.duration_hours.toFixed(1)}h
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-arch-text-tertiary py-3">
                No active breakdowns recorded for this shift.
              </p>
            )}
          </div>
        </GlassCard>

        {/* Bredell Workshop Card */}
        <GlassCard
          variant="default"
          padding
          className="bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-card"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-arch-text-primary mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-arch-accent-blue" />
            Machines at Bredell Workshop
          </h3>
          {bredell_workshop && bredell_workshop.length === 0 ? (
            <p className="text-xs text-arch-text-tertiary">0 machines off-site</p>
          ) : (
            <div className="space-y-2">
              {bredell_workshop?.map((m) => (
                <div
                  key={m.machine_name}
                  className="rounded-lg border border-arch-border-subtle bg-arch-surface-secondary/40 p-2.5 text-xs"
                >
                  <span className="font-bold text-arch-text-primary font-mono">
                    {m.machine_name}
                  </span>
                  <p className="text-arch-text-secondary mt-0.5">{m.reason}</p>
                  <p className="text-[10px] text-arch-text-tertiary mt-0.5">Since: {m.date_in}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
