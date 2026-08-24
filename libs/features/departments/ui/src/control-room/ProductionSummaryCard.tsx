"use client";

import type { UnifiedShiftReport } from "@repo/contract/types/shift-compilation.types";
import { GlassCard } from "@repo/ui/GlassCard";
import { Truck, Layers, BarChart2 } from "lucide-react";

interface ProductionSummaryCardProps {
  production: UnifiedShiftReport["production"];
  shiftType: "day" | "night";
}

export function ProductionSummaryCard({ production, shiftType }: ProductionSummaryCardProps) {
  const activeHours =
    shiftType === "day"
      ? ["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17"]
      : ["18", "19", "20", "21", "22", "23", "00", "01", "02", "03", "04", "05"];

  return (
    <GlassCard className="overflow-hidden border border-black/[0.08] shadow-card bg-white/70 backdrop-blur-xl">
      <div className="border-b border-black/[0.08] px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <Truck className="h-4 w-4 text-neutral-700" />
            Excavator & Hauling Output
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Total loads hauled and hourly loader production rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white font-mono text-xs flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-neutral-300" />
            <span>Total Shift Loads:</span>
            <span className="text-sm font-bold text-emerald-400">{production.total_loads}</span>
          </div>
        </div>
      </div>

      <div className="p-5">
        {production.machines.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 text-xs">
            <BarChart2 className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
            No hourly load tallies recorded for this shift date.
          </div>
        ) : (
          <div className="space-y-4">
            {production.machines.map((machine) => {
              const maxHourly = Math.max(
                1,
                ...Object.values(machine.hourly_distribution).map((v) => Number(v) || 0),
              );

              return (
                <div
                  key={machine.machine_id}
                  className="p-3.5 rounded-lg border border-black/[0.06] bg-white/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <span>{machine.machine_name}</span>
                      <span className="text-[10px] font-normal text-neutral-500 px-2 py-0.5 rounded bg-neutral-100 uppercase">
                        {machine.machine_type}
                      </span>
                    </div>
                    <div className="font-mono font-medium text-neutral-700">
                      Loads:{" "}
                      <strong className="text-neutral-950 font-bold">{machine.total_loads}</strong>
                    </div>
                  </div>

                  {/* Hourly spark bars */}
                  <div className="grid grid-cols-12 gap-1.5 pt-1">
                    {activeHours.map((h) => {
                      const loadCount =
                        machine.hourly_distribution[`hour_${h}`] ||
                        machine.hourly_distribution[`h${h}`] ||
                        0;
                      const heightPct = Math.min(100, Math.max(12, (loadCount / maxHourly) * 100));

                      return (
                        <div key={h} className="flex flex-col items-center gap-1">
                          <div className="w-full h-10 bg-neutral-100 rounded-sm flex items-end overflow-hidden p-0.5">
                            <div
                              className={`w-full rounded-xs transition-all duration-300 ${
                                loadCount > 0
                                  ? "bg-neutral-800 hover:bg-neutral-900"
                                  : "bg-neutral-200"
                              }`}
                              style={{ height: `${heightPct}%` }}
                              title={`${h}:00 - ${loadCount} loads`}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-neutral-400">{h}h</span>
                        </div>
                      );
                    })}
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
