import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { GlassCard } from '@repo/ui/GlassCard';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { withCache } from '@/lib/cache-utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getProductionMachinesTargetReport } from '~/features/departments/components/production/actions';
import { ProductionMachinesTargetPanel } from '~/features/departments/components/production/ProductionMachinesTargetPanel';
import { getDepartmentContext } from '~/lib/dept-context';
import { MachineTelemetryPanelsClient } from './MachineTelemetryPanelsClient';
import {
  buildMachineTelemetryMap,
  type DepartmentMachineRow,
  groupMachinesBySite,
  type MachinePanelTelemetry,
  type RawMachineBreakdownRow,
  type RawMachineHoursRow,
  type RawMachineOpsRow,
  type RawMachineTireInspectionRow,
  type RawMachineTireRow,
  shiftIsoDay,
} from './machine-telemetry-helpers';

const DRILL_RIG_MACHINE_TYPE = 'Drill Rig';
const TWO_WEEK_WINDOW_DAYS = 13;

async function safeTelemetryRows<TRow>(
  fn: () => PromiseLike<{ data?: readonly unknown[] | null }>
): Promise<TRow[]> {
  try {
    const res = await fn();
    return (res?.data ?? []) as TRow[];
  } catch {
    return [];
  }
}

async function loadDepartmentMachines(deptSlug: string): Promise<DepartmentMachineRow[]> {
  const db = await createReadReplicaClient([]);
  let machinesQuery = db
    .from('machines')
    .select(
      'id, name, machine_type, serial_number, bin_factor, active, created_at, site:sites(name, site_code)'
    );
  if (deptSlug === 'drilling') {
    machinesQuery = machinesQuery.eq('machine_type', DRILL_RIG_MACHINE_TYPE);
  }
  const { data: machines } = await machinesQuery.order('name');
  return (machines ?? []) as DepartmentMachineRow[];
}

/**
 * Dual-tier cached department machine fleet list.
 * Route params, redirects, and context resolution remain outside `'use cache'`.
 */
async function getCachedDepartmentMachines(deptSlug: string): Promise<DepartmentMachineRow[]> {
  'use cache';

  const machinesTag = tagDepartment(deptSlug, 'machines');

  cacheLife('departments');

  cacheTag(machinesTag);
  cacheTag('table:machines');

  return withCache(() => loadDepartmentMachines(deptSlug), {
    category: CacheCategory.EQUIPMENT,
    keyParts: ['machines-list-v1', deptSlug],
    tags: [machinesTag, 'table:machines'],
  });
}

