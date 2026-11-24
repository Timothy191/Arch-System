import { connection } from 'next/server';
import { searchBreakdownDiagnosticsAction } from '@/app/actions/vector-search';
import type { Breakdown, BreakdownMetrics, Machine } from '@/features/departments';
import { BreakdownsDashboard } from '@/features/departments';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';

const BREAKDOWNS_LIMIT = 200;
const RECENT_OPERATIONS_LIMIT = 500;
const MS_PER_HOUR = 3_600_000;

interface RawSiteRef {
  readonly name?: string | null;
  readonly site_code?: string | null;
}

interface RawMachineRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
  readonly manufacturer?: string | null;
  readonly starting_smr?: number | string | null;
  readonly image_url?: string | null;
  readonly active: boolean;
  readonly site?: RawSiteRef | readonly RawSiteRef[] | null;
}

interface RawMachineOpSmuRow {
  readonly machine_id?: string | null;
  readonly end_smu?: number | string | null;
  readonly start_smu?: number | string | null;
}

function parseFiniteNumber(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function BreakdownsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  await connection();
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
      .limit(BREAKDOWNS_LIMIT),
    supabase
      .from('machines')
      .select(
        'id, name, machine_type, serial_number, manufacturer, starting_smr, image_url, active, site:sites(name, site_code)'
      )
      .eq('active', true)
      .order('name'),
  ]);

  const rawMachines = (Array.isArray(machines) ? machines : []) as unknown as RawMachineRow[];
  const latestSmuByMachineId = new Map<string, number>();

  if (rawMachines.length > 0) {
    try {
      const machineIds = rawMachines.map((machine) => machine.id);
      const { data: recentOps } = await supabase
        .from('machine_operations')
        .select('machine_id, end_smu, start_smu')
        .in('machine_id', machineIds)
        .order('shift_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(RECENT_OPERATIONS_LIMIT);

      for (const op of (recentOps ?? []) as RawMachineOpSmuRow[]) {
        if (!op.machine_id || latestSmuByMachineId.has(op.machine_id)) {
          continue;
        }
        const resolvedSmu = parseFiniteNumber(op.end_smu) ?? parseFiniteNumber(op.start_smu);
        if (resolvedSmu !== null && resolvedSmu > 0) {
          latestSmuByMachineId.set(op.machine_id, resolvedSmu);
        }
      }
    } catch {
      // Non-fatal fallback: starting_smr on machine record remains available
    }
  }

  const normalizedMachines: Machine[] = rawMachines.map((rawMachine) => {
    const siteRecord = Array.isArray(rawMachine.site) ? rawMachine.site[0] : rawMachine.site;
    const startingSmr = parseFiniteNumber(rawMachine.starting_smr);
    return {
      id: rawMachine.id,
      name: rawMachine.name,
      machine_type: rawMachine.machine_type,
      serial_number: rawMachine.serial_number ?? null,
      manufacturer: rawMachine.manufacturer ?? null,
      starting_smr: startingSmr,
      current_smu: latestSmuByMachineId.get(rawMachine.id) ?? startingSmr,
      image_url: rawMachine.image_url ?? null,
      site_name: siteRecord?.name ?? null,
      site_code: siteRecord?.site_code ?? null,
      active: rawMachine.active,
    };
  });

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
        const diffHours = (end.getTime() - start.getTime()) / MS_PER_HOUR;
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
      machines={normalizedMachines}
      onSearchDiagnostics={searchBreakdownDiagnosticsAction}
    />
  );
}
