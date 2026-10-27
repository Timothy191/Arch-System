import { getShiftCompleteness } from '@/lib/shift-completeness';
import type { getDepartmentContext } from '~/lib/dept-context';

type DepartmentSupabaseClient = Awaited<ReturnType<typeof getDepartmentContext>>['supabase'];

export interface RawExcavatorActivityNode {
  id?: string;
  machine_id?: string;
  activity_date: string;
  shift_type: string;
  passes?: number | null;
  loads?: number | null;
  material_type?: string | null;
  machine?:
    | { name?: string; machine_type?: string }
    | { name?: string; machine_type?: string }[]
    | null;
  operator?: { full_name?: string } | { full_name?: string }[] | null;
  site?: { name?: string } | { name?: string }[] | null;
  block_mined?: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
}

export interface RawExcavatorAssignmentRow {
  total_loads?: number | null;
  total_bcm?: number | null;
  material_type?: string | null;
  dumper_machine_id?: string | null;
  dumper?:
    | { name?: string; machine_type?: string; bin_factor?: number | null }
    | { name?: string; machine_type?: string; bin_factor?: number | null }[]
    | null;
  excavator_activity?: RawExcavatorActivityNode | RawExcavatorActivityNode[] | null;
}

export interface RawHourlyLoadRow {
  machine_id?: string | null;
  excavator_id?: string | null;
  material_type?: string | null;
  load_date: string;
  shift_type: string;
  total_loads: number | null;
  machine?:
    | {
        name?: string;
        machine_type?: string;
        bin_factor?: number | null;
        sites?: { name: string }[] | { name: string } | null;
      }
    | {
        name?: string;
        machine_type?: string;
        bin_factor?: number | null;
        sites?: { name: string }[] | { name: string } | null;
      }[]
    | null;
  excavator?:
    | {
        name?: string;
        sites?: { name: string }[] | { name: string } | null;
      }
    | {
        name?: string;
        sites?: { name: string }[] | { name: string } | null;
      }[]
    | null;
}

export interface RawDozerRollRow {
  machine_id?: string | null;
  roll_date: string;
  shift_type: string;
  blade_passes: number | null;
  hours_operated: number | null;
  machine?:
    | {
        name?: string;
        machine_type?: string;
        sites?: { name: string }[] | { name: string } | null;
      }
    | {
        name?: string;
        machine_type?: string;
        sites?: { name: string }[] | { name: string } | null;
      }[]
    | null;
  operator?: { full_name?: string } | { full_name?: string }[] | null;
}

export interface RawBreakdownRow {
  id: string;
  fleet_id: string;
  machine_name: string | null;
  machine_type: string | null;
  reason: string;
  repair_notes: string | null;
  date_in: string;
  time_in: string | null;
  date_out: string | null;
  duration_minutes?: number | null;
  status: string;
}

export interface RawEngineeringNoteRow {
  id: string;
  note_date: string;
  shift_type: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action_taken: string | null;
  status: string;
  machine?: { name: string } | { name: string }[] | null;
}

export interface RawMachineOperationRow {
  id: string;
  machine_id: string;
  shift_date: string;
  shift_type: string;
  start_smu: number | null;
  end_smu: number | null;
  hours_worked: number | null;
  operator_name?: string | null;
  machine?:
    | {
        name: string;
        machine_type: string;
        bin_factor: number | null;
        serial_number?: string | null;
        sites?: { name: string }[] | { name: string } | null;
      }
    | {
        name: string;
        machine_type: string;
        bin_factor: number | null;
        serial_number?: string | null;
        sites?: { name: string }[] | { name: string } | null;
      }[]
    | null;
  operator?: { full_name: string } | { full_name: string }[] | null;
  site?: { name: string } | { name: string }[] | null;
  delay_entries?: Array<{
    duration_hours: number | null;
    manual_duration_hours?: number | null;
    is_manual_override?: boolean | null;
    deleted_at: string | null;
    description?: string | null;
    delay_category?: { name: string } | { name: string }[] | null;
  }> | null;
}

export interface RawDailyLogRow {
  id: string;
  department_id: string;
  log_date: string;
  shift: string;
  notes: string | null;
}

