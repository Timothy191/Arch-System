import { ControlRoomChecklistWidget } from '@repo/departments/ui';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { GlassCard } from '@repo/ui/components/GlassCard';
import { Divider } from '@repo/ui/Divider';
import { getCurrentShift } from '@repo/utils';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { getFleetOpeningSmrSnapshot } from '~/lib/control-room-fleet-smr';
import { getDepartmentContext } from '~/lib/dept-context';
import { ControlRoomQuickNav } from '../components/ControlRoomQuickNav';
import { ControlRoomSubtabs } from '../components/ControlRoomSubtabs';
import { ShiftCloseoutForm } from '../components/ShiftCloseoutForm';
import { ShiftReportSummary, SupervisorApprovalPanel } from '../components/SupervisorApprovalPanel';

export const metadata: Metadata = {
  title: 'Shift Closeout | Control Room | Arch OS',
  description: 'Atomic shift closeout and equipment SMR reconciliation.',
};

async function ShiftCloseoutSection() {
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });
  const supabase = await createServerSupabaseClient();
  const [principal, { closeoutFleet: fleetData }, { data: recentReportsData }] = await Promise.all([
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

  const recentReports: ShiftReportSummary[] = (recentReportsData ?? []).map((r) => ({
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

  const isSupervisorOrAdmin =
    principal?.employee?.role && ['supervisor', 'admin'].includes(principal.employee.role);
  const currentShift = getCurrentShift();

  return (
    <div className="space-y-8">
      {isSupervisorOrAdmin && (
        <SupervisorApprovalPanel
          reports={recentReports}
          currentEmployeeId={principal?.employee?.id}
          currentRole={principal?.employee?.role}
        />
      )}
      <ShiftCloseoutForm deptId={deptId} shiftDate={today} initialFleet={fleetData} />
      <ControlRoomChecklistWidget
        departmentId={deptId}
        departmentSlug="control-room"
        date={today}
        shift={currentShift}
        initialOperatorName={
          (principal?.user?.user_metadata?.full_name as string | undefined) ||
          principal?.user?.email ||
          undefined
        }
      />
    </div>
  );
}

function ShiftCloseoutSkeleton() {
  return (
    <GlassCard variant="spotlight" className="max-w-5xl animate-pulse p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-64 rounded-md bg-[var(--bg-secondary)]" />
          <div className="h-4 w-96 rounded-md bg-[var(--bg-secondary)]/60" />
        </div>
      </div>
      <div className="mb-4 h-10 w-48 rounded-lg bg-[var(--bg-secondary)]" />
      <div className="h-64 w-full rounded-xl bg-[var(--bg-secondary)]/40" />
    </GlassCard>
  );
}

export default function ShiftCloseoutPage() {
  return (
    <ErrorBoundary context="Control Room Shift Closeout">
      <div className="space-y-6">
        <GlassCard hover accent="charcoal">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Link
                  href="/control-room"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] text-xs transition-colors hover:text-[var(--text-heading)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Control Room
                </Link>
              </div>
              <h1 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                Shift Closeout Procedures
              </h1>
              <p className="mt-1 text-[var(--text-secondary)] text-sm">
                Dynamic opening SMR resolution, machine hours allocation, and atomic shift handover.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <ControlRoomQuickNav />
            </div>
          </div>

          <ControlRoomSubtabs activeTab="shift-closeout" />
        </GlassCard>

        <Divider variant="dotted" label="END OF SHIFT PROCEDURES" />

        <Suspense fallback={<ShiftCloseoutSkeleton />}>
          <ShiftCloseoutSection />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
