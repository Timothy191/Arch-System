import {
  HOUR_PROP,
  HOURS_12,
  type HourlyLoad,
  type HourlyMaterial,
  type HourlyShift,
  loadKey,
  sumHourlyTotal,
} from './loads-utils';

export interface Machine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor?: number | null;
  site_id?: string | null;
}

export interface Excavator {
  id: string;
  name: string;
  machine_type: string;
  site_id?: string | null;
  sites?: { name: string } | { name: string }[] | null;
}

interface MineBlockOption {
  id: string;
  name: string;
  code: string;
  site_id: string | null;
}

export interface ExcavatorActivitySummary {
  id: string;
  machine_id: string;
  site_id: string | null;
  block_mined_id: string | null;
  material_type: string | null;
  shift_type: string;
}

export interface HourlyLoadsGridProps {
  departmentId: string;
  machines: Machine[];
  excavators: Excavator[];
  hourlyLoads: HourlyLoad[];
  sites: { id: string; name: string; site_code: string }[];
  mineBlocks?: MineBlockOption[];
  excavatorActivities?: ExcavatorActivitySummary[];
  mineralRegistry?: {
    waste: string[];
    coal: string[];
  };
  /** Operational date (Africa/Johannesburg) from the server — never derive on the client. */
  today: string;
  /** Shift active at first render, resolved on the server to avoid UTC drift. */
  initialShift?: HourlyShift;
}

