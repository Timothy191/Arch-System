import { MachineTimeAllocationInput } from '@repo/contract';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { GlassCard } from '@repo/ui/components/GlassCard';
import { Divider } from '@repo/ui/Divider';
import { Suspense } from 'react';
import { getDepartmentContext } from '~/lib/dept-context';
import { ShiftCloseoutForm } from './components/ShiftCloseoutForm';

async function ShiftCloseoutSection() {
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });
  const supabase = await createServerSupabaseClient();

  const { data: machines } = await supabase.from('machines').select('id, name').eq('active', true);

  const fleetData: MachineTimeAllocationInput[] =
    machines && machines.length > 0
      ? machines.map((m) => ({
          machine_id: m.id,
          machine_name: m.name,
          opening_smr: 0,
          closing_smr: 0,
          breakdown_hours: 0,
          delay_hours: 0,
        }))
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

export default function ControlRoomDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
            Control Room Operations
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Live SCADA monitoring and atomic shift closeout.
          </p>
        </div>
      </div>

      <Divider variant="dotted" label="END OF SHIFT PROCEDURES" />

      <Suspense fallback={<ShiftCloseoutSkeleton />}>
        <ShiftCloseoutSection />
      </Suspense>
    </div>
  );
}
