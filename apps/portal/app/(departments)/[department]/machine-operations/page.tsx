import { GlassCard } from '@repo/ui/GlassCard';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';

const MachineOperationsForm = dynamic(
  () => import('./MachineOperationsForm').then((m) => m.MachineOperationsForm),
  {
    loading: () => <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />,
  }
);

const MachineOperationsList = dynamic(
  () => import('./MachineOperationsList').then((m) => m.MachineOperationsList),
  {
    loading: () => (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
        ))}
      </div>
    ),
  }
);

const MachineOperationsComplianceWidget = dynamic(
  () =>
    import('./MachineOperationsComplianceWidget').then((m) => m.MachineOperationsComplianceWidget),
  {
    loading: () => <div className="h-20 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />,
  }
);

export default async function MachineOperationsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Parallel fetch of independent data
  const [
    { data: machines },
    { data: previousSMRs },
    { data: baselineSmrReadings },
    { data: operators },
    { data: sites },
    { data: mineBlocks },
    { data: todayOperations },
    { data: todayLoads },
    { data: _delayCategories },
    { data: activeBreakdowns },
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, active, bin_factor, site_id')
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
    supabase
      .from('operators')
      .select('id, full_name, employee_code')
      .eq('active', true)
      .order('full_name'),
    supabase.from('sites').select('id, name, site_code').eq('active', true).order('name'),
    supabase.from('mine_blocks').select('id, name, code, site_id').eq('active', true).order('name'),
    supabase
      .from('machine_operations')
      .select(
        '*, machine:machines(name, machine_type, bin_factor, serial_number), operator:operators(full_name), site:sites(name), delay_entries:delay_entries(*, delay_category:delay_categories(*))'
      )
      .eq('department_id', deptId)
      .eq('shift_date', today)
      .order('start_time', { ascending: false }),
    supabase
      .from('hourly_loads')
      .select('machine_id, shift_type, total_loads')
      .eq('department_id', deptId)
      .eq('load_date', today),
    supabase
      .from('delay_categories')
      .select('id, name, description')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('breakdowns')
      .select('id, fleet_id, reason, repair_notes, status, date_in, time_in, date_out, time_out')
      .or(`status.eq.active,date_in.eq.${today},date_out.eq.${today}`),
  ]);

  const parseBreakdownDelayHours = (b: {
    reason?: string | null;
    date_in?: string | null;
    time_in?: string | null;
    date_out?: string | null;
    time_out?: string | null;
    delay_hours?: number | null;
  }): number => {
    if (typeof b.delay_hours === 'number' && !Number.isNaN(b.delay_hours) && b.delay_hours > 0) {
      return Math.min(12, Math.max(0, b.delay_hours));
    }
    const tagMatch = b.reason?.match(/\[Shift Delay:\s*([\d.]+)h\]/i);
    if (tagMatch?.[1]) {
      const parsed = parseFloat(tagMatch[1]);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.min(12, parsed);
    }
    if (b.date_in && b.time_in && b.date_out && b.time_out) {
      const startMs = new Date(`${b.date_in}T${b.time_in.slice(0, 8)}`).getTime();
      const endMs = new Date(`${b.date_out}T${b.time_out.slice(0, 8)}`).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
        return Math.min(12, Number(((endMs - startMs) / 3600000).toFixed(2)));
      }
    }
    return 0;
  };

  // Map Engineering breakdown delay hours by machine.id and serial_number
  const engineeringDelaysByMachine: Record<
    string,
    { hours: number; reasons: string[]; status: string }
  > = {};
  const machineBySerialOrId = new Map<string, string>();
  for (const m of machines || []) {
    machineBySerialOrId.set(m.id, m.id);
    if (m.serial_number) {
      machineBySerialOrId.set(m.serial_number, m.id);
    }
    machineBySerialOrId.set(m.name, m.id);
  }
  for (const b of (activeBreakdowns || []) as Array<Record<string, any>>) {
    const fleetKey = String(b.fleet_id || '');
    const resolvedMachineId = machineBySerialOrId.get(fleetKey) || fleetKey;
    if (!resolvedMachineId) continue;
    const hrs = parseBreakdownDelayHours(b);
    const existing = engineeringDelaysByMachine[resolvedMachineId] || {
      hours: 0,
      reasons: [],
      status: String(b.status || 'active'),
    };
    existing.hours = Math.min(12, Number((existing.hours + hrs).toFixed(2)));
    if (b.reason) existing.reasons.push(String(b.reason));
    if (b.status === 'active') existing.status = 'active';
    engineeringDelaysByMachine[resolvedMachineId] = existing;
  }

  const totalEngineeringDelayHours = Object.values(engineeringDelaysByMachine).reduce(
    (sum, item) => sum + item.hours,
    0
  );

  const latestSMRMap = new Map<string, number>();
  (previousSMRs as Array<{ machine_id: string; end_smu: number | null }> | null)?.forEach((row) => {
    if (!latestSMRMap.has(row.machine_id) && row.end_smu !== null && row.end_smu !== undefined) {
      latestSMRMap.set(row.machine_id, Number(row.end_smu));
    }
  });
  (
    baselineSmrReadings as Array<{ machine_id: string; reading_hours: number | null }> | null
  )?.forEach((row) => {
    if (
      !latestSMRMap.has(row.machine_id) &&
      row.reading_hours !== null &&
      row.reading_hours !== undefined
    ) {
      latestSMRMap.set(row.machine_id, Number(row.reading_hours));
    }
  });

  const siteMap = new Map((sites || []).map((s) => [s.id, s]));
  const machinesWithSmu = (machines || []).map((m) => {
    const rawSite = Array.isArray((m as any).site) ? (m as any).site[0] : (m as any).site;
    const resolvedSite = rawSite || (m.site_id ? siteMap.get(m.site_id) : null);
    return {
      ...m,
      site: resolvedSite ? { name: resolvedSite.name, site_code: resolvedSite.site_code } : null,
      latest_smu: latestSMRMap.get(m.id) ?? null,
    };
  });

  // Calculate today's totals
  const totalHours =
    todayOperations?.reduce((sum, op) => {
      return sum + (op.hours_worked || 0);
    }, 0) || 0;

  const activeMachines = new Set(todayOperations?.map((op) => op.machine_id)).size;

  // AGENT-TRACE: Calculate total delay hours across all operations + Engineering logged breakdown delays
  const controlRoomDelayHours =
    todayOperations?.reduce((sum, op) => {
      const operationDelays = (op as any).delay_entries || [];
      return (
        sum +
        operationDelays.reduce((delaySum: number, d: any) => delaySum + (d.duration_hours || 0), 0)
      );
    }, 0) || 0;
  const totalDelayHours = controlRoomDelayHours + totalEngineeringDelayHours;

  // Calculate total material moved (BCM) - sum of (loads × bin_factor) or Dozer rollover (hours × 250)
  let totalMaterialBCM = 0;
  todayOperations?.forEach((op) => {
    const isDozerOp =
      op.machine?.machine_type === 'Dozer' ||
      Boolean(op.machine?.machine_type?.toLowerCase().includes('dozer'));
    if (isDozerOp) {
      totalMaterialBCM += (op.hours_worked || 0) * 250;
      return;
    }
    const binFactor = op.machine?.bin_factor || 0;
    // Find loads for this machine across both shifts
    const machineLoads =
      todayLoads
        ?.filter((l) => l.machine_id === op.machine_id)
        ?.reduce((sum, l) => sum + (l.total_loads || 0), 0) || 0;
    totalMaterialBCM += machineLoads * binFactor;
  });

  // Calculate average BCM/hour
  const avgBcmPerHour = totalHours > 0 ? totalMaterialBCM / totalHours : 0;

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-2xl text-[var(--text-heading)]">Machine Operations</h2>
          <p className="text-[var(--text-muted)] text-sm">
            {new Date().toLocaleDateString('en-ZA', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </GlassCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Today&apos;s Hours</p>
          <p className="mt-1 font-medium text-2xl text-[var(--text-heading)]">
            {totalHours.toFixed(1)}h
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Active Machines</p>
          <p className="mt-1 font-medium text-2xl text-accent-green">{activeMachines}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Material Moved</p>
          <p className="mt-1 font-medium text-2xl text-[var(--accent-blue)]">
            {totalMaterialBCM.toFixed(1)} BCM
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">BCM/Hour</p>
          <p className="mt-1 font-medium text-2xl text-accent-blue">{avgBcmPerHour.toFixed(1)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Total Delays</p>
          <p className="mt-1 font-medium text-2xl text-accent-red">{totalDelayHours.toFixed(1)}h</p>
          {totalEngineeringDelayHours > 0 && (
            <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
              CR: {controlRoomDelayHours.toFixed(1)}h + Eng: {totalEngineeringDelayHours.toFixed(1)}
              h
            </p>
          )}
        </GlassCard>
      </div>

      {/* Shift Coverage Compliance Widget */}
      <Suspense
        fallback={<div className="h-20 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />}
      >
        <MachineOperationsComplianceWidget departmentId={deptId} departmentSlug={deptSlug} />
      </Suspense>

      {/* Add Operation Form */}
      <div id="machine-operations-form" className="scroll-mt-6">
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />}
        >
          <MachineOperationsForm
            departmentId={deptId}
            machines={machinesWithSmu}
            operators={operators || []}
            sites={sites || []}
            mineBlocks={mineBlocks || []}
            todayOperations={todayOperations || []}
            engineeringDelaysByMachine={engineeringDelaysByMachine}
          />
        </Suspense>
      </div>

      {/* Today's Operations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] text-lg">
            Today&apos;s Operations
          </h3>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {machinesWithSmu.length} fleet machine{machinesWithSmu.length === 1 ? '' : 's'}
          </span>
        </div>
        <Suspense
          fallback={
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
              ))}
            </div>
          }
        >
          <MachineOperationsList
            machines={machinesWithSmu}
            operations={todayOperations || []}
            todayLoads={todayLoads || []}
            activeBreakdowns={activeBreakdowns || []}
            engineeringDelaysByMachine={engineeringDelaysByMachine}
          />
        </Suspense>
      </div>
    </div>
  );
}
