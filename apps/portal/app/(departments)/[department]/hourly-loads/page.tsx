import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { getCurrentShift } from '@repo/utils';
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

  // Fetch dump trucks (ADT, RDT, Dump Truck) with bin_factor (centralised fleet)
  const { data: machines } = await supabase
    .from('machines')
    .select('id, name, machine_type, bin_factor, site_id')
    .in('machine_type', [...HAUL_TRUCK_MACHINE_TYPES])
    .eq('active', true)
    .order('name');

  // Fetch active excavators with their site associations
  const { data: excavators } = await supabase
    .from('machines')
    .select('id, name, machine_type, site_id, sites(name)')
    .eq('machine_type', 'Excavator')
    .eq('active', true)
    .order('name');

  // Fetch today's hourly loads
  const { data: hourlyLoads } = await supabase
    .from('hourly_loads')
    .select('*')
    .eq('department_id', deptId)
    .eq('load_date', today);

  // Fetch active sites
  const { data: sites } = await supabase
    .from('sites')
    .select('id, name, site_code')
    .eq('active', true)
    .order('name');

  // Fetch active mine blocks / areas
  const { data: mineBlocks } = await supabase
    .from('mine_blocks')
    .select('id, name, code, site_id')
    .eq('active', true)
    .order('name');

  // Fetch today's excavator activity records (for block_mined_id and material_type)
  const { data: excavatorActivities } = await supabase
    .from('excavator_activity')
    .select('id, machine_id, site_id, block_mined_id, material_type, shift_type')
    .eq('department_id', deptId)
    .eq('activity_date', today)
    .order('created_at', { ascending: false });

  // Calculate totals
  const loadsByMachine = new Map();
  let grandTotal = 0;

  hourlyLoads?.forEach((load) => {
    loadsByMachine.set(load.machine_id, load.total_loads);
    grandTotal += load.total_loads || 0;
  });

  return (
    <div className="space-y-6">
      <GlassCard className="relative overflow-hidden group">
        <PageHeader title="Hourly Loads Sheet" />
      </GlassCard>

      <KPIGrid cols={3}>
        <KPICard label="Total Loads Today" value={grandTotal.toLocaleString()} color="green" />
        <KPICard label="Machines Active" value={loadsByMachine.size} color="green" />
        <KPICard
          label="Avg Loads per Machine"
          value={loadsByMachine.size > 0 ? Math.round(grandTotal / loadsByMachine.size) : 0}
        />
      </KPIGrid>

      <HourlyLoadsGrid
        departmentId={deptId}
        machines={machines || []}
        excavators={excavators || []}
        hourlyLoads={hourlyLoads || []}
        sites={sites || []}
        mineBlocks={mineBlocks || []}
        excavatorActivities={excavatorActivities || []}
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
