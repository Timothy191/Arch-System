import { connection } from 'next/server';
import { getDepartmentContext } from '~/lib/dept-context';
import {
  buildEngineeringReportsPayload,
  type EngineeringReportsPayload,
  type EngineeringReportTab,
  type RawBreakdownRecord,
  type RawMachineHoursRecord,
  type RawMachineOperationRecord,
  type RawMachineRecord,
  type RawTireInspectionRecord,
  type RawTireRecord,
  resolveEngineeringReportRange,
  resolveRangeWindow,
} from './engineering-reports-model';

function unwrapSettledRows<T>(
  result: PromiseSettledResult<{ data: T[] | null; error?: unknown }>
): T[] {
  if (result.status !== 'fulfilled') {
    return [];
  }
  if (result.value.error || !Array.isArray(result.value.data)) {
    return [];
  }
  return result.value.data;
}

export async function loadEngineeringReportsPayload(options: {
  readonly rawRange?: string;
  readonly initialTab: EngineeringReportTab;
}): Promise<EngineeringReportsPayload> {
  await connection();
  const { dept, deptId, supabase, today } = await getDepartmentContext({
    department: 'engineering',
  });

  const range = resolveEngineeringReportRange(options.rawRange);
  const todayStr = today || new Date().toISOString().slice(0, 10);
  const { fromDateStr, toDateStr, rangeLabel } = resolveRangeWindow({ todayStr, range });

  const [
    breakdownsResult,
    tiresResult,
    inspectionsResult,
    machinesResult,
    machineHoursResult,
    machineOpsResult,
  ] = await Promise.allSettled([
    supabase
      .from('breakdowns')
      .select(
        'id, fleet_id, machine_id, machine_name, machine_type, reason, status, date_in, time_in, date_out, time_out, duration_hours, repair_notes, created_at'
      )
      .eq('department_id', deptId)
      .is('deleted_at', null)
      .gte('date_in', fromDateStr)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('tires')
      .select(
        'id, serial_number, brand, size, position, status, machine_id, installed_at, installed_hours, removed_at, removed_hours, scrapped_reason, machines(id, name)'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('tire_inspections')
      .select(
        'id, tire_id, inspection_date, tread_depth_mm, pressure_psi, condition_status, current_smu, notes'
      )
      .gte('inspection_date', fromDateStr)
      .order('inspection_date', { ascending: false })
      .limit(100),
    supabase.from('machines').select('id, name, machine_type, serial_number, active').order('name'),
    supabase
      .from('machine_hours')
      .select('id, machine_id, daily_log_date, hours_worked')
      .gte('daily_log_date', fromDateStr)
      .limit(500),
    supabase
      .from('machine_operations')
      .select('id, machine_id, shift_date, hours_worked, start_smu, end_smu')
      .gte('shift_date', fromDateStr)
      .limit(500),
  ]);

  return buildEngineeringReportsPayload({
    departmentName: dept.displayName,
    range,
    initialTab: options.initialTab,
    todayStr,
    fromDateStr,
    toDateStr,
    rangeLabel,
    rawBreakdowns: unwrapSettledRows<RawBreakdownRecord>(
      breakdownsResult as PromiseSettledResult<{
        data: RawBreakdownRecord[] | null;
        error?: unknown;
      }>
    ),
    rawTires: unwrapSettledRows<RawTireRecord>(
      tiresResult as PromiseSettledResult<{ data: RawTireRecord[] | null; error?: unknown }>
    ),
    rawTireInspections: unwrapSettledRows<RawTireInspectionRecord>(
      inspectionsResult as PromiseSettledResult<{
        data: RawTireInspectionRecord[] | null;
        error?: unknown;
      }>
    ),
    rawMachines: unwrapSettledRows<RawMachineRecord>(
      machinesResult as PromiseSettledResult<{ data: RawMachineRecord[] | null; error?: unknown }>
    ),
    rawMachineHours: unwrapSettledRows<RawMachineHoursRecord>(
      machineHoursResult as PromiseSettledResult<{
        data: RawMachineHoursRecord[] | null;
        error?: unknown;
      }>
    ),
    rawMachineOperations: unwrapSettledRows<RawMachineOperationRecord>(
      machineOpsResult as PromiseSettledResult<{
        data: RawMachineOperationRecord[] | null;
        error?: unknown;
      }>
    ),
  });
}
