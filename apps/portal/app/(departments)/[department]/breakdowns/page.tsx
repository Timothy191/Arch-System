import { searchBreakdownDiagnosticsAction } from '@/app/actions/vector-search';
import type { Breakdown, BreakdownMetrics, Machine } from '@/features/departments';
import { BreakdownsDashboard } from '@/features/departments';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';

export default async function BreakdownsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'engineering');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch all non-deleted breakdowns and active machines in parallel
  const [{ data: breakdowns }, { data: machines }] = await Promise.all([
    supabase
      .from('breakdowns')
      .select('*, machine_name')
      .eq('department_id', deptId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, active')
      .eq('active', true)
      .order('name'),
  ]);

  // Compute metrics
  // Performance Optimization: Calculate total, active, completedToday, and average repair hours in a single pass O(N) loop
  // instead of multiple array .filter() passes over allBreakdowns, avoiding intermediate array allocations and reducing complexity from 3N to N.
  const allBreakdowns = (breakdowns ?? []) as Breakdown[];
  let active = 0;
  let completedToday = 0;
  let totalRepairHours = 0;
  let completedCount = 0;

  for (const b of allBreakdowns) {
    if (b.status === 'active') {
      active++;
    } else if (b.status === 'completed') {
      if (b.date_out === today) {
        completedToday++;
      }
      if (b.date_out && b.time_out && b.date_in && b.time_in) {
        const start = new Date(`${b.date_in}T${b.time_in}`);
        const end = new Date(`${b.date_out}T${b.time_out}`);
        const diffHours = (end.getTime() - start.getTime()) / 3600000;
        if (diffHours > 0) {
          totalRepairHours += diffHours;
          completedCount++;
        }
      }
    }
  }

  const metrics: BreakdownMetrics = {
    total: allBreakdowns.length,
    active,
    completedToday,
    avgRepairHours: completedCount > 0 ? totalRepairHours / completedCount : 0,
  };

  return (
    <BreakdownsDashboard
      departmentId={deptId}
      breakdowns={allBreakdowns}
      metrics={metrics}
      machines={(machines ?? []) as Machine[]}
      onSearchDiagnostics={searchBreakdownDiagnosticsAction}
    />
  );
}
