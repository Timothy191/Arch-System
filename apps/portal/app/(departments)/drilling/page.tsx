import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, ArrowRight, Clock, Drill, FileText, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { withCache } from '@/lib/cache-utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { getDepartmentContext } from '~/lib/dept-context';

export const metadata: Metadata = {
  title: 'Drilling Dashboard — Arch Systems',
  description:
    'Real-time drilling operations dashboard with machine metrics, shift logging, and productivity tracking',
};

interface DrillingDashboardMetrics {
  loggedShifts: number;
  machineCount: number;
  totalHours: number;
  totalMeters: number;
  totalHoles: number;
  activeOps: number;
  delayCount: number;
  delayMinutes: number;
}

async function loadDrillingDashboardMetrics(
  deptId: string,
  today: string
): Promise<DrillingDashboardMetrics> {
  const db = await createReadReplicaClient([]);

  const [{ data: drills }, { data: todayOperations }, { data: todayDelays }] = await Promise.all([
    db.from('machines').select('id, name').eq('machine_type', 'Drill Rig').eq('active', true),
    db
      .from('drill_operations')
      .select('machine_id, shift_type, total_hours, holes, meters_drilled, status')
      .eq('department_id', deptId)
      .eq('operation_date', today),
    // operational_delays table is deprecated; delays are tracked via machine_operations delay_entries
    Promise.resolve({ data: [] as Array<{ delay_minutes: number; status: string }> }),
  ]);

  const drillIds = (drills ?? []).map((d) => d.id);

  const { data: controlRoomOps } =
    drillIds.length > 0
      ? await db
          .from('machine_operations')
          .select(
            'machine_id, shift_type, start_smu, end_smu, hours_worked, meters_drilled, holes_drilled, delay_entries:delay_entries(duration_hours, deleted_at)'
          )
          .in('machine_id', drillIds)
          .eq('shift_date', today)
      : { data: [] };

  const opsMap = new Map<
    string,
    { hours: number; meters: number; holes: number; status: string; delayMins: number }
  >();

  for (const op of todayOperations ?? []) {
    const shift = op.shift_type || 'day';
    const key = `${op.machine_id}:${shift}`;
    opsMap.set(key, {
      hours: Number(op.total_hours) || 0,
      meters: Number(op.meters_drilled) || 0,
      holes: Number(op.holes) || 0,
      status: op.status || 'active',
      delayMins: 0,
    });
  }

  interface ControlRoomDrillOp {
    machine_id: string;
    shift_type?: string | null;
    start_smu?: number | null;
    end_smu?: number | null;
    hours_worked?: number | null;
    meters_drilled?: number | null;
    holes_drilled?: number | null;
    delay_entries?: Array<{ duration_hours?: number | null; deleted_at?: string | null }> | null;
  }

  for (const cr of (controlRoomOps ?? []) as unknown as ControlRoomDrillOp[]) {
    const shift = cr.shift_type || 'day';
    const key = `${cr.machine_id}:${shift}`;
    const existing = opsMap.get(key);
    const startSmu = cr.start_smu != null ? Number(cr.start_smu) : null;
    const endSmu = cr.end_smu != null ? Number(cr.end_smu) : null;
    const calcHours =
      cr.hours_worked != null
        ? Number(cr.hours_worked)
        : startSmu != null && endSmu != null && endSmu >= startSmu
          ? endSmu - startSmu
          : (existing?.hours ?? 0);

    const delays = Array.isArray(cr.delay_entries)
      ? cr.delay_entries.filter((d) => !d.deleted_at)
      : [];
    const crDelayMins = delays.reduce(
      (sum: number, d) => sum + Number(d.duration_hours || 0) * 60,
      0
    );

    opsMap.set(key, {
      hours: calcHours,
      meters: cr.meters_drilled != null ? Number(cr.meters_drilled) : (existing?.meters ?? 0),
      holes: cr.holes_drilled != null ? Number(cr.holes_drilled) : (existing?.holes ?? 0),
      status: endSmu != null ? 'completed' : 'active',
      delayMins: crDelayMins,
    });
  }

  const compiledOps = Array.from(opsMap.values());
  const totalHours = compiledOps.reduce((sum, op) => sum + op.hours, 0);
  const totalMeters = compiledOps.reduce((sum, op) => sum + op.meters, 0);
  const totalHoles = compiledOps.reduce((sum, op) => sum + op.holes, 0);
  const activeOps = compiledOps.filter((op) => op.status === 'active').length;
  const loggedShifts = compiledOps.length;

  const crDelayTotal = compiledOps.reduce((sum, op) => sum + op.delayMins, 0);
  const legacyDelayMinutes = todayDelays?.reduce((sum, d) => sum + (d.delay_minutes || 0), 0) || 0;
  const delayMinutes = Math.round(crDelayTotal + legacyDelayMinutes);
  const delayCount =
    (todayDelays?.length || 0) + compiledOps.filter((op) => op.delayMins > 0).length;

  return {
    loggedShifts,
    machineCount: drills?.length ?? 0,
    totalHours,
    totalMeters,
    totalHoles,
    activeOps,
    delayCount,
    delayMinutes,
  };
}

