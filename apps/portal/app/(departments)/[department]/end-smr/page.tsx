import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { EndSMRForm } from './EndSMRForm';

export default async function EndSMRPage({ params }: { params: Promise<{ department: string }> }) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch machines and active sites
  const [{ data: machines }, { data: sites }, { data: operators }] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, machine_type, active')
      .eq('active', true)
      .order('name'),
    supabase.from('sites').select('id, name').eq('active', true).order('name'),
    supabase
      .from('operators')
      .select('id, full_name, employee_code')
      .eq('active', true)
      .order('full_name'),
  ]);

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
        machines={machines || []}
        sites={sites || []}
        operators={operators || []}
        shiftDate={today}
      />
    </div>
  );
}