export async function fetchDepartmentReportsRawData(params: {
  supabase: DepartmentSupabaseClient;
  deptId: string;
  deptSlug: string;
  fromDateStr: string;
  toDateStr: string;
  todayStr: string;
  currentShift: 'day' | 'night';
}) {
  const { supabase, deptId, deptSlug, fromDateStr, toDateStr, todayStr, currentShift } = params;

  const [
    { data: operations, error: operationsError },
    { data: loads, error: loadsError },
    { data: delays },
    { data: excavatorAssignments, error: assignmentsError },
    { data: dozerRolls, error: dozerRollsError },
    { data: breakdowns, error: breakdownsError },
    { data: engNotes, error: engNotesError },
    { data: dailyLogs, error: dailyLogsError },
    completeness,
  ] = await Promise.all([
    supabase
      .from('machine_operations')
      .select(
        'id, machine_id, shift_date, shift_type, start_smu, end_smu, hours_worked, operator_name, machine:machines(name, machine_type, bin_factor, serial_number, sites(name)), operator:operators(full_name), site:sites(name), delay_entries:delay_entries(duration_hours, manual_duration_hours, is_manual_override, deleted_at, description, delay_category:delay_categories(name))'
      )
      .gte('shift_date', fromDateStr)
      .lte('shift_date', toDateStr)
      .order('shift_date', { ascending: false }),
    supabase
      .from('hourly_loads')
      .select(
        'id, machine_id, excavator_id, material_type, load_date, shift_type, total_loads, machine:machines!machine_id(name, machine_type, bin_factor, sites(name)), excavator:machines!excavator_id(name, sites(name))'
      )
      .gte('load_date', fromDateStr)
      .lte('load_date', toDateStr),
    Promise.resolve({
      data: [] as Array<{ delay_date: string; shift_type: string; delay_minutes: number }>,
    }),
    supabase
      .from('excavator_dumper_assignments')
      .select(
        'total_loads, total_bcm, material_type, dumper_machine_id, dumper:machines!dumper_machine_id(name, machine_type, bin_factor), excavator_activity!inner(id, machine_id, activity_date, shift_type, department_id, passes, loads, material_type, notes, machine:machines(name, machine_type), operator:operators(full_name), site:sites(name), block_mined:mine_blocks(name, code))'
      )
      .gte('excavator_activity.activity_date', fromDateStr)
      .lte('excavator_activity.activity_date', toDateStr),
    supabase
      .from('dozer_rolls')
      .select(
        'id, machine_id, roll_date, shift_type, blade_passes, hours_operated, machine:machines(name, machine_type, sites(name)), operator:operators(full_name)'
      )
      .gte('roll_date', fromDateStr)
      .lte('roll_date', toDateStr),
    supabase
      .from('breakdowns')
      .select(
        'id, fleet_id, machine_name, machine_type, reason, repair_notes, date_in, time_in, date_out, duration_minutes, status, created_at'
      )
      .is('deleted_at', null)
      .gte('date_in', fromDateStr)
      .lte('date_in', toDateStr)
      .order('created_at', { ascending: false }),
    supabase
      .from('engineering_notes')
      .select(
        'id, note_date, shift_type, issue_type, severity, description, action_taken, status, created_at, machine:machines(name)'
      )
      .gte('note_date', fromDateStr)
      .lte('note_date', toDateStr)
      .order('created_at', { ascending: false }),
    supabase
      .from('daily_logs')
      .select('id, department_id, log_date, shift, notes, created_at')
      .gte('log_date', fromDateStr)
      .lte('log_date', toDateStr)
      .order('log_date', { ascending: false }),
    getShiftCompleteness(supabase, deptId, deptSlug, todayStr, currentShift).catch(() => ({
      complete: true,
      totalRequired: 0,
      totalCovered: 0,
      statuses: [],
    })),
  ]);

  const queryWarnings: string[] = [];
  const namedErrors: Array<[string, { message?: string } | null | undefined]> = [
    ['machine_operations', operationsError],
    ['hourly_loads', loadsError],
    ['excavator_dumper_assignments', assignmentsError],
    ['dozer_rolls', dozerRollsError],
    ['breakdowns', breakdownsError],
    ['engineering_notes', engNotesError],
    ['daily_logs', dailyLogsError],
  ];
  for (const [tableName, err] of namedErrors) {
    if (err?.message) {
      queryWarnings.push(`${tableName}: ${err.message}`);
    }
  }

  const logIds = (dailyLogs || []).map((l) => l.id);
  const [{ data: machineHours }, { data: fuelLogs }, { data: productionLogs }] = await Promise.all([
    logIds.length > 0
      ? supabase
          .from('machine_hours')
          .select('daily_log_id, hours_worked')
          .in('daily_log_id', logIds)
      : Promise.resolve({ data: [] }),
    logIds.length > 0
      ? supabase.from('fuel_logs').select('daily_log_id, diesel_litres').in('daily_log_id', logIds)
      : Promise.resolve({ data: [] }),
    logIds.length > 0
      ? supabase
          .from('production_logs')
          .select('daily_log_id, coal_tonnes, waste_tonnes')
          .in('daily_log_id', logIds)
      : Promise.resolve({ data: [] }),
  ]);

  const machineHoursByLog = new Map<string, number>();
  machineHours?.forEach((m) => {
    machineHoursByLog.set(
      m.daily_log_id,
      (machineHoursByLog.get(m.daily_log_id) || 0) + (m.hours_worked || 0)
    );
  });

  const fuelLogsByLog = new Map<string, number>();
  fuelLogs?.forEach((f) => {
    fuelLogsByLog.set(
      f.daily_log_id,
      (fuelLogsByLog.get(f.daily_log_id) || 0) + (f.diesel_litres || 0)
    );
  });

  const productionByLog = new Map<string, { coal_tonnes: number; waste_tonnes: number }>();
  productionLogs?.forEach((p) => {
    productionByLog.set(p.daily_log_id, p);
  });

  return {
    operations: (operations || []) as RawMachineOperationRow[],
    loads: (loads || []) as RawHourlyLoadRow[],
    delays: delays || [],
    excavatorAssignments: (excavatorAssignments || []) as RawExcavatorAssignmentRow[],
    dozerRolls: (dozerRolls || []) as RawDozerRollRow[],
    breakdowns: (breakdowns || []) as RawBreakdownRow[],
    engNotes: (engNotes || []) as RawEngineeringNoteRow[],
    dailyLogs: (dailyLogs || []) as RawDailyLogRow[],
    completeness,
    queryWarnings,
    machineHoursByLog,
    fuelLogsByLog,
    productionByLog,
  };
}
