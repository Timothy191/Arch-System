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

  const totalTires = tires.length;
  const installedTires = tires.filter((t) => t.status === 'installed').length;
  const inventoryTires = tires.filter((t) => t.status === 'inventory').length;
  const criticalTires = tires.filter(
    (t) =>
      t.status === 'installed' &&
      t.latestInspection &&
      (t.latestInspection.condition_status === 'critical' ||
        Number(t.latestInspection.tread_depth_mm) < 15)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CircleDot className="w-6 h-6 text-dept-engineering" />
            <h2 className="text-2xl font-bold text-[var(--text-heading)]">Tire Management</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Fleet tire pressure, tread wear telemetry, and replacement tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/engineering/breakdowns"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:border-[var(--border-emphasis)] transition-colors"
          >
            <Wrench className="w-4 h-4 text-dept-engineering" />
            Breakdowns
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-[var(--accent-blue)]/90 transition-colors shadow-sm"
          >
            Manage Fleet
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Total Tires
            </span>
            <Layers className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">{totalTires}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">In fleet tracking</span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Installed Active
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{installedTires}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">
            Mounted on machines
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Inventory / Spares
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{inventoryTires}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">
            Ready for deployment
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Critical Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${criticalTires > 0 ? 'text-amber-600' : 'text-[var(--text-heading)]'}`}
          >
            {criticalTires}
          </p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">
            Low tread or high PSI drift
          </span>
        </GlassCard>
      </div>

      {/* Tires Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[var(--text-heading)]">Tire Fleet Status</h3>
        {tires.length === 0 ? (
          <GlassCard>
            <div className="text-center py-10 space-y-3">
              <CircleDot className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-50" />
              <p className="text-sm font-medium text-[var(--text-heading)]">No Tires Registered</p>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Tire telemetry and maintenance records are managed through Admin fleet provisioning
                and the engineering workshop.
              </p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-black/[0.02]">
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      Serial Number
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      Brand / Size
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      Machine / Position
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      Tread Depth
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      Pressure
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider text-right"
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
                      <tr key={tire.id} className="hover:bg-black/[0.01] transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[var(--text-heading)]">
                          {tire.serial_number}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[var(--text-secondary)]">
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
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
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
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-[var(--text-heading)]'
                              }`}
                            >
                              {tread} mm
                              {isCritical && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {psi !== null ? (
                            <span className="inline-flex items-center gap-1 text-[var(--text-heading)]">
                              <Gauge className="w-3 h-3 text-[var(--text-muted)]" />
                              {psi} PSI
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-right font-mono text-[var(--text-secondary)]">
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
