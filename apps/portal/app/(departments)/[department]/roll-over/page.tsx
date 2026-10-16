import { DozerRollForm } from '@repo/departments/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';

export default async function RollOverPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch dozers with site info (centralised fleet)
  const { data: dozers } = await supabase
    .from('machines')
    .select('id, name, serial_number, site_id, sites(name)')
    .eq('machine_type', 'Dozer')
    .eq('active', true)
    .order('name');

  const dozerIds = (dozers ?? []).map((d) => d.id);

  // Fetch today's roll data and Dozer SMR machine_operations — include site via machine join
  const [{ data: todayRolls }, { data: todayDozerOps }] = await Promise.all([
    supabase
      .from('dozer_rolls')
      .select('*, machine:machines(name, site_id, sites(name)), operator:operators(full_name)')
      .eq('department_id', deptId)
      .eq('roll_date', today),
    dozerIds.length > 0
      ? supabase
          .from('machine_operations')
          .select(
            'id, machine_id, shift_type, hours_worked, start_smu, end_smu, machine:machines(name, site_id, sites(name)), operator:operators(full_name), site:sites(name)'
          )
          .eq('department_id', deptId)
          .eq('shift_date', today)
          .in('machine_id', dozerIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Combine dozer_rolls and Dozer machine_operations (avoid double-counting hours for same machine + shift)
  const rollKeySet = new Set(
    (todayRolls ?? []).map((r) => `${r.machine_id}:${r.shift_type || 'day'}`)
  );
  const derivedRollsFromOps = (todayDozerOps ?? [])
    .filter((op) => !rollKeySet.has(`${op.machine_id}:${op.shift_type || 'day'}`))
    .map((op) => {
      const siteRel = op.site as { name: string } | { name: string }[] | null | undefined;
      return {
        id: `op-${op.id}`,
        machine_id: op.machine_id,
        shift_type: op.shift_type || 'day',
        blade_passes: 0,
        push_count: 0,
        hours_operated: Number(op.hours_worked) || 0,
        area_covered_sqm: 0,
        material_moved_tonnes: null as number | null,
        machine: op.machine,
        operator: op.operator,
        site_override: Array.isArray(siteRel) ? siteRel[0]?.name : siteRel?.name,
      };
    });

  const combinedRolls = [
    ...(todayRolls ?? []).map((r) => ({ ...r, site_override: undefined as string | undefined })),
    ...derivedRollsFromOps,
  ];

  const totalPasses = combinedRolls.reduce((sum, r) => sum + (r.blade_passes || 0), 0);
  const totalPushes = combinedRolls.reduce((sum, r) => sum + (r.push_count || 0), 0);
  const totalHours = combinedRolls.reduce((sum, r) => sum + (Number(r.hours_operated) || 0), 0);
  const totalRolloverBcm = totalHours * 250;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium text-[var(--text-heading)]">Roll Over (Dozers)</h2>
        <p className="text-[var(--text-muted)] text-sm">
          {new Date().toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Total Roll-over (BCM)</p>
          <p className="text-2xl font-semibold font-mono text-[var(--accent-blue)] mt-1">
            {Number(totalRolloverBcm.toFixed(1)).toLocaleString()} BCM
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            {totalHours.toFixed(1)}h &times; 250 BCM/h
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Hours Operated</p>
          <p className="text-2xl font-medium text-accent-green mt-1">{totalHours.toFixed(1)}h</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Blade Passes</p>
          <p className="text-2xl font-medium text-[var(--accent-blue)] mt-1">
            {totalPasses.toLocaleString()}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Push Count</p>
          <p className="text-2xl font-medium text-[var(--accent-blue)] mt-1">
            {totalPushes.toLocaleString()}
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
      <DozerRollForm departmentId={deptId} dozers={dozers || []} today={today} />

      {/* Roll List — grouped by site → shift */}
      {combinedRolls.length > 0 &&
        (() => {
          // Build site map
          type RollRow = (typeof combinedRolls)[number];
          const siteMap = new Map<string, { siteName: string; rolls: RollRow[] }>();

          for (const roll of combinedRolls) {
            const machine = Array.isArray(roll.machine) ? roll.machine[0] : roll.machine;
            const siteId = (machine as { site_id?: string | null } | null)?.site_id ?? '__none__';
            const sites = (machine as { sites?: { name: string }[] | null } | null)?.sites;
            const siteName =
              roll.site_override ??
              (Array.isArray(sites) ? sites[0]?.name : null) ??
              'No Site Assigned';

            if (!siteMap.has(siteId)) {
              siteMap.set(siteId, { siteName, rolls: [] });
            }
            siteMap.get(siteId)!.rolls.push(roll);
          }

          const siteEntries = Array.from(siteMap.entries()).sort(([a], [b]) => {
            if (a === '__none__') return 1;
            if (b === '__none__') return -1;
            return 0;
          });

          return (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-[var(--text-heading)]">Today&apos;s Rolls</h3>

              {siteEntries.map(([siteKey, { siteName, rolls }]) => {
                const sitePasses = rolls.reduce((sum, r) => sum + (r.blade_passes || 0), 0);
                const siteHours = rolls.reduce(
                  (sum, r) => sum + (Number(r.hours_operated) || 0),
                  0
                );
                const siteRolloverBcm = siteHours * 250;
                const dayRolls = rolls.filter((r) => r.shift_type === 'day');
                const nightRolls = rolls.filter((r) => r.shift_type === 'night');

                return (
                  <div key={siteKey} className="space-y-3">
                    {/* Site header */}
                    <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                      <h4 className="text-base font-medium text-[var(--text-heading)] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-blue)]" />
                        {siteName}
                      </h4>
                      <div className="flex items-center gap-4 text-xs">
                        {siteRolloverBcm > 0 && (
                          <span className="text-[var(--accent-blue)] font-semibold font-mono">
                            Roll-over: {Number(siteRolloverBcm.toFixed(1)).toLocaleString()} BCM
                          </span>
                        )}
                        {sitePasses > 0 && (
                          <span className="text-[var(--accent-blue)] font-medium">
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
                        {dayRolls.map((roll) => {
                          const rollHours = Number(roll.hours_operated) || 0;
                          const rollBcm = rollHours * 250;
                          return (
                            <GlassCard key={roll.id} className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[var(--text-heading)] font-medium">
                                    {Array.isArray(roll.machine)
                                      ? roll.machine[0]?.name
                                      : roll.machine?.name}
                                  </p>
                                  <p className="text-[var(--text-muted)] text-xs">
                                    {(Array.isArray(roll.operator)
                                      ? roll.operator[0]?.full_name
                                      : roll.operator?.full_name) || 'Unassigned'}{' '}
                                    • Day shift • {rollHours.toFixed(1)}h worked
                                  </p>
                                </div>
                                <div className="text-right space-y-0.5">
                                  <p className="text-[var(--accent-blue)] font-semibold font-mono text-sm">
                                    Roll-over: {Number(rollBcm.toFixed(1)).toLocaleString()} BCM
                                  </p>
                                  {roll.blade_passes > 0 && (
                                    <p className="text-[var(--text-muted)] text-xs">
                                      {roll.blade_passes} passes
                                    </p>
                                  )}
                                  {roll.area_covered_sqm > 0 && (
                                    <p className="text-[var(--text-muted)] text-xs">
                                      {Number(roll.area_covered_sqm).toFixed(2)} m²
                                    </p>
                                  )}
                                </div>
                              </div>
                            </GlassCard>
                          );
                        })}
                      </div>
                    )}

                    {nightRolls.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-medium text-indigo-400 flex items-center gap-1.5 ml-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          Night Shift
                        </h5>
                        {nightRolls.map((roll) => {
                          const rollHours = Number(roll.hours_operated) || 0;
                          const rollBcm = rollHours * 250;
                          return (
                            <GlassCard key={roll.id} className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[var(--text-heading)] font-medium">
                                    {Array.isArray(roll.machine)
                                      ? roll.machine[0]?.name
                                      : roll.machine?.name}
                                  </p>
                                  <p className="text-[var(--text-muted)] text-xs">
                                    {(Array.isArray(roll.operator)
                                      ? roll.operator[0]?.full_name
                                      : roll.operator?.full_name) || 'Unassigned'}{' '}
                                    • Night shift • {rollHours.toFixed(1)}h worked
                                  </p>
                                </div>
                                <div className="text-right space-y-0.5">
                                  <p className="text-[var(--accent-blue)] font-semibold font-mono text-sm">
                                    Roll-over: {Number(rollBcm.toFixed(1)).toLocaleString()} BCM
                                  </p>
                                  {roll.blade_passes > 0 && (
                                    <p className="text-[var(--text-muted)] text-xs">
                                      {roll.blade_passes} passes
                                    </p>
                                  )}
                                  {roll.area_covered_sqm > 0 && (
                                    <p className="text-[var(--text-muted)] text-xs">
                                      {Number(roll.area_covered_sqm).toFixed(2)} m²
                                    </p>
                                  )}
                                </div>
                              </div>
                            </GlassCard>
                          );
                        })}
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
