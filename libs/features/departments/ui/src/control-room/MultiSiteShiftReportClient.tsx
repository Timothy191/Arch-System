'use client';

import type { MultiSiteShiftReport } from '@repo/contract/types/multi-site-production.types';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { AlertCircle, MapPin, Pickaxe, Shield, Truck, Wrench } from 'lucide-react';
import { useState } from 'react';

interface MultiSiteShiftReportClientProps {
  initialReport: MultiSiteShiftReport;
}

// AGENT-TRACE: Production multi-site shift compilation view with BKF, EXT, PLANT, and Bredell filtering.
export function MultiSiteShiftReportClient({ initialReport }: MultiSiteShiftReportClientProps) {
  const [activeSite, setActiveSite] = useState<'ALL' | 'BKF' | 'EXT' | 'PLANT'>('ALL');
  const { production, rollover, breakdowns, bredell_workshop, meta } = initialReport;

  const sites = ['ALL', 'BKF', 'EXT', 'PLANT'] as const;

  return (
    <div className="space-y-6">
      {/* Top Banner: Shift Meta & Site Selector */}
      <GlassCard
        variant="default"
        padding
        className="flex flex-wrap items-center justify-between gap-4 border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-arch-text-primary text-xl uppercase tracking-tight">
              Multi-Site Production & Engineering Report
            </h1>
            <span className="rounded-md bg-arch-brand-blue/10 px-2.5 py-0.5 font-semibold text-arch-brand-blue text-xs">
              {meta.shift_date} — {meta.shift_type.toUpperCase()} SHIFT
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-arch-text-secondary text-xs">
            <MapPin className="h-3.5 w-3.5 text-arch-accent-blue" />
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
                'rounded-md px-3 py-1 font-medium text-xs transition-all',
                activeSite === site
                  ? 'bg-white font-semibold text-arch-text-primary shadow-card'
                  : 'text-arch-text-tertiary hover:text-arch-text-secondary'
              )}
            >
              {site}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 1. Excavator Production Blocks */}
      {(activeSite === 'ALL' || activeSite === 'BKF' || activeSite === 'EXT') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-arch-border-subtle border-b pb-2">
            <Pickaxe className="h-4 w-4 text-arch-accent-blue" />
            <h2 className="font-semibold text-arch-text-primary text-sm uppercase tracking-wider">
              Excavator Production & Hauling
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Object.entries(production || {})
              .filter(([site]) => activeSite === 'ALL' || activeSite === site)
              .flatMap(([site, excavators]) =>
                excavators.map((exc) => (
                  <GlassCard
                    key={`${site}-${exc.excavator_name}-${exc.block_id}`}
                    variant="default"
                    padding
                    className="border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between border-arch-border-subtle/80 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-arch-text-primary">
                            {exc.excavator_name}
                          </span>
                          <span className="rounded bg-arch-surface-tertiary px-1.5 py-0.5 font-semibold text-[10px] text-arch-text-secondary uppercase">
                            {site}
                          </span>
                          <span className="text-arch-text-tertiary text-xs">
                            ({exc.operator_name})
                          </span>
                        </div>
                        <p className="mt-0.5 font-medium text-arch-accent-blue text-xs">
                          {exc.material_type} • Block {exc.block_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-arch-text-primary text-lg">
                          {exc.material_type === 'TOPSOIL'
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
                          className="flex items-center gap-1.5 rounded-md border border-arch-border-subtle bg-arch-surface-secondary/50 px-2 py-1 font-mono text-xs"
                        >
                          <Truck className="h-3 w-3 text-arch-text-tertiary" />
                          <span className="text-arch-text-secondary">{trk.truck_name}:</span>
                          <span className="font-semibold text-arch-text-primary">{trk.loads}</span>
                        </div>
                      ))}
                    </div>

                    {/* Performance Metric Footer */}
                    <div className="mt-3 flex items-center justify-between border-arch-border-subtle/60 border-t pt-2 text-xs">
                      <span className="text-arch-text-secondary">
                        Operating:{' '}
                        <strong className="text-arch-text-primary">{exc.operating_hours}h</strong>
                      </span>
                      <span className="text-arch-text-secondary">
                        Rate:{' '}
                        <strong className="text-arch-text-primary">
                          {exc.rate_per_hour} {exc.material_type === 'TOPSOIL' ? 'm³/h' : 't/h'}
                        </strong>
                      </span>
                      {exc.delays ? (
                        <span
                          className="max-w-[200px] truncate text-accent-amber"
                          title={exc.delays}
                        >
                          ⚠️ {exc.delays}
                        </span>
                      ) : (
                        <span className="font-medium text-accent-green">Optimal Flow</span>
                      )}
                    </div>
                  </GlassCard>
                ))
              )}
          </div>
        </div>
      )}

      {/* 2. Dozer Rollover Volume Section */}
      {(activeSite === 'ALL' || activeSite === 'EXT') &&
        rollover &&
        rollover.entries &&
        rollover.entries.length > 0 && (
          <GlassCard
            variant="default"
            padding
            className="border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-arch-border-subtle border-b pb-2">
              <h3 className="flex items-center gap-2 font-semibold text-arch-text-primary text-sm uppercase">
                <Shield className="h-4 w-4 text-arch-accent-blue" />
                Bulldozer Rollover Operations (Push Factor: 250 m³/h)
              </h3>
              <span className="font-bold font-mono text-accent-green text-sm">
                Total: {rollover.total_bcm.toLocaleString()} BCM
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {rollover.entries.map((item) => (
                <div
                  key={item.machine_name}
                  className="rounded-lg border border-arch-border-subtle bg-arch-surface-secondary/40 p-2.5 text-xs"
                >
                  <span className="font-bold text-arch-text-primary">{item.machine_name}</span>
                  <p className="mt-0.5 font-mono text-[11px] text-arch-text-secondary">
                    {item.start_smu} - {item.end_smu} ({item.hours}h × {item.push_factor})
                  </p>
                  <p className="mt-1 font-mono font-semibold text-arch-brand-blue">
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
          className="border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl lg:col-span-2"
        >
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-arch-text-primary text-sm uppercase tracking-wider">
            <Wrench className="h-4 w-4 text-accent-amber" />
            Engineering Downtime & Faults
          </h3>
          <div className="divide-y divide-arch-border-subtle/60">
            {breakdowns && breakdowns.length > 0 ? (
              breakdowns.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-2 py-2.5 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-arch-text-primary">
                        {b.machine_name}
                      </span>
                      <span className="rounded bg-arch-surface-tertiary px-1.5 py-0.2 font-semibold text-[10px] text-arch-text-secondary">
                        {b.site_code}
                      </span>
                      {b.is_operational_defect && (
                        <span className="rounded bg-accent-amber/10 px-1 font-medium text-[10px] text-accent-amber">
                          Working with defect
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-arch-text-secondary">{b.reason}</p>
                    {b.repair_notes && (
                      <p className="mt-0.5 text-[11px] text-arch-text-tertiary italic">
                        Note: {b.repair_notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right font-mono">
                    <span
                      className={
                        b.duration_hours >= 10
                          ? 'font-bold text-accent-red'
                          : 'font-medium text-arch-text-primary'
                      }
                    >
                      {b.duration_hours.toFixed(1)}h
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-3 text-arch-text-tertiary text-xs">
                No active breakdowns recorded for this shift.
              </p>
            )}
          </div>
        </GlassCard>

        {/* Bredell Workshop Card */}
        <GlassCard
          variant="default"
          padding
          className="border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl"
        >
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-arch-text-primary text-sm uppercase tracking-wider">
            <AlertCircle className="h-4 w-4 text-arch-accent-blue" />
            Machines at Bredell Workshop
          </h3>
          {bredell_workshop && bredell_workshop.length === 0 ? (
            <p className="text-arch-text-tertiary text-xs">0 machines off-site</p>
          ) : (
            <div className="space-y-2">
              {bredell_workshop?.map((m) => (
                <div
                  key={m.machine_name}
                  className="rounded-lg border border-arch-border-subtle bg-arch-surface-secondary/40 p-2.5 text-xs"
                >
                  <span className="font-bold font-mono text-arch-text-primary">
                    {m.machine_name}
                  </span>
                  <p className="mt-0.5 text-arch-text-secondary">{m.reason}</p>
                  <p className="mt-0.5 text-[10px] text-arch-text-tertiary">Since: {m.date_in}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
