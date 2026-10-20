'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, CheckCircle2, Clock, Plus, Search } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

export interface DelayEntry {
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

export interface MachineOperation {
  id: string;
  machine_id: string;
  operator_id: string | null;
  site_id: string | null;
  shift_type: 'day' | 'night';
  start_time: string;
  end_time: string | null;
  hours_worked: number | null;
  start_smu?: number | null;
  end_smu?: number | null;
  block_drilled?: string | null;
  meters_drilled?: number | null;
  holes_drilled?: number | null;
  machine?: {
    name: string;
    machine_type?: string;
    bin_factor?: number;
    serial_number?: string | null;
  } | null;
  operator?: { full_name: string } | null;
  site?: { name: string } | null;
  delay_entries?: DelayEntry[];
}

export interface HourlyLoadSummary {
  machine_id: string;
  shift_type: string;
  total_loads: number;
}

export interface Breakdown {
  id: string;
  fleet_id: string;
  reason: string;
  repair_notes: string | null;
  status: string;
  date_in: string;
  date_out: string | null;
}

export interface MachineItem {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  site_id?: string | null;
  latest_smu?: number | null;
  bin_factor?: number | null;
  site?: { name: string; site_code?: string } | null;
}

export interface MachineOperationsListProps {
  operations: MachineOperation[];
  todayLoads?: HourlyLoadSummary[];
  activeBreakdowns?: Breakdown[];
  machines?: MachineItem[];
  engineeringDelaysByMachine?: Record<string, { hours: number; reasons: string[]; status: string }>;
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5); // HH:MM format
}

type FilterStatus = 'all' | 'operating' | 'standby' | 'breakdown';