async function loadMachineActivityTelemetry(options: {
  readonly deptSlug: string;
  readonly today: string;
  readonly machines: readonly DepartmentMachineRow[];
}): Promise<Record<string, MachinePanelTelemetry>> {
  const db = await createReadReplicaClient([]);
  const windowStartDate = shiftIsoDay(options.today, -TWO_WEEK_WINDOW_DAYS);

  const [breakdowns, tires, tireInspections, machineHours, machineOperations] = await Promise.all([
    safeTelemetryRows<RawMachineBreakdownRow>(() =>
      db
        .from('breakdowns')
        .select('id, machine_id, fleet_id, machine_name, status, date_in, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500)
    ),
    safeTelemetryRows<RawMachineTireRow>(() =>
      db
        .from('tires')
        .select('id, machine_id, status, installed_at, removed_at, created_at')
        .limit(1000)
    ),
    safeTelemetryRows<RawMachineTireInspectionRow>(() =>
      db
        .from('tire_inspections')
        .select('id, tire_id, inspection_date, created_at')
        .gte('inspection_date', windowStartDate)
        .limit(1000)
    ),
    safeTelemetryRows<RawMachineHoursRow>(() =>
      db
        .from('machine_hours')
        .select('machine_id, daily_log_date, hours_worked, created_at')
        .gte('daily_log_date', windowStartDate)
        .limit(2000)
    ),
    safeTelemetryRows<RawMachineOpsRow>(() =>
      db
        .from('machine_operations')
        .select(
          'machine_id, shift_date, daily_log_date, hours_worked, start_smu, end_smu, created_at'
        )
        .gte('shift_date', windowStartDate)
        .limit(2000)
    ),
  ]);

  return buildMachineTelemetryMap({
    machines: options.machines,
    breakdowns,
    tires,
    tireInspections,
    machineHours,
    machineOperations,
    today: options.today,
  });
}

async function getCachedMachineActivityTelemetry(options: {
  readonly deptSlug: string;
  readonly today: string;
  readonly machines: readonly DepartmentMachineRow[];
}): Promise<Record<string, MachinePanelTelemetry>> {
  'use cache';

  const telemetryTag = tagDepartment(options.deptSlug, 'machines-telemetry');

  cacheLife('telemetry');

  cacheTag(telemetryTag);
  cacheTag('table:machines');
  cacheTag('table:breakdowns');
  cacheTag('table:tires');
  cacheTag('table:tire_inspections');
  cacheTag('table:machine_hours');
  cacheTag('table:machine_operations');

  return withCache(() => loadMachineActivityTelemetry(options), {
    category: CacheCategory.METRICS,
    keyParts: ['machines-telemetry-v1', options.deptSlug, options.today],
    tags: [
      telemetryTag,
      'table:machines',
      'table:breakdowns',
      'table:tires',
      'table:tire_inspections',
      'table:machine_hours',
      'table:machine_operations',
    ],
  });
}

export default async function MachinesPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  if (deptSlug === 'plant-processing') {
    redirect('/plant-processing/delays');
  }
  await connection();
  const { today } = await getDepartmentContext({
    department: deptSlug,
  });
  if (deptSlug === 'plant-inventory') {
    return <PlantInventoryWorkspaceClient mode="item-list" today={today} />;
  }
  if (deptSlug === 'production') {
    const productionMachinesReport = await getProductionMachinesTargetReport(today);
    return <ProductionMachinesTargetPanel report={productionMachinesReport} />;
  }

  const machines = await getCachedDepartmentMachines(deptSlug);
  const telemetryByMachineId =
    machines.length > 0
      ? await getCachedMachineActivityTelemetry({ deptSlug, today, machines })
      : {};

  const activeCount = machines.filter((machine) => machine.active).length;
  const siteGroups = groupMachinesBySite({ machines, telemetryByMachineId, today });

  return (
    <div className="space-y-6">
      <div
        data-testid="machine-database-header-panel"
        className="gold-steel-border gold-steel-border-slim flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-gold/60 bg-white px-5 py-3.5 shadow-card"
      >
        <h2 className="font-bold text-2xl text-[var(--text-heading)]">Machine Database</h2>
        <Link
          href="/admin"
          className="rounded-full border border-accent-gold/50 bg-white px-4 py-2 font-medium text-[var(--text-heading)] text-sm transition-colors hover:border-accent-gold hover:text-[var(--accent-blue)]"
        >
          Manage in Admin →
        </Link>
      </div>

      <div
        data-testid="machine-database-admin-banner"
        className="gold-steel-border gold-steel-border-slim flex items-center gap-2.5 rounded-2xl border border-accent-gold/55 bg-white px-5 py-3 text-[var(--text-heading)] text-sm shadow-2xs"
      >
        <svg
          className="h-4 w-4 shrink-0 text-accent-amber"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"
          />
        </svg>
        Fleet is managed by the Admin department. Contact an administrator to add, edit, or
        decommission machines.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Total Machines</p>
          <p className="mt-1 font-medium text-2xl text-[var(--text-heading)]">
            {machines?.length ?? 0}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Active</p>
          <p className="mt-1 font-medium text-2xl text-accent-green">{activeCount}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Inactive</p>
          <p className="mt-1 font-medium text-2xl text-[var(--text-muted)]">
            {(machines?.length ?? 0) - activeCount}
          </p>
        </GlassCard>
      </div>

      <MachineTelemetryPanelsClient siteGroups={siteGroups} />
    </div>
  );
}
