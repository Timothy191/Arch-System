import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CircleDot,
  Clock,
  Gauge,
  Layers,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';

export default async function TireManagementPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'engineering');

  const { supabase } = await getDepartmentContext({
    department: deptSlug,
  });

  const [{ data: tiresData }, { data: inspectionsData }] = await Promise.all([
    supabase
      .from('tires')
      .select(
        'id, serial_number, brand, size, position, status, installed_at, installed_hours, machines(id, name, serial_number)'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('tire_inspections')
      .select('id, tire_id, inspection_date, tread_depth_mm, pressure_psi, condition_status, notes')
      .order('inspection_date', { ascending: false })
      .limit(50),
  ]);

  const inspectionsByTire = new Map<string, NonNullable<typeof inspectionsData>[number]>();
  for (const insp of inspectionsData || []) {
    if (!inspectionsByTire.has(insp.tire_id)) {
      inspectionsByTire.set(insp.tire_id, insp);
    }
  }

  const tires = (tiresData || []).map((t) => {
    const machine = Array.isArray(t.machines) ? t.machines[0] : t.machines;
    const latestInspection = inspectionsByTire.get(t.id);
    return {
      ...t,
      machineName: machine?.name || 'Unassigned',
      latestInspection,
    };
  });

  // Performance Optimization: Calculate total, installed, inventory, and critical counts in a single pass O(N) loop
  // instead of multiple array .filter() passes over tires.
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
          Number(t.latestInspection.tread_depth_mm) < 15)
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
          <div className="flex items-center gap-2">
            <CircleDot className="h-6 w-6 text-dept-engineering" aria-hidden="true" />
            <h2 className="font-bold text-2xl text-[var(--text-heading)]">Tire Management</h2>
          </div>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Fleet tire pressure, tread wear telemetry, and replacement tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/engineering/breakdowns"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-secondary)] text-sm transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--text-heading)]"
          >
            <Wrench className="h-4 w-4 text-dept-engineering" aria-hidden="true" />
            Breakdowns
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-medium text-sm text-white shadow-sm transition-colors hover:bg-[var(--accent-blue)]/90"
          >
            Manage Fleet
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Total Tires
            </span>
            <Layers className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">{totalTires}</p>
          <span className="mt-1 block text-[var(--text-secondary)] text-xs">In fleet tracking</span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Installed Active
            </span>
            <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-bold text-2xl text-emerald-600">{installedTires}</p>
          <span className="mt-1 block text-[var(--text-secondary)] text-xs">
            Mounted on machines
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Inventory / Spares
            </span>
            <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-bold text-2xl text-blue-600">{inventoryTires}</p>
          <span className="mt-1 block text-[var(--text-secondary)] text-xs">
            Ready for deployment
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Critical Alerts
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
          </div>
          <p
            className={`mt-2 font-bold text-2xl ${criticalTires > 0 ? 'text-amber-600' : 'text-[var(--text-heading)]'}`}
          >
            {criticalTires}
          </p>
          <span className="mt-1 block text-[var(--text-secondary)] text-xs">
            Low tread or high PSI drift
          </span>
        </GlassCard>
      </div>

      {/* Tires Table */}
      <div className="space-y-4">
        <h3 className="font-semibold text-[var(--text-heading)] text-lg">Tire Fleet Status</h3>
        {tires.length === 0 ? (
          <GlassCard>
            <div className="space-y-3 py-10 text-center">
              <CircleDot className="mx-auto h-10 w-10 text-[var(--text-muted)] opacity-50" />
              <p className="font-medium text-[var(--text-heading)] text-sm">No Tires Registered</p>
              <p className="mx-auto max-w-sm text-[var(--text-muted)] text-xs">
                Tire telemetry and maintenance records are managed through Admin fleet provisioning
                and the engineering workshop.
              </p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                aria-label="Tire fleet inventory and telemetry table"
              >
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Serial Number
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Brand / Size
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Machine / Position
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Tread Depth
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Pressure
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Hours Operated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {tires.map((tire) => {
                    const tread = tire.latestInspection
                      ? Number(tire.latestInspection.tread_depth_mm)
                      : null;
                    const psi = tire.latestInspection
                      ? Number(tire.latestInspection.pressure_psi)
                      : null;
                    const isLowTread = tread !== null && tread < 15;
                    const isCritical =
                      tire.latestInspection?.condition_status === 'critical' || isLowTread;

                    return (
                      <tr key={tire.id} className="transition-colors hover:bg-black/[0.01]">
                        <td className="px-5 py-3.5 font-mono font-semibold text-[var(--text-heading)] text-xs">
                          {tire.serial_number}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-secondary)] text-xs">
                          <span className="font-medium text-[var(--text-heading)]">
                            {tire.brand}
                          </span>
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {tire.size}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="font-medium text-[var(--text-heading)]">
                            {tire.machineName}
                          </span>
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {tire.position}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[11px] ${
                              tire.status === 'installed'
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : tire.status === 'inventory'
                                  ? 'bg-blue-500/10 text-blue-700'
                                  : 'bg-zinc-500/10 text-zinc-700'
                            }`}
                          >
                            {tire.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {tread !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                isCritical
                                  ? 'font-semibold text-amber-600'
                                  : 'text-[var(--text-heading)]'
                              }`}
                            >
                              {tread} mm
                              {isCritical && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 text-amber-600"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {psi !== null ? (
                            <span className="inline-flex items-center gap-1 text-[var(--text-heading)]">
                              <Gauge
                                className="h-3 w-3 text-[var(--text-muted)]"
                                aria-hidden="true"
                              />
                              {psi} PSI
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-xs">
                          {tire.installed_hours?.toLocaleString() || 0} hrs
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
