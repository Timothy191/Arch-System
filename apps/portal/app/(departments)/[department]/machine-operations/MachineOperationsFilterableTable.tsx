'use client';

import { DataTable } from '@repo/ui/components/ui/data-table';
import { Activity, AlertCircle, Clock, Drill, Gauge, Layers, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
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

export interface MachineOperationsFilterableTableProps {
  machines: MachineItem[];
  operations: MachineOperation[];
  todayLoads?: HourlyLoadSummary[];
  activeBreakdowns?: Breakdown[];
  engineeringDelaysByMachine?: Record<string, { hours: number; reasons: string[]; status: string }>;
  onMachineSelect?: (machine: MachineItem) => void;
  onFilterStatusChange?: (status: FilterStatus) => void;
  onSearchQueryChange?: (query: string) => void;
  defaultCategory?: MachineCategory;
}

const DOZER_PUSH_FACTOR_BCM_PER_HOUR = 250;

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
  machines,
  operations,
  todayLoads = [],
  activeBreakdowns = [],
  engineeringDelaysByMachine,
  onMachineSelect,
  onFilterStatusChange,
  onSearchQueryChange,
  defaultCategory = 'all',
}: MachineOperationsFilterableTableProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<MachineCategory>(defaultCategory);
  const [searchQuery, setSearchQuery] = useState('');

  // Prepare data mappings
  const machineOps = useMemo(() => buildOperationsByMachineMap(operations), [operations]);
  const breakdownsByFleetId = useMemo(
    () => buildBreakdownsByFleetIdMap(activeBreakdowns),
    [activeBreakdowns]
  );
  const loadsByMachine = useMemo(() => buildLoadsByMachineMap(todayLoads), [todayLoads]);
  const fleetMachines = useMemo(
    () => buildFleetMachinesList(machines, operations),
    [machines, operations]
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

  // Transform items into typed table rows
  const transformRow = (item: MachineWithMeta): MachineTableRow => {
    const machine = item.machine;
    const ops = item.operations || [];
    const latestOp = ops[ops.length - 1];

    const category = item.category;
    const isDozer = category === 'dozer';
    const isDrill = category === 'drill';
    const isAdt = category === 'adt';
    const isExcavator = category === 'excavator';

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
      isDrill && totalMetersDrilled && item.totalHours > 0
        ? `${(totalMetersDrilled / item.totalHours).toFixed(1)} m/h`
        : null;

    // Dozer metrics
    const rolloverBcm = isDozer ? item.totalHours * DOZER_PUSH_FACTOR_BCM_PER_HOUR : null;

    return {
      id: machine.id,
      name: machine.name,
      machine_type: machine.machine_type,
      serial_number: machine.serial_number,
      status: item.status,
      category,
      start_smu: latestOp?.start_smu ?? ops[0]?.start_smu ?? null,
      stop_smu: latestOp?.end_smu ?? null,
      total_hours: item.totalHours,
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

  // Category columns definitions

  // 1. Dump Trucks (ADT): Loads, Bin Factor, Total BCM. NO Meters/Holes!
  const adtColumns = [
    {
      key: 'name',
      header: 'Machine ID',
      cell: (row: MachineTableRow) => (
        <span className="font-semibold text-[var(--text-heading)]">{row.name}</span>
      ),
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => (row.start_smu !== null ? row.start_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => (row.stop_smu !== null ? row.stop_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Hours',
      cell: (row: MachineTableRow) => `${row.total_hours.toFixed(1)}h`,
      sortable: true,
      align: 'right' as const,
    },
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
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: MachineTableRow) => row.operator || 'Unassigned',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'site',
      header: 'Site',
      cell: (row: MachineTableRow) => row.site || '—',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: MachineTableRow) => renderStatusBadge(row.status),
      sortable: true,
      align: 'center' as const,
    },
  ];

  // 2. Drill Rigs: Holes, Meters, Penetration Rate (m/h), Block. NO Loads/Rollover!
  const drillColumns = [
    {
      key: 'name',
      header: 'Machine ID',
      cell: (row: MachineTableRow) => (
        <span className="font-semibold text-[var(--text-heading)]">{row.name}</span>
      ),
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => (row.start_smu !== null ? row.start_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => (row.stop_smu !== null ? row.stop_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Hours',
      cell: (row: MachineTableRow) => `${row.total_hours.toFixed(1)}h`,
      sortable: true,
      align: 'right' as const,
    },
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
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: MachineTableRow) => row.operator || 'Unassigned',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'site',
      header: 'Site',
      cell: (row: MachineTableRow) => row.site || '—',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: MachineTableRow) => renderStatusBadge(row.status),
      sortable: true,
      align: 'center' as const,
    },
  ];

  // 3. Dozers: Activity (Roll Over/Other), Rollover (BCM). NO Meters/Holes!
  const dozerColumns = [
    {
      key: 'name',
      header: 'Machine ID',
      cell: (row: MachineTableRow) => (
        <span className="font-semibold text-[var(--text-heading)]">{row.name}</span>
      ),
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => (row.start_smu !== null ? row.start_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => (row.stop_smu !== null ? row.stop_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Hours',
      cell: (row: MachineTableRow) => `${row.total_hours.toFixed(1)}h`,
      sortable: true,
      align: 'right' as const,
    },
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
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: MachineTableRow) => row.operator || 'Unassigned',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'site',
      header: 'Site',
      cell: (row: MachineTableRow) => row.site || '—',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: MachineTableRow) => renderStatusBadge(row.status),
      sortable: true,
      align: 'center' as const,
    },
  ];

  // 4. Excavators: Loads, Bin Factor, Material Moved
  const excavatorColumns = [
    {
      key: 'name',
      header: 'Machine ID',
      cell: (row: MachineTableRow) => (
        <span className="font-semibold text-[var(--text-heading)]">{row.name}</span>
      ),
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => (row.start_smu !== null ? row.start_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => (row.stop_smu !== null ? row.stop_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Hours',
      cell: (row: MachineTableRow) => `${row.total_hours.toFixed(1)}h`,
      sortable: true,
      align: 'right' as const,
    },
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
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: MachineTableRow) => row.operator || 'Unassigned',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'site',
      header: 'Site',
      cell: (row: MachineTableRow) => row.site || '—',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: MachineTableRow) => renderStatusBadge(row.status),
      sortable: true,
      align: 'center' as const,
    },
  ];

  // 5. Ancillary / Other: Standard columns
  const ancillaryColumns = [
    {
      key: 'name',
      header: 'Machine ID',
      cell: (row: MachineTableRow) => (
        <span className="font-semibold text-[var(--text-heading)]">{row.name}</span>
      ),
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'machine_type',
      header: 'Type',
      cell: (row: MachineTableRow) => row.machine_type,
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => (row.start_smu !== null ? row.start_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => (row.stop_smu !== null ? row.stop_smu.toFixed(1) : '—'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Hours',
      cell: (row: MachineTableRow) => `${row.total_hours.toFixed(1)}h`,
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: MachineTableRow) => row.operator || 'Unassigned',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'site',
      header: 'Site',
      cell: (row: MachineTableRow) => row.site || '—',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: MachineTableRow) => renderStatusBadge(row.status),
      sortable: true,
      align: 'center' as const,
    },
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
            return (
              <div key={cat} className="space-y-3" data-testid={`category-section-${cat}`}>
                {/* Section Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-50 p-1.5 ring-1 ring-amber-200">
                      {getCategoryIcon(cat)}
                    </span>
                    <h4 className="font-semibold text-[var(--text-heading)] text-base">
                      {MACHINE_CATEGORY_LABELS[cat]}
                    </h4>
                  </div>
                  <span className="font-mono text-[var(--text-muted)] text-xs">
                    {rows.length} {rows.length === 1 ? 'machine' : 'machines'}
                  </span>
                </div>

                {/* Table for this Category */}
                <div className="overflow-x-auto">
                  <DataTable
                    data={rows}
                    columns={cols}
                    keyExtractor={(row: MachineTableRow) => row.id}
                    loading={false}
                    pageSize={15}
                    searchable={true}
                    searchPlaceholder="Search machine, type, or SN..."
                    searchFilter={(item: MachineTableRow, query: string) => {
                      const lowerQuery = query.toLowerCase();
                      return (
                        item.name.toLowerCase().includes(lowerQuery) ||
                        item.machine_type.toLowerCase().includes(lowerQuery) ||
                        Boolean(item.serial_number?.toLowerCase().includes(lowerQuery)) ||
                        item.status.toLowerCase().includes(lowerQuery)
                      );
                    }}
                    emptyState={
                      <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                        No {MACHINE_CATEGORY_LABELS[cat]} matching current filter criteria.
                      </div>
                    }
                    className="gold-steel-border gold-steel-border-slim overflow-hidden rounded-xl border border-black/[0.08] bg-white/70 shadow-2xs backdrop-blur-md"
                    onRowClick={handleRowClick}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MachineOperationsFilterableTable;
