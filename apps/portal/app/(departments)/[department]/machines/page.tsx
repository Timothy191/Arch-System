import { getDepartmentContext } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";
import Link from "next/link";

export default async function MachinesPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  const { supabase } = await getDepartmentContext({
    department: deptSlug,
  });

  const { data: machines } = await supabase
    .from("machines")
    .select(
      "id, name, machine_type, serial_number, active, created_at, site:sites(name, site_code)",
    )
    .order("name");

  const activeCount = machines?.filter((m) => m.active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-heading)]">
          Machine Database
        </h2>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-muted)] text-sm hover:text-[var(--text-heading)] hover:border-[var(--border-emphasis)] transition-colors"
        >
          Manage in Admin →
        </Link>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent-cyan)]/5 border border-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] text-sm">
        <svg
          className="w-4 h-4 shrink-0"
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
        Fleet is managed by the Admin department. Contact an administrator to
        add, edit, or decommission machines.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Total Machines</p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {machines?.length ?? 0}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Active</p>
          <p className="text-2xl font-medium text-accent-green mt-1">
            {activeCount}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Inactive</p>
          <p className="text-2xl font-medium text-[var(--text-muted)] mt-1">
            {(machines?.length ?? 0) - activeCount}
          </p>
        </GlassCard>
      </div>

      {!machines || machines.length === 0 ? (
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm text-center py-8">
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
            const site = Array.isArray(machine.site)
              ? machine.site[0]
              : machine.site;
            const siteKey = site?.site_code ?? "__none__";
            if (!siteMap.has(siteKey)) {
              siteMap.set(siteKey, {
                siteCode: site?.site_code ?? "",
                siteName: site?.name ?? "Unassigned",
                machines: [],
              });
            }
            siteMap.get(siteKey)!.machines.push(machine);
          }

          const siteEntries = Array.from(siteMap.entries()).sort(([a], [b]) => {
            if (a === "__none__") return 1;
            if (b === "__none__") return -1;
            return a.localeCompare(b);
          });

          return (
            <div className="space-y-6">
              {siteEntries.map(
                ([siteKey, { siteCode, siteName, machines: sms }]) => (
                  <div key={siteKey} className="space-y-3">
                    {/* Site heading */}
                    <div className="flex items-center gap-3 border-b border-[var(--border-default)] pb-2">
                      {siteCode ? (
                        <span className="inline-flex px-2 py-0.5 rounded font-mono text-xs bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20">
                          {siteCode}
                        </span>
                      ) : null}
                      <h3 className="text-sm font-medium text-[var(--text-heading)]">
                        {siteName}
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">
                        {sms.length} machine{sms.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {sms.map((machine) => (
                      <GlassCard key={machine.id}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[var(--text-heading)] font-medium">
                              {machine.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[var(--text-muted)] text-xs">
                                {machine.machine_type}
                              </span>
                              {machine.serial_number && (
                                <span className="text-[var(--text-muted)] text-xs">
                                  SN: {machine.serial_number}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              machine.active
                                ? "bg-emerald-50/70 border-emerald-200/50 text-emerald-700"
                                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-default)]"
                            }`}
                          >
                            {machine.active && (
                              <span className="badge-pulse-dot bg-emerald-500" />
                            )}
                            {machine.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                ),
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