function MachineOperationsList({
  operations = [],
  todayLoads = [],
  activeBreakdowns = [],
  machines,
  engineeringDelaysByMachine = {},
}: MachineOperationsListProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // BOLT-OPTIMIZATION: Pre-index todayLoads by machine_id into a Map to replace O(N * L) array filtering
  // inside renders with O(1) Map lookups. Defensive array fallback (todayLoads || []) handles undefined inputs.
  const loadsByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const load of todayLoads || []) {
      if (!load.machine_id) continue;
      const current = map.get(load.machine_id) || 0;
      map.set(load.machine_id, current + (load.total_loads || 0));
    }
    return map;
  }, [todayLoads]);

  // BOLT-OPTIMIZATION: Pre-index activeBreakdowns by fleet_id into a Map to replace O(N * B) array searching
  // with O(1) Map lookups. Defensive array fallback (activeBreakdowns || []) handles undefined inputs.
  const breakdownsByFleetId = useMemo(() => {
    const map = new Map<string, Breakdown>();
    for (const breakdown of activeBreakdowns || []) {
      if (breakdown.fleet_id) {
        map.set(breakdown.fleet_id, breakdown);
      }
    }
    return map;
  }, [activeBreakdowns]);

  // Index operations by machine_id
  const operationsByMachine = useMemo(() => {
    const map = new Map<string, MachineOperation[]>();
    for (const op of operations) {
      if (!op.machine_id) continue;
      const list = map.get(op.machine_id) || [];
      list.push(op);
      map.set(op.machine_id, list);
    }
    return map;
  }, [operations]);

  // Mode A: Legacy mode when `machines` prop is not passed
  // Maintains 100% backwards compatibility with existing tests
  const legacySiteEntries = useMemo(() => {
    if (machines !== undefined) return null;

    const siteMap = new Map<string, { siteName: string; operations: MachineOperation[] }>();

    for (const op of operations) {
      const siteKey = op.site_id ?? '__none__';
      const siteName = op.site?.name ?? 'No Site Assigned';
      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, { siteName, operations: [] });
      }
      siteMap.get(siteKey)!.operations.push(op);
    }

    return Array.from(siteMap.entries()).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return 0;
    });
  }, [operations, machines]);

  // Mode B: Fleet Machines Mode (when `machines` prop is provided)
  // Consolidates all fleet machines with their status, SMR, and shifts logged today.
  const fleetMachines = useMemo(() => {
    if (!machines) return [];
    const list: MachineItem[] = [...machines];
    const knownIds = new Set(machines.map((m) => m.id));

    // Synthesize entries for any machines present in operations but missing from machines array
    for (const op of operations) {
      if (op.machine_id && !knownIds.has(op.machine_id)) {
        knownIds.add(op.machine_id);
        list.push({
          id: op.machine_id,
          name: op.machine?.name || 'Unknown Machine',
          machine_type: op.machine?.machine_type || 'Unknown Type',
          serial_number: op.machine?.serial_number || null,
          bin_factor: op.machine?.bin_factor,
          site_id: op.site_id,
          site: op.site ? { name: op.site.name } : null,
          latest_smu: op.end_smu ?? op.start_smu ?? null,
        });
      }
    }

    return list;
  }, [machines, operations]);

  // Pre-calculate status and stats for each machine
  const machinesWithMeta = useMemo(() => {
    return fleetMachines.map((machine) => {
      const breakdown =
        breakdownsByFleetId.get(machine.id) ||
        (machine.serial_number ? breakdownsByFleetId.get(machine.serial_number) : undefined);
      const isBreakdown = breakdown?.status === 'active';

      const machineOps = operationsByMachine.get(machine.id) || [];
      const hasOps = machineOps.length > 0;
      const isInProgress = machineOps.some((op) => op.end_smu == null && op.end_time === null);
      const totalHours = machineOps.reduce((sum, op) => sum + (op.hours_worked || 0), 0);

      let status: 'breakdown' | 'in-progress' | 'operating' | 'standby';
      if (isBreakdown) {
        status = 'breakdown';
      } else if (isInProgress) {
        status = 'in-progress';
      } else if (hasOps) {
        status = 'operating';
      } else {
        status = 'standby';
      }

      return {
        machine,
        breakdown,
        operations: machineOps,
        status,
        totalHours,
      };
    });
  }, [fleetMachines, breakdownsByFleetId, operationsByMachine]);

  // Metrics counts
  const counts = useMemo(() => {
    let operating = 0;
    let standby = 0;
    let breakdown = 0;

    for (const item of machinesWithMeta) {
      if (item.status === 'breakdown') {
        breakdown++;
      } else if (item.status === 'operating' || item.status === 'in-progress') {
        operating++;
      } else {
        standby++;
      }
    }

    return {
      total: machinesWithMeta.length,
      operating,
      standby,
      breakdown,
    };
  }, [machinesWithMeta]);

  // Filter and search
  const filteredMachines = useMemo(() => {
    return machinesWithMeta.filter((item) => {
      // Status filter
      if (
        filterStatus === 'operating' &&
        item.status !== 'operating' &&
        item.status !== 'in-progress'
      ) {
        return false;
      }
      if (filterStatus === 'standby' && item.status !== 'standby') {
        return false;
      }
      if (filterStatus === 'breakdown' && item.status !== 'breakdown') {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = item.machine.name.toLowerCase().includes(query);
        const typeMatch = item.machine.machine_type.toLowerCase().includes(query);
        const snMatch = item.machine.serial_number?.toLowerCase().includes(query) ?? false;
        const siteMatch = item.machine.site?.name?.toLowerCase().includes(query) ?? false;
        return nameMatch || typeMatch || snMatch || siteMatch;
      }

      return true;
    });
  }, [machinesWithMeta, filterStatus, searchQuery]);

  // Group filtered machines by site
  const siteGrouped = useMemo(() => {
    const map = new Map<
      string,
      { siteName: string; siteCode?: string; items: typeof filteredMachines }
    >();

    for (const item of filteredMachines) {
      const siteKey = item.machine.site_id || item.machine.site?.name || '__unassigned__';
      const siteName = item.machine.site?.name || 'Unassigned Site';
      const siteCode = item.machine.site?.site_code;

      if (!map.has(siteKey)) {
        map.set(siteKey, { siteName, siteCode, items: [] });
      }
      map.get(siteKey)!.items.push(item);
    }

    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '__unassigned__') return 1;
      if (b === '__unassigned__') return -1;
      return 0;
    });
  }, [filteredMachines]);

  // Mode A Render: when `machines` prop is not passed
  if (machines === undefined) {
    if (operations.length === 0) {
      return (
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm text-center py-8">
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
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                  <h4 className="text-[var(--text-heading)] font-semibold text-sm">{siteName}</h4>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
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
                  <h5 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider pl-4 border-l-2 border-[var(--accent-amber)]">
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
                  <h5 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider pl-4 border-l-2 border-[var(--accent-purple)]">
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
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No machines registered in the fleet. Contact an administrator to add machines.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5" data-testid="fleet-machines-list">
      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStatus === 'all'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            All Machines ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('operating')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filterStatus === 'operating'
                ? 'bg-accent-green text-white shadow-sm'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block" />
            Operating ({counts.operating})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('standby')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStatus === 'standby'
                ? 'bg-[var(--text-heading)] text-white shadow-sm'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            Standby ({counts.standby})
          </button>
          {counts.breakdown > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('breakdown')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterStatus === 'breakdown'
                  ? 'bg-accent-red text-white shadow-sm'
                  : 'bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red/20'
              }`}
            >
              <AlertCircle size={12} />
              Breakdowns ({counts.breakdown})
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search machine, type, or SN..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
          />
        </div>
      </div>

      {/* Filtered Machine Results */}
      {filteredMachines.length === 0 ? (
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm text-center py-6">
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
                <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                    {siteCode && (
                      <span className="inline-flex px-1.5 py-0.5 rounded font-mono text-[11px] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
                        {siteCode}
                      </span>
                    )}
                    <h4 className="text-[var(--text-heading)] font-semibold text-sm">{siteName}</h4>
                    <span className="text-xs text-[var(--text-muted)]">
                      ({items.length} machine{items.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span className="text-accent-green font-medium">
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

function FleetMachineCard({
  machine,
  breakdown,
  operations,
  status,
  totalHours,
  loadsByMachine,
  breakdownsByFleetId,
  engineeringDelay,
}: {
  machine: MachineItem;
  breakdown?: Breakdown;
  operations: MachineOperation[];
  status: 'breakdown' | 'in-progress' | 'operating' | 'standby';
  totalHours: number;
  loadsByMachine: Map<string, number>;
  breakdownsByFleetId: Map<string, Breakdown>;
  engineeringDelay?: { hours: number; reasons: string[]; status: string };
}) {
  const [isExpanded, setIsExpanded] = useState(operations.length > 0);

  const scrollToForm = () => {
    const formElem = document.getElementById('machine-operations-form');
    if (formElem) {
      formElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <GlassCard className="py-3 px-4">
      <div className="space-y-3">
        {/* Machine Header Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Indicator, Machine Name, Type, SN */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Status Indicator */}
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                status === 'breakdown'
                  ? 'bg-accent-red animate-pulse'
                  : status === 'in-progress'
                    ? 'bg-accent-blue animate-pulse'
                    : status === 'operating'
                      ? 'bg-accent-green'
                      : 'bg-[var(--text-muted)]/50'
              }`}
            />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[var(--text-heading)] font-semibold text-sm">
                  {machine.name}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] font-medium">
                  {machine.machine_type}
                </span>
                {machine.serial_number && (
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    SN: {machine.serial_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: SMR, Status Badge & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Latest SMR */}
            {machine.latest_smu != null && (
              <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)]">
                SMR {machine.latest_smu.toFixed(1)}
              </span>
            )}

            {/* Status Badge */}
            {status === 'breakdown' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-accent-red/10 text-accent-red border border-accent-red/20">
                <AlertCircle size={12} />
                Breakdown
              </span>
            )}
            {status === 'in-progress' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-accent-blue/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 animate-pulse">
                <Clock size={12} />
                In Progress
              </span>
            )}
            {status === 'operating' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
                <CheckCircle2 size={12} />
                {totalHours.toFixed(1)}h logged
              </span>
            )}
            {status === 'standby' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-default)]">
                Standby
              </span>
            )}

            {/* Shift Count / Toggle button */}
            {operations.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-[var(--accent-blue)] hover:underline font-medium ml-1"
              >
                {operations.length} shift{operations.length !== 1 ? 's' : ''} (
                {isExpanded ? 'Hide' : 'Show'})
              </button>
            )}
          </div>
        </div>

        {/* Breakdown Alert Banner */}
        {breakdown && breakdown.status === 'active' && (
          <div className="p-2.5 rounded-lg bg-accent-red/10 border border-accent-red/20 text-xs">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-accent-red shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-accent-red">
                    Engineering Breakdown: {breakdown.reason}
                  </p>
                  {breakdown.repair_notes && (
                    <p className="text-[var(--text-secondary)] mt-0.5">{breakdown.repair_notes}</p>
                  )}
                </div>
              </div>
              {engineeringDelay && engineeringDelay.hours > 0 && (
                <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                  Eng Delay: {engineeringDelay.hours.toFixed(1)}h · Remaining Shift Cap:{' '}
                  {Math.max(0, 12 - engineeringDelay.hours).toFixed(1)}h
                </span>
              )}
            </div>
          </div>
        )}

        {/* Today's Shifts for this machine */}
        {operations.length > 0 ? (
          isExpanded && (
            <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
              {operations.map((op) => (
                <OperationCard
                  key={op.id}
                  operation={op}
                  loadsByMachine={loadsByMachine}
                  breakdownsByFleetId={breakdownsByFleetId}
                />
              ))}
            </div>
          )
        ) : (
          /* Standby notice when no operations logged */
          <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="italic">Standby — No operations logged today</span>
            <button
              type="button"
              onClick={scrollToForm}
              className="inline-flex items-center gap-1 text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 font-medium transition-colors"
            >
              <Plus size={12} />
              Log Shift
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function OperationCard({
  operation,
  loadsByMachine,
  breakdownsByFleetId,
}: {
  operation: MachineOperation;
  loadsByMachine: Map<string, number>;
  breakdownsByFleetId: Map<string, Breakdown>;
}) {
  const isComplete =
    (operation.end_smu != null || operation.end_time !== null) && operation.hours_worked !== null;
  const isInProgress = operation.end_smu == null && operation.end_time === null;

  const isDozer =
    operation.machine?.machine_type === 'Dozer' ||
    Boolean(operation.machine?.machine_type?.toLowerCase().includes('dozer'));

  // Calculate BCM metrics using pre-indexed Map (O(1) lookup) + fixed Dozer Roll-over (250 BCM/h)
  const binFactor = operation.machine?.bin_factor || 0;
  const machineLoads = loadsByMachine.get(operation.machine_id) || 0;
  const materialBCM = isDozer ? (operation.hours_worked || 0) * 250 : machineLoads * binFactor;
  const bcmPerHour = isDozer
    ? 250
    : (operation.hours_worked || 0) > 0
      ? materialBCM / (operation.hours_worked || 1)
      : 0;

  // Match breakdown by machine_id or serial_number using pre-indexed Map (O(1) lookup)
  const machineBreakdown =
    breakdownsByFleetId.get(operation.machine_id) ||
    (operation.machine?.serial_number
      ? breakdownsByFleetId.get(operation.machine.serial_number)
      : undefined);

  // Calculate delay totals by category and status
  const delayEntries = operation.delay_entries || [];
  const totalDelayHours = delayEntries.reduce((sum, d) => sum + d.duration_hours, 0);
  const _committedDelayHours = delayEntries
    .filter((d) => d.status === 'committed')
    .reduce((sum, d) => sum + d.duration_hours, 0);
  const draftDelayHours = delayEntries
    .filter((d) => d.status === 'draft')
    .reduce((sum, d) => sum + d.duration_hours, 0);

  // Group delays by category
  const delaysByCategory = delayEntries.reduce(
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

  const [showDelays, setShowDelays] = useState(false);

  return (
    <GlassCard className="py-2.5 px-3">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                <p className="text-[var(--text-heading)] font-medium text-xs sm:text-sm">
                  {operation.machine?.name || 'Unknown Machine'}
                </p>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                    operation.shift_type === 'day'
                      ? 'bg-[var(--accent-amber)]/15 text-[var(--accent-amber)] border border-[var(--accent-amber)]/30'
                      : 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                  }`}
                >
                  {operation.shift_type} shift
                </span>
                {machineBreakdown && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                      machineBreakdown.status === 'active'
                        ? 'bg-accent-red/10 text-accent-red'
                        : 'bg-accent-green/10 text-accent-green'
                    }`}
                  >
                    <AlertCircle size={10} />
                    {machineBreakdown.status === 'active' ? 'Active Breakdown' : 'Repaired'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                <span>{operation.operator?.full_name || 'No Operator'}</span>
                <span className="text-[var(--border-emphasis)]">|</span>
                <span>{operation.site?.name || 'No Site'}</span>
                {operation.block_drilled && (
                  <>
                    <span className="text-[var(--border-emphasis)]">|</span>
                    <span className="text-[var(--text-heading)] font-medium">
                      Block: {operation.block_drilled}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Time, Hours, Drilling Metrics & BCM */}
          <div className="text-right">
            <p className="text-[var(--text-heading)] text-xs sm:text-sm">
              {operation.start_smu != null && operation.end_smu != null ? (
                <>
                  SMR {operation.start_smu.toFixed(1)} – {operation.end_smu.toFixed(1)}
                </>
              ) : operation.start_smu != null ? (
                <>SMR {operation.start_smu.toFixed(1)} – In Progress</>
              ) : (
                <>
                  {formatTime(operation.start_time)} -{' '}
                  {operation.end_time ? formatTime(operation.end_time) : 'In Progress'}
                </>
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5 justify-end flex-wrap text-xs">
              {operation.start_smu != null ? (
                <span className="text-[var(--text-muted)] font-mono text-[11px]">
                  {formatTime(operation.start_time)}
                  {operation.end_time ? ` - ${formatTime(operation.end_time)}` : ''}
                </span>
              ) : null}
              {operation.hours_worked !== null && (
                <span className="text-accent-green font-medium">
                  {operation.hours_worked.toFixed(2)}h
                </span>
              )}
              {operation.meters_drilled != null && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-accent-green font-medium">
                    {Number(operation.meters_drilled).toFixed(1)}m
                  </span>
                </>
              )}
              {operation.holes_drilled != null && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--accent-blue)] font-medium">
                    {operation.holes_drilled} holes
                  </span>
                </>
              )}
              {(binFactor > 0 || isDozer) && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--accent-blue)]">
                    {isDozer
                      ? `Roll-over: ${materialBCM.toFixed(1)} BCM`
                      : `${materialBCM.toFixed(1)} BCM`}
                  </span>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-accent-blue">{bcmPerHour.toFixed(1)} BCM/h</span>
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
              type="button"
              onClick={() => setShowDelays(!showDelays)}
              className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
            >
              <Clock size={14} />
              <span className="font-medium">
                {delayEntries.length} delay{delayEntries.length > 1 ? 's' : ''}
              </span>
              <span className="text-accent-red">{totalDelayHours.toFixed(2)}h total</span>
              {draftDelayHours > 0 && (
                <span className="text-[var(--accent-amber)]">
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
                  <div className="flex items-center gap-1 text-xs text-[var(--accent-amber)]">
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
// activeBreakdowns, machines) are stable across renders from parent state changes.
const MemoizedMachineOperationsList = memo(MachineOperationsList);

export { MemoizedMachineOperationsList as MachineOperationsList };
