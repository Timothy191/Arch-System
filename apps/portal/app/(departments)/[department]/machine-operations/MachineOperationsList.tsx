"use client";

import { memo, useState, useMemo } from "react";
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
  machine?: { name: string; bin_factor?: number; serial_number?: string | null } | null;
  operator?: { full_name: string } | null;
  site?: { name: string } | null;
  delay_entries?: DelayEntry[];
}

interface HourlyLoadSummary {
  machine_id: string;
  shift_type: string;
  total_loads: number;
}

interface Breakdown {
  id: string;
  fleet_id: string;
  reason: string;
  repair_notes: string | null;
  status: string;
  date_in: string;
  date_out: string | null;
}

interface MachineOperationsListProps {
  operations: MachineOperation[];
  todayLoads: HourlyLoadSummary[];
  activeBreakdowns?: Breakdown[];
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5); // HH:MM format
}

function MachineOperationsList({
  operations,
  todayLoads,
  activeBreakdowns = [],
}: MachineOperationsListProps) {
  // Performance Optimization: Pre-index todayLoads by machine_id into a Map to replace O(N * M) nested .filter().reduce() with O(1) lookups
  const loadsByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const load of todayLoads) {
      if (load.machine_id) {
        map.set(load.machine_id, (map.get(load.machine_id) || 0) + (load.total_loads || 0));
      }
    }
    return map;
  }, [todayLoads]);

  // Performance Optimization: Pre-index activeBreakdowns by fleet_id into a Map to replace O(B) array .find() calls with O(1) lookups
  const breakdownsByFleet = useMemo(() => {
    const map = new Map<string, Breakdown>();
    for (const b of activeBreakdowns) {
      if (b.fleet_id) {
        map.set(b.fleet_id, b);
      }
    }
    return map;
  }, [activeBreakdowns]);

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
          const loads = loadsByMachine.get(op.machine_id) || 0;
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
                    <OperationCard
                      key={op.id}
                      operation={op}
                      loadsByMachine={loadsByMachine}
                      breakdownsByFleet={breakdownsByFleet}
                    />
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
                    <OperationCard
                      key={op.id}
                      operation={op}
                      loadsByMachine={loadsByMachine}
                      breakdownsByFleet={breakdownsByFleet}
                    />
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

// Performance Optimization: Wrap OperationCard in React.memo to prevent unnecessary re-renders of individual operation cards when delay dropdowns or sibling states change
const OperationCard = memo(function OperationCard({
  operation,
  loadsByMachine,
  breakdownsByFleet,
}: {
  operation: MachineOperation;
  loadsByMachine: Map<string, number>;
  breakdownsByFleet: Map<string, Breakdown>;
}) {
  const isComplete = operation.end_time !== null && operation.hours_worked !== null;
  const isInProgress = operation.end_time === null;

  // Calculate BCM metrics using pre-indexed loads Map lookup O(1)
  const binFactor = operation.machine?.bin_factor || 0;
  const machineLoads = loadsByMachine.get(operation.machine_id) || 0;
  const materialBCM = machineLoads * binFactor;
  const bcmPerHour =
    (operation.hours_worked || 0) > 0 ? materialBCM / (operation.hours_worked || 1) : 0;

  // O(1) Breakdown lookup by machine_id or serial_number
  const machineBreakdown =
    breakdownsByFleet.get(operation.machine_id) ||
    (operation.machine?.serial_number ? breakdownsByFleet.get(operation.machine.serial_number) : undefined);

  // Calculate delay totals by category and status
  const delayEntries = operation.delay_entries || [];
  const totalDelayHours = delayEntries.reduce((sum, d) => sum + d.duration_hours, 0);
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
                machineBreakdown?.status === "active"
                  ? "bg-accent-red animate-pulse"
                  : isComplete
                    ? "bg-accent-green"
                    : isInProgress
                      ? "bg-accent-blue animate-pulse"
                      : "bg-[var(--text-secondary)]"
              }`}
            />

            {/* Machine & Details */}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[var(--text-heading)] font-medium">
                  {operation.machine?.name || "Unknown Machine"}
                </p>
                {machineBreakdown && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                      machineBreakdown.status === "active"
                        ? "bg-accent-red/10 text-accent-red"
                        : "bg-accent-green/10 text-accent-green"
                    }`}
                  >
                    <AlertCircle size={12} />
                    {machineBreakdown.status === "active" ? "Active Breakdown" : "Repaired"}
                  </span>
                )}
              </div>
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

        {/* Breakdown Summary */}
        {machineBreakdown && (
          <div className="pt-2 border-t border-[var(--border-default)]">
            <div className="flex items-start gap-2 text-xs">
              <AlertCircle
                size={14}
                className={
                  machineBreakdown.status === "active"
                    ? "text-accent-red mt-0.5 shrink-0"
                    : "text-accent-green mt-0.5 shrink-0"
                }
              />
              <div>
                <p
                  className={`font-medium ${machineBreakdown.status === "active" ? "text-accent-red" : "text-accent-green"}`}
                >
                  Engineering Breakdown: {machineBreakdown.reason}
                </p>
                {machineBreakdown.repair_notes && (
                  <p className="text-[var(--text-muted)] mt-0.5">{machineBreakdown.repair_notes}</p>
                )}
              </div>
            </div>
          </div>
        )}

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
});

// AGENT-TRACE: Memoize MachineOperationsList — props (operations, todayLoads,
// activeBreakdowns) are stable across renders from parent state changes.
const MemoizedMachineOperationsList = memo(MachineOperationsList);
export { MemoizedMachineOperationsList as MachineOperationsList };
