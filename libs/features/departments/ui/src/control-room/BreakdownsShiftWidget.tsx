"use client";

import type { ShiftBreakdownSummary } from "@repo/contract/types/shift-compilation.types";
import { GlassCard } from "@repo/ui/GlassCard";
import { Wrench, CheckCircle2, AlertOctagon, Clock } from "lucide-react";

interface BreakdownsShiftWidgetProps {
  breakdowns: ShiftBreakdownSummary[];
}

export function BreakdownsShiftWidget({ breakdowns }: BreakdownsShiftWidgetProps) {
  const activeCount = breakdowns.filter((b) => b.status === "active").length;
  const completedCount = breakdowns.filter((b) => b.status === "completed").length;

  return (
    <GlassCard className="overflow-hidden border border-black/[0.08] shadow-card bg-white/70 backdrop-blur-xl">
      <div className="border-b border-black/[0.08] px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <Wrench className="h-4 w-4 text-neutral-700" />
            Engineering Breakdowns & Stoppages
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Equipment stoppages, engineering repair logs, and book-out status
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {activeCount > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-medium flex items-center gap-1.5">
              <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
              {activeCount} Active Breakdown{activeCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200/60 font-medium">
            {completedCount} Resolved
          </span>
        </div>
      </div>

      <div className="p-5">
        {breakdowns.length === 0 ? (
          <div className="py-6 text-center text-neutral-500 text-xs">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/70" />
            No machine breakdowns recorded during this shift.
          </div>
        ) : (
          <div className="space-y-3">
            {breakdowns.map((item) => {
              const isActive = item.status === "active";

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-lg border text-xs transition-colors ${
                    isActive ? "border-rose-200 bg-rose-50/30" : "border-black/[0.06] bg-white/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isActive ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                        }`}
                      />
                      <span>{item.machine_name}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        isActive
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-neutral-700 font-medium">{item.reason}</p>

                  {item.repair_notes && (
                    <p className="mt-1.5 text-neutral-500 text-[11px] bg-neutral-50/80 p-2 rounded border border-neutral-100">
                      <strong className="text-neutral-700">Repair Notes:</strong>{" "}
                      {item.repair_notes}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      In: {item.time_in ? item.time_in.slice(0, 5) : "—"}
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
