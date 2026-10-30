import { MachineTimeAllocationInput } from '@repo/contract';
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
import { getDepartmentContext } from '~/lib/dept-context';
import { ShiftCloseoutForm } from '../components/ShiftCloseoutForm';
import { ShiftReportSummary, SupervisorApprovalPanel } from '../components/SupervisorApprovalPanel';

export const metadata: Metadata = {
  title: 'Shift Closeout | Control Room | Arch OS',
  description: 'Atomic shift closeout and equipment SMR reconciliation.',
};

async function ShiftCloseoutSection() {
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  const [
    { data: machines },
    { data: previousSMRs },
    { data: baselineSmrReadings },
    { data: recentReportsData },
  ] = await Promise.all([
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
      .select('meter_id, reading')
      .order('reading_at', { ascending: false })
      .limit(200),
    supabase
      .from('control_room_shift_reports')
      .select(
        'id, report_date, shift_type, operator_name, status, submitter_id, created_by, approver_id, approval_note, approved_at, created_at'
      )
      .eq('department_id', deptId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const latestSMRMap = new Map<string, number>();
  (previousSMRs as Array<{ machine_id: string; end_smu: number | null }> | null)?.forEach((row) => {
    if (row.end_smu !== null && row.end_smu !== undefined) {
      const currentMax = latestSMRMap.get(row.machine_id) ?? 0;
      const candidate = Number(row.end_smu);
      if (candidate > currentMax) {
        latestSMRMap.set(row.machine_id, candidate);
      }
    }
  });
  (baselineSmrReadings as Array<{ meter_id: string; reading: number | null }> | null)?.forEach(
    (row) => {
      if (row.reading !== null && row.reading !== undefined && row.meter_id) {
        const currentMax = latestSMRMap.get(row.meter_id) ?? 0;
        const candidate = Number(row.reading);
        if (candidate > currentMax) {
          latestSMRMap.set(row.meter_id, candidate);
        }
      }
    }
  );

  const fleetData: MachineTimeAllocationInput[] =
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
        <div className="flex items-center justify-between">
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
        </div>

        <Divider variant="dotted" label="END OF SHIFT PROCEDURES" />

        <Suspense fallback={<ShiftCloseoutSkeleton />}>
          <ShiftCloseoutSection />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
