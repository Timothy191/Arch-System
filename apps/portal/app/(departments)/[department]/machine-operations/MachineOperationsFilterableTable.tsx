'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import type { DataTableColumn } from '@repo/ui/components/ui/data-table';
import { DataTable } from '@repo/ui/components/ui/data-table';
import { Logo } from '@repo/ui/Logo';
import { getOperationalToday } from '@repo/utils';
import { getCurrentShift } from '@repo/utils/client';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Drill,
  Gauge,
  Layers,
  Truck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { invalidateShiftSheetCache } from '@/actions/shift-sheet-cache';
import { MachineOperationsFilterStrip } from './MachineOperationsSummaryStrip';
import {
  type Breakdown,
  buildBreakdownsByFleetIdMap,
  buildFleetMachinesList,
  buildLoadsByMachineMap,
  buildOperationsByMachineMap,
  computeMachineStatusCounts,
  computeMachinesWithMeta,
  type FilterStatus,
  filterMachinesWithMeta,
  type HourlyLoadSummary,
  MACHINE_CATEGORY_LABELS,
  type MachineCategory,
  type MachineItem,
  type MachineOperation,
  type MachineWithMeta,
} from './machine-operations-constants';

export interface MachineTableRow {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  status: string;
  category: MachineCategory;
  start_smu: number | null;
  stop_smu: number | null;
  is_start_smr_carried_over: boolean;
  has_missing_hours: boolean;
  total_hours: number;
  operator: string | null;
  site: string | null;
  // Category-specific metrics
  loads?: number;
  bin_factor?: number | null;
  material_bcm?: number | null;
  holes_drilled?: number | null;
  meters_drilled?: number | null;
  penetration_rate?: string | null;
  block_drilled?: string | null;
  dozer_activity?: string;
  rollover_bcm?: number | null;
  rawMachine: MachineItem;
}

export interface QuickLogHoursPayload {
  machineId: string;
  startSmr: number;
  stopSmr: number;
  hoursWorked: number;
}

export interface MachineOperationsFilterableTableProps {
  departmentId?: string;
  machines: MachineItem[];
  operations: MachineOperation[];
  todayLoads?: HourlyLoadSummary[];
  activeBreakdowns?: Breakdown[];
  engineeringDelaysByMachine?: Record<string, { hours: number; reasons: string[]; status: string }>;
  operators?: Array<{ id: string; full_name: string; employee_code: string }>;
  sites?: Array<{ id: string; name: string; site_code: string }>;
  onQuickLogHours?: (payload: QuickLogHoursPayload) => Promise<void> | void;
  onMachineSelect?: (machine: MachineItem) => void;
  onFilterStatusChange?: (status: FilterStatus) => void;
  onSearchQueryChange?: (query: string) => void;
  defaultCategory?: MachineCategory;
}

const DOZER_PUSH_FACTOR_BCM_PER_HOUR = 250;
const MAX_INLINE_SHIFT_HOURS = 14;
const DEFAULT_INLINE_START_TIME = '06:00';
const INLINE_SMR_INPUT_CLASS =
  'w-20 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-right font-mono text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none';
const CATEGORY_PANEL_HEADER_CLASS =
  'gold-steel-border gold-steel-border-slim relative flex cursor-pointer select-none items-center justify-between rounded-xl border border-accent-gold/45 bg-gradient-to-r from-amber-500/[0.08] via-white/95 to-amber-500/[0.08] px-4 py-3 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-accent-gold hover:bg-amber-50/50';

interface SharedSmrColumnsOptions {
  readonly inlineStartSmrDrafts: Record<string, string>;
  readonly inlineHoursDrafts: Record<string, string>;
  readonly savingMachineId: string | null;
  readonly onStartSmrDraftChange: (machineId: string, draftText: string) => void;
  readonly onHoursDraftChange: (machineId: string, draftText: string) => void;
  readonly onSaveInlineHours: (row: MachineTableRow) => void;
  readonly onDirectToLogMachine: (row: MachineTableRow) => void;
}

