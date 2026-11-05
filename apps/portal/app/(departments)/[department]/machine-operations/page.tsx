import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { type BreakdownDelaySource, breakdownShiftDelayHours } from '~/lib/shift-completeness';

const MachineOperationsForm = dynamic(
  () => import('./MachineOperationsForm').then((m) => m.MachineOperationsForm),
  {
    loading: () => <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />,
  }
);

const MachineOperationsFilterableTable = dynamic(
  () => import('./MachineOperationsFilterableTable').then((m) => m.default),
  {
    loading: () => <div className="h-96 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />,
  }
);

// MachineOperationsList removed - replaced by MachineOperationsFilterableTable

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
      .select('meter_id, reading')
      .order('reading_at', { ascending: false })
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
      .select(
        'id, fleet_id, reason, repair_notes, status, delay_hours, date_in, time_in, date_out, time_out'
      )
      .or(`status.eq.active,date_in.eq.${today},date_out.eq.${today}`),
  ]);

  const parseBreakdownDelayHours = (b: BreakdownDelaySource): number => breakdownShiftDelayHours(b);

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
  for (const b of (activeBreakdowns || []) as Array<
    BreakdownDelaySource & {
      fleet_id?: string | null;
      status?: string | null;
      reason?: string | null;
    }
  >) {
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
    if (row.end_smu !== null && row.end_smu !== undefined) {
      const currentMax = latestSMRMap.get(row.machine_id) ?? 0;
      const candidate = Number(row.end_smu);
      if (candidate > currentMax) {
        latestSMRMap.set(row.machine_id, candidate);
      }
    }
  });
  (baselineSmrReadings as Array<{ meter_id: string; reading: number | null }> | null)?.forEach(
    (row) => {
      if (row.reading !== null && row.reading !== undefined && row.meter_id) {
        const currentMax = latestSMRMap.get(row.meter_id) ?? 0;
        const candidate = Number(row.reading);
        if (candidate > currentMax) {
          latestSMRMap.set(row.meter_id, candidate);
        }
      }
    }
  );

  const siteMap = new Map((sites || []).map((s) => [s.id, s]));
  const machinesWithSmu = (machines || []).map((m) => {
    const rawSiteProp = (
      m as {
        site?:
          | { name: string; site_code: string }
          | Array<{ name: string; site_code: string }>
          | null;
      }
    ).site;
    const rawSite = Array.isArray(rawSiteProp) ? rawSiteProp[0] : rawSiteProp;
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
      const operationDelays =
        (op as { delay_entries?: Array<{ duration_hours?: number | null }> }).delay_entries || [];
      return (
        sum + operationDelays.reduce((delaySum: number, d) => delaySum + (d.duration_hours || 0), 0)
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
      if (
        String(op.block_drilled || '')
          .toLowerCase()
          .startsWith('other')
      ) {
        return;
      }
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
        <div
          data-testid="todays-operations-golden-header"
          className="gold-steel-border gold-steel-border-slim relative flex items-center justify-between overflow-hidden rounded-xl border border-accent-amber/45 bg-white/90 px-4 py-2.5 shadow-2xs"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-amber-500/10 via-amber-300/25 to-amber-500/10"
          />
          <div className="relative z-10 flex items-center gap-2.5">
            <Logo variant="gold" className="h-4 w-4 shrink-0" />
            <h3 className="animate-shimmer bg-gradient-to-r from-amber-700 via-[var(--accent-blue)] to-amber-800 bg-clip-text font-semibold text-lg text-transparent">
              Today&apos;s Operations
            </h3>
          </div>
          <span
            data-testid="todays-operations-fleet-count"
            className="gold-steel-border gold-steel-border-slim relative z-10 inline-flex items-center gap-1.5 rounded-full border border-accent-amber/45 bg-amber-50/90 px-3 py-1 font-mono font-semibold text-[var(--accent-blue)] text-xs shadow-2xs"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-blue)]"
            />
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
          <MachineOperationsFilterableTable
            machines={machinesWithSmu}
            operations={todayOperations || []}
            activeBreakdowns={activeBreakdowns || []}
            engineeringDelaysByMachine={engineeringDelaysByMachine}
          />
        </Suspense>
      </div>
    </div>
  );
}
