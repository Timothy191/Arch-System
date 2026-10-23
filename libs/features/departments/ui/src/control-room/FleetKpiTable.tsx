'use client';

import type { MachinePerformance } from '@repo/contract/types/shift-compilation.types';
import { GlassCard } from '@repo/ui/GlassCard';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity, AlertTriangle } from 'lucide-react';
import { useRef } from 'react';

interface FleetKpiTableProps {
  fleet: MachinePerformance[];
}

export function FleetKpiTable({ fleet }: FleetKpiTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: fleet ? fleet.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  if (!fleet || fleet.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <div className="flex flex-col items-center justify-center py-6 text-neutral-500">
          <Activity className="mb-2 h-8 w-8 stroke-1 text-neutral-400" />
          <p className="font-medium text-sm">
            No machine telemetry or operations recorded for this shift.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden border border-[var(--border-subtle)] bg-[var(--vibrancy-surface)] shadow-card backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/50 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm tracking-tight">
            <Activity className="h-4 w-4 text-[var(--text-secondary)]" />
            Fleet Availability & SMU Performance
          </h3>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            Machine operating hours, recorded operational delays, and mechanical availability
          </p>
        </div>
      </div>

      {/* Table Header Wrapper to keep headers fixed if we scroll */}
      <div className="grid w-full grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1.5fr] border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80 text-left font-medium text-[var(--text-secondary)] text-xs">
        <div className="px-5 py-3">Machine</div>
        <div className="px-4 py-3">Type</div>
        <div className="px-4 py-3">Operating Window</div>
        <div className="px-4 py-3 text-right">SMU Hours</div>
        <div className="px-4 py-3 text-right">Delays (hrs)</div>
        <div className="px-4 py-3 text-right">Breakdown (hrs)</div>
        <div className="px-5 py-3 text-right">Mechanical Availability</div>
      </div>

      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ height: '400px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = fleet[virtualRow.index];
            if (!item) return null;
            const isHigh = item.mechanical_availability_pct >= 85;
            const isMedium =
              item.mechanical_availability_pct >= 70 && item.mechanical_availability_pct < 85;

            return (
              <div
                key={item.machine_id}
                className="absolute top-0 left-0 grid w-full grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1.5fr] items-center border-black/[0.06] border-b text-xs transition-colors hover:bg-neutral-50/70"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex items-center gap-2 px-5 font-semibold text-[var(--text-heading)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {item.machine_name}
                </div>
                <div className="truncate px-4 text-[var(--text-secondary)] capitalize">
                  {item.machine_type}
                </div>
                <div className="truncate px-4 font-mono text-[11px] text-[var(--text-muted)]">
                  {item.start_smu != null
                    ? `SMR ${item.start_smu.toFixed(1)} – ${item.end_smu != null ? item.end_smu.toFixed(1) : 'Active'}`
                    : item.start_time
                      ? `${item.start_time.slice(0, 5)} - ${item.end_time?.slice(0, 5) || 'Active'}`
                      : 'Not logged'}
                </div>
                <div className="px-4 text-right font-medium font-mono text-[var(--text-heading)]">
                  {item.hours_worked.toFixed(1)}h
                </div>
                <div className="px-4 text-right font-medium font-mono text-amber-700">
                  {item.delay_hours > 0 ? `${item.delay_hours.toFixed(1)}h` : '—'}
                </div>
                <div className="px-4 text-right font-medium font-mono text-rose-700">
                  {item.breakdown_hours > 0 ? `${item.breakdown_hours.toFixed(1)}h` : '—'}
                </div>
                <div className="px-5 text-right font-mono font-semibold">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 font-medium text-[11px] ${
                      isHigh
                        ? 'border border-emerald-200 bg-emerald-100/70 text-emerald-800'
                        : isMedium
                          ? 'border border-amber-200 bg-amber-100/70 text-amber-800'
                          : 'border border-rose-200 bg-rose-100/70 text-rose-800'
                    }`}
                  >
                    {!isHigh && <AlertTriangle className="mr-1 h-3 w-3" />}
                    {item.mechanical_availability_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
