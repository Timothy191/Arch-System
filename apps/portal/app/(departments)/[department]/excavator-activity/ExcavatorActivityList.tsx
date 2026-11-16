'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { memo, useMemo } from 'react';
import { isRegularMachineExcavatorActivity } from '../hourly-loads/loads-utils';

const SHIFT_HOURS = 12;

interface ExcavatorActivity {
  id: string;
  machine_id: string;
  operator_id: string | null;
  activity_date: string;
  shift_type: 'day' | 'night';
  passes: number;
  loads: number;
  notes: string | null;
  site_id: string | null;
  block_mined_id: string | null;
  material_type?: string | null;
  machine?: { name: string } | null;
  operator?: { full_name: string } | null;
  site?: { name: string } | null;
  block_mined?: { name: string; code: string } | null;
}

interface DumperAssignment {
  id: string;
  excavator_activity_id: string;
  dumper_machine_id: string;
  material_type: string;
  total_loads: number;
  total_bcm: number | null;
  notes: string | null;
  dumper?: {
    name: string;
    bin_factor: number | null;
    machine_type: string;
  } | null;
}

interface ExcavatorActivityListProps {
  todayActivity: ExcavatorActivity[];
  todayAssignments: DumperAssignment[];
}

export const ExcavatorActivityList = memo(function ExcavatorActivityList({
  todayActivity,
  todayAssignments,
}: ExcavatorActivityListProps) {
  // Bolt Optimization: Pre-index todayAssignments into a Map by excavator_activity_id.
  // Replaces O(A * D) nested array filtering across activities and sites with O(1) Map lookups.
  const assignmentsByActivityId = useMemo(() => {
    const map = new Map<string, DumperAssignment[]>();
    for (const assignment of todayAssignments) {
      const list = map.get(assignment.excavator_activity_id);
      if (list) {
        list.push(assignment);
      } else {
        map.set(assignment.excavator_activity_id, [assignment]);
      }
    }
    return map;
  }, [todayAssignments]);

  // Bolt Optimization: Group activities and pre-aggregate shift operations and site totals in useMemo.
  // Consolidates site grouping, shift splitting, and assignment metric rollups into a single pass,
  // completely eliminating per-render .flatMap(), multiple .reduce(), and .filter() calls in JSX.
  const siteEntries = useMemo(() => {
    interface SiteGroup {
      siteName: string;
      dayOps: ExcavatorActivity[];
      nightOps: ExcavatorActivity[];
      siteBcm: number;
      siteLoads: number;
    }
    const siteMap = new Map<string, SiteGroup>();

    for (const activity of todayActivity) {
      const siteKey = activity.site_id ?? '__none__';
      const siteName = activity.site?.name ?? 'No Site Assigned';
      let siteGroup = siteMap.get(siteKey);
      if (!siteGroup) {
        siteGroup = {
          siteName,
          dayOps: [],
          nightOps: [],
          siteBcm: 0,
          siteLoads: 0,
        };
        siteMap.set(siteKey, siteGroup);
      }

      if (activity.shift_type === 'day') {
        siteGroup.dayOps.push(activity);
      } else {
        siteGroup.nightOps.push(activity);
      }

      const assignments = assignmentsByActivityId.get(activity.id);
      if (assignments) {
        for (const assignment of assignments) {
          siteGroup.siteBcm += assignment.total_bcm || 0;
          siteGroup.siteLoads += assignment.total_loads || 0;
        }
      }
    }

    // Put "No Site Assigned" last
    return Array.from(siteMap.entries()).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return 0;
    });
  }, [todayActivity, assignmentsByActivityId]);

  return (
    <div className="space-y-6">
      <h3 className="font-medium text-[var(--text-heading)] text-lg">Today&apos;s Activity</h3>

      {siteEntries.map(([siteKey, { siteName, dayOps, nightOps, siteBcm, siteLoads }]) => (
        <div key={siteKey} className="space-y-3">
          {/* Site header */}
          <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-2">
            <h4 className="flex items-center gap-2 font-medium text-[var(--text-heading)] text-base">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-blue)]" />
              {siteName}
            </h4>
            <div className="flex items-center gap-4 text-[var(--text-muted)] text-xs">
              {siteBcm > 0 && (
                <span className="font-medium text-accent-green">{siteBcm.toFixed(1)} BCM</span>
              )}
              {siteLoads > 0 && (
                <span className="font-medium text-[var(--accent-blue)]">
                  {siteLoads.toLocaleString()} loads
                </span>
              )}
            </div>
          </div>

          {/* Day shift */}
          {dayOps.length > 0 && (
            <div className="space-y-2">
              <h5 className="ml-4 flex items-center gap-1.5 font-medium text-accent-blue text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
                Day Shift
              </h5>
              <div className="space-y-2">
                {dayOps.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    assignments={assignmentsByActivityId.get(activity.id) || []}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Night shift */}
          {nightOps.length > 0 && (
            <div className="space-y-2">
              <h5 className="ml-4 flex items-center gap-1.5 font-medium text-indigo-400 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Night Shift
              </h5>
              <div className="space-y-2">
                {nightOps.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    assignments={assignmentsByActivityId.get(activity.id) || []}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

const SHIFT_BADGE_CLASSES: Record<ExcavatorActivity['shift_type'], string> = {
  day: 'bg-accent-blue/20 text-accent-blue',
  night: 'bg-accent-blue/20 text-accent-blue',
};

const SHIFT_LABELS: Record<ExcavatorActivity['shift_type'], string> = {
  day: 'Day',
  night: 'Night',
};

function computeActivityMetrics(assignments: DumperAssignment[]) {
  // Bolt Optimization: Single-pass accumulation of BCM and loads to avoid multiple array iterations.
  let totalBcm = 0;
  let totalLoads = 0;
  for (const assignment of assignments) {
    totalBcm += assignment.total_bcm || 0;
    totalLoads += assignment.total_loads || 0;
  }
  const bcmPerHour = totalBcm > 0 ? totalBcm / SHIFT_HOURS : 0;
  const loadsPerHour = totalLoads > 0 ? totalLoads / SHIFT_HOURS : 0;
  const estimatedScoopMinutes = totalLoads > 0 ? (SHIFT_HOURS * 60) / totalLoads : 0;
  return { totalBcm, totalLoads, bcmPerHour, loadsPerHour, estimatedScoopMinutes };
}

function ActivityCardHeader({
  activity,
  isRegularMachine,
}: {
  activity: ExcavatorActivity;
  isRegularMachine: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-[var(--text-heading)]">
          {activity.machine?.name || 'Unknown Excavator'}
        </p>
        <div
          data-testid={`activity-card-separator-${activity.machine?.name || activity.id}`}
          aria-hidden="true"
          className="my-1 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
        />
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[var(--text-muted)] text-xs">
          <span>{activity.operator?.full_name || 'No Operator'}</span>
          <span className="text-[var(--border-emphasis)]">|</span>
          <span>{activity.site?.name || 'No Site'}</span>
          {activity.block_mined && (
            <>
              <span className="text-[var(--border-emphasis)]">|</span>
              <span className="text-accent-blue">Block {activity.block_mined.code}</span>
            </>
          )}
          {isRegularMachine && (
            <>
              <span className="text-[var(--border-emphasis)]">|</span>
              <span className="font-semibold text-accent-green">
                Regular Machine ({activity.material_type})
              </span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <span
          className={`inline-block rounded px-2 py-0.5 font-medium text-xs ${SHIFT_BADGE_CLASSES[activity.shift_type]}`}
        >
          {SHIFT_LABELS[activity.shift_type]} Shift
        </span>
      </div>
    </div>
  );
}

function DumperAssignmentsSection({
  activity,
  assignments,
  isRegularMachine,
  totalLoads,
  totalBcm,
}: {
  activity: ExcavatorActivity;
  assignments: DumperAssignment[];
  isRegularMachine: boolean;
  totalLoads: number;
  totalBcm: number;
}) {
  if (assignments.length > 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-[var(--border-default)] border-b">
              <th
                scope="col"
                className="px-2 py-1.5 text-left font-medium text-[var(--text-muted)] text-xs"
              >
                Dumper
              </th>
              <th
                scope="col"
                className="px-2 py-1.5 text-left font-medium text-[var(--text-muted)] text-xs"
              >
                Material
              </th>
              <th
                scope="col"
                className="px-2 py-1.5 text-right font-medium text-[var(--text-muted)] text-xs"
              >
                Loads
              </th>
              <th
                scope="col"
                className="px-2 py-1.5 text-right font-medium text-[var(--text-muted)] text-xs"
              >
                BCM
              </th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-[var(--border-default)]/30 border-b">
                <td className="px-2 py-1.5 text-[var(--text-heading)]">
                  {assignment.dumper?.name || 'Unknown'}
                  <span className="ml-1 text-[var(--text-muted)] text-xs">
                    ({assignment.dumper?.machine_type || ''})
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[var(--text-muted)]">{assignment.material_type}</td>
                <td className="px-2 py-1.5 text-right text-[var(--text-heading)]">
                  {assignment.total_loads}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-[var(--accent-blue)]">
                  {(assignment.total_bcm || 0).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-[var(--border-default)] border-t">
              <td
                colSpan={2}
                className="px-2 py-1.5 font-medium text-[var(--text-heading)] text-xs"
              >
                Total
              </td>
              <td className="px-2 py-1.5 text-right font-medium text-[var(--text-heading)] text-xs">
                {totalLoads}
              </td>
              <td className="px-2 py-1.5 text-right font-medium text-[var(--accent-blue)] text-xs">
                {totalBcm.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }
  if (isRegularMachine) {
    return (
      <p className="py-2 text-center font-medium text-accent-green text-sm">
        Logged as regular machine ({activity.material_type})
      </p>
    );
  }
  return <p className="py-2 text-center text-[var(--text-muted)] text-sm">No dumper assignments</p>;
}

function MetricsRow({
  bcmPerHour,
  loadsPerHour,
  estimatedScoopMinutes,
}: {
  bcmPerHour: number;
  loadsPerHour: number;
  estimatedScoopMinutes: number;
}) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-muted)]">BCM/h:</span>
        <span className="font-medium text-accent-blue">{bcmPerHour.toFixed(1)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-muted)]">Loads/h:</span>
        <span className="font-medium text-accent-green">{loadsPerHour.toFixed(1)}</span>
      </div>
      {estimatedScoopMinutes > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-muted)]">Scoop time:</span>
          <span className="font-medium text-[var(--text-heading)]">
            {estimatedScoopMinutes.toFixed(1)} min/load
          </span>
        </div>
      )}
    </div>
  );
}

function ActivityNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;
  return (
    <p className="border-[var(--border-default)]/50 border-t pt-2 text-[var(--text-muted)] text-xs italic">
      {notes}
    </p>
  );
}

const ActivityCard = memo(function ActivityCard({
  activity,
  assignments,
}: {
  activity: ExcavatorActivity;
  assignments: DumperAssignment[];
}) {
  const { totalBcm, totalLoads, bcmPerHour, loadsPerHour, estimatedScoopMinutes } =
    computeActivityMetrics(assignments);
  const isRegularMachine = isRegularMachineExcavatorActivity(activity.material_type);

  return (
    <GlassCard className="py-4">
      <div className="space-y-3">
        <ActivityCardHeader activity={activity} isRegularMachine={isRegularMachine} />
        <DumperAssignmentsSection
          activity={activity}
          assignments={assignments}
          isRegularMachine={isRegularMachine}
          totalLoads={totalLoads}
          totalBcm={totalBcm}
        />
        <MetricsRow
          bcmPerHour={bcmPerHour}
          loadsPerHour={loadsPerHour}
          estimatedScoopMinutes={estimatedScoopMinutes}
        />
        <ActivityNotes notes={activity.notes} />
      </div>
    </GlassCard>
  );
});