export interface HourlyLoadGridRow {
  rowKey: string;
  loadId: string;
  machineId: string;
  machineName: string;
  baseMachineName: string;
  excavatorId: string;
  machineType: string;
  materialType: HourlyMaterial | string;
  startHour: number;
  endHour: number;
  isLocked: boolean;
  isSplit: boolean;
  total: number;
  binFactor?: number | string;
  totalMaterial?: number | string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface HourlySlotSeries {
  hourLabel: string;
  shortLabel: string;
  wasteLoads: number;
  coalLoads: number;
  totalLoads: number;
  cumulativeLoads: number;
}

export const DAY_HOUR_LABELS = [
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
];

export const NIGHT_HOUR_LABELS = [
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
];

export function buildSyncSourceRows(params: {
  isLargeDataset: boolean;
  machines: Machine[];
  groupedLoadsByMachine: Map<string, HourlyLoad[]>;
  selectedShift: HourlyShift;
  hourLabels: string[];
  hasBinFactors: boolean;
}): HourlyLoadGridRow[] {
  const {
    isLargeDataset,
    machines,
    groupedLoadsByMachine,
    selectedShift,
    hourLabels,
    hasBinFactors,
  } = params;

  if (isLargeDataset) return [];
  const rows: HourlyLoadGridRow[] = [];

  machines.forEach((machine) => {
    const machineLoads = (
      groupedLoadsByMachine.get(loadKey(machine.id, selectedShift)) || []
    ).slice();
    const binFactor = machine.bin_factor ?? 0;

    if (machineLoads.length === 0) {
      const virtualLoadId = `local-${machine.id}-${selectedShift}`;
      const row: HourlyLoadGridRow = {
        rowKey: `${machine.id}:${selectedShift}:default`,
        loadId: virtualLoadId,
        machineId: machine.id,
        machineName: machine.name,
        baseMachineName: machine.name,
        excavatorId: '',
        machineType: machine.machine_type,
        materialType: 'Waste',
        startHour: 1,
        endHour: 12,
        isLocked: false,
        isSplit: false,
        total: 0,
      };
      HOURS_12.forEach((_, index) => {
        row[HOUR_PROP(index)] = 0;
      });
      if (hasBinFactors) {
        row.binFactor = binFactor > 0 ? binFactor : '-';
        row.totalMaterial = '-';
      }
      rows.push(row);
    } else {
      machineLoads.sort((a, b) => (a.start_hour ?? 1) - (b.start_hour ?? 1));
      machineLoads.forEach((load) => {
        const startHour = load.start_hour ?? 1;
        const endHour = load.end_hour ?? 12;
        const isLocked = Boolean(load.is_locked);
        const isSplit = machineLoads.length > 1;
        const startLabel = hourLabels[startHour - 1] ?? '06';
        const endLabel = hourLabels[endHour - 1] ?? '17';
        const segmentLabel = isSplit
          ? `${machine.name} (${startLabel}:00 - ${endLabel}:59)`
          : machine.name;

        const totalLoads = load.total_loads ?? sumHourlyTotal(load);
        const row: HourlyLoadGridRow = {
          rowKey: load.id,
          loadId: load.id,
          machineId: machine.id,
          machineName: segmentLabel,
          baseMachineName: machine.name,
          excavatorId: load.excavator_id || '',
          machineType: machine.machine_type,
          materialType: load.material_type || 'Waste',
          startHour,
          endHour,
          isLocked,
          isSplit,
          total: totalLoads,
        };
        HOURS_12.forEach((_, index) => {
          row[HOUR_PROP(index)] = (load[HOUR_PROP(index) as keyof HourlyLoad] as number) || 0;
        });
        if (hasBinFactors) {
          row.binFactor = binFactor > 0 ? binFactor : '-';
          row.totalMaterial =
            binFactor > 0 && totalLoads > 0 ? Math.round(totalLoads * binFactor * 10) / 10 : '-';
        }
        rows.push(row);
      });
    }
  });

  return rows;
}

export function applyOptimisticAsyncSourcePatch(
  prev: HourlyLoadGridRow[],
  loadId: string,
  patch: Partial<HourlyLoad>
): HourlyLoadGridRow[] {
  if (!prev || prev.length === 0) return prev;
  let changed = false;
  const next = prev.map((row) => {
    if (row.loadId === loadId) {
      changed = true;
      const updatedRow: HourlyLoadGridRow = { ...row, ...patch };
      let newTotal = 0;
      HOURS_12.forEach((_, idx) => {
        const val = updatedRow[HOUR_PROP(idx)];
        newTotal += typeof val === 'number' ? val : 0;
      });
      updatedRow.total = newTotal;
      if (typeof updatedRow.binFactor === 'number') {
        updatedRow.totalMaterial = Math.round(newTotal * updatedRow.binFactor * 10) / 10;
      }
      if (patch.excavator_id !== undefined) {
        updatedRow.excavatorId = patch.excavator_id || '';
      }
      if (patch.material_type !== undefined) {
        updatedRow.materialType = patch.material_type;
      }
      return updatedRow;
    }
    return row;
  });
  return changed ? next : prev;
}

export function computeHourlyLoadsTelemetry(
  source: HourlyLoadGridRow[],
  hourLabels: string[],
  machinesCount: number
) {
  let cumulative = 0;
  const series: HourlySlotSeries[] = HOURS_12.map((_, index) => {
    const prop = HOUR_PROP(index);
    let waste = 0;
    let coal = 0;
    source.forEach((row) => {
      const val = typeof row[prop] === 'number' ? row[prop] : 0;
      if (row.materialType === 'Coal') {
        coal += val;
      } else {
        waste += val;
      }
    });
    const total = waste + coal;
    cumulative += total;
    return {
      hourLabel: `${hourLabels[index] ?? '00'}:00`,
      shortLabel: hourLabels[index] ?? '00',
      wasteLoads: waste,
      coalLoads: coal,
      totalLoads: total,
      cumulativeLoads: cumulative,
    };
  });

  const totals = series.map((s) => s.totalLoads);

  const grandLoads = source.reduce(
    (acc, row) => acc + (typeof row.total === 'number' ? row.total : 0),
    0
  );

  const grandMaterial = source.reduce((acc, row) => {
    const val = typeof row.totalMaterial === 'number' ? row.totalMaterial : 0;
    return acc + val;
  }, 0);

  const activeMachineIds = new Set<string>();
  let wasteLoadsSum = 0;
  let coalLoadsSum = 0;

  source.forEach((row) => {
    const rowTotal = typeof row.total === 'number' ? row.total : 0;
    if (rowTotal > 0 || row.excavatorId) {
      activeMachineIds.add(String(row.machineId));
    }
    if (row.materialType === 'Coal') {
      coalLoadsSum += rowTotal;
    } else {
      wasteLoadsSum += rowTotal;
    }
  });

  const peak = series.reduce(
    (best, curr) => (curr.totalLoads > best.totalLoads ? curr : best),
    series[0] ?? {
      hourLabel: `${hourLabels[0] ?? '06'}:00`,
      shortLabel: hourLabels[0] ?? '06',
      wasteLoads: 0,
      coalLoads: 0,
      totalLoads: 0,
      cumulativeLoads: 0,
    }
  );

  const maxLoads = Math.max(1, ...series.map((s) => s.totalLoads));

  return {
    hourTotals: totals,
    grandTotalLoads: grandLoads,
    grandTotalMaterial: Math.round(grandMaterial * 10) / 10,
    hourlySeries: series,
    activeMachinesCount: activeMachineIds.size,
    avgLoadsPerMachine: machinesCount > 0 ? Math.round((grandLoads / machinesCount) * 10) / 10 : 0,
    wasteTotalLoads: wasteLoadsSum,
    coalTotalLoads: coalLoadsSum,
    peakHour: peak,
    maxHourLoads: maxLoads,
  };
}
