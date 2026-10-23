import { GlassCard } from '@repo/ui/GlassCard';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getDepartmentContext } from '~/lib/dept-context';

export default async function MachinesPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  if (deptSlug === 'plant-processing') {
    redirect('/plant-processing/delays');
  }
  const { supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });
  if (deptSlug === 'plant-inventory') {
    return <PlantInventoryWorkspaceClient mode="item-list" today={today} />;
  }
  let machinesQuery = supabase
    .from('machines')
    .select(
      'id, name, machine_type, serial_number, bin_factor, active, created_at, site:sites(name, site_code)'
    );
  if (deptSlug === 'drilling') {
    machinesQuery = machinesQuery.eq('machine_type', 'Drill Rig');
  }
  const { data: machines } = await machinesQuery.order('name');

  const activeCount = machines?.filter((m) => m.active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-2xl text-[var(--text-heading)]">Machine Database</h2>
        <Link
          href="/admin"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-muted)] text-sm transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--text-heading)]"
        >
          Manage in Admin →
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5 px-4 py-3 text-[var(--accent-blue)] text-sm">
        <svg
          className="h-4 w-4 shrink-0"
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

      {!machines || machines.length === 0 ? (
        <GlassCard>
          <p className="py-8 text-center text-[var(--text-muted)] text-sm">
            No machines registered for this department.
          </p>
        </GlassCard>
      ) : (
        (() => {
          // Group by site
          type MachineRow = NonNullable<typeof machines>[number];
          const siteMap = new Map<
            string,
            {
              siteCode: string;
              siteName: string;
              machines: MachineRow[];
            }
          >();

          for (const machine of machines) {
            const site = Array.isArray(machine.site) ? machine.site[0] : machine.site;
            const siteKey = site?.site_code ?? '__none__';
            if (!siteMap.has(siteKey)) {
              siteMap.set(siteKey, {
                siteCode: site?.site_code ?? '',
                siteName: site?.name ?? 'Unassigned',
                machines: [],
              });
            }
            siteMap.get(siteKey)!.machines.push(machine);
          }

          const siteEntries = Array.from(siteMap.entries()).sort(([a], [b]) => {
            if (a === '__none__') return 1;
            if (b === '__none__') return -1;
            return a.localeCompare(b);
          });

          return (
            <div className="space-y-6">
              {siteEntries.map(([siteKey, { siteCode, siteName, machines: sms }]) => (
                <div key={siteKey} className="space-y-3">
                  {/* Site heading */}
                  <div className="flex items-center gap-3 border-[var(--border-default)] border-b pb-2">
                    {siteCode ? (
                      <span className="inline-flex rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono text-[var(--accent-blue)] text-xs">
                        {siteCode}
                      </span>
                    ) : null}
                    <h3 className="font-medium text-[var(--text-heading)] text-sm">{siteName}</h3>
                    <span className="text-[var(--text-muted)] text-xs">
                      {sms.length} machine{sms.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {sms.map((machine) => (
                      <GlassCard key={machine.id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text-heading)] text-sm">
                              {machine.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                                {machine.machine_type}
                              </span>
                              {machine.bin_factor != null && machine.bin_factor > 0 && (
                                <span className="rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono text-[11px] text-[var(--accent-blue)]">
                                  Bin: {machine.bin_factor} BCM
                                </span>
                              )}
                              {machine.serial_number && (
                                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                  {machine.serial_number}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold text-xs ${
                              machine.active
                                ? 'border-emerald-200/50 bg-emerald-50/70 text-emerald-700'
                                : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                            }`}
                          >
                            {machine.active && <span className="badge-pulse-dot bg-emerald-500" />}
                            {machine.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}