/**
 * Next.js 16 Cache Components with 'use cache' directive.
 * Dual-tier cache: Next.js Data Cache (RSC) + Redis L1/L2 via withCache.
 * METRICS TTL (L2 300s) keeps shift dashboards responsive without hammering Postgres
 * on every control-room ↔ drilling navigation.
 */
async function getDrillingDashboardData(
  deptId: string,
  today: string
): Promise<DrillingDashboardMetrics> {
  'use cache';

  const dashboardTag = tagDepartment('drilling', `dashboard:${today}`);

  // Set cache lifetime profile for this function
  cacheLife('telemetry');

  // Associate cache tags for on-demand revalidation
  cacheTag(dashboardTag);
  cacheTag('table:machines');
  cacheTag('table:drill_operations');
  cacheTag('table:machine_operations');

  return withCache(() => loadDrillingDashboardMetrics(deptId, today), {
    category: CacheCategory.METRICS,
    keyParts: ['drilling', 'dashboard-v2', deptId, today],
    tags: [dashboardTag, 'table:machines', 'table:drill_operations', 'table:machine_operations'],
  });
}

export default async function DrillingDashboardPage() {
  const { deptId, today } = await getDepartmentContext({
    department: 'drilling',
  });

  const {
    loggedShifts,
    machineCount,
    totalHours,
    totalMeters,
    totalHoles,
    activeOps,
    delayCount,
    delayMinutes,
  } = await getDrillingDashboardData(deptId, today);

  return (
    <div className="space-y-8 lg:space-y-12">
      <header className="mb-8">
        <h1 className="mb-2 font-bold font-display text-4xl text-[var(--text-heading)] lg:text-5xl">
          Drilling Dashboard
        </h1>
        <p className="text-[var(--text-muted)] text-base">Auto-Built from Control Room</p>
      </header>

      <div className="border-[var(--border-default)]/20 border-t pb-8">
        <Divider variant="fading" label="CONTROL ROOM AUTO-SYNCED PRODUCTION" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        {/* Meters Today Card */}
        <GlassCard variant="window" accent="green" className="h-full p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Meters Today
              </h2>
              <p className="mt-2 font-bold text-3xl text-[var(--text-heading)] lg:text-4xl">
                {totalMeters.toFixed(1)}m
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green/10">
              <Drill className="h-6 w-6 text-accent-green" />
            </div>
          </div>
          <p className="mt-3 text-[var(--text-muted)] text-sm">
            Captured via Control Room auto-sync
          </p>
        </GlassCard>

        {/* Holes Today Card */}
        <GlassCard variant="window" accent="blue" className="h-full p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Holes Today
              </h2>
              <p className="mt-2 font-bold text-3xl text-[var(--accent-blue)] lg:text-4xl">
                {totalHoles}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue/10">
              <FileText className="h-6 w-6 text-[var(--accent-blue)]" />
            </div>
          </div>
          <p className="mt-3 text-[var(--text-muted)] text-sm">
            {loggedShifts} shift{loggedShifts === 1 ? '' : 's'} compiled
          </p>
        </GlassCard>

        {/* Active Drills Card */}
        <GlassCard variant="window" accent="green" className="h-full p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Active Drills
              </h2>
              <p className="mt-2 font-bold text-3xl text-[var(--text-heading)] lg:text-4xl">
                {machineCount}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green/10">
              <Drill className="h-6 w-6 text-accent-green" />
            </div>
          </div>
          {activeOps > 0 && (
            <p className="mt-3 text-accent-green text-sm">
              {activeOps} operation{activeOps > 1 ? 's' : ''} active
            </p>
          )}
        </GlassCard>

        {/* Hours Today Card */}
        <GlassCard variant="window" accent="blue" className="h-full p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Hours Today
              </h2>
              <p className="mt-2 font-bold text-3xl text-[var(--accent-blue)] lg:text-4xl">
                {totalHours.toFixed(1)}h
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue/10">
              <Clock className="h-6 w-6 text-[var(--accent-blue)]" />
            </div>
          </div>
          <p className="mt-3 text-[var(--text-muted)] text-sm">{loggedShifts} shifts logged</p>
        </GlassCard>

        {/* Delays Card */}
        <GlassCard variant="window" className="h-full p-6 md:p-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-accent-blue" />
            <div>
              <h2 className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Delays
              </h2>
              <p className="mt-1 font-bold text-accent-blue text-xl">{delayCount}</p>
              {delayMinutes > 0 && (
                <p className="mt-1 text-[var(--text-muted)] text-sm">{delayMinutes} min lost</p>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      <Divider variant="dotted" label="OPERATIONAL MODULES & RIG COMMAND" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Drilling Operations Card */}
        <Link href="/drilling/drilling-operations">
          <GlassCard
            variant="window"
            accent="green"
            className="h-full cursor-pointer p-6 transition-colors hover:shadow-card-hover md:p-8"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="font-semibold text-[var(--text-heading)] text-base">
                  Drilling Operations
                </h2>
                <p className="text-[var(--text-muted)] text-xs">
                  Shift hole counts, meters drilled, and operator sign-offs
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--text-heading)]" />
            </div>
            <p className="mt-4 text-[var(--text-muted)] text-xs">
              Today's Compiled Shifts: {loggedShifts} Active Records
            </p>
          </GlassCard>
        </Link>

        {/* Shift PDF Report Card */}
        <Link href="/drilling/reports?tab=pdf-report">
          <GlassCard
            variant="window"
            accent="blue"
            className="h-full cursor-pointer p-6 transition-colors hover:shadow-card-hover md:p-8"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="font-semibold text-[var(--text-heading)] text-base">
                  Shift PDF Report
                </h2>
                <p className="text-[var(--text-muted)] text-xs">
                  Printable executive shift report with rig-by-rig breakdown
                </p>
              </div>
              <FileText className="h-5 w-5 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-4 text-[var(--text-muted)] text-xs">
              Total Meters: {totalMeters.toFixed(1)}m ({totalHoles} holes)
            </p>
          </GlassCard>
        </Link>

        {/* WhatsApp Shift Dispatch Card */}
        <Link href="/drilling/reports?tab=whatsapp-report">
          <GlassCard
            variant="window"
            accent="green"
            className="h-full cursor-pointer p-6 transition-colors hover:shadow-card-hover md:p-8"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="font-semibold text-[var(--text-heading)] text-base">
                  WhatsApp Shift Dispatch
                </h2>
                <p className="text-[var(--text-muted)] text-xs">
                  Formatted shift summary ready for 1-click WhatsApp group sharing
                </p>
              </div>
              <MessageSquare className="h-5 w-5 text-accent-green" />
            </div>
            <p className="mt-4 text-[var(--text-muted)] text-xs">Dispatch Mode: Ready to Share</p>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
