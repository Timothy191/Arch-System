import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { BorderBox } from '@repo/ui/BorderBox';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, ArrowRight, CircleDot, ClipboardList, Cpu, Wrench } from 'lucide-react';
import Link from 'next/link';
import { withCache } from '@/lib/cache-utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { getDepartmentContext } from '~/lib/dept-context';
import { EngineeringHubDashboardClient } from './EngineeringHubDashboardClient';
import {
  buildEngineeringHubMetrics,
  type EngineeringHubMetrics,
  type RawBreakdownMetricRow,
  type RawMachineHoursMetricRow,
  type RawMachineMetricRow,
  type RawMachineOperationMetricRow,
  type RawTireInspectionMetricRow,
  type RawTireMetricRow,
} from './engineering-hub-metrics';

const MS_PER_DAY = 86_400_000;
const HISTORY_WINDOW_DAYS = 30;
const QUICK_LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:border-[var(--border-emphasis)]';

async function safeQueryCount(fn: () => PromiseLike<{ count?: number | null }>): Promise<number> {
  try {
    const res = await fn();
    return res?.count ?? 0;
  } catch {
    return 0;
  }
}

async function safeQueryRows<TRow>(
  fn: () => PromiseLike<{ data?: readonly unknown[] | null }>
): Promise<TRow[]> {
  try {
    const res = await fn();
    return (res?.data ?? []) as TRow[];
  } catch {
    return [];
  }
}

