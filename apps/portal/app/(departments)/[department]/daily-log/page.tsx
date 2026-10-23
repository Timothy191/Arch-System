import { GlassCard } from '@repo/ui/GlassCard';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getDepartmentContext } from '~/lib/dept-context';
import { DailyLogForm } from './DailyLogForm';

export default async function DailyLogPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  if (department === 'plant-inventory') {
    return <PlantInventoryWorkspaceClient mode="inventory-list" today={today} />;
  }
  const { data: machines } = await supabase
    .from('machines')
    .select('id, name, machine_type')
    .eq('active', true)
    .order('name');

  const { data: todayLogs } = await supabase
    .from('daily_logs')
    .select('id, shift, notes')
    .eq('department_id', deptId)
    .eq('log_date', today);

  const existingShifts = (todayLogs || []).map((l) => l.shift as 'day' | 'night');
  const allShiftsLogged = existingShifts.length >= 2;

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-2xl text-[var(--text-heading)]">Daily Log</h2>

      {allShiftsLogged ? (
        <GlassCard className="border-accent-green/20">
          <p className="font-medium text-accent-green text-sm">
            &#10003; All shifts logged for today
          </p>
          <p className="mt-1 text-[var(--text-secondary)] text-sm">
            <a
              href={`/${department}/history`}
              className="text-[var(--accent-cyan)] hover:underline"
            >
              View History
            </a>
          </p>
        </GlassCard>
      ) : (
        <>
          {existingShifts.length > 0 && (
            <GlassCard className="border-accent-blue/20">
              <p className="font-medium text-accent-blue text-sm">
                {existingShifts.length} shift
                {existingShifts.length > 1 ? 's' : ''} already logged: {existingShifts.join(', ')}
              </p>
            </GlassCard>
          )}
          <DailyLogForm
            departmentId={deptId}
            departmentSlug={department}
            machines={machines || []}
          />
        </>
      )}
    </div>
  );
}
