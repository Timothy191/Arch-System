import { getFleetOpeningSmrSnapshot } from '~/lib/control-room-fleet-smr';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { EndSMRForm } from './EndSMRForm';

export default async function EndSMRPage({ params }: { params: Promise<{ department: string }> }) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch machines, latest closing SMRs, and active sites via shared helper
  const [{ machines, latestSMRMap }, { data: sites }, { data: operators }] = await Promise.all([
    getFleetOpeningSmrSnapshot(supabase),
    supabase.from('sites').select('id, name').eq('active', true).order('name'),
    supabase
      .from('operators')
      .select('id, full_name, employee_code')
      .eq('active', true)
      .order('full_name'),
  ]);

  const machinesWithSmu = machines.map((m) => ({
    ...m,
    machine_type: m.machine_type ?? 'Unknown',
    active: m.active ?? true,
    site_id: m.site_id ?? null,
    latest_smu: latestSMRMap.get(m.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-2xl text-[var(--text-heading)]">End SMR</h2>
        <p className="text-[var(--text-muted)] text-sm">
          {new Date().toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <EndSMRForm
        departmentId={deptId}
        machines={machinesWithSmu}
        sites={sites || []}
        operators={operators || []}
        shiftDate={today}
      />
    </div>
  );
}
