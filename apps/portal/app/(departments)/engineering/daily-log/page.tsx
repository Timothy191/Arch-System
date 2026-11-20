import { connection } from 'next/server';
import { getDepartmentContext } from '~/lib/dept-context';
import { EngineeringDailyLogClient } from './EngineeringDailyLogClient';
import {
  buildEngineeringDailyLogReport,
  type RawDailyBreakdownRow,
  type RawDailyMachineRow,
} from './engineering-daily-log-helpers';

const MS_PER_DAY = 86_400_000;
const BREAKDOWN_SELECT_FIELDS =
  'id, fleet_id, machine_id, machine_name, machine_type, site_code, shift_type, date_in, time_in, date_out, time_out, duration_hours, duration_minutes, delay_hours, reason, repair_notes, status, created_at, updated_at';

export default async function EngineeringDailyLogPage() {
  await connection();
  const { deptId, supabase, today } = await getDepartmentContext({
    department: 'engineering',
  });

  const nowMs = Date.now();
  const cutoff24hIso = new Date(nowMs - MS_PER_DAY).toISOString();

  const [recentTimestampRes, todayDatedRes, activeMachinesRes] = await Promise.all([
    supabase
      .from('breakdowns')
      .select(BREAKDOWN_SELECT_FIELDS)
      .eq('department_id', deptId)
      .is('deleted_at', null)
      .gte('created_at', cutoff24hIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('breakdowns')
      .select(BREAKDOWN_SELECT_FIELDS)
      .eq('department_id', deptId)
      .is('deleted_at', null)
      .eq('date_in', today)
      .order('created_at', { ascending: false }),
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, active, site:sites(name, site_code)')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name'),
  ]);

  const combinedBreakdowns = [
    ...((recentTimestampRes.data ?? []) as RawDailyBreakdownRow[]),
    ...((todayDatedRes.data ?? []) as RawDailyBreakdownRow[]),
  ];

  const report = buildEngineeringDailyLogReport({
    breakdowns: combinedBreakdowns,
    machines: (activeMachinesRes.data ?? []) as RawDailyMachineRow[],
    today,
    nowMs,
  });

  return <EngineeringDailyLogClient report={report} />;
}
