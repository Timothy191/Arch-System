'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  resolveDefaultMachineImage,
  resolveDefaultManufacturer,
  resolveMachineIdentity,
} from '@/features/admin/tabs/fleet-utils';
import type { SiteMachineGroup } from './machine-telemetry-helpers';

interface MachineTelemetryPanelsClientProps {
  readonly siteGroups: readonly SiteMachineGroup[];
}

const PANEL_CHART_HEIGHT = 88;
const MINI_AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 10 } as const;
const MINI_TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 11,
} as const;

const MACHINE_CARD_CLASS =
  'group gold-steel-border gold-steel-border-slim px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover';
const IMAGE_FRAME_CLASS =
  'gold-steel-border gold-steel-border-slim relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--accent-gold)]/60 bg-[var(--bg-secondary)] shadow-xs sm:h-24 sm:w-24';
const STAT_BOX_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/70 px-2.5 py-2 transition-colors group-hover:border-[var(--accent-gold)]/35';
const STAT_LABEL_CLASS = 'text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide';
const STAT_VALUE_CLASS = 'mt-0.5 font-semibold text-sm text-[var(--text-heading)] tabular-nums';

export function MachineTelemetryPanelsClient({ siteGroups }: MachineTelemetryPanelsClientProps) {
  if (siteGroups.length === 0) {
    return (
      <GlassCard>
        <p className="py-8 text-center text-[var(--text-muted)] text-sm">
          No machines registered for this department.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {siteGroups.map(({ siteKey, siteCode, siteName, machines: siteMachines }) => (
        <div key={siteKey} className="space-y-3">
          {/* Site heading */}
          <div
            data-testid={`site-group-pill-${siteKey}`}
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2.5 rounded-full border border-accent-gold/60 bg-white px-4 py-2 shadow-card"
          >
            {siteCode ? (
              <span className="inline-flex rounded-full border border-accent-gold/40 bg-amber-50 px-2.5 py-0.5 font-mono font-semibold text-amber-900 text-xs">
                {siteCode}
              </span>
            ) : null}
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">{siteName}</h3>
            <span className="text-[var(--text-muted)] text-xs">
              {siteMachines.length} machine{siteMachines.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {siteMachines.map((machine) => {
              const { telemetry } = machine;
              const isDeltaPositive = telemetry.hoursDeltaPct >= 0;
              const formattedDelta = `${isDeltaPositive && telemetry.hoursDeltaPct > 0 ? '+' : ''}${telemetry.hoursDeltaPct.toFixed(1)}%`;
              const identity = resolveMachineIdentity({
                name: machine.name,
                serialNumber: machine.serial_number,
              });
              const manufacturer = resolveDefaultManufacturer({
                machineId: identity.machineId,
                machineName: identity.machineName,
                machineType: machine.machine_type,
                manufacturer: machine.manufacturer,
              });
              const imageUrl = resolveDefaultMachineImage({
                machineType: machine.machine_type,
                manufacturer,
                machineId: identity.machineId,
                imageUrl: machine.image_url,
              });

              return (
                <GlassCard key={machine.id} className={MACHINE_CARD_CLASS}>
                  {/* Panel Header with Square Golden-Border Machine Image */}
                  <div className="flex items-start gap-3">
                    <div
                      data-testid={`machine-image-frame-${machine.id}`}
                      className={IMAGE_FRAME_CLASS}
                    >
                      <Image
                        src={imageUrl}
                        alt={`${machine.name} (${machine.machine_type})`}
                        width={160}
                        height={160}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-bold text-[var(--text-heading)] text-sm tracking-tight">
                          {machine.name}
                        </p>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold text-xs ${
                            machine.active
                              ? 'border-emerald-200/50 bg-emerald-50/70 text-emerald-700'
                              : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                          }`}
                        >
                          {machine.active && <span className="badge-pulse-dot bg-emerald-500" />}
                          {machine.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                          {machine.machine_type}
                        </span>
                        {machine.bin_factor != null && machine.bin_factor > 0 && (
                          <span className="rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono text-[11px] text-[var(--accent-blue)]">
                            Bin: {machine.bin_factor} BCM
                          </span>
                        )}
                      </div>
                      {machine.serial_number && (
                        <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">
                          {machine.serial_number}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Totals Strip: Hours Worked (+% Up/Down), Breakdowns, Tyre Activity */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className={STAT_BOX_CLASS}>
                      <p className={STAT_LABEL_CLASS}>Hours Worked</p>
                      <p className={STAT_VALUE_CLASS}>
                        {telemetry.totalHoursWorked.toLocaleString('en-US', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        h
                      </p>
                      <span
                        aria-label={`Hours worked change ${formattedDelta} vs prior 7 days`}
                        className={`mt-0.5 inline-flex items-center gap-0.5 font-medium text-[10px] tabular-nums ${
                          isDeltaPositive ? 'text-accent-green' : 'text-accent-red'
                        }`}
                      >
                        {isDeltaPositive ? (
                          <TrendingUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                        )}
                        {formattedDelta}
                      </span>
                    </div>

                    <div className={STAT_BOX_CLASS}>
                      <p className={STAT_LABEL_CLASS}>Breakdowns</p>
                      <p className={STAT_VALUE_CLASS}>{telemetry.totalBreakdowns}</p>
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        {telemetry.activeBreakdowns > 0
                          ? `${telemetry.activeBreakdowns} active`
                          : '0 open'}
                      </span>
                    </div>

                    <div className={STAT_BOX_CLASS}>
                      <p className={STAT_LABEL_CLASS}>Tyre Activity</p>
                      <p className={STAT_VALUE_CLASS}>{telemetry.tireEventsCount}</p>
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        {telemetry.installedTiresCount} mounted
                      </span>
                    </div>
                  </div>

                  {/* Tyre & Breakdown Activity Mini Graph */}
                  <div className="mt-3 border-[var(--border-subtle)] border-t pt-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span className="font-medium uppercase tracking-wider">
                        Tyre &amp; Breakdown Activity (7d)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" />
                          BD
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
                          Tyre
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
                          Hrs
                        </span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={PANEL_CHART_HEIGHT}>
                      <ComposedChart data={telemetry.activitySeries}>
                        <XAxis
                          dataKey="day"
                          tick={MINI_AXIS_TICK}
                          stroke="var(--border-default)"
                          interval="preserveStartEnd"
                        />
                        <YAxis yAxisId="events" hide allowDecimals={false} />
                        <YAxis yAxisId="hours" orientation="right" hide />
                        <Tooltip contentStyle={MINI_TOOLTIP_STYLE} />
                        <Bar
                          yAxisId="events"
                          dataKey="breakdowns"
                          name="Breakdowns"
                          fill="var(--accent-red)"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          yAxisId="events"
                          dataKey="tireEvents"
                          name="Tyre Events"
                          fill="var(--accent-amber)"
                          radius={[3, 3, 0, 0]}
                        />
                        <Line
                          yAxisId="hours"
                          type="monotone"
                          dataKey="hours"
                          name="Hours Worked"
                          stroke="var(--accent-blue)"
                          strokeWidth={1.75}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
