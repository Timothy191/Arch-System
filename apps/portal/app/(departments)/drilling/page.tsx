import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { BorderBox } from '@repo/ui/BorderBox';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, ClipboardList, Clock, Drill, FileText, Radio } from 'lucide-react';
import Link from 'next/link';
import { getDepartmentContext } from '~/lib/dept-context';

async function getDrillingDashboardData(deptId: string, today: string) {
  const db = await createReadReplicaClient();

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

  for (const cr of (controlRoomOps ?? []) as any[]) {
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
      ? cr.delay_entries.filter((d: any) => !d.deleted_at)
      : [];
    const crDelayMins = delays.reduce(
      (sum: number, d: any) => sum + Number(d.duration_hours || 0) * 60,
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-semibold text-2xl text-[var(--text-heading)]">
              Drilling Dashboard
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-medium text-accent-green text-xs">
              <Radio className="h-3 w-3" />
              Auto-Built from Control Room
            </span>
          </div>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            {new Date().toLocaleDateString('en-ZA', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/drilling/drilling-operations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <Drill className="h-3.5 w-3.5 text-accent-green" />
            Today&apos;s Shift Report ({loggedShifts})
          </Link>
          <Link
            href="/drilling/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-3.5 py-1.5 font-medium text-[var(--accent-blue)] text-xs transition-colors hover:bg-[var(--accent-blue)]/20"
          >
            <FileText className="h-3.5 w-3.5" />
            Production Reports
          </Link>
        </div>
      </div>

      <Divider variant="fading" label="CONTROL ROOM AUTO-SYNCED PRODUCTION" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <GlassCard>
          <div className="flex items-center gap-2">
            <Drill className="h-4 w-4 text-accent-green" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Meters Today
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-accent-green">{totalMeters.toFixed(1)}m</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">Captured via Control Room</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Holes Today
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--accent-blue)]">{totalHoles}</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {loggedShifts} shift{loggedShifts === 1 ? '' : 's'} compiled
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Drill className="h-4 w-4 text-accent-green" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Active Drills
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">{machineCount}</p>
          {activeOps > 0 && (
            <p className="mt-1 text-accent-green text-xs">
              {activeOps} operation{activeOps > 1 ? 's' : ''} active
            </p>
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--accent-blue)]" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Hours Today
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--accent-blue)]">
            {totalHours.toFixed(1)}h
          </p>
        </GlassCard>

        <BorderBox variant="patterned-caution" padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent-blue" />
              <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Delays
              </p>
            </div>
            <p className="mt-2 font-bold text-2xl text-accent-blue">{delayCount}</p>
            {delayMinutes > 0 && (
              <p className="mt-1 text-[var(--text-muted)] text-xs">{delayMinutes} min lost</p>
            )}
          </div>
        </BorderBox>
      </div>
    </div>
  );
}
