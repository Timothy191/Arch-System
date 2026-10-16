import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { EndSMRForm } from './EndSMRForm';

export default async function EndSMRPage({ params }: { params: Promise<{ department: string }> }) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch machines, latest closing SMRs, and active sites
  const [{ data: machines }, { data: previousSMRs }, { data: sites }, { data: operators }] =
    await Promise.all([
      supabase
        .from('machines')
        .select('id, name, machine_type, active, site_id')
        .eq('active', true)
        .order('name'),
      supabase
        .from('machine_operations')
        .select('machine_id, end_smu')
        .not('end_smu', 'is', null)
        .order('shift_date', { ascending: false })
        .order('end_smu', { ascending: false }),
      supabase.from('sites').select('id, name').eq('active', true).order('name'),
      supabase
        .from('operators')
        .select('id, full_name, employee_code')
        .eq('active', true)
        .order('full_name'),
    ]);

  const latestSMRMap = new Map<string, number>();
  (previousSMRs as Array<{ machine_id: string; end_smu: number | null }> | null)?.forEach((row) => {
    if (!latestSMRMap.has(row.machine_id) && row.end_smu !== null && row.end_smu !== undefined) {
      latestSMRMap.set(row.machine_id, Number(row.end_smu));
    }
  });

  const machinesWithSmu = (machines || []).map((m) => ({
    ...m,
    latest_smu: latestSMRMap.get(m.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium text-[var(--text-heading)]">End SMR</h2>
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
