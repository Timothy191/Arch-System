import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";
import { DozerRollForm } from "~/features/departments/components/control-room/DozerRollForm";

export default async function RollOverPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, "control-room");
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch dozers with site info (centralised fleet)
  const { data: dozers } = await supabase
    .from("machines")
    .select("id, name, serial_number, site_id, sites(name)")
    .eq("machine_type", "Dozer")
    .eq("active", true)
    .order("name");

  // Fetch today's roll data — include site via machine join
  const { data: todayRolls } = await supabase
    .from("dozer_rolls")
    .select(
      "*, machine:machines(name, site_id, sites(name)), operator:operators(full_name)",
    )
    .eq("department_id", deptId)
    .eq("roll_date", today);

  const totalPasses =
    todayRolls?.reduce((sum, r) => sum + (r.blade_passes || 0), 0) || 0;
  const totalPushes =
    todayRolls?.reduce((sum, r) => sum + (r.push_count || 0), 0) || 0;
  const totalHours =
    todayRolls?.reduce((sum, r) => sum + (r.hours_operated || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium text-[var(--text-heading)]">
          Roll Over (Dozers)
        </h2>
        <p className="text-[var(--text-muted)] text-sm">
          {new Date().toLocaleDateString("en-ZA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Blade Passes</p>
          <p className="text-2xl font-medium text-[var(--accent-cyan)] mt-1">
            {totalPasses.toLocaleString()}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Push Count</p>
          <p className="text-2xl font-medium text-[var(--accent-cyan)] mt-1">
            {totalPushes.toLocaleString()}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Hours Operated</p>
          <p className="text-2xl font-medium text-accent-green mt-1">
            {totalHours.toFixed(1)}h
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Active Dozers</p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {dozers?.length || 0}
          </p>
        </GlassCard>
      </div>

      {/* Add Roll Form */}
      <DozerRollForm
        departmentId={deptId}
        dozers={dozers || []}
        today={today}
      />

      {/* Roll List — grouped by site → shift */}
      {todayRolls &&
        todayRolls.length > 0 &&
        (() => {
          // Build site map
          type RollRow = (typeof todayRolls)[number];
          const siteMap = new Map<
            string,
            { siteName: string; rolls: RollRow[] }
          >();

          for (const roll of todayRolls) {
            const machine = Array.isArray(roll.machine)
              ? roll.machine[0]
              : roll.machine;
            const siteId =
              (machine as { site_id?: string | null } | null)?.site_id ??
              "__none__";
            const sites = (
              machine as { sites?: { name: string }[] | null } | null
            )?.sites;
            const siteName =
              (Array.isArray(sites) ? sites[0]?.name : null) ??
              "No Site Assigned";

            if (!siteMap.has(siteId)) {
              siteMap.set(siteId, { siteName, rolls: [] });
            }
            siteMap.get(siteId)!.rolls.push(roll);
          }

          const siteEntries = Array.from(siteMap.entries()).sort(([a], [b]) => {
            if (a === "__none__") return 1;
            if (b === "__none__") return -1;
            return 0;
          });

          return (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-[var(--text-heading)]">
                Today&apos;s Rolls
              </h3>

              {siteEntries.map(([siteKey, { siteName, rolls }]) => {
                const sitePasses = rolls.reduce(
                  (sum, r) => sum + (r.blade_passes || 0),
                  0,
                );
                const siteHours = rolls.reduce(
                  (sum, r) => sum + (r.hours_operated || 0),
                  0,
                );
                const dayRolls = rolls.filter((r) => r.shift_type === "day");
                const nightRolls = rolls.filter(
                  (r) => r.shift_type === "night",
                );

                return (
                  <div key={siteKey} className="space-y-3">
                    {/* Site header */}
                    <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                      <h4 className="text-base font-medium text-[var(--text-heading)] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-cyan)]" />
                        {siteName}
                      </h4>
                      <div className="flex items-center gap-4 text-xs">
                        {sitePasses > 0 && (
                          <span className="text-[var(--accent-cyan)] font-medium">
                            {sitePasses.toLocaleString()} passes
                          </span>
                        )}
                        {siteHours > 0 && (
                          <span className="text-accent-green font-medium">
                            {siteHours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>

                    {dayRolls.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-medium text-accent-blue flex items-center gap-1.5 ml-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                          Day Shift
                        </h5>
                        {dayRolls.map((roll) => (
                          <GlassCard key={roll.id} className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[var(--text-heading)] font-medium">
                                  {Array.isArray(roll.machine)
                                    ? roll.machine[0]?.name
                                    : roll.machine?.name}
                                </p>
                                <p className="text-[var(--text-muted)] text-xs">
                                  {roll.operator?.full_name} • Day shift
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[var(--accent-cyan)] font-medium">
                                  {roll.blade_passes} passes
                                </p>
                                {roll.area_covered_sqm > 0 && (
                                  <p className="text-[var(--text-muted)] text-xs">
                                    {Number(roll.area_covered_sqm).toFixed(2)}{" "}
                                    m²
                                  </p>
                                )}
                                {roll.material_moved_tonnes && (
                                  <p className="text-[var(--text-muted)] text-xs">
                                    {roll.material_moved_tonnes.toFixed(1)}{" "}
                                    tonnes
                                  </p>
                                )}
                              </div>
                            </div>
                          </GlassCard>
                        ))}
                      </div>
                    )}

                    {nightRolls.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-medium text-indigo-400 flex items-center gap-1.5 ml-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          Night Shift
                        </h5>
                        {nightRolls.map((roll) => (
                          <GlassCard key={roll.id} className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[var(--text-heading)] font-medium">
                                  {Array.isArray(roll.machine)
                                    ? roll.machine[0]?.name
                                    : roll.machine?.name}
                                </p>
                                <p className="text-[var(--text-muted)] text-xs">
                                  {roll.operator?.full_name} • Night shift
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[var(--accent-cyan)] font-medium">
                                  {roll.blade_passes} passes
                                </p>
                                {roll.area_covered_sqm > 0 && (
                                  <p className="text-[var(--text-muted)] text-xs">
                                    {Number(roll.area_covered_sqm).toFixed(2)}{" "}
                                    m²
                                  </p>
                                )}
                                {roll.material_moved_tonnes && (
                                  <p className="text-[var(--text-muted)] text-xs">
                                    {roll.material_moved_tonnes.toFixed(1)}{" "}
                                    tonnes
                                  </p>
                                )}
                              </div>
                            </div>
                          </GlassCard>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
    </div>
  );
}
