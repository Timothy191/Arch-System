import type { UnifiedShiftReport } from '@repo/contract/types/shift-compilation.types';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { getCurrentShift } from '@repo/utils';
import { getFleetOpeningSmrSnapshot } from '~/lib/control-room-fleet-smr';
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
    { closeoutFleet },
    { data: recentReportsData },
  ] = await Promise.all([
    getUnifiedShiftReport(deptId, shiftDate, shiftType),
    getMultiSiteShiftReport(deptId, shiftDate, shiftType),
    getAuthenticatedEmployee(supabase),
    getFleetOpeningSmrSnapshot(supabase),
    supabase
      .from('control_room_shift_reports')
      .select(
        'id, report_date, shift_type, operator_name, status, submitter_id, created_by, approver_id, approval_note, approved_at, created_at'
      )
      .eq('department_id', deptId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const recentCloseoutReports: ShiftReportSummary[] = (recentReportsData ?? []).map((r) => ({
    id: r.id,
    reportDate: r.report_date,
    shiftType: r.shift_type,
    operatorName: r.operator_name,
    status: (r.status ?? 'submitted') as ShiftReportSummary['status'],
    submitterId: r.submitter_id ?? r.created_by ?? null,
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
      initialOperatorName={
        (principal?.user?.user_metadata?.full_name as string | undefined) ||
        principal?.user?.email ||
        undefined
      }
    />
  );
}
