'use client';

import type { ShiftBreakdownSummary } from '@repo/contract/types/shift-compilation.types';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertOctagon, CheckCircle2, Clock, Wrench } from 'lucide-react';

interface BreakdownsShiftWidgetProps {
  breakdowns: ShiftBreakdownSummary[];
}

export function BreakdownsShiftWidget({ breakdowns }: BreakdownsShiftWidgetProps) {
  const activeCount = breakdowns.filter((b) => b.status === 'active').length;
  const completedCount = breakdowns.filter((b) => b.status === 'completed').length;

  return (
    <GlassCard className="overflow-hidden border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-black/[0.08] border-b bg-neutral-50/50 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-neutral-900 text-sm tracking-tight">
            <Wrench className="h-4 w-4 text-neutral-700" />
            Engineering Breakdowns & Stoppages
          </h3>
          <p className="mt-0.5 text-neutral-500 text-xs">
            Equipment stoppages, engineering repair logs, and book-out status
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 font-medium text-rose-800">
              <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
              {activeCount} Active Breakdown{activeCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="rounded-md border border-neutral-200/60 bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
            {completedCount} Resolved
          </span>
        </div>
      </div>

      <div className="p-5">
        {breakdowns.length === 0 ? (
          <div className="py-6 text-center text-neutral-500 text-xs">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/70" />
            No machine breakdowns recorded during this shift.
          </div>
        ) : (
          <div className="space-y-3">
            {breakdowns.map((item) => {
              const isActive = item.status === 'active';

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3.5 text-xs transition-colors ${
                    isActive ? 'border-rose-200 bg-rose-50/30' : 'border-black/[0.06] bg-white/50'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isActive ? 'animate-pulse bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span>{item.machine_name}</span>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider ${
                        isActive
                          ? 'border border-rose-200 bg-rose-100 text-rose-800'
                          : 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="font-medium text-neutral-700">{item.reason}</p>

                  {item.repair_notes && (
                    <p className="mt-1.5 rounded border border-neutral-100 bg-neutral-50/80 p-2 text-[11px] text-neutral-500">
                      <strong className="text-neutral-700">Repair Notes:</strong>{' '}
                      {item.repair_notes}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      In: {item.time_in ? item.time_in.slice(0, 5) : '—'}
                    </span>
                    {item.time_out && <span>Out: {item.time_out.slice(0, 5)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
