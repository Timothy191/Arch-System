"use client";

import type { ShiftTireEvent } from "@repo/contract/types/shift-compilation.types";
import { GlassCard } from "@repo/ui/GlassCard";
import { Disc, AlertTriangle, CheckCircle2, Gauge, Ruler } from "lucide-react";

interface TireAlertsBannerProps {
  tireEvents: ShiftTireEvent[];
}

export function TireAlertsBanner({ tireEvents }: TireAlertsBannerProps) {
  const criticalCount = tireEvents.filter((t) => t.condition_status === "critical").length;
  const warningCount = tireEvents.filter((t) => t.condition_status === "warning").length;

  return (
    <GlassCard className="overflow-hidden border border-black/[0.08] shadow-card bg-white/70 backdrop-blur-xl">
      <div className="border-b border-black/[0.08] px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <Disc className="h-4 w-4 text-neutral-700" />
            Tire Health & Inspection Activity
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Pressure telemetry, tread wear logs, and tire swap events logged for this shift
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {criticalCount > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
              {warningCount} Warning
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && tireEvents.length > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              All Inspected Good
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {tireEvents.length === 0 ? (
          <div className="py-6 text-center text-neutral-500 text-xs">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
            No tire inspections or replacement logs recorded for this shift.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tireEvents.map((event) => {
              const isCritical = event.condition_status === "critical";
              const isWarning = event.condition_status === "warning";

              return (
                <div
                  key={event.id}
                  className={`p-3.5 rounded-lg border text-xs flex flex-col justify-between ${
                    isCritical
                      ? "border-rose-200 bg-rose-50/40"
                      : isWarning
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-black/[0.06] bg-white/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                        <span>{event.serial_number}</span>
                        {event.machine_name && (
                          <span className="text-neutral-500 font-normal text-[11px]">
                            ({event.machine_name})
                          </span>
                        )}
                      </div>
                      <div className="text-neutral-500 text-[11px] mt-0.5">{event.position}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        isCritical
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : isWarning
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {event.condition_status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-700 pt-1 border-t border-black/[0.04]">
                    {event.pressure_psi !== null && event.pressure_psi !== undefined && (
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3 text-neutral-400" />
                        {event.pressure_psi} PSI
                      </span>
                    )}
                    {event.tread_depth_mm !== null && event.tread_depth_mm !== undefined && (
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3 text-neutral-400" />
                        {event.tread_depth_mm} mm
                      </span>
                    )}
                  </div>

                  {event.notes && (
                    <p className="mt-2 text-[11px] text-neutral-600 italic">{event.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