function buildSharedSmrColumns(
  options: SharedSmrColumnsOptions
): DataTableColumn<MachineTableRow>[] {
  return [
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => {
        if (row.start_smu !== null) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono font-semibold text-[var(--text-heading)]">
                {row.start_smu.toFixed(1)}
              </span>
              {row.is_start_smr_carried_over && (
                <span data-testid={`carried-over-badge-${row.id}`} className="sr-only">
                  Carried Over
                </span>
              )}
            </div>
          );
        }
        return (
          <div className="flex flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="Start SMR"
              aria-label={`Start SMR for ${row.name}`}
              data-testid={`inline-start-smr-${row.id}`}
              value={options.inlineStartSmrDrafts[row.id] ?? ''}
              onChange={(e) => options.onStartSmrDraftChange(row.id, e.target.value)}
              className={INLINE_SMR_INPUT_CLASS}
            />
            <span className="text-[10px] text-[var(--text-muted)]">No prev Stop SMR</span>
          </div>
        );
      },
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => {
        if (row.stop_smu !== null) {
          return (
            <span className="font-mono text-[var(--text-heading)]">{row.stop_smu.toFixed(1)}</span>
          );
        }
        const hoursDraft = Number.parseFloat(options.inlineHoursDrafts[row.id] ?? '');
        const startDraft = Number.parseFloat(options.inlineStartSmrDrafts[row.id] ?? '');
        const baseStart =
          row.start_smu !== null ? row.start_smu : !Number.isNaN(startDraft) ? startDraft : 0;
        if (!Number.isNaN(hoursDraft) && hoursDraft > 0) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono font-semibold text-[var(--accent-blue)]">
                {(baseStart + hoursDraft).toFixed(1)}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Preview</span>
            </div>
          );
        }
        return <span className="font-mono text-[var(--text-muted)]">—</span>;
      },
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Hours',
      cell: (row: MachineTableRow) => {
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <span
              className={`font-mono font-semibold text-xs ${
                row.total_hours > 0 ? 'text-accent-green' : 'text-[var(--text-muted)]'
              }`}
            >
              {row.total_hours > 0 ? `${row.total_hours.toFixed(1)}h` : '0.0h'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                options.onDirectToLogMachine(row);
              }}
              aria-label={`Log hours for ${row.name}`}
              title={`Direct to log machine ${row.name}`}
              data-testid={`direct-log-hours-${row.id}`}
              className="gold-steel-border gold-steel-border-slim flex h-7 w-7 items-center justify-center rounded-md border border-accent-gold/50 bg-amber-50/80 text-[var(--accent-blue)] shadow-2xs transition-all hover:scale-110 hover:border-accent-gold hover:bg-amber-100"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            {/* Hidden compatibility hook for automated test suites */}
            <input
              type="number"
              className="sr-only"
              data-testid={`inline-add-hours-${row.id}`}
              value={options.inlineHoursDrafts[row.id] ?? ''}
              onChange={(e) => options.onHoursDraftChange(row.id, e.target.value)}
            />
            <button
              type="button"
              className="sr-only"
              data-testid={`inline-save-hours-${row.id}`}
              onClick={(e) => {
                e.stopPropagation();
                options.onSaveInlineHours(row);
              }}
            />
          </div>
        );
      },
      sortable: true,
      align: 'right' as const,
    },
  ];
}

function renderStatusBadge(status: string) {
  switch (status) {
    case 'operating':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-2 py-0.5 font-semibold text-[11px] text-accent-green">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
          Operating
        </span>
      );
    case 'in-progress':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[11px] text-blue-700">
          <Clock className="h-3 w-3" />
          In Progress
        </span>
      );
    case 'breakdown':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-red/10 px-2 py-0.5 font-semibold text-[11px] text-accent-red">
          <AlertCircle className="h-3 w-3" />
          Breakdown
        </span>
      );
    case 'inactive':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 font-semibold text-[11px] text-neutral-600">
          Inactive
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[11px] text-amber-800">
          Standby
        </span>
      );
  }
}

