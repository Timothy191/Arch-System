/* cspell:ignore Tyre */
import {
  EngineeringMountedWheelIcon,
  EngineeringPressureAlertIcon,
  EngineeringSpareStockIcon,
  EngineeringTireTreadIcon,
} from '@repo/ui/engineering-icons';
import { GlassCard } from '@repo/ui/GlassCard';
import { connection } from 'next/server';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { TireActivityManagerClient } from './TireActivityManagerClient';
import { TireFleetStatusPanel } from './TireFleetStatusPanel';
import {
  CRITICAL_TREAD_DEPTH_MM,
  classifyTireActivityType,
  type TireInspectionActivity,
  type TireLatestInspection,
  type TireMachineOption,
  type TireRecord,
} from './tire-constants';

const KPI_ICON_BADGE_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] shadow-2xs';

export default async function TireManagementPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  await connection();
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'engineering');

  const { supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  const [{ data: tiresData }, { data: inspectionsData }, { data: machinesData }] =
    await Promise.all([
      supabase
        .from('tires')
        .select(
          'id, serial_number, brand, size, position, status, machine_id, installed_at, installed_hours, removed_at, removed_hours, scrapped_reason, machines(id, name, serial_number)'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('tire_inspections')
        .select(
          'id, tire_id, inspection_date, tread_depth_mm, pressure_psi, condition_status, current_smu, notes'
        )
        .order('inspection_date', { ascending: false })
        .limit(50),
      supabase
        .from('machines')
        .select(
          'id, name, machine_type, serial_number, manufacturer, starting_smr, image_url, active, site:sites(name, site_code)'
        )
        .order('name'),
    ]);

  const inspectionsByTire = new Map<string, TireLatestInspection>();
  for (const insp of inspectionsData || []) {
    if (!inspectionsByTire.has(insp.tire_id)) {
      inspectionsByTire.set(insp.tire_id, insp);
    }
  }

  const tires: TireRecord[] = (tiresData || []).map((t) => {
    const machine = Array.isArray(t.machines) ? t.machines[0] : t.machines;
    const latestInspection = inspectionsByTire.get(t.id);
    return {
      ...t,
      machine_id: t.machine_id ?? machine?.id ?? null,
      machineName: machine?.name || 'Unassigned',
      latestInspection,
    };
  });

  const tireLookup = new Map(tires.map((t) => [t.id, t]));
  const recentActivities: TireInspectionActivity[] = (inspectionsData || []).map((insp) => {
    const tire = tireLookup.get(insp.tire_id);
    return {
      id: insp.id,
      tire_id: insp.tire_id,
      serial_number: tire?.serial_number ?? 'Unknown Serial',
      brand: tire?.brand ?? '',
      size: tire?.size ?? '',
      machineName: tire?.machineName ?? 'Unassigned',
      position: tire?.position ?? '—',
      inspection_date: insp.inspection_date,
      tread_depth_mm: Number(insp.tread_depth_mm) || 0,
      pressure_psi: Number(insp.pressure_psi) || 0,
      condition_status: insp.condition_status,
      current_smu: insp.current_smu != null ? Number(insp.current_smu) : null,
      notes: insp.notes ?? null,
      activityType: classifyTireActivityType(insp.notes),
    };
  });

  const activeMachines = (machinesData || []).filter(
    (m) => (m as { active?: boolean | null }).active !== false
  );

  const latestSmuByMachine = new Map<string, number>();
  for (const tire of tires) {
    if (!tire.machine_id) continue;
    const candidate = tire.latestInspection?.current_smu ?? tire.installed_hours;
    if (candidate != null && Number.isFinite(Number(candidate))) {
      const prev = latestSmuByMachine.get(tire.machine_id);
      if (prev === undefined || Number(candidate) > prev) {
        latestSmuByMachine.set(tire.machine_id, Number(candidate));
      }
    }
  }

  if (activeMachines.length > 0) {
    try {
      const machineIds = activeMachines.map((m) => m.id);
      const { data: recentOps } = await supabase
        .from('machine_operations')
        .select('machine_id, end_smu, start_smu')
        .in('machine_id', machineIds)
        .order('shift_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);

      for (const op of recentOps || []) {
        if (!op.machine_id) continue;
        const smu =
          op.end_smu != null
            ? Number(op.end_smu)
            : op.start_smu != null
              ? Number(op.start_smu)
              : null;
        if (smu != null && Number.isFinite(smu) && smu > 0) {
          const prev = latestSmuByMachine.get(op.machine_id);
          if (prev === undefined || smu > prev) {
            latestSmuByMachine.set(op.machine_id, smu);
          }
        }
      }
    } catch {
      // Non-fatal fallback: machine.starting_smr and installed tire hours remain available
    }
  }

  const machines: TireMachineOption[] = activeMachines.map((m) => {
    const rawStarting = (m as { starting_smr?: number | null }).starting_smr;
    const startingSmr =
      rawStarting != null && Number.isFinite(Number(rawStarting)) ? Number(rawStarting) : null;
    const latestSmu = latestSmuByMachine.get(m.id) ?? startingSmr;
    const rawSite = (m as { site?: { name?: string; site_code?: string } | null }).site;
    return {
      id: m.id,
      name: m.name,
      machine_type: m.machine_type,
      serial_number: m.serial_number ?? null,
      starting_smr: startingSmr,
      latest_smu: latestSmu,
      manufacturer: (m as { manufacturer?: string | null }).manufacturer ?? null,
      image_url: (m as { image_url?: string | null }).image_url ?? null,
      site_name: rawSite?.name ?? null,
      site_code: rawSite?.site_code ?? null,
    };
  });

  const resolvedToday = today || new Date().toISOString().slice(0, 10);

  // Performance Optimization: Single-pass O(N) metric aggregation across fleet tires.
  const totalTires = tires.length;
  let installedTires = 0;
  let inventoryTires = 0;
  let criticalTires = 0;

  for (const t of tires) {
    if (t.status === 'installed') {
      installedTires++;
      if (
        t.latestInspection &&
        (t.latestInspection.condition_status === 'critical' ||
          Number(t.latestInspection.tread_depth_mm) < CRITICAL_TREAD_DEPTH_MM)
      ) {
        criticalTires++;
      }
    } else if (t.status === 'inventory') {
      inventoryTires++;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Tire Management</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Fleet tire pressure, tread wear telemetry, and replacement tracking
          </p>
        </div>
      </div>

      {/* #2 Engineering Department Bespoke Vector Visuals & Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="bg-[var(--material-regular)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Total Tires
              </span>
              <p className="mt-2 font-bold text-2xl text-[var(--text-heading)] tabular-nums">
                {totalTires}
              </p>
              <span className="mt-1 block text-[var(--text-secondary)] text-xs">
                In fleet tracking
              </span>
            </div>
            <div className={KPI_ICON_BADGE_CLASS}>
              <EngineeringTireTreadIcon className="h-5 w-5 text-accent-gold" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-[var(--material-regular)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Installed Active
              </span>
              <p className="mt-2 font-bold text-2xl text-emerald-700 tabular-nums">
                {installedTires}
              </p>
              <span className="mt-1 block text-[var(--text-secondary)] text-xs">
                Mounted on machines
              </span>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-2xs">
              <EngineeringMountedWheelIcon className="h-5 w-5 text-emerald-700" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-[var(--material-regular)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Inventory / Spares
              </span>
              <p className="mt-2 font-bold text-2xl text-sky-700 tabular-nums">{inventoryTires}</p>
              <span className="mt-1 block text-[var(--text-secondary)] text-xs">
                Ready for deployment
              </span>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 shadow-2xs">
              <EngineeringSpareStockIcon className="h-5 w-5 text-sky-700" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-[var(--material-regular)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Critical Alerts
              </span>
              <p
                className={`mt-2 font-bold text-2xl tabular-nums ${
                  criticalTires > 0 ? 'text-amber-700' : 'text-[var(--text-heading)]'
                }`}
              >
                {criticalTires}
              </p>
              <span className="mt-1 block text-[var(--text-secondary)] text-xs">
                Low tread or high PSI drift
              </span>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-2xs">
              <EngineeringPressureAlertIcon className="h-5 w-5 text-amber-700" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* #3 & #5 Interactive Tyre Activity Logger & Golden-Border Ledger Panel */}
      <TireActivityManagerClient
        machines={machines}
        tires={tires}
        recentActivities={recentActivities}
        todayStr={resolvedToday}
      />

      {/* #4 Redesigned Tire Fleet Status GoldenPanel */}
      <TireFleetStatusPanel tires={tires} machines={machines} />
    </div>
  );
}
