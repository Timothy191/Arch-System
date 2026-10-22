import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import { getCurrentShift } from '@repo/utils';
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
  ] = await Promise.all([
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
    supabase.from('hourly_loads').select('*').eq('department_id', deptId).eq('load_date', today),
    supabase.from('sites').select('id, name, site_code').eq('active', true).order('name'),
    supabase.from('mine_blocks').select('id, name, code, site_id').eq('active', true).order('name'),
    supabase
      .from('excavator_activity')
      .select('id, machine_id, site_id, block_mined_id, material_type, shift_type')
      .eq('department_id', deptId)
      .eq('activity_date', today)
      .order('created_at', { ascending: false }),
    getMineralRegistry(),
  ]);

  return (
    <div className="space-y-6">
      <GlassCard className="relative overflow-hidden group">
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

      <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]"></span>
          <span>Active hour with loads</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]"></span>
          <span>No loads recorded</span>
        </div>
        <p className="ml-auto">Tip: Click any cell to edit load count. Auto-saves on change.</p>
      </div>
    </div>
  );
}
