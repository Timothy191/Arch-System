import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { EndSMRForm } from './EndSMRForm';

export default async function EndSMRPage({ params }: { params: Promise<{ department: string }> }) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch machines, latest closing SMRs, and active sites
  const [
    { data: machines },
    { data: previousSMRs },
    { data: baselineSmrReadings },
    { data: sites },
    { data: operators },
  ] = await Promise.all([
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
      .order('end_smu', { ascending: false })
      .limit(500),
    supabase
      .from('smr_readings')
      .select('machine_id, reading_hours')
      .order('reading_date', { ascending: false })
      .limit(200),
    supabase.from('sites').select('id, name').eq('active', true).order('name'),
    supabase
      .from('operators')
      .select('id, full_name, employee_code')
      .eq('active', true)
      .order('full_name'),
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
  (
    baselineSmrReadings as Array<{ machine_id: string; reading_hours: number | null }> | null
  )?.forEach((row) => {
    if (row.reading_hours !== null && row.reading_hours !== undefined) {
      const currentMax = latestSMRMap.get(row.machine_id) ?? 0;
      const candidate = Number(row.reading_hours);
      if (candidate > currentMax) {
        latestSMRMap.set(row.machine_id, candidate);
      }
    }
  });

  const machinesWithSmu = (machines || []).map((m) => ({
    ...m,
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
