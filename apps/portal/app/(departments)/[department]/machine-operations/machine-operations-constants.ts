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

interface HourlyLoadSummary {
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

export type FilterStatus = 'all' | 'operating' | 'standby' | 'breakdown';

interface MachineWithMeta {
  machine: MachineItem;
  breakdown: Breakdown | undefined;
  operations: MachineOperation[];
  status: 'breakdown' | 'in-progress' | 'operating' | 'standby';
  totalHours: number;
}

export interface MachineStatusCounts {
  total: number;
  operating: number;
  standby: number;
  breakdown: number;
}

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

export function buildLoadsByMachineMap(todayLoads: HourlyLoadSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const load of todayLoads || []) {
    if (!load.machine_id) continue;
    const current = map.get(load.machine_id) || 0;
    map.set(load.machine_id, current + (load.total_loads || 0));
  }
  return map;
}

export function buildBreakdownsByFleetIdMap(activeBreakdowns: Breakdown[]): Map<string, Breakdown> {
  const map = new Map<string, Breakdown>();
  for (const breakdown of activeBreakdowns || []) {
    if (breakdown.fleet_id) {
      map.set(breakdown.fleet_id, breakdown);
    }
  }
  return map;
}

export function buildOperationsByMachineMap(
  operations: MachineOperation[]
): Map<string, MachineOperation[]> {
  const map = new Map<string, MachineOperation[]>();
  for (const op of operations) {
    if (!op.machine_id) continue;
    const list = map.get(op.machine_id) || [];
    list.push(op);
    map.set(op.machine_id, list);
  }
  return map;
}

export function buildLegacySiteEntries(
  operations: MachineOperation[],
  machines: MachineItem[] | undefined
): Array<[string, { siteName: string; operations: MachineOperation[] }]> | null {
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
}

export function buildFleetMachinesList(
  machines: MachineItem[] | undefined,
  operations: MachineOperation[]
): MachineItem[] {
  if (!machines) return [];
  const list: MachineItem[] = [...machines];
  const knownIds = new Set(machines.map((m) => m.id));

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
}

export function computeMachinesWithMeta(
  fleetMachines: MachineItem[],
  breakdownsByFleetId: Map<string, Breakdown>,
  operationsByMachine: Map<string, MachineOperation[]>
): MachineWithMeta[] {
  return fleetMachines.map((machine) => {
    const breakdown =
      breakdownsByFleetId.get(machine.id) ||
      breakdownsByFleetId.get(machine.name) ||
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
}

export function computeMachineStatusCounts(
  machinesWithMeta: MachineWithMeta[]
): MachineStatusCounts {
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
}

export function filterMachinesWithMeta(
  machinesWithMeta: MachineWithMeta[],
  filterStatus: FilterStatus,
  searchQuery: string
): MachineWithMeta[] {
  return machinesWithMeta.filter((item) => {
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
}

export function groupMachinesBySite(
  filteredMachines: MachineWithMeta[]
): Array<[string, { siteName: string; siteCode?: string; items: MachineWithMeta[] }]> {
  const map = new Map<string, { siteName: string; siteCode?: string; items: MachineWithMeta[] }>();

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
}

// DelayEntriesForm constants & helpers
export interface DelayCategoryItem {
  id: string;
  name: string;
  description: string | null;
}

export interface DelayFormEntry {
  id?: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time: string;
  is_manual_override: boolean;
  manual_duration_hours: number | null;
  description: string | null;
  status: 'draft' | 'committed';
}

export interface DelayEntriesFormProps {
  machineOperationId: string;
  departmentId: string;
  onDelayChange?: (_delays: DelayFormEntry[]) => void;
  existingDelays?: DelayFormEntry[];
  readOnly?: boolean;
  engineeringDelayHours?: number;
  engineeringDelayReasons?: string[];
}

const toLocalTime = (utcString: string): string => {
  const date = new Date(utcString);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const toUTC = (localString: string): string => {
  const date = new Date(localString);
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toISOString();
};

export function calculateDelayDurationHours(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

export function formatDelayEntriesFromDb(
  rows: Array<{
    id: string;
    delay_category_id: string;
    delay_start_time: string;
    delay_end_time: string;
    is_manual_override: boolean;
    manual_duration_hours: number | null;
    description: string | null;
    status: string;
  }>
): DelayFormEntry[] {
  return rows.map((d) => ({
    id: d.id,
    delay_category_id: d.delay_category_id,
    delay_start_time: toLocalTime(d.delay_start_time),
    delay_end_time: toLocalTime(d.delay_end_time),
    is_manual_override: d.is_manual_override,
    manual_duration_hours: d.manual_duration_hours,
    description: d.description,
    status: d.status as 'draft' | 'committed',
  }));
}

export function validateDelayFormEntry(
  entry: DelayFormEntry,
  index: number,
  allEntries: DelayFormEntry[],
  engineeringDelayHours: number
): string | null {
  if (!entry.delay_category_id) {
    return 'Category is required';
  }

  if (!entry.delay_start_time) {
    return 'Start time is required';
  }

  if (!entry.is_manual_override && !entry.delay_end_time) {
    return 'End time is required (unless using manual override)';
  }

  if (entry.delay_end_time) {
    const start = new Date(entry.delay_start_time);
    const end = new Date(entry.delay_end_time);

    if (end <= start) {
      return 'End time must be after start time';
    }
  }

  let duration: number;
  if (entry.is_manual_override) {
    duration = entry.manual_duration_hours || 0;
  } else if (entry.delay_end_time) {
    duration = calculateDelayDurationHours(entry.delay_start_time, entry.delay_end_time);
  } else {
    return 'Duration cannot be calculated without end time';
  }

  if (duration <= 0) {
    return 'Duration must be greater than 0';
  }

  const otherEntries = allEntries.filter((_, i) => i !== index);
  const totalDuration = otherEntries.reduce((sum, e) => {
    const d = e.is_manual_override
      ? e.manual_duration_hours || 0
      : calculateDelayDurationHours(e.delay_start_time, e.delay_end_time);
    return sum + d;
  }, 0);

  const maxRemainingHours = Math.max(0, Number((12 - engineeringDelayHours).toFixed(2)));
  if (engineeringDelayHours + totalDuration + duration > 12) {
    if (engineeringDelayHours > 0) {
      return `Total delay hours cannot exceed 12h shift limit (Engineering logged ${engineeringDelayHours.toFixed(2)}h; Control Room remaining cap is ${maxRemainingHours.toFixed(2)}h). Current CR: ${totalDuration.toFixed(2)}h, This entry: ${duration.toFixed(2)}h`;
    }
    return `Total delay hours cannot exceed 12 hours. Current: ${totalDuration.toFixed(2)}h, This entry: ${duration.toFixed(2)}h`;
  }

  return null;
}
