import type { RealtimePayload } from '@repo/shared/hooks';

/**
 * Pure derivation layer for the control-room SCADA panel.
 *
 * The panel used to re-run three PostgREST queries (with nested embeds) for
 * every `hourly_loads` CDC event, on every connected client. That turns one
 * write into `clients × 3` database round-trips.
 *
 * Instead, CDC payloads are merged into local row state and the same
 * aggregation runs in memory via `useMemo`. One write now costs zero queries.
 */

/** Bin factor used when a machine row has no `bin_factor` (matches legacy behaviour). */
export const FALLBACK_LOAD_BIN_FACTOR = 24;

/** Bin factor used when rendering a machine row without `bin_factor`. */
export const FALLBACK_MACHINE_BIN_FACTOR = 25;

/** Upper bound on haul machines rendered in the panel. */
export const MAX_RENDERED_HAUL_MACHINES = 12;

export interface NamedRef {
  name?: string | null;
  code?: string | null;
  full_name?: string | null;
}

export interface ScadaActivityRow {
  id: string;
  machine_id: string | null;
  shift_type: string | null;
  material_type: string | null;
  activity_date?: string | null;
  machine: NamedRef | NamedRef[] | null;
  operator: NamedRef | NamedRef[] | null;
  site: NamedRef | NamedRef[] | null;
  block_mined: NamedRef | NamedRef[] | null;
}

export interface ScadaMachineRow {
  id: string;
  name: string;
  machine_type: string | null;
  bin_factor: number | null;
  active: boolean | null;
}

export interface ScadaLoadRow {
  id: string;
  machine_id: string | null;
  excavator_id: string | null;
  material_type: string | null;
  total_loads: number | null;
  load_date?: string | null;
}

export interface ExcavatorActivityViewRow {
  id: string;
  excavatorName: string;
  operatorName: string;
  siteBlock: string;
  shift: string;
  material: string;
  assignedMachines: number;
  loadedLoads: number;
  totalBcm: number;
  status: 'digging' | 'loading' | 'standby';
}

export interface RegisteredMachineLoadViewRow {
  id: string;
  machineName: string;
  machineType: string;
  assignedExcavator: string;
  material: string;
  binFactor: number;
  loadedLoads: number;
  totalBcm: number;
  status: 'hauling' | 'loading' | 'standby';
}

export interface ScadaPanelDerivation {
  excavators: ExcavatorActivityViewRow[];
  registeredMachines: RegisteredMachineLoadViewRow[];
}

/** Joined PostgREST embeds arrive either as an object or a single-element array. */
function pickJoined(ref: NamedRef | NamedRef[] | null | undefined): NamedRef | undefined {
  if (!ref) return undefined;
  return Array.isArray(ref) ? ref[0] : ref;
}

interface ExcavatorAggregate {
  loadedLoads: number;
  dumperIds: Set<string>;
  totalBcm: number;
}

interface MachineAggregate {
  loads: number;
  material: string;
  excavatorId: string | null;
}

const FALLBACK_MATERIAL = 'ROM Coal';
const FALLBACK_EXCAVATOR_NAME = 'Excavator';
const UNASSIGNED_OPERATOR = 'Unassigned Operator';
const UNASSIGNED_BLOCK = 'Unassigned Block';
const UNASSIGNED_MATERIAL = 'Unassigned';
const UNASSIGNED_EXCAVATOR = 'Unassigned';

/**
 * Single-pass aggregation over load rows, building O(1) lookup maps for both
 * excavator and haul-machine totals.
 */
function aggregateLoads(
  loads: readonly ScadaLoadRow[],
  binFactorByMachine: Map<string, number>
): { byExcavator: Map<string, ExcavatorAggregate>; byMachine: Map<string, MachineAggregate> } {
  const byExcavator = new Map<string, ExcavatorAggregate>();
  const byMachine = new Map<string, MachineAggregate>();

  for (const load of loads) {
    const loadCount = load.total_loads ?? 0;
    const binFactor =
      (load.machine_id && binFactorByMachine.get(load.machine_id)) || FALLBACK_LOAD_BIN_FACTOR;

    if (load.excavator_id) {
      const aggregate = byExcavator.get(load.excavator_id) ?? {
        loadedLoads: 0,
        dumperIds: new Set<string>(),
        totalBcm: 0,
      };
      aggregate.loadedLoads += loadCount;
      if (load.machine_id) aggregate.dumperIds.add(load.machine_id);
      aggregate.totalBcm += loadCount * binFactor;
      byExcavator.set(load.excavator_id, aggregate);
    }

    if (load.machine_id) {
      const aggregate = byMachine.get(load.machine_id) ?? {
        loads: 0,
        material: load.material_type || FALLBACK_MATERIAL,
        excavatorId: load.excavator_id,
      };
      aggregate.loads += loadCount;
      if (load.material_type) aggregate.material = load.material_type;
      if (load.excavator_id) aggregate.excavatorId = load.excavator_id;
      byMachine.set(load.machine_id, aggregate);
    }
  }

  return { byExcavator, byMachine };
}

