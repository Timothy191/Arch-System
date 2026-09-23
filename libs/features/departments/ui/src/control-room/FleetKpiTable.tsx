'use client';

import type { MachinePerformance } from '@repo/contract/types/shift-compilation.types';
import { GlassCard } from '@repo/ui/GlassCard';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity, AlertTriangle, CheckCircle2, Clock, Wrench } from 'lucide-react';
import { useMemo, useRef } from 'react';

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

  // Performance Optimization:
  // Virtualized table scrolling re-renders FleetKpiTable continuously on scroll frames.
  // Single-pass traversal memoized on `fleet` prevents redundant O(N) array reductions
  // on every scroll frame re-render.
  const { avgAvailability, totalSmuHours, totalBreakdownHours } = useMemo(() => {
    if (!fleet || fleet.length === 0) {
      return { avgAvailability: '0.0', totalSmuHours: '0.0', totalBreakdownHours: '0.0' };
    }
    let totalMa = 0;
    let totalSmu = 0;
    let totalBreakdown = 0;
    for (let i = 0; i < fleet.length; i++) {
      const item = fleet[i];
      totalMa += item.mechanical_availability_pct;
      totalSmu += item.hours_worked;
      totalBreakdown += item.breakdown_hours;
    }
    return {
      avgAvailability: (totalMa / fleet.length).toFixed(1),
      totalSmuHours: totalSmu.toFixed(1),
      totalBreakdownHours: totalBreakdown.toFixed(1),
    };
  }, [fleet]);

  if (!fleet || fleet.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <div className="flex flex-col items-center justify-center py-6 text-neutral-500">
          <Activity className="h-8 w-8 mb-2 stroke-1 text-neutral-400" />
          <p className="text-sm font-medium">
            No machine telemetry or operations recorded for this shift.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden border border-black/[0.08] shadow-card bg-white/70 backdrop-blur-xl">
      <div className="border-b border-black/[0.08] px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <Activity className="h-4 w-4 text-neutral-700" />
            Fleet Availability & SMU Performance
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Machine operating hours, recorded operational delays, and mechanical availability
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200/60">
            <Clock className="h-3.5 w-3.5 text-neutral-500" />
            Total SMU: <strong className="font-mono">{totalSmuHours}h</strong>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200/60">
            <Wrench className="h-3.5 w-3.5 text-neutral-500" />
            Breakdowns: <strong className="font-mono">{totalBreakdownHours}h</strong>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Avg MA: <strong className="font-mono">{avgAvailability}%</strong>
          </span>
        </div>
      </div>

      {/* Table Header Wrapper to keep headers fixed if we scroll */}
      <div className="w-full text-left text-xs bg-neutral-100/60 text-neutral-600 font-medium grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1.5fr] border-b border-black/[0.08]">
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
                className="absolute top-0 left-0 w-full text-xs hover:bg-neutral-50/70 transition-colors border-b border-black/[0.06] grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1.5fr] items-center"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="px-5 font-semibold text-neutral-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {item.machine_name}
                </div>
                <div className="px-4 text-neutral-600 capitalize truncate">{item.machine_type}</div>
                <div className="px-4 text-neutral-500 font-mono text-[11px] truncate">
                  {item.start_time
                    ? `${item.start_time.slice(0, 5)} - ${item.end_time?.slice(0, 5) || 'Active'}`
                    : 'Not logged'}
                </div>
                <div className="px-4 text-right font-mono font-medium text-neutral-800">
                  {item.hours_worked.toFixed(1)}h
                </div>
                <div className="px-4 text-right font-mono font-medium text-amber-700">
                  {item.delay_hours > 0 ? `${item.delay_hours.toFixed(1)}h` : '—'}
                </div>
                <div className="px-4 text-right font-mono font-medium text-rose-700">
                  {item.breakdown_hours > 0 ? `${item.breakdown_hours.toFixed(1)}h` : '—'}
                </div>
                <div className="px-5 text-right font-mono font-semibold">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                      isHigh
                        ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200'
                        : isMedium
                          ? 'bg-amber-100/70 text-amber-800 border border-amber-200'
                          : 'bg-rose-100/70 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {!isHigh && <AlertTriangle className="h-3 w-3 mr-1" />}
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
