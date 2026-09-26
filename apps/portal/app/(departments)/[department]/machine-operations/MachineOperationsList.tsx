'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, Clock } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

interface DelayEntry {
  id: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time: string;
  duration_hours: number;
  is_manual_override: boolean;
  status: 'draft' | 'committed';
  delay_category?: {
    name: string;
  };
}

interface MachineOperation {
  id: string;
  machine_id: string;
  operator_id: string | null;
  site_id: string | null;
  shift_type: 'day' | 'night';
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
  if (operations.length === 0) {
    return (
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No operations logged today. Use the form above to add operations.
        </p>
      </GlassCard>
    );
  }

  // AGENT-TRACE: Pre-index todayLoads into a Map by machine_id to replace O(N * L) filter/reduce with O(1) Map lookups
  const loadsByMachine = useMemo(() => {
    const map = new Map<string, number>();
    if (!todayLoads) return map;
    for (const load of todayLoads) {
      if (!load.machine_id) continue;
      map.set(load.machine_id, (map.get(load.machine_id) || 0) + (load.total_loads || 0));
    }
    return map;
  }, [todayLoads]);

  // AGENT-TRACE: Pre-index activeBreakdowns into a Map by fleet_id to replace O(N * B) array searching with O(1) Map lookups
  const breakdownsByFleet = useMemo(() => {
    const map = new Map<string, Breakdown>();
    if (!activeBreakdowns) return map;
    for (const breakdown of activeBreakdowns) {
      if (breakdown.fleet_id) {
        map.set(breakdown.fleet_id, breakdown);
      }
    }
    return map;
  }, [activeBreakdowns]);

  // AGENT-TRACE: Group operations by site and compute site metrics in a single O(N) pass inside useMemo
  const siteEntries = useMemo(() => {
    const siteMap = new Map<
      string,
      {
        siteName: string;
        operations: MachineOperation[];
        siteHours: number;
        siteBcm: number;
      }
    >();

    for (const op of operations) {
      const siteKey = op.site_id ?? '__none__';
      const siteName = op.site?.name ?? 'No Site Assigned';
      let entry = siteMap.get(siteKey);
      if (!entry) {
        entry = { siteName, operations: [], siteHours: 0, siteBcm: 0 };
        siteMap.set(siteKey, entry);
      }
      entry.operations.push(op);
      entry.siteHours += op.hours_worked || 0;

      const binFactor = op.machine?.bin_factor || 0;
      const machineLoads = loadsByMachine.get(op.machine_id) || 0;
      entry.siteBcm += machineLoads * binFactor;
    }

    return Array.from(siteMap.entries()).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return 0;
    });
  }, [operations, loadsByMachine]);

  return (
    <div className="space-y-6">
      {siteEntries.map(([siteKey, { siteName, operations: siteOps, siteHours, siteBcm }]) => {
        const dayOps = siteOps.filter((op) => op.shift_type === 'day');
        const nightOps = siteOps.filter((op) => op.shift_type === 'night');

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
                      machineLoads={loadsByMachine.get(op.machine_id) || 0}
                      machineBreakdown={
                        breakdownsByFleet.get(op.machine_id) ||
                        (op.machine?.serial_number
                          ? breakdownsByFleet.get(op.machine.serial_number)
                          : undefined)
                      }
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
                      machineLoads={loadsByMachine.get(op.machine_id) || 0}
                      machineBreakdown={
                        breakdownsByFleet.get(op.machine_id) ||
                        (op.machine?.serial_number
                          ? breakdownsByFleet.get(op.machine.serial_number)
                          : undefined)
                      }
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

function OperationCard({
  operation,
  machineLoads,
  machineBreakdown,
}: {
  operation: MachineOperation;
  machineLoads: number;
  machineBreakdown?: Breakdown;
}) {
  const isComplete = operation.end_time !== null && operation.hours_worked !== null;
  const isInProgress = operation.end_time === null;

  // Calculate BCM metrics using pre-indexed machineLoads
  const binFactor = operation.machine?.bin_factor || 0;
  const materialBCM = machineLoads * binFactor;
  const bcmPerHour =
    (operation.hours_worked || 0) > 0 ? materialBCM / (operation.hours_worked || 1) : 0;

  // AGENT-TRACE: Calculate delay totals by category and status
  const delayEntries = operation.delay_entries || [];
  const totalDelayHours = delayEntries.reduce((sum, d) => sum + d.duration_hours, 0);
  const _committedDelayHours = delayEntries
    .filter((d) => d.status === 'committed')
    .reduce((sum, d) => sum + d.duration_hours, 0);
  const draftDelayHours = delayEntries
    .filter((d) => d.status === 'draft')
    .reduce((sum, d) => sum + d.duration_hours, 0);

  // Group delays by category — memoize to avoid recalculation on toggle state changes
  const delaysByCategory = useMemo(() => {
    return delayEntries.reduce(
      (acc, delay) => {
        const categoryName = delay.delay_category?.name || 'Unknown';
        if (!acc[categoryName]) {
          acc[categoryName] = 0;
        }
        acc[categoryName] += delay.duration_hours;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [delayEntries]);

  const [showDelays, setShowDelays] = useState(false);

  return (
    <GlassCard className="py-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div
              className={`w-2 h-2 rounded-full ${
                machineBreakdown?.status === 'active'
                  ? 'bg-accent-red animate-pulse'
                  : isComplete
                    ? 'bg-accent-green'
                    : isInProgress
                      ? 'bg-accent-blue animate-pulse'
                      : 'bg-[var(--text-secondary)]'
              }`}
            />

            {/* Machine & Details */}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[var(--text-heading)] font-medium">
                  {operation.machine?.name || 'Unknown Machine'}
                </p>
                {machineBreakdown && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                      machineBreakdown.status === 'active'
                        ? 'bg-accent-red/10 text-accent-red'
                        : 'bg-accent-green/10 text-accent-green'
                    }`}
                  >
                    <AlertCircle size={12} />
                    {machineBreakdown.status === 'active' ? 'Active Breakdown' : 'Repaired'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                <span>{operation.operator?.full_name || 'No Operator'}</span>
                <span className="text-[var(--border-emphasis)]">|</span>
                <span>{operation.site?.name || 'No Site'}</span>
              </div>
            </div>
          </div>

          {/* Time, Hours & BCM */}
          <div className="text-right">
            <p className="text-[var(--text-heading)] text-sm">
              {formatTime(operation.start_time)} -{' '}
              {operation.end_time ? formatTime(operation.end_time) : 'In Progress'}
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
                  machineBreakdown.status === 'active'
                    ? 'text-accent-red mt-0.5 shrink-0'
                    : 'text-accent-green mt-0.5 shrink-0'
                }
              />
              <div>
                <p
                  className={`font-medium ${machineBreakdown.status === 'active' ? 'text-accent-red' : 'text-accent-green'}`}
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
                {delayEntries.length} delay{delayEntries.length > 1 ? 's' : ''}
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

// AGENT-TRACE: Memoize MachineOperationsList — props (operations, todayLoads,
// activeBreakdowns) are stable across renders from parent state changes.
const MemoizedMachineOperationsList = memo(MachineOperationsList);

export { MemoizedMachineOperationsList as MachineOperationsList };
