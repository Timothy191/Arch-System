"use client";

import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { Clock, AlertCircle } from "lucide-react";

interface DelayEntry {
  id: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time: string;
  duration_hours: number;
  is_manual_override: boolean;
  status: "draft" | "committed";
  delay_category?: {
    name: string;
  };
}

interface MachineOperation {
  id: string;
  machine_id: string;
  operator_id: string | null;
  site_id: string | null;
  shift_type: "day" | "night";
  start_time: string;
  end_time: string | null;
  hours_worked: number | null;
  machine?: { name: string; bin_factor?: number } | null;
  operator?: { full_name: string } | null;
  site?: { name: string } | null;
  delay_entries?: DelayEntry[];
}

interface HourlyLoadSummary {
  machine_id: string;
  shift_type: string;
  total_loads: number;
}

interface MachineOperationsListProps {
  operations: MachineOperation[];
  todayLoads: HourlyLoadSummary[];
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5); // HH:MM format
}

export function MachineOperationsList({ operations, todayLoads }: MachineOperationsListProps) {
  if (operations.length === 0) {
    return (
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No operations logged today. Use the form above to add operations.
        </p>
      </GlassCard>
    );
  }

  // Group by site_id, then by shift
  const siteMap = new Map<string, { siteName: string; operations: MachineOperation[] }>();

  for (const op of operations) {
    const siteKey = op.site_id ?? "__none__";
    const siteName = op.site?.name ?? "No Site Assigned";
    if (!siteMap.has(siteKey)) {
      siteMap.set(siteKey, { siteName, operations: [] });
    }
    siteMap.get(siteKey)!.operations.push(op);
  }

  // "No Site Assigned" last
  const siteEntries = Array.from(siteMap.entries()).sort(([a], [b]) => {
    if (a === "__none__") return 1;
    if (b === "__none__") return -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {siteEntries.map(([siteKey, { siteName, operations: siteOps }]) => {
        const siteHours = siteOps.reduce((sum, op) => sum + (op.hours_worked || 0), 0);
        const siteBcm = siteOps.reduce((sum, op) => {
          const bf = op.machine?.bin_factor || 0;
          const loads = todayLoads
            .filter((l) => l.machine_id === op.machine_id)
            .reduce((s, l) => s + (l.total_loads || 0), 0);
          return sum + loads * bf;
        }, 0);

        const dayOps = siteOps.filter((op) => op.shift_type === "day");
        const nightOps = siteOps.filter((op) => op.shift_type === "night");

        return (
          <div key={siteKey} className="space-y-3">
            {/* Site header */}
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <h4 className="text-base font-medium text-[var(--text-heading)] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-blue)]" />
                {siteName}
              </h4>
              <div className="flex items-center gap-4 text-xs">
                {siteHours > 0 && (
                  <span className="text-accent-green font-medium">{siteHours.toFixed(1)}h</span>
                )}
                {siteBcm > 0 && (
                  <span className="text-[var(--accent-blue)] font-medium">
                    {siteBcm.toFixed(1)} BCM
                  </span>
                )}
              </div>
            </div>

            {dayOps.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-accent-blue flex items-center gap-1.5 ml-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                  Day Shift
                </h5>
                <div className="space-y-2">
                  {dayOps.map((op) => (
                    <OperationCard key={op.id} operation={op} todayLoads={todayLoads} />
                  ))}
                </div>
              </div>
            )}

            {nightOps.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-indigo-400 flex items-center gap-1.5 ml-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Night Shift
                </h5>
                <div className="space-y-2">
                  {nightOps.map((op) => (
                    <OperationCard key={op.id} operation={op} todayLoads={todayLoads} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OperationCard({
  operation,
  todayLoads,
}: {
  operation: MachineOperation;
  todayLoads: HourlyLoadSummary[];
}) {
  const isComplete = operation.end_time !== null && operation.hours_worked !== null;
  const isInProgress = operation.end_time === null;

  // Calculate BCM metrics
  const binFactor = operation.machine?.bin_factor || 0;
  const machineLoads =
    todayLoads
      ?.filter((l) => l.machine_id === operation.machine_id)
      ?.reduce((sum, l) => sum + (l.total_loads || 0), 0) || 0;
  const materialBCM = machineLoads * binFactor;
  const bcmPerHour =
    (operation.hours_worked || 0) > 0 ? materialBCM / (operation.hours_worked || 1) : 0;

  // AGENT-TRACE: Calculate delay totals by category and status
  const delayEntries = operation.delay_entries || [];
  const totalDelayHours = delayEntries.reduce((sum, d) => sum + d.duration_hours, 0);
  const _committedDelayHours = delayEntries
    .filter((d) => d.status === "committed")
    .reduce((sum, d) => sum + d.duration_hours, 0);
  const draftDelayHours = delayEntries
    .filter((d) => d.status === "draft")
    .reduce((sum, d) => sum + d.duration_hours, 0);

  // Group delays by category
  const delaysByCategory = delayEntries.reduce(
    (acc, delay) => {
      const categoryName = delay.delay_category?.name || "Unknown";
      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += delay.duration_hours;
      return acc;
    },
    {} as Record<string, number>,
  );

  const [showDelays, setShowDelays] = useState(false);

  return (
    <GlassCard className="py-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div
              className={`w-2 h-2 rounded-full ${
                isComplete
                  ? "bg-accent-green"
                  : isInProgress
                    ? "bg-accent-blue animate-pulse"
                    : "bg-[var(--text-secondary)]"
              }`}
            />

            {/* Machine & Details */}
            <div>
              <p className="text-[var(--text-heading)] font-medium">
                {operation.machine?.name || "Unknown Machine"}
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                <span>{operation.operator?.full_name || "No Operator"}</span>
                <span className="text-[var(--border-emphasis)]">|</span>
                <span>{operation.site?.name || "No Site"}</span>
              </div>
            </div>
          </div>

          {/* Time, Hours & BCM */}
          <div className="text-right">
            <p className="text-[var(--text-heading)] text-sm">
              {formatTime(operation.start_time)} -{" "}
              {operation.end_time ? formatTime(operation.end_time) : "In Progress"}
            </p>
            <div className="flex items-center gap-3 mt-0.5 justify-end">
              {operation.hours_worked !== null && (
                <span className="text-accent-green text-xs">
                  {operation.hours_worked.toFixed(2)}h
                </span>
              )}
              {binFactor > 0 && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--accent-blue)] text-xs">
                    {materialBCM.toFixed(1)} BCM
                  </span>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-accent-blue text-xs">{bcmPerHour.toFixed(1)} BCM/h</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Delay Summary */}
        {delayEntries.length > 0 && (
          <div className="pt-2 border-t border-[var(--border-default)]">
            <button
              onClick={() => setShowDelays(!showDelays)}
              className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
            >
              <Clock size={14} />
              <span className="font-medium">
                {delayEntries.length} delay{delayEntries.length > 1 ? "s" : ""}
              </span>
              <span className="text-accent-red">{totalDelayHours.toFixed(2)}h total</span>
              {draftDelayHours > 0 && (
                <span className="text-[var(--accent-yellow)]">
                  ({draftDelayHours.toFixed(2)}h draft)
                </span>
              )}
            </button>

            {showDelays && (
              <div className="mt-2 space-y-1 pl-6">
                {Object.entries(delaysByCategory).map(([category, hours]) => (
                  <div key={category} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{category}</span>
                    <span className="text-[var(--text-heading)]">{hours.toFixed(2)}h</span>
                  </div>
                ))}
                {delayEntries.some((d) => d.is_manual_override) && (
                  <div className="flex items-center gap-1 text-xs text-[var(--accent-yellow)]">
                    <AlertCircle size={12} />
                    <span>Includes manual override entries</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
