import type { MachineTimeAllocationInput } from '@repo/contract';
import type { createServerSupabaseClient } from '@repo/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export interface PreviousSmrRow {
  readonly machine_id: string;
  readonly end_smu: number | null;
}

export interface BaselineSmrReadingRow {
  readonly meter_id: string | null;
  readonly reading: number | null;
}

export interface ActiveFleetMachineRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type?: string;
  readonly active?: boolean;
  readonly site_id?: string | null;
}

const PREVIOUS_SMR_QUERY_LIMIT = 500;
const BASELINE_SMR_QUERY_LIMIT = 200;

/**
 * Resolves the highest recorded SMR/SMU per machine across historical
 * `machine_operations.end_smu` and `smr_readings.reading` records.
 */
export function resolveLatestMachineSmrMap(
  previousSMRs: readonly PreviousSmrRow[] | null | undefined,
  baselineSmrReadings: readonly BaselineSmrReadingRow[] | null | undefined
): Map<string, number> {
  const latestSMRMap = new Map<string, number>();

  for (const row of previousSMRs ?? []) {
    if (row.end_smu !== null && row.end_smu !== undefined) {
      const currentMax = latestSMRMap.get(row.machine_id) ?? 0;
      const candidate = Number(row.end_smu);
      if (candidate > currentMax) {
        latestSMRMap.set(row.machine_id, candidate);
      }
    }
  }

  for (const row of baselineSmrReadings ?? []) {
    if (row.reading !== null && row.reading !== undefined && row.meter_id) {
      const currentMax = latestSMRMap.get(row.meter_id) ?? 0;
      const candidate = Number(row.reading);
      if (candidate > currentMax) {
        latestSMRMap.set(row.meter_id, candidate);
      }
    }
  }

  return latestSMRMap;
}

/**
 * Builds the initial `MachineTimeAllocationInput[]` closeout ledger for active fleet units.
 */
export function buildCloseoutFleetAllocations(
  machines: readonly ActiveFleetMachineRow[] | null | undefined,
  latestSMRMap: ReadonlyMap<string, number>
): MachineTimeAllocationInput[] {
  if (!machines || machines.length === 0) {
    return [];
  }

  return machines.map((machine) => {
    const openingSMR = latestSMRMap.get(machine.id) ?? 0;
    return {
      machine_id: machine.id,
      machine_name: machine.name,
      opening_smr: openingSMR,
      closing_smr: openingSMR,
      breakdown_hours: 0,
      delay_hours: 0,
    };
  });
}

/**
 * Fetches active fleet machines and resolves their opening SMR readings in parallel.
 */
export async function getFleetOpeningSmrSnapshot(supabase: SupabaseServerClient) {
  const [{ data: machines }, { data: previousSMRs }, { data: baselineSmrReadings }] =
    await Promise.all([
      supabase
        .from('machines')
        .select('id, name, machine_type, active, site_id')
        .eq('active', true)
        .order('name'),
      supabase
        .from('machine_operations')
        .select('machine_id, end_smu')
        .not('end_smu', 'is', null)
        .order('shift_date', { ascending: false })
        .order('end_smu', { ascending: false })
        .limit(PREVIOUS_SMR_QUERY_LIMIT),
      supabase
        .from('smr_readings')
        .select('meter_id, reading')
        .order('reading_at', { ascending: false })
        .limit(BASELINE_SMR_QUERY_LIMIT),
    ]);

  const typedMachines = (machines ?? []) as ActiveFleetMachineRow[];
  const latestSMRMap = resolveLatestMachineSmrMap(
    previousSMRs as PreviousSmrRow[] | null,
    baselineSmrReadings as BaselineSmrReadingRow[] | null
  );
  const closeoutFleet = buildCloseoutFleetAllocations(typedMachines, latestSMRMap);

  return {
    machines: typedMachines,
    latestSMRMap,
    closeoutFleet,
  };
}
