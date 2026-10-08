import { MachineTimeAllocationInput } from '@repo/contract';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { GlassCard } from '@repo/ui/components/GlassCard';
import { Divider } from '@repo/ui/Divider';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { getDepartmentContext } from '~/lib/dept-context';
import { ShiftCloseoutForm } from '../components/ShiftCloseoutForm';

export const metadata: Metadata = {
  title: 'Shift Closeout | Control Room | Arch OS',
  description: 'Atomic shift closeout and equipment SMR reconciliation.',
};

async function ShiftCloseoutSection() {
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });
  const supabase = await createServerSupabaseClient();

  const { data: machines } = await supabase.from('machines').select('id, name').eq('active', true);

  // AGENT-TRACE: Dynamic Opening SMR Resolution
  // Queries latest closing SMR per machine from machine_operations.end_smu instead of defaulting to 0.
  const { data: previousSMRs } = await supabase
    .from('machine_operations')
    .select('machine_id, end_smu')
    .eq('department_id', deptId)
    .not('end_smu', 'is', null)
    .order('shift_date', { ascending: false });

  const latestSMRMap = new Map<string, number>();
  (previousSMRs as Array<{ machine_id: string; end_smu: number | null }> | null)?.forEach((row) => {
    if (!latestSMRMap.has(row.machine_id) && row.end_smu !== null && row.end_smu !== undefined) {
      latestSMRMap.set(row.machine_id, Number(row.end_smu));
    }
  });

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

  return <ShiftCloseoutForm deptId={deptId} shiftDate={today} initialFleet={fleetData} />;
}

function ShiftCloseoutSkeleton() {
  return (
    <GlassCard variant="spotlight" className="p-6 max-w-5xl animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-64 bg-[var(--bg-secondary)] rounded-md" />
          <div className="h-4 w-96 bg-[var(--bg-secondary)]/60 rounded-md" />
        </div>
      </div>
      <div className="h-10 w-48 bg-[var(--bg-secondary)] rounded-lg mb-4" />
      <div className="h-64 w-full bg-[var(--bg-secondary)]/40 rounded-xl" />
    </GlassCard>
  );
}

export default function ShiftCloseoutPage() {
  return (
    <ErrorBoundary context="Control Room Shift Closeout">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/control-room"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Control Room
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
              Shift Closeout Procedures
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
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
