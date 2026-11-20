import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { withCache } from '@/lib/cache-utils';
import { logError } from '@/lib/errors/error-logger';
import { cacheLife, cacheTag } from '@/lib/server-cache';
import {
  aggregateDailyProduction,
  type BreakdownRow,
  buildBreakdownStats,
  buildFleetMix,
  buildFleetStatus,
  buildPersonnelByDepartment,
  computeAvailabilityPct,
  computeTargetAttainment,
  computeTrendStats,
  type EmployeeDepartmentRow,
  type ExecutiveData,
  type MachineRow,
  type MonthlyTargetRow,
  type ProductionSummaryRow,
  pointsSince,
  shiftIsoDate,
  summarizePeriod,
} from './executive-metrics';

const EXECUTIVE_CACHE_SECONDS = 300;
const SUMMARY_WINDOW_DAYS = 30;
const ISO_DATE_LENGTH = 10;
const ISO_MONTH_LENGTH = 7;

const EXECUTIVE_CACHE_TAGS = [
  'table:machines',
  'table:employees',
  'table:breakdowns',
  'table:production_monthly_targets',
] as const;

type ReadReplicaClient = Awaited<ReturnType<typeof createReadReplicaClient>>;

interface ReportingWindow {
  today: string;
  monthStart: string;
  windowStart: string;
  month: string;
}

function resolveReportingWindow(): ReportingWindow {
  const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
  const month = today.slice(0, ISO_MONTH_LENGTH);
  return {
    today,
    month,
    monthStart: `${month}-01`,
    windowStart: shiftIsoDate(today, -SUMMARY_WINDOW_DAYS),
  };
}

/** All dashboard sources in a single parallel round-trip against the read replica. */
function queryExecutiveSources(db: ReadReplicaClient, window: ReportingWindow) {
  return Promise.all([
    db.rpc('get_production_summary', {
      p_start_date: window.windowStart,
      p_end_date: window.today,
    }),
    db
      .from('machines')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .is('deleted_at', null),
    db.from('machines').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('machines').select('machine_type, active').is('deleted_at', null),
    db.from('employees').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('employees').select('departments(display_name)').is('deleted_at', null),
    db
      .from('breakdowns')
      .select('id, status, machine_type, duration_hours')
      .gte('date_in', window.monthStart)
      .is('deleted_at', null),
    db
      .from('production_monthly_targets')
      .select('coal_target_tonnes, waste_target_tonnes')
      .eq('target_month', window.month)
      .maybeSingle(),
  ]);
}

async function loadExecutiveData(): Promise<ExecutiveData> {
  const db = await createReadReplicaClient([]);
  const window = resolveReportingWindow();
  const [
    summary,
    activeMachines,
    totalMachines,
    machineRows,
    employees,
    staff,
    breakdowns,
    target,
  ] = await queryExecutiveSources(db, window);

  if (summary.error) {
    await logError(summary.error, { context: 'hub.executive.get_production_summary' });
  }

  const summaryRows = (summary.data ?? []) as unknown as ProductionSummaryRow[];
  const daily = aggregateDailyProduction(summaryRows);
  const mtd = summarizePeriod(pointsSince(daily, window.monthStart));
  const active = activeMachines.count ?? 0;
  const total = totalMachines.count ?? 0;

  return {
    today: window.today,
    monthStart: window.monthStart,
    summaryAvailable: !summary.error,
    daily,
    mtd,
    window: summarizePeriod(daily),
    trend: computeTrendStats(daily, window.today),
    fleet: {
      active,
      total,
      availabilityPct: computeAvailabilityPct(active, total),
      mix: buildFleetMix((machineRows.data ?? []) as MachineRow[]),
      status: buildFleetStatus(active, total),
    },
    breakdowns: buildBreakdownStats((breakdowns.data ?? []) as BreakdownRow[]),
    personnel: {
      total: employees.count ?? 0,
      byDepartment: buildPersonnelByDepartment(
        (staff.data ?? []) as unknown as EmployeeDepartmentRow[]
      ),
    },
    target: computeTargetAttainment({
      target: (target.data ?? null) as MonthlyTargetRow | null,
      coalMtd: mtd.coal,
      todayIso: window.today,
    }),
  };
}

export async function getExecutiveData(): Promise<ExecutiveData> {
  'use cache';

  cacheLife({
    stale: EXECUTIVE_CACHE_SECONDS,
    revalidate: EXECUTIVE_CACHE_SECONDS,
    expire: EXECUTIVE_CACHE_SECONDS,
  });
  for (const tag of EXECUTIVE_CACHE_TAGS) cacheTag(tag);

  return withCache(loadExecutiveData, {
    category: CacheCategory.METRICS,
    keyParts: ['hub', 'executive-v3'],
    tags: [...EXECUTIVE_CACHE_TAGS],
  });
}
