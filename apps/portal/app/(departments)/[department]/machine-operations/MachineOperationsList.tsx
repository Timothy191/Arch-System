'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { memo, useMemo, useState } from 'react';
import {
  FleetMachineCard,
  MachineOperationsFilterStrip,
  OperationCard,
} from './MachineOperationsSummaryStrip';
import {
  buildBreakdownsByFleetIdMap,
  buildFleetMachinesList,
  buildLegacySiteEntries,
  buildLoadsByMachineMap,
  buildOperationsByMachineMap,
  computeMachineStatusCounts,
  computeMachinesWithMeta,
  type FilterStatus,
  filterMachinesWithMeta,
  groupMachinesBySite,
  type MachineOperationsListProps,
} from './machine-operations-constants';

function MachineOperationsList({
  operations = [],
  todayLoads = [],
  activeBreakdowns = [],
  machines,
  engineeringDelaysByMachine = {},
}: MachineOperationsListProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadsByMachine = useMemo(() => buildLoadsByMachineMap(todayLoads), [todayLoads]);

  const breakdownsByFleetId = useMemo(
    () => buildBreakdownsByFleetIdMap(activeBreakdowns),
    [activeBreakdowns]
  );

  const operationsByMachine = useMemo(() => buildOperationsByMachineMap(operations), [operations]);

  // Mode A: Legacy mode when `machines` prop is not passed
  const legacySiteEntries = useMemo(
    () => buildLegacySiteEntries(operations, machines),
    [operations, machines]
  );

  // Mode B: Fleet Machines Mode (when `machines` prop is provided)
  const fleetMachines = useMemo(
    () => buildFleetMachinesList(machines, operations),
    [machines, operations]
  );

  const machinesWithMeta = useMemo(
    () => computeMachinesWithMeta(fleetMachines, breakdownsByFleetId, operationsByMachine),
    [fleetMachines, breakdownsByFleetId, operationsByMachine]
  );

  const counts = useMemo(() => computeMachineStatusCounts(machinesWithMeta), [machinesWithMeta]);

  const filteredMachines = useMemo(
    () => filterMachinesWithMeta(machinesWithMeta, filterStatus, searchQuery),
    [machinesWithMeta, filterStatus, searchQuery]
  );

  const siteGrouped = useMemo(() => groupMachinesBySite(filteredMachines), [filteredMachines]);

  // Mode A Render: when `machines` prop is not passed
  if (machines === undefined) {
    if (operations.length === 0) {
      return (
        <GlassCard>
          <p className="py-8 text-center text-[var(--text-muted)] text-sm">
            No operations logged today. Use the form above to add operations.
          </p>
        </GlassCard>
      );
    }

    return (
      <div className="space-y-6">
        {legacySiteEntries?.map(([siteKey, { siteName, operations: siteOps }]) => {
          const siteHours = siteOps.reduce((sum, op) => sum + (op.hours_worked || 0), 0);
          const siteBcm = siteOps.reduce((sum, op) => {
            const isDozerOp =
              op.machine?.machine_type === 'Dozer' ||
              Boolean(op.machine?.machine_type?.toLowerCase().includes('dozer'));
            if (isDozerOp) {
              return sum + (op.hours_worked || 0) * 250;
            }
            const bf = op.machine?.bin_factor || 0;
            const loads = loadsByMachine.get(op.machine_id) || 0;
            return sum + loads * bf;
          }, 0);

          const dayOps = siteOps.filter((op) => op.shift_type === 'day');
          const nightOps = siteOps.filter((op) => op.shift_type === 'night');

          return (
            <div key={siteKey} className="space-y-3">
              {/* Site Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--accent-blue)]" />
                  <h4 className="font-semibold text-[var(--text-heading)] text-sm">{siteName}</h4>
                </div>
                <div className="flex items-center gap-3 text-[var(--text-muted)] text-xs">
                  <span>{siteHours.toFixed(1)}h total</span>
                  {siteBcm > 0 && (
                    <>
                      <span className="text-[var(--border-emphasis)]">|</span>
                      <span className="text-[var(--accent-blue)]">{siteBcm.toFixed(1)} BCM</span>
                    </>
                  )}
                </div>
              </div>

              {/* Shift Subsections */}
              {dayOps.length > 0 && (
                <div className="space-y-2">
                  <h5 className="border-[var(--accent-amber)] border-l-2 pl-4 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                    Day Shift ({dayOps.length})
                  </h5>
                  <div className="space-y-2">
                    {dayOps.map((op) => (
                      <OperationCard
                        key={op.id}
                        operation={op}
                        loadsByMachine={loadsByMachine}
                        breakdownsByFleetId={breakdownsByFleetId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {nightOps.length > 0 && (
                <div className="space-y-2">
                  <h5 className="border-[var(--accent-purple)] border-l-2 pl-4 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                    Night Shift ({nightOps.length})
                  </h5>
                  <div className="space-y-2">
                    {nightOps.map((op) => (
                      <OperationCard
                        key={op.id}
                        operation={op}
                        loadsByMachine={loadsByMachine}
                        breakdownsByFleetId={breakdownsByFleetId}
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

  // Mode B Render: when `machines` prop is provided
  if (fleetMachines.length === 0) {
    return (
      <GlassCard>
        <p className="py-8 text-center text-[var(--text-muted)] text-sm">
          No machines registered in the fleet. Contact an administrator to add machines.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5" data-testid="fleet-machines-list">
      <MachineOperationsFilterStrip
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        counts={counts}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {filteredMachines.length === 0 ? (
        <GlassCard>
          <p className="py-6 text-center text-[var(--text-muted)] text-sm">
            No machines matching the selected filter or search query.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {siteGrouped.map(([siteKey, { siteName, siteCode, items }]) => {
            const siteOperatingCount = items.filter(
              (i) => i.status === 'operating' || i.status === 'in-progress'
            ).length;
            const siteTotalHours = items.reduce((sum, i) => sum + i.totalHours, 0);

            return (
              <div key={siteKey} className="space-y-3">
                {/* Site Header */}
                <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--accent-blue)]" />
                    {siteCode && (
                      <span className="inline-flex rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-mono text-[11px] text-[var(--accent-blue)]">
                        {siteCode}
                      </span>
                    )}
                    <h4 className="font-semibold text-[var(--text-heading)] text-sm">{siteName}</h4>
                    <span className="text-[var(--text-muted)] text-xs">
                      ({items.length} machine{items.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[var(--text-muted)] text-xs">
                    <span className="font-medium text-accent-green">
                      {siteOperatingCount} operating
                    </span>
                    {siteTotalHours > 0 && (
                      <>
                        <span className="text-[var(--border-emphasis)]">|</span>
                        <span>{siteTotalHours.toFixed(1)}h total</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Machines List */}
                <div className="space-y-3">
                  {items.map(
                    ({ machine, breakdown, operations: machineOps, status, totalHours }) => (
                      <FleetMachineCard
                        key={machine.id}
                        machine={machine}
                        breakdown={breakdown}
                        operations={machineOps}
                        status={status}
                        totalHours={totalHours}
                        loadsByMachine={loadsByMachine}
                        breakdownsByFleetId={breakdownsByFleetId}
                        engineeringDelay={
                          engineeringDelaysByMachine[machine.id] ||
                          (machine.serial_number
                            ? engineeringDelaysByMachine[machine.serial_number]
                            : undefined)
                        }
                      />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MemoizedMachineOperationsList = memo(MachineOperationsList);

export { MemoizedMachineOperationsList as MachineOperationsList };
