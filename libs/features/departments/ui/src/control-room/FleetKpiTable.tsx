"use client";

import type { MachinePerformance } from "@repo/contract/types/shift-compilation.types";
import { GlassCard } from "@repo/ui/GlassCard";
import { Wrench, Clock, Activity, CheckCircle2, AlertTriangle } from "lucide-react";

interface FleetKpiTableProps {
  fleet: MachinePerformance[];
}

export function FleetKpiTable({ fleet }: FleetKpiTableProps) {
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

  const avgAvailability = (
    fleet.reduce((acc, curr) => acc + curr.mechanical_availability_pct, 0) / fleet.length
  ).toFixed(1);

  const totalSmuHours = fleet.reduce((acc, curr) => acc + curr.hours_worked, 0).toFixed(1);
  const totalBreakdownHours = fleet.reduce((acc, curr) => acc + curr.breakdown_hours, 0).toFixed(1);

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

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-black/[0.08] bg-neutral-100/60 text-neutral-600 font-medium">
            <tr>
              <th className="px-5 py-3">Machine</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Operating Window</th>
              <th className="px-4 py-3 text-right">SMU Hours</th>
              <th className="px-4 py-3 text-right">Delays (hrs)</th>
              <th className="px-4 py-3 text-right">Breakdown (hrs)</th>
              <th className="px-5 py-3 text-right">Mechanical Availability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {fleet.map((item) => {
              const isHigh = item.mechanical_availability_pct >= 85;
              const isMedium =
                item.mechanical_availability_pct >= 70 && item.mechanical_availability_pct < 85;

              return (
                <tr key={item.machine_id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-5 py-3 font-semibold text-neutral-900 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {item.machine_name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 capitalize">{item.machine_type}</td>
                  <td className="px-4 py-3 text-neutral-500 font-mono text-[11px]">
                    {item.start_time
                      ? `${item.start_time.slice(0, 5)} - ${item.end_time?.slice(0, 5) || "Active"}`
                      : "Not logged"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-neutral-800">
                    {item.hours_worked.toFixed(1)}h
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-amber-700">
                    {item.delay_hours > 0 ? `${item.delay_hours.toFixed(1)}h` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-rose-700">
                    {item.breakdown_hours > 0 ? `${item.breakdown_hours.toFixed(1)}h` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        isHigh
                          ? "bg-emerald-100/70 text-emerald-800 border border-emerald-200"
                          : isMedium
                            ? "bg-amber-100/70 text-amber-800 border border-amber-200"
                            : "bg-rose-100/70 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {!isHigh && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {item.mechanical_availability_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