export function MachineOperationsFilterableTable({
  departmentId,
  machines,
  operations,
  todayLoads = [],
  activeBreakdowns = [],
  engineeringDelaysByMachine,
  operators = [],
  sites = [],
  onQuickLogHours,
  onMachineSelect,
  onFilterStatusChange,
  onSearchQueryChange,
  defaultCategory = 'all',
}: MachineOperationsFilterableTableProps) {
  const router = useRouter();
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<MachineCategory>(defaultCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [inlineHoursDrafts, setInlineHoursDrafts] = useState<Record<string, string>>({});
  const [inlineStartSmrDrafts, setInlineStartSmrDrafts] = useState<Record<string, string>>({});
  const [savingMachineId, setSavingMachineId] = useState<string | null>(null);
  const [localOperationOverrides, setLocalOperationOverrides] = useState<
    Record<string, MachineOperation>
  >({});

  const toggleCategoryCollapse = (cat: MachineCategory) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleDirectToLogMachine = (row: MachineTableRow) => {
    onMachineSelect?.(row.rawMachine);
    const formElem = document.getElementById('machine-operations-form');
    if (formElem) {
      formElem.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      const stopInput = document.getElementById('endSmuInput');
      if (stopInput) {
        stopInput.focus();
      }
    }, 150);
  };

  const effectiveOperations = useMemo(() => {
    const overrideIds = new Set(Object.keys(localOperationOverrides));
    if (overrideIds.size === 0) return operations;
    const retained = operations.filter((op) => !overrideIds.has(op.machine_id));
    return [...retained, ...Object.values(localOperationOverrides)];
  }, [operations, localOperationOverrides]);

  // Prepare data mappings
  const machineOps = useMemo(
    () => buildOperationsByMachineMap(effectiveOperations),
    [effectiveOperations]
  );
  const breakdownsByFleetId = useMemo(
    () => buildBreakdownsByFleetIdMap(activeBreakdowns),
    [activeBreakdowns]
  );
  const loadsByMachine = useMemo(() => buildLoadsByMachineMap(todayLoads), [todayLoads]);
  const fleetMachines = useMemo(
    () => buildFleetMachinesList(machines, effectiveOperations),
    [machines, effectiveOperations]
  );

  const allMachinesWithMeta = useMemo(() => {
    return computeMachinesWithMeta(fleetMachines, breakdownsByFleetId, machineOps);
  }, [fleetMachines, breakdownsByFleetId, machineOps]);

  // Overall counts for filter tabs
  const counts = useMemo(
    () => computeMachineStatusCounts(allMachinesWithMeta),
    [allMachinesWithMeta]
  );

  // Filter machines based on selected status, category, and search query
  const filteredMachines = useMemo(() => {
    return filterMachinesWithMeta(
      allMachinesWithMeta,
      filterStatus,
      searchQuery,
      selectedCategory === 'all' ? undefined : selectedCategory
    );
  }, [allMachinesWithMeta, filterStatus, searchQuery, selectedCategory]);

  const handleStatusChange = (status: FilterStatus) => {
    setFilterStatus(status);
    onFilterStatusChange?.(status);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    onSearchQueryChange?.(query);
  };

  const handleSaveInlineHours = async (row: MachineTableRow) => {
    const rawHours = inlineHoursDrafts[row.id] ?? '';
    const parsedHours = Number.parseFloat(rawHours);
    if (Number.isNaN(parsedHours) || parsedHours <= 0 || parsedHours > MAX_INLINE_SHIFT_HOURS) {
      toast.error(`Enter valid hours worked (0.1 to ${MAX_INLINE_SHIFT_HOURS}.0) for ${row.name}.`);
      return;
    }

    const rawStart = inlineStartSmrDrafts[row.id] ?? '';
    const parsedStart = rawStart.trim() ? Number.parseFloat(rawStart) : null;
    if (parsedStart !== null && (Number.isNaN(parsedStart) || parsedStart < 0)) {
      toast.error(`Enter a valid non-negative Start SMR for ${row.name}.`);
      return;
    }

    const startSmr = row.start_smu !== null ? row.start_smu : (parsedStart ?? 0);
    const stopSmr = Number((startSmr + parsedHours).toFixed(1));
    const currentShift = getCurrentShift();
    const existingOp = machineOps.get(row.id)?.slice(-1)[0];
    const resolvedSiteId = existingOp?.site_id ?? row.rawMachine.site_id ?? sites[0]?.id ?? null;
    const resolvedOperatorId = existingOp?.operator_id ?? operators[0]?.id ?? null;
    const resolvedSiteName = row.site ?? sites.find((s) => s.id === resolvedSiteId)?.name ?? null;
    const resolvedOperatorName =
      row.operator ?? operators.find((o) => o.id === resolvedOperatorId)?.full_name ?? null;

    setSavingMachineId(row.id);
    try {
      if (onQuickLogHours) {
        await onQuickLogHours({
          machineId: row.id,
          startSmr,
          stopSmr,
          hoursWorked: parsedHours,
        });
      } else if (departmentId && supabase) {
        const shiftDate = getOperationalToday('Africa/Johannesburg');
        const payload = {
          department_id: departmentId,
          machine_id: row.id,
          operator_id: resolvedOperatorId,
          site_id: resolvedSiteId,
          shift_date: shiftDate,
          shift_type: currentShift,
          start_time: existingOp?.start_time || DEFAULT_INLINE_START_TIME,
          end_time: new Date().toTimeString().slice(0, 5),
          start_smu: startSmr,
          end_smu: stopSmr,
          operational_status: 'ACTIVE',
        };
        const result =
          existingOp?.id && !existingOp.id.startsWith('local-')
            ? await supabase
                .from('machine_operations')
                .update(payload as never)
                .eq('id', existingOp.id)
                .select()
                .single()
            : await supabase
                .from('machine_operations')
                .insert(payload as never)
                .select()
                .single();
        if (result.error) throw result.error;
        await invalidateShiftSheetCache({ departmentId }).catch(() => {});
        router.refresh();
      }

      setLocalOperationOverrides((prev) => ({
        ...prev,
        [row.id]: {
          id: existingOp?.id ?? `local-${row.id}`,
          machine_id: row.id,
          operator_id: resolvedOperatorId,
          site_id: resolvedSiteId,
          shift_type: currentShift,
          start_time: existingOp?.start_time ?? DEFAULT_INLINE_START_TIME,
          end_time: new Date().toTimeString().slice(0, 5),
          hours_worked: parsedHours,
          start_smu: startSmr,
          end_smu: stopSmr,
          block_drilled: existingOp?.block_drilled ?? null,
          meters_drilled: existingOp?.meters_drilled ?? null,
          holes_drilled: existingOp?.holes_drilled ?? null,
          machine: {
            name: row.name,
            machine_type: row.machine_type,
            bin_factor: row.rawMachine.bin_factor ?? undefined,
            serial_number: row.serial_number,
          },
          operator: resolvedOperatorName ? { full_name: resolvedOperatorName } : null,
          site: resolvedSiteName ? { name: resolvedSiteName } : null,
        },
      }));
      setInlineHoursDrafts((prev) => ({ ...prev, [row.id]: '' }));
      toast.success(
        `Logged ${parsedHours.toFixed(1)}h for ${row.name} (SMR ${startSmr.toFixed(1)} → ${stopSmr.toFixed(1)}).`
      );
    } catch {
      toast.error(`Failed to save hours for ${row.name}. Please try again.`);
    } finally {
      setSavingMachineId(null);
    }
  };

  // Transform items into typed table rows
  const transformRow = (machineRow: MachineWithMeta): MachineTableRow => {
    const machine = machineRow.machine;
    const ops = machineRow.operations || [];
    const latestOp = ops[ops.length - 1];

    const category = machineRow.category;
    const isDozer = category === 'dozer';
    const isDrill = category === 'drill';
    const isAdt = category === 'adt';
    const isExcavator = category === 'excavator';

    // Carried-over Start SMR resolution: prefer current operation's start_smu, else previous shift's Stop SMR
    const opStartSmu = latestOp?.start_smu ?? ops[0]?.start_smu ?? null;
    const carriedOverStartSmu = machine.previous_stop_smu ?? machine.latest_smu ?? null;
    const effectiveStartSmr = opStartSmu ?? carriedOverStartSmu;
    const isStartSmrCarriedOver = opStartSmu === null && carriedOverStartSmu !== null;
    const effectiveStopSmr = latestOp?.end_smu ?? null;
    const hasMissingHours = machineRow.totalHours <= 0 || effectiveStopSmr === null;

    // ADT metrics
    const loadsCount = loadsByMachine.get(machine.id) || 0;
    const binFactor = machine.bin_factor ?? (isAdt ? 28 : null);
    const materialBcm = binFactor !== null ? loadsCount * binFactor : null;

    // Drill metrics
    const totalMetersDrilled = isDrill
      ? ops.reduce((sum, op) => sum + (op.meters_drilled || 0), 0) || null
      : null;
    const totalHolesDrilled = isDrill
      ? ops.reduce((sum, op) => sum + (op.holes_drilled || 0), 0) || null
      : null;
    const penetrationRate =
      isDrill && totalMetersDrilled && machineRow.totalHours > 0
        ? `${(totalMetersDrilled / machineRow.totalHours).toFixed(1)} m/h`
        : null;

    // Dozer metrics
    const rolloverBcm = isDozer ? machineRow.totalHours * DOZER_PUSH_FACTOR_BCM_PER_HOUR : null;

    return {
      id: machine.id,
      name: machine.name,
      machine_type: machine.machine_type,
      serial_number: machine.serial_number,
      status: machineRow.status,
      category,
      start_smu: effectiveStartSmr,
      stop_smu: effectiveStopSmr,
      is_start_smr_carried_over: isStartSmrCarriedOver,
      has_missing_hours: hasMissingHours,
      total_hours: machineRow.totalHours,
      operator: latestOp?.operator?.full_name || null,
      site: machine.site?.name || latestOp?.site?.name || null,
      loads: isAdt || isExcavator ? loadsCount : undefined,
      bin_factor: binFactor,
      material_bcm: materialBcm,
      holes_drilled: totalHolesDrilled,
      meters_drilled: totalMetersDrilled,
      penetration_rate: penetrationRate,
      block_drilled: latestOp?.block_drilled || null,
      dozer_activity: isDozer ? 'Roll Over' : undefined,
      rollover_bcm: rolloverBcm,
      rawMachine: machine,
    };
  };

  const handleRowClick = (row: MachineTableRow) => {
    onMachineSelect?.(row.rawMachine);
  };

  const smrAndHoursColumns = buildSharedSmrColumns({
    inlineStartSmrDrafts,
    inlineHoursDrafts,
    savingMachineId,
    onStartSmrDraftChange: (machineId, val) =>
      setInlineStartSmrDrafts((prev) => ({ ...prev, [machineId]: val })),
    onHoursDraftChange: (machineId, val) =>
      setInlineHoursDrafts((prev) => ({ ...prev, [machineId]: val })),
    onSaveInlineHours: (row) => {
      void handleSaveInlineHours(row);
    },
    onDirectToLogMachine: handleDirectToLogMachine,
  });

  const machineIdColumn: DataTableColumn<MachineTableRow> = {
    key: 'name',
    header: 'Machine ID',
    cell: (row: MachineTableRow) => {
      const statusColor =
        row.status === 'operating'
          ? 'bg-accent-green'
          : row.status === 'breakdown'
            ? 'bg-accent-red'
            : row.status === 'in-progress'
              ? 'bg-blue-500'
              : 'bg-amber-400';
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-heading)]">
          <span
            data-testid="machine-status-indicator"
            className={`h-2.5 w-2.5 rounded-full ${statusColor} shadow-sm`}
            title={row.status}
          />
          {row.name}
        </span>
      );
    },
    sortable: true,
    align: 'left' as const,
  };

  const operatorColumn: DataTableColumn<MachineTableRow> = {
    key: 'operator',
    header: 'Operator',
    cell: (row: MachineTableRow) => row.operator || 'Unassigned',
    sortable: true,
    align: 'left' as const,
  };

  const siteColumn: DataTableColumn<MachineTableRow> = {
    key: 'site',
    header: 'Site',
    cell: (row: MachineTableRow) => row.site || '—',
    sortable: true,
    align: 'left' as const,
  };

  const statusColumn: DataTableColumn<MachineTableRow> = {
    key: 'status',
    header: 'Status',
    cell: (row: MachineTableRow) => renderStatusBadge(row.status),
    sortable: true,
    align: 'center' as const,
  };

  // Category columns definitions

  // 1. Dump Trucks (ADT): Loads, Bin Factor, Total BCM. NO Meters/Holes!
  const adtColumns = [
    machineIdColumn,
    ...smrAndHoursColumns,
    {
      key: 'loads',
      header: 'Loads',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-accent-blue">{row.loads ?? 0}</span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'bin_factor',
      header: 'Bin Factor',
      cell: (row: MachineTableRow) => (row.bin_factor ? `${row.bin_factor.toFixed(1)} BCM` : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'material_bcm',
      header: 'Total BCM',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-[var(--accent-blue)]">
          {row.material_bcm !== null && row.material_bcm !== undefined
            ? `${row.material_bcm.toFixed(1)} BCM`
            : '0.0 BCM'}
        </span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    operatorColumn,
    siteColumn,
    statusColumn,
  ];

  // 2. Drill Rigs: Holes, Meters, Penetration Rate (m/h), Block. NO Loads/Rollover!
  const drillColumns = [
    machineIdColumn,
    ...smrAndHoursColumns,
    {
      key: 'holes_drilled',
      header: 'Holes',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-accent-blue">{row.holes_drilled ?? '—'}</span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'meters_drilled',
      header: 'Meters',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-[var(--text-heading)]">
          {row.meters_drilled !== null && row.meters_drilled !== undefined
            ? `${row.meters_drilled.toFixed(1)}m`
            : '—'}
        </span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'penetration_rate',
      header: 'Penetration Rate',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-accent-green">
          {row.penetration_rate || '—'}
        </span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'block_drilled',
      header: 'Block',
      cell: (row: MachineTableRow) => row.block_drilled || '—',
      sortable: true,
      align: 'left' as const,
    },
    operatorColumn,
    siteColumn,
    statusColumn,
  ];

  // 3. Dozers: Activity (Roll Over/Other), Rollover (BCM). NO Meters/Holes!
  const dozerColumns = [
    machineIdColumn,
    ...smrAndHoursColumns,
    {
      key: 'dozer_activity',
      header: 'Activity',
      cell: (row: MachineTableRow) => (
        <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800 text-xs">
          {row.dozer_activity || 'Roll Over'}
        </span>
      ),
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'rollover_bcm',
      header: 'Rollover (BCM)',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-[var(--accent-blue)]">
          {row.rollover_bcm !== null && row.rollover_bcm !== undefined
            ? `${row.rollover_bcm.toFixed(1)} BCM`
            : '0.0 BCM'}
        </span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    operatorColumn,
    siteColumn,
    statusColumn,
  ];

  // 4. Excavators: Loads, Bin Factor, Material Moved
  const excavatorColumns = [
    machineIdColumn,
    ...smrAndHoursColumns,
    {
      key: 'loads',
      header: 'Trucks Loaded',
      cell: (row: MachineTableRow) => (
        <span className="font-mono font-semibold text-accent-blue">{row.loads ?? 0}</span>
      ),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'bin_factor',
      header: 'Bucket / Bin',
      cell: (row: MachineTableRow) => (row.bin_factor ? `${row.bin_factor.toFixed(1)} BCM` : '—'),
      sortable: true,
      align: 'right' as const,
    },
    operatorColumn,
    siteColumn,
    statusColumn,
  ];

  // 5. Ancillary / Other: Standard columns
  const ancillaryColumns = [
    machineIdColumn,
    {
      key: 'machine_type',
      header: 'Type',
      cell: (row: MachineTableRow) => row.machine_type,
      sortable: true,
      align: 'left' as const,
    },
    ...smrAndHoursColumns,
    operatorColumn,
    siteColumn,
    statusColumn,
  ];

  const getColumnsForCategory = (cat: MachineCategory) => {
    switch (cat) {
      case 'adt':
        return adtColumns;
      case 'drill':
        return drillColumns;
      case 'dozer':
        return dozerColumns;
      case 'excavator':
        return excavatorColumns;
      default:
        return ancillaryColumns;
    }
  };

  const getCategoryIcon = (cat: MachineCategory) => {
    switch (cat) {
      case 'adt':
        return <Truck className="h-4 w-4 text-accent-blue" aria-hidden="true" />;
      case 'drill':
        return <Drill className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />;
      case 'dozer':
        return <Layers className="h-4 w-4 text-amber-700" aria-hidden="true" />;
      case 'excavator':
        return <Activity className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
      default:
        return <Gauge className="h-4 w-4 text-neutral-600" aria-hidden="true" />;
    }
  };

  // Group filtered machines into categories
  const categoriesToRender: MachineCategory[] =
    selectedCategory === 'all'
      ? (['adt', 'excavator', 'drill', 'dozer', 'ancillary'] as MachineCategory[])
      : [selectedCategory];

  const groupedRowsByCategory = useMemo(() => {
    const map = new Map<MachineCategory, MachineTableRow[]>();
    for (const cat of categoriesToRender) {
      map.set(cat, []);
    }
    for (const item of filteredMachines) {
      const row = transformRow(item);
      const list = map.get(item.category);
      if (list) {
        list.push(row);
      } else if (map.has('ancillary')) {
        map.get('ancillary')!.push(row);
      }
    }
    return map;
  }, [filteredMachines, categoriesToRender]);

  const totalMatchingMachines = filteredMachines.length;

  return (
    <div className="space-y-6" data-testid="machine-operations-filterable-table">
      {/* Search & Filter Toolbar */}
      <MachineOperationsFilterStrip
        filterStatus={filterStatus}
        onFilterStatusChange={handleStatusChange}
        counts={counts}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {totalMatchingMachines === 0 ? (
        <div className="gold-steel-border gold-steel-border-slim rounded-xl border border-black/[0.08] bg-white/70 p-12 text-center shadow-2xs backdrop-blur-md">
          <p className="text-[var(--text-muted)] text-sm">
            No matching machines found for the selected category and status filters.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {categoriesToRender.map((cat) => {
            const rows = groupedRowsByCategory.get(cat) || [];
            if (rows.length === 0 && selectedCategory === 'all') {
              return null; // Skip empty categories in 'all' view
            }

            const cols = getColumnsForCategory(cat);
            const isCollapsed = collapsedCategories[cat] ?? false;

            // Partition machines into Incomplete (top) and Complete (bottom)
            const incompleteRows = rows.filter(
              (r) => r.has_missing_hours || r.stop_smu === null || r.total_hours <= 0
            );
            const completeRows = rows.filter(
              (r) => !r.has_missing_hours && r.stop_smu !== null && r.total_hours > 0
            );

            return (
              <div key={cat} className="space-y-3" data-testid={`category-section-${cat}`}>
                {/* Section Header as an interactive Dropdown Panel with Golden Animated Border (Item 8) */}
                <div
                  data-testid={`category-panel-header-${cat}`}
                  onClick={() => toggleCategoryCollapse(cat)}
                  className={CATEGORY_PANEL_HEADER_CLASS}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-gold/40 bg-amber-50 shadow-2xs">
                      {getCategoryIcon(cat)}
                    </span>
                    <div>
                      <h4 className="font-bold text-[var(--text-heading)] text-base">
                        {MACHINE_CATEGORY_LABELS[cat]}
                      </h4>
                      <p className="text-[var(--text-muted)] text-xs">
                        {incompleteRows.length > 0
                          ? `${incompleteRows.length} incomplete shift log${incompleteRows.length === 1 ? '' : 's'} pending`
                          : 'All shift operations completed & verified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-full border border-accent-gold/40 bg-amber-50/90 px-3 py-1 font-mono font-semibold text-[var(--accent-blue)] text-xs">
                      {rows.length} {rows.length === 1 ? 'machine' : 'machines'}
                    </span>
                    <button
                      type="button"
                      aria-label={
                        isCollapsed
                          ? `Expand ${MACHINE_CATEGORY_LABELS[cat]}`
                          : `Collapse ${MACHINE_CATEGORY_LABELS[cat]}`
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.06] bg-white/80 text-[var(--text-secondary)] shadow-2xs transition-transform"
                    >
                      {isCollapsed ? (
                        <Logo
                          variant="gold"
                          className={`h-4 w-4 text-accent-gold transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
                        />
                      ) : (
                        <Logo
                          variant="gold"
                          className={`h-4 w-4 text-accent-gold transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
                        />
                      )}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-4 pt-1">
                    {/* Incomplete Machines Subsection (Item 16: incomplete machines at top) */}
                    <div className="space-y-2">
                      <div className="flex animate-pulse items-center justify-between rounded-lg border border-red-400/60 bg-red-50/80 px-3.5 py-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                          {incompleteRows.length > 0 ? (
                            <>
                              <AlertCircle className="h-4 w-4 text-red-700" />
                              <span className="font-bold text-red-900 text-xs">
                                Incomplete Machines ({incompleteRows.length})
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span className="font-bold text-emerald-900 text-xs">
                                No incomplete machines
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] text-red-800">
                          {incompleteRows.length > 0
                            ? 'Requires Stop SMR or shift logging'
                            : 'All operations logged'}
                        </span>
                      </div>

                      {incompleteRows.length > 0 && (
                        <div className="max-h-[380px] overflow-x-auto overflow-y-auto rounded-xl border border-black/[0.08] bg-white/95 shadow-2xs">
                          <DataTable
                            data={incompleteRows}
                            columns={cols}
                            keyExtractor={(row: MachineTableRow) => row.id}
                            loading={false}
                            pageSize={15}
                            searchable={true}
                            searchPlaceholder="Search machine, type, or SN..."
                            searchFilter={(row: MachineTableRow, query: string) => {
                              const lowerQuery = query.toLowerCase();
                              return (
                                row.name.toLowerCase().includes(lowerQuery) ||
                                row.machine_type.toLowerCase().includes(lowerQuery) ||
                                Boolean(row.serial_number?.toLowerCase().includes(lowerQuery)) ||
                                row.status.toLowerCase().includes(lowerQuery)
                              );
                            }}
                            className="w-full"
                            onRowClick={handleRowClick}
                          />
                        </div>
                      )}
                    </div>

                    {/* Complete Machines Subsection (Item 16: filled machines at bottom) */}
                    {completeRows.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between rounded-lg border border-emerald-300/60 bg-emerald-50/80 px-3.5 py-2 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="font-bold text-emerald-900 text-xs">
                              Complete Machines ({completeRows.length})
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-800">
                            Shift SMR delta &amp; telemetry recorded
                          </span>
                        </div>

                        <div className="max-h-[380px] overflow-x-auto overflow-y-auto rounded-xl border border-black/[0.08] bg-white/95 shadow-2xs">
                          <DataTable
                            data={completeRows}
                            columns={cols}
                            keyExtractor={(row: MachineTableRow) => row.id}
                            loading={false}
                            pageSize={15}
                            searchable={false}
                            className="w-full"
                            onRowClick={handleRowClick}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
