import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import { getCurrentShift } from '@repo/utils';
import { withAsyncSpan } from '@/lib/observability/tracing';
import { getMineralRegistry } from '~/features/admin/actions/minerals';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { HourlyLoadsGrid } from './HourlyLoadsGrid';
import { HAUL_TRUCK_MACHINE_TYPES } from './loads-utils';

export default async function HourlyLoadsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  requireDepartment(department, 'control-room');

  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  // Parallel fetch of fleet dump trucks, excavators, today's loads, sites, mine blocks, excavator activities, and mineral registry
  const [
    { data: machines },
    { data: excavators },
    { data: hourlyLoads },
    { data: sites },
    { data: mineBlocks },
    { data: excavatorActivities },
    mineralRegistry,
  ] = await withAsyncSpan(
    'hourly_loads_load',
    {
      department_id: deptId,
      date: today,
    },
    async (span) => {
      const results = await Promise.all([
        supabase
          .from('machines')
          .select('id, name, machine_type, bin_factor, site_id')
          .in('machine_type', [...HAUL_TRUCK_MACHINE_TYPES])
          .eq('active', true)
          .order('name'),
        supabase
          .from('machines')
          .select('id, name, machine_type, site_id, sites(name)')
          .eq('machine_type', 'Excavator')
          .eq('active', true)
          .order('name'),
        supabase
          .from('hourly_loads')
          .select('*')
          .eq('department_id', deptId)
          .eq('load_date', today),
        supabase.from('sites').select('id, name, site_code').eq('active', true).order('name'),
        supabase
          .from('mine_blocks')
          .select('id, name, code, site_id')
          .eq('active', true)
          .order('name'),
        supabase
          .from('excavator_activity')
          .select('id, machine_id, site_id, block_mined_id, material_type, shift_type')
          .eq('department_id', deptId)
          .eq('activity_date', today)
          .order('created_at', { ascending: false }),
        getMineralRegistry(),
      ]);
      span?.setAttributes?.({
        department_id: deptId,
        date: today,
        machine_count: results[0].data?.length ?? 0,
        excavator_count: results[1].data?.length ?? 0,
        hourly_load_count: results[2].data?.length ?? 0,
      });
      return results;
    }
  );

  return (
    <div className="space-y-6">
      <GlassCard className="group relative overflow-hidden">
        <PageHeader title="Hourly Loads Sheet" showDate={false} />
      </GlassCard>

      <HourlyLoadsGrid
        departmentId={deptId}
        machines={machines || []}
        excavators={excavators || []}
        hourlyLoads={hourlyLoads || []}
        sites={sites || []}
        mineBlocks={mineBlocks || []}
        excavatorActivities={excavatorActivities || []}
        mineralRegistry={mineralRegistry}
        today={today}
        initialShift={getCurrentShift()}
      />

      <div className="flex items-center gap-6 text-[var(--text-muted)] text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-[var(--accent-blue)] bg-[var(--accent-blue)]/20"></span>
          <span>Active hour with loads</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"></span>
          <span>No loads recorded</span>
        </div>
        <p className="ml-auto">Tip: Click any cell to edit load count. Auto-saves on change.</p>
      </div>
    </div>
  );
}