function buildExcavatorRows(
  activities: readonly ScadaActivityRow[],
  byExcavator: Map<string, ExcavatorAggregate>
): ExcavatorActivityViewRow[] {
  return activities.map((activity, index) => {
    const machineRef = pickJoined(activity.machine);
    const operatorRef = pickJoined(activity.operator);
    const siteRef = pickJoined(activity.site);
    const blockRef = pickJoined(activity.block_mined);

    const aggregate = activity.machine_id ? byExcavator.get(activity.machine_id) : undefined;
    const loadedLoads = aggregate?.loadedLoads ?? 0;
    const assignedMachines = aggregate?.dumperIds.size ?? 0;
    const totalBcm = aggregate?.totalBcm ?? 0;

    const siteBlock =
      [siteRef?.name, blockRef?.code || blockRef?.name].filter(Boolean).join(' · ') ||
      UNASSIGNED_BLOCK;

    return {
      id: activity.id,
      excavatorName: machineRef?.name || `${FALLBACK_EXCAVATOR_NAME} 0${index + 1}`,
      operatorName: operatorRef?.full_name || UNASSIGNED_OPERATOR,
      siteBlock,
      shift: (activity.shift_type || 'day').toUpperCase(),
      material: activity.material_type || UNASSIGNED_MATERIAL,
      assignedMachines,
      loadedLoads,
      totalBcm: Math.round(totalBcm),
      status: loadedLoads > 0 ? 'loading' : assignedMachines > 0 ? 'digging' : 'standby',
    };
  });
}

function buildMachineRows(
  fleet: readonly ScadaMachineRow[],
  byMachine: Map<string, MachineAggregate>,
  machineNameById: Map<string, string>
): RegisteredMachineLoadViewRow[] {
  return fleet
    .filter((machine) => machine.machine_type !== 'Excavator')
    .slice(0, MAX_RENDERED_HAUL_MACHINES)
    .map((machine) => {
      const aggregate = byMachine.get(machine.id);
      const loads = aggregate?.loads ?? 0;
      const binFactor = machine.bin_factor ?? FALLBACK_MACHINE_BIN_FACTOR;
      const excavatorId = aggregate?.excavatorId ?? null;

      return {
        id: machine.id,
        machineName: machine.name,
        machineType: machine.machine_type ?? 'Haul Truck',
        assignedExcavator:
          (excavatorId && machineNameById.get(excavatorId)) || UNASSIGNED_EXCAVATOR,
        material: aggregate?.material || UNASSIGNED_MATERIAL,
        binFactor,
        loadedLoads: loads,
        totalBcm: Math.round(loads * binFactor),
        status: loads > 0 ? 'hauling' : excavatorId ? 'loading' : 'standby',
      };
    });
}

export function deriveScadaPanelRows({
  activities,
  fleet,
  loads,
}: {
  activities: readonly ScadaActivityRow[];
  fleet: readonly ScadaMachineRow[];
  loads: readonly ScadaLoadRow[];
}): ScadaPanelDerivation {
  const binFactorByMachine = new Map<string, number>();
  const machineNameById = new Map<string, string>();

  for (const machine of fleet) {
    machineNameById.set(machine.id, machine.name);
    if (typeof machine.bin_factor === 'number' && machine.bin_factor > 0) {
      binFactorByMachine.set(machine.id, machine.bin_factor);
    }
  }

  const { byExcavator, byMachine } = aggregateLoads(loads, binFactorByMachine);

  return {
    excavators: buildExcavatorRows(activities, byExcavator),
    registeredMachines: buildMachineRows(fleet, byMachine, machineNameById),
  };
}

/**
 * Merge one CDC payload into a row list without refetching.
 *
 * `UPDATE`/`INSERT` upsert by `id` (preserving embedded joins from the existing
 * row so names do not blank out); `DELETE` removes. Rows whose operational date
 * is not `today` are dropped, matching the initial query filter.
 */
export function mergeScadaRows<T extends { id: string }>({
  rows,
  payload,
  today,
  dateField,
}: {
  rows: readonly T[];
  payload: RealtimePayload<T>;
  today: string;
  dateField: keyof T;
}): T[] {
  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old.id;
    return deletedId ? rows.filter((row) => row.id !== deletedId) : [...rows];
  }

  const incoming = payload.new;
  if (!incoming?.id) return [...rows];

  const incomingDate = incoming[dateField];
  if (typeof incomingDate === 'string' && incomingDate !== today) {
    return rows.filter((row) => row.id !== incoming.id);
  }

  const index = rows.findIndex((row) => row.id === incoming.id);
  if (index === -1) return [...rows, incoming];

  const next = [...rows];
  next[index] = { ...next[index], ...incoming };
  return next;
}