async function loadEngineeringHubMetrics(deptId: string): Promise<EngineeringHubMetrics> {
  const db = await createReadReplicaClient([]);
  const nowMs = Date.now();
  const resolvedSinceIso = new Date(nowMs - MS_PER_DAY).toISOString();
  const thirtyDaysAgoIso = new Date(nowMs - HISTORY_WINDOW_DAYS * MS_PER_DAY).toISOString();
  const referenceDateIso = new Date(nowMs).toISOString().slice(0, 10);

  const [
    activeBreakdownsCount,
    resolvedTodayCount,
    recentActiveRows,
    breakdownHistoryRows,
    machineRows,
    tireRows,
    tireInspectionRows,
    machineHoursRows,
    machineOperationRows,
  ] = await Promise.all([
    safeQueryCount(() =>
      db
        .from('breakdowns')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', deptId)
        .eq('status', 'active')
        .is('deleted_at', null)
    ),
    safeQueryCount(() =>
      db
        .from('breakdowns')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', deptId)
        .eq('status', 'completed')
        .gte('updated_at', resolvedSinceIso)
    ),
    safeQueryRows<RawBreakdownMetricRow>(() =>
      db
        .from('breakdowns')
        .select('id, machine_name, reason, status, created_at')
        .eq('department_id', deptId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeQueryRows<RawBreakdownMetricRow>(() =>
      db
        .from('breakdowns')
        .select(
          'id, fleet_id, machine_id, machine_name, machine_type, reason, status, date_in, time_in, date_out, time_out, duration_hours, duration_minutes, delay_hours, shift_type, site_code, created_at, updated_at'
        )
        .eq('department_id', deptId)
        .is('deleted_at', null)
        .gte('created_at', thirtyDaysAgoIso)
        .order('created_at', { ascending: false })
        .limit(500)
    ),
    safeQueryRows<RawMachineMetricRow>(() =>
      db
        .from('machines')
        .select('id, name, machine_type, serial_number, active, site_id')
        .is('deleted_at', null)
        .order('name')
    ),
    safeQueryRows<RawTireMetricRow>(() =>
      db
        .from('tires')
        .select(
          'id, serial_number, brand, size, position, status, installed_at, installed_hours, removed_at, machine_id'
        )
        .order('created_at', { ascending: false })
        .limit(500)
    ),
    safeQueryRows<RawTireInspectionMetricRow>(() =>
      db
        .from('tire_inspections')
        .select(
          'id, tire_id, inspection_date, tread_depth_mm, pressure_psi, condition_status, notes'
        )
        .order('inspection_date', { ascending: false })
        .limit(500)
    ),
    safeQueryRows<RawMachineHoursMetricRow>(() =>
      db
        .from('machine_hours')
        .select('id, machine_id, daily_log_date, hours_worked, created_at')
        .gte('created_at', thirtyDaysAgoIso)
        .limit(1000)
    ),
    safeQueryRows<RawMachineOperationMetricRow>(() =>
      db
        .from('machine_operations')
        .select(
          'id, machine_id, shift_date, daily_log_date, hours_worked, start_smu, end_smu, created_at'
        )
        .gte('created_at', thirtyDaysAgoIso)
        .limit(1000)
    ),
  ]);

  return buildEngineeringHubMetrics({
    activeBreakdownsCount,
    resolvedTodayCount,
    recentActiveRows,
    breakdownHistoryRows,
    machineRows,
    tireRows,
    tireInspectionRows,
    machineHoursRows,
    machineOperationRows,
    referenceDateIso,
  });
}

/**
 * Next.js 16 Cache Components with 'use cache' directive.
 */
async function getEngineeringHubData(deptId: string): Promise<EngineeringHubMetrics> {
  'use cache';

  const hubTag = tagDepartment('engineering', 'hub-metrics');

  cacheLife('telemetry');

  cacheTag(hubTag);
  cacheTag('table:breakdowns');
  cacheTag('table:machines');
  cacheTag('table:tires');
  cacheTag('table:tire_inspections');

  return withCache(() => loadEngineeringHubMetrics(deptId), {
    category: CacheCategory.METRICS,
    keyParts: ['engineering', 'hub-v3', deptId],
    tags: [hubTag, 'table:breakdowns', 'table:machines', 'table:tires', 'table:tire_inspections'],
  });
}

export default async function EngineeringDashboardPage() {
  const { deptId } = await getDepartmentContext({
    department: 'engineering',
  });

  const metrics = await getEngineeringHubData(deptId);
  const { activeBreakdowns, resolvedToday, recentBreakdowns } = metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-2xl text-[var(--text-heading)]">Engineering Hub</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Breakdowns, tire management, fleet availability &amp; maintenance reporting
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/engineering/daily-log" className={QUICK_LINK_CLASS}>
            <ClipboardList className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
            24h Daily Log
          </Link>
          <Link href="/engineering/machines" className={QUICK_LINK_CLASS}>
            <Cpu className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" />
            Machine Panels
          </Link>
          <p className="ml-1 text-[var(--text-muted)] text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      <Divider variant="dotted" label="FLEET HEALTH & TELEMETRY" />

      {/* Primary Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Breakdowns Card */}
        <Link href="/engineering/breakdowns" className="group h-full">
          <BorderBox variant="thick-transparent" className="h-full border-0 p-0">
            <GlassCard className="h-full cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-accent-red/10 p-2.5 text-accent-red">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-heading)] text-lg">Breakdowns</h3>
                    <p className="text-[var(--text-muted)] text-sm">
                      Active faults &amp; maintenance issues
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent-blue)]" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-accent-red/10 bg-accent-red/5 p-3">
                  <p className="font-bold text-2xl text-accent-red">{activeBreakdowns}</p>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">Active Breakdowns</p>
                </div>
                <div className="rounded-lg border border-accent-green/10 bg-accent-green/5 p-3">
                  <p className="font-bold text-2xl text-accent-green">{resolvedToday}</p>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">Resolved Today</p>
                </div>
              </div>

              {recentBreakdowns.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                    Recent Active
                  </p>
                  {recentBreakdowns.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between border-[var(--border-subtle)] border-b py-2 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-[var(--text-body)] text-sm">
                          {b.machine_name || 'Unknown Machine'}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium text-xs ${
                          b.priority === 'critical'
                            ? 'bg-accent-red/10 text-accent-red'
                            : b.priority === 'high'
                              ? 'bg-arch-accent-blue/10 text-arch-accent-blue'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        }`}
                      >
                        {b.priority || 'normal'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </BorderBox>
        </Link>

        {/* Tire Management & Daily Log Card */}
        <Link href="/engineering/tire-management" className="group h-full">
          <BorderBox variant="thick-transparent" className="h-full border-0 p-0">
            <GlassCard className="h-full cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[var(--accent-blue)]/10 p-2.5 text-[var(--accent-blue)]">
                    <CircleDot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-heading)] text-lg">
                      Tire Management &amp; Fleet
                    </h3>
                    <p className="text-[var(--text-muted)] text-sm">
                      Tread telemetry, pressure alerts &amp; spare stock
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent-blue)]" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--accent-blue)]/10 bg-[var(--accent-blue)]/5 p-3">
                  <p className="font-bold text-2xl text-[var(--accent-blue)]">
                    {metrics.installedTires}
                  </p>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">Installed Tires</p>
                </div>
                <div className="rounded-lg border border-accent-amber/10 bg-accent-amber/5 p-3">
                  <p className="font-bold text-2xl text-accent-amber">{metrics.criticalTires}</p>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">Critical Tire Alerts</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-t pt-3 text-xs">
                <span className="text-[var(--text-muted)]">
                  Fleet Active: {metrics.activeMachines} / {metrics.totalMachines} units
                </span>
                <span className="font-medium text-[var(--accent-blue)]">Open Tire Telemetry →</span>
              </div>
            </GlassCard>
          </BorderBox>
        </Link>
      </div>

      {/* Interactive Recharts & Detailed Reporting Tables */}
      <EngineeringHubDashboardClient metrics={metrics} />
    </div>
  );
}
