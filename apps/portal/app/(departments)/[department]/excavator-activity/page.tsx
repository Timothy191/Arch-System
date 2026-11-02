import { getCurrentShift } from '@repo/utils';
import { getMineralRegistry } from '~/features/admin/actions/minerals';
import { getOperationalTargets } from '~/features/admin/actions/targets';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { HAUL_TRUCK_MACHINE_TYPES, parseExcavatorMaterial } from '../hourly-loads/loads-utils';
import { ExcavatorActivityForm } from './ExcavatorActivityForm';
import { ExcavatorActivityList } from './ExcavatorActivityList';
import { ExcavatorActivityTelemetryOverview } from './ExcavatorActivityTelemetryOverview';

export default async function ExcavatorActivityPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');

  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Parallel fetch of independent reference data, today's activity, mineral registry, and targets
  const [
    { data: excavators },
    { data: dumpers },
    { data: operators },
    { data: sites },
    { data: mineBlocks },
    { data: todayActivity },
    mineralRegistry,
    operationalTargets,
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, active, site_id')
      .eq('machine_type', 'Excavator')
      .eq('active', true)
      .order('name'),
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, active, bin_factor, site_id')
      .in('machine_type', [...HAUL_TRUCK_MACHINE_TYPES])
      .eq('active', true)
      .order('name'),
    supabase
      .from('operators')
      .select('id, full_name, employee_code')
      .eq('active', true)
      .order('full_name'),
    supabase.from('sites').select('id, name, site_code, active').eq('active', true).order('name'),
    supabase
      .from('mine_blocks')
      .select('id, name, code, site_id, active')
      .eq('active', true)
      .order('name'),
    supabase
      .from('excavator_activity')
      .select(
        '*, machine:machines(name), operator:operators(full_name), site:sites(name), block_mined:mine_blocks(name, code)'
      )
      .eq('department_id', deptId)
      .eq('activity_date', today)
      .order('created_at', { ascending: false }),
    getMineralRegistry(),
    getOperationalTargets(),
  ]);

  // Fetch today's dumper assignments via excavator_activity IDs
  const activityIds = todayActivity?.map((a) => a.id) || [];
  let todayAssignments: Array<{
    id: string;
    excavator_activity_id: string;
    dumper_machine_id: string;
    material_type: string;
    total_loads: number;
    total_bcm: number | null;
    notes: string | null;
    dumper: {
      name: string;
      bin_factor: number | null;
      machine_type: string;
    } | null;
  }> = [];

  // Fetch assignments and hourly loads in parallel (loads don't depend on assignments)
  const [{ data: assignments }, { data: todayLoads }] = await Promise.all([
    activityIds.length > 0
      ? supabase
          .from('excavator_dumper_assignments')
          .select('*, dumper:machines!dumper_machine_id(name, bin_factor, machine_type)')
          .in('excavator_activity_id', activityIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('hourly_loads')
      .select(
        'id, machine_id, excavator_id, material_type, shift_type, start_hour, end_hour, is_locked, total_loads'
      )
      .eq('department_id', deptId)
      .eq('load_date', today),
  ]);
  todayAssignments = assignments || [];

  // Compute KPIs and Global Combined Tally
  const totalLoads = todayAssignments?.reduce((sum, a) => sum + (a.total_loads || 0), 0) || 0;
  const totalBcm = todayAssignments?.reduce((sum, a) => sum + (a.total_bcm || 0), 0) || 0;
  const activeExcavators = new Set(todayActivity?.map((a) => a.machine_id)).size;
  const fleetExcavatorsCount = excavators?.length || 0;

  let wasteLoads = 0;
  let coalLoads = 0;
  for (const a of todayAssignments) {
    const loadsNum = a.total_loads || 0;
    if ((a.material_type || '').toLowerCase().includes('coal')) {
      coalLoads += loadsNum;
    } else {
      wasteLoads += loadsNum;
    }
  }

  let plantUnitsCount = 0;
  let otherUnitsCount = 0;
  const seenMachineForMode = new Set<string>();
  for (const act of todayActivity || []) {
    if (seenMachineForMode.has(act.machine_id)) continue;
    seenMachineForMode.add(act.machine_id);
    const cat = parseExcavatorMaterial(act.material_type, mineralRegistry).category;
    if (cat === 'Plant') plantUnitsCount += 1;
    if (cat === 'Other') otherUnitsCount += 1;
  }

  return (
    <div className="space-y-6">
      <ExcavatorActivityTelemetryOverview
        totalBcm={totalBcm}
        totalLoads={totalLoads}
        activeExcavators={activeExcavators}
        fleetExcavatorsCount={fleetExcavatorsCount}
        wasteLoads={wasteLoads}
        coalLoads={coalLoads}
        plantUnitsCount={plantUnitsCount}
        otherUnitsCount={otherUnitsCount}
        targetBcm={operationalTargets.shift.volumeBcmTarget}
        targetLoads={operationalTargets.shift.loadsTarget}
      />

      <ExcavatorActivityForm
        departmentId={deptId}
        excavators={excavators || []}
        dumpers={dumpers || []}
        operators={operators || []}
        sites={sites || []}
        mineBlocks={mineBlocks || []}
        todayDumperLoads={todayLoads || []}
        todayActivities={todayActivity || []}
        todayAssignments={todayAssignments || []}
        mineralRegistry={mineralRegistry}
        today={today}
        initialShift={getCurrentShift()}
      />

      {todayActivity && todayActivity.length > 0 && (
        <ExcavatorActivityList
          todayActivity={todayActivity}
          todayAssignments={todayAssignments || []}
        />
      )}
    </div>
  );
}
