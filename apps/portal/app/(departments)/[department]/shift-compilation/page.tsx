import type { MachineTimeAllocationInput } from '@repo/contract';
import type { UnifiedShiftReport } from '@repo/contract/types/shift-compilation.types';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { getCurrentShift } from '@repo/utils';
import { getDepartmentContext } from '~/lib/dept-context';
import type { ShiftReportSummary } from '../../control-room/components/SupervisorApprovalPanel';
import { getMultiSiteShiftReport, getUnifiedShiftReport } from './actions';
import { ShiftCompilationClient } from './ShiftCompilationClient';

export default async function ShiftCompilationPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ date?: string; shift?: string; tab?: string }>;
}) {
  const { department } = await params;
  const { date: queryDate, shift: queryShift, tab: queryTab } = await searchParams;

  const { deptId, today } = await getDepartmentContext({
    department,
  });

  const shiftDate = queryDate || today;
  const shiftType = queryShift === 'day' || queryShift === 'night' ? queryShift : getCurrentShift();
  const initialSection: 'handover' | 'coverage' | 'closeout' =
    queryTab === 'coverage' || queryTab === 'closeout' ? queryTab : 'handover';

  const supabase = await createServerSupabaseClient();

  const [
    { data: compiledReport },
    { data: multiSiteReport },
    principal,
    { data: machines },
    { data: previousSMRs },
    { data: baselineSmrReadings },
    { data: recentReportsData },
  ] = await Promise.all([
    getUnifiedShiftReport(deptId, shiftDate, shiftType),
    getMultiSiteShiftReport(deptId, shiftDate, shiftType),
    getAuthenticatedEmployee(supabase),
    supabase.from('machines').select('id, name').eq('active', true).order('name'),
    supabase
      .from('machine_operations')
      .select('machine_id, end_smu')
      .not('end_smu', 'is', null)
      .order('shift_date', { ascending: false })
      .order('end_smu', { ascending: false })
      .limit(500),
    supabase
      .from('smr_readings')
      .select('machine_id, reading_hours')
      .order('reading_date', { ascending: false })
      .limit(200),
    supabase
      .from('control_room_shift_reports')
      .select(
        'id, report_date, shift_type, operator_name, status, submitter_id, approver_id, approval_note, approved_at, created_at'
      )
      .eq('department_id', deptId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const latestSMRMap = new Map<string, number>();
  (previousSMRs as Array<{ machine_id: string; end_smu: number | null }> | null)?.forEach((row) => {
    if (!latestSMRMap.has(row.machine_id) && row.end_smu !== null && row.end_smu !== undefined) {
      latestSMRMap.set(row.machine_id, Number(row.end_smu));
    }
  });
  (
    baselineSmrReadings as Array<{ machine_id: string; reading_hours: number | null }> | null
  )?.forEach((row) => {
    if (
      !latestSMRMap.has(row.machine_id) &&
      row.reading_hours !== null &&
      row.reading_hours !== undefined
    ) {
      latestSMRMap.set(row.machine_id, Number(row.reading_hours));
    }
  });

  const closeoutFleet: MachineTimeAllocationInput[] =
    machines && machines.length > 0
      ? machines.map((m) => {
          const openingSMR = latestSMRMap.get(m.id) ?? 0;
          return {
            machine_id: m.id,
            machine_name: m.name,
            opening_smr: openingSMR,
            closing_smr: openingSMR,
            breakdown_hours: 0,
            delay_hours: 0,
          };
        })
      : [];

  const recentCloseoutReports: ShiftReportSummary[] = (recentReportsData ?? []).map((r) => ({
    id: r.id,
    reportDate: r.report_date,
    shiftType: r.shift_type,
    operatorName: r.operator_name,
    status: (r.status ?? 'submitted') as ShiftReportSummary['status'],
    submitterId: r.submitter_id,
    approverId: r.approver_id,
    approvalNote: r.approval_note,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
  }));

  const fallbackReport: UnifiedShiftReport = {
    meta: {
      department_id: deptId,
      shift_date: shiftDate,
      shift_type: shiftType,
      compiled_at: new Date().toISOString(),
    },
    shift_status: {
      status: 'open',
    },
    production: {
      total_loads: 0,
      machines: [],
    },
    fleet_performance: [],
    breakdowns: [],
    tire_management: [],
  };

  const report = compiledReport || fallbackReport;

  return (
    <ShiftCompilationClient
      initialReport={report}
      multiSiteReport={multiSiteReport || null}
      departmentId={deptId}
      departmentSlug={department}
      shiftDate={shiftDate}
      shiftType={shiftType}
      initialSection={initialSection}
      closeoutFleet={closeoutFleet}
      recentCloseoutReports={recentCloseoutReports}
      currentEmployeeId={principal?.employee?.id}
      currentRole={principal?.employee?.role}
    />
  );
}
