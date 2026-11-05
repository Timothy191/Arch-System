'use client';

import { DataTable } from '@repo/ui/components/ui/data-table';
import { useMemo, useState } from 'react';
import { MachineOperationsFilterStrip } from './MachineOperationsSummaryStrip';
import {
  type Breakdown,
  buildBreakdownsByFleetIdMap,
  buildFleetMachinesList,
  buildOperationsByMachineMap,
  computeMachineStatusCounts,
  computeMachinesWithMeta,
  type FilterStatus,
  filterMachinesWithMeta,
  groupMachinesBySite,
  type MachineItem,
  type MachineOperation,
} from './machine-operations-constants';

interface MachineTableRow {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  status: string;
  start_smu: number | null;
  stop_smu: number | null;
  total_hours: number;
  operator: string | null;
  rollover_bcm: number | null; // for dozers
  meters_drilled: number | null; // for drills
  holes_drilled: number | null; // for drills
  site: string | null;
}

interface MachineOperationsFilterableTableProps {
  machines: MachineItem[];
  operations: MachineOperation[];
  activeBreakdowns?: Breakdown[];
  engineeringDelaysByMachine?: Record<string, { hours: number; reasons: string[]; status: string }>;
  onMachineSelect?: (machine: MachineItem) => void;
  onFilterStatusChange?: (status: FilterStatus) => void;
  onSearchQueryChange?: (query: string) => void;
}

function MachineOperationsFilterableTable({
  machines,
  operations,
  activeBreakdowns,
  engineeringDelaysByMachine,
  onMachineSelect,
}: MachineOperationsFilterableTableProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [_sortKey, _setSortKey] = useState<string | null>(null);
  const [_sortDirection, _setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Prepare machine data with meta
  const machineOps = useMemo(() => buildOperationsByMachineMap(operations), [operations]);
  const breakdownsByFleetId = useMemo(
    () => buildBreakdownsByFleetIdMap(activeBreakdowns || []),
    [activeBreakdowns]
  );
  const fleetMachines = useMemo(
    () => buildFleetMachinesList(machines, operations),
    [machines, operations]
  );
  const allMachinesWithMeta = useMemo(() => {
    const machinesWithMeta = computeMachinesWithMeta(
      fleetMachines,
      breakdownsByFleetId,
      machineOps
    );
    return filterMachinesWithMeta(machinesWithMeta, filterStatus, searchQuery);
  }, [fleetMachines, breakdownsByFleetId, machineOps, filterStatus, searchQuery]);

  const counts = useMemo(
    () => computeMachineStatusCounts(allMachinesWithMeta),
    [allMachinesWithMeta]
  );
  const _siteGrouped = useMemo(
    () => groupMachinesBySite(allMachinesWithMeta),
    [allMachinesWithMeta]
  );

  const totalPages = Math.ceil(allMachinesWithMeta.length / 10) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return allMachinesWithMeta.slice(start, start + 10);
  }, [allMachinesWithMeta, currentPage]);

  // Build table rows
  const rows = useMemo(() => {
    return paginatedData.map((item) => {
      const machine = item.machine;
      const ops = item.operations || [];
      const latestOp = ops[ops.length - 1];

      const isDozer =
        machine.machine_type === 'Dozer' || machine.machine_type.toLowerCase().includes('dozer');
      const isDrillRig = machine.machine_type === 'Drill Rig';

      const rolloverBcm = isDozer
        ? ops.reduce((sum, op) => sum + (op.hours_worked || 0), 0) * 250 || null
        : null;

      const totalMetersDrilled = isDrillRig
        ? ops.reduce((sum, op) => sum + (op.meters_drilled || 0), 0) || null
        : null;

      const totalHolesDrilled = isDrillRig
        ? ops.reduce((sum, op) => sum + (op.holes_drilled || 0), 0)
        : null;

      const operatorName = latestOp?.operator?.full_name || null;
      const siteName = machine.site?.name || null;

      return {
        id: machine.id,
        name: machine.name,
        machine_type: machine.machine_type,
        serial_number: machine.serial_number,
        status: item.status,
        start_smu: latestOp?.start_smu ?? null,
        stop_smu: latestOp?.end_smu ?? null,
        total_hours: item.totalHours,
        operator: operatorName,
        rollover_bcm: rolloverBcm,
        meters_drilled: totalMetersDrilled,
        holes_drilled: totalHolesDrilled,
        site: siteName,
      };
    });
  }, [paginatedData]);

  const handleMachineSelect = (row: MachineTableRow) => {
    const machine = machines.find((m) => m.id === row.id);
    if (machine && onMachineSelect) {
      onMachineSelect(machine);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Machine ID',
      cell: (row: MachineTableRow) => row.name,
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'start_smu',
      header: 'Start SMR',
      cell: (row: MachineTableRow) => (row.start_smu !== null ? row.start_smu.toFixed(1) : 'N/A'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'stop_smu',
      header: 'Stop SMR',
      cell: (row: MachineTableRow) => (row.stop_smu !== null ? row.stop_smu.toFixed(1) : 'N/A'),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'total_hours',
      header: 'Total',
      cell: (row: MachineTableRow) => row.total_hours.toFixed(1),
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: MachineTableRow) => row.operator || 'N/A',
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
      key: 'serial_number',
      header: 'SN',
      cell: (row: MachineTableRow) => row.serial_number || 'N/A',
      sortable: true,
      align: 'left' as const,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: MachineTableRow) => row.status,
      sortable: true,
      align: 'center' as const,
    },
    {
      key: 'rollover_bcm',
      header: 'Rollover (BCM)',
      cell: (row: MachineTableRow) =>
        row.rollover_bcm !== null ? row.rollover_bcm.toFixed(1) : '0',
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'meters_drilled',
      header: 'Meters',
      cell: (row: MachineTableRow) =>
        row.meters_drilled !== null ? row.meters_drilled.toFixed(1) : '0',
      sortable: true,
      align: 'right' as const,
    },
    {
      key: 'holes_drilled',
      header: 'Holes',
      cell: (row: MachineTableRow) =>
        row.holes_drilled !== null ? row.holes_drilled.toString() : '0',
      sortable: true,
      align: 'right' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <MachineOperationsFilterStrip
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        counts={counts}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      <div className="overflow-x-auto">
        <DataTable
          data={rows}
          columns={columns}
          keyExtractor={(row: MachineTableRow) => row.id}
          loading={false}
          pageSize={10}
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
              No matching machines found. Use the filter or search to find specific machines.
            </div>
          }
          className="gold-steel-border gold-steel-border-slim overflow-hidden rounded-xl border border-black/[0.08] bg-white/70 shadow-2xs backdrop-blur-md"
          onRowClick={handleMachineSelect}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          Showing {(currentPage - 1) * 10 + 1} to{' '}
          {Math.min(currentPage * 10, allMachinesWithMeta.length)} of {allMachinesWithMeta.length}{' '}
          machines
        </div>
        <div>
          <span className="text-[var(--text-muted)] text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="ml-2 rounded-sm border border-[var(--border-default)]/20 bg-black/[0.04] px-2 py-1 text-[var(--text-muted)] hover:bg-black/[0.08]"
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="ml-2 rounded-sm border border-[var(--border-default)]/20 bg-black/[0.04] px-2 py-1 text-[var(--text-muted)] hover:bg-black/[0.08]"
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default MachineOperationsFilterableTable;
