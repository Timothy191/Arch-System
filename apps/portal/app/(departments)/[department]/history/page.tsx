import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import Form from 'next/form';
import Link from 'next/link';
import { withCache } from '@/lib/cache-utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getPlantProcessingWorkspaceData } from '~/features/departments/components/plant-processing/actions';
import { PlantHistoryDatabaseClient } from '~/features/departments/components/plant-processing/PlantHistoryDatabaseClient';
import { getDepartmentContext } from '~/lib/dept-context';

const DEFAULT_HISTORY_WINDOW_DAYS = 30;
const MS_PER_DAY = 86_400_000;
const MINUTES_PER_HOUR = 60;
const CONTROL_ROOM_DEPT_TYPE = 'control_room';
const EMPTY_TABLE_COL_SPAN_CONTROL_ROOM = 7;
const EMPTY_TABLE_COL_SPAN_STANDARD = 4;

interface CloserProfile {
  readonly full_name: string | null;
}

interface ControlRoomShiftStatusRow {
  readonly shift_date: string;
  readonly shift_type: string;
  readonly status: string;
  readonly closed_at: string | null;
  readonly closer: CloserProfile | CloserProfile[] | null;
}

interface ControlRoomOperationRow {
  readonly shift_date: string;
  readonly shift_type: string;
  readonly hours_worked: number | null;
  readonly delay_entries?: ReadonlyArray<{
    readonly duration_hours: number | null;
    readonly deleted_at: string | null;
  }> | null;
}

interface DailyLogHistoryRow {
  readonly id: string;
  readonly log_date: string;
  readonly shift: string;
  readonly notes: string | null;
  readonly created_at: string;
}

type CachedDepartmentHistoryPayload =
  | {
      readonly kind: 'control_room';
      readonly shiftStatuses: ControlRoomShiftStatusRow[];
      readonly hoursByShift: Record<string, number>;
      readonly delayMinutesByShift: Record<string, number>;
      readonly loadsByShift: Record<string, number>;
    }
  | {
      readonly kind: 'standard';
      readonly logs: DailyLogHistoryRow[];
    };

interface LoadDepartmentHistoryOptions {
  readonly deptId: string;
  readonly isControlRoom: boolean;
  readonly from: string;
  readonly to: string;
}

interface GetCachedDepartmentHistoryOptions extends LoadDepartmentHistoryOptions {
  readonly deptSlug: string;
}

function buildShiftKey(shiftDate: string, shiftType: string): string {
  return `${shiftDate}|${shiftType}`;
}

async function loadDepartmentHistory({
  deptId,
  isControlRoom,
  from,
  to,
}: LoadDepartmentHistoryOptions): Promise<CachedDepartmentHistoryPayload> {
  const db = await createReadReplicaClient([]);

  if (isControlRoom) {
    const [{ data: shiftStatuses }, { data: operations }, { data: loads }] = await Promise.all([
      db
        .from('shift_status')
        .select(
          'shift_date, shift_type, status, closed_at, closer:employees!closed_by(full_name), approver:employees!approved_by(full_name)'
        )
        .eq('department_id', deptId)
        .gte('shift_date', from)
        .lte('shift_date', to)
        .order('shift_date', { ascending: false }),
      db
        .from('machine_operations')
        .select(
          'shift_date, shift_type, hours_worked, delay_entries:delay_entries(duration_hours, deleted_at)'
        )
        .eq('department_id', deptId)
        .gte('shift_date', from)
        .lte('shift_date', to),
      db
        .from('hourly_loads')
        .select('load_date, shift_type, total_loads')
        .eq('department_id', deptId)
        .gte('load_date', from)
        .lte('load_date', to),
    ]);

    const hoursByShift: Record<string, number> = {};
    const delayMinutesByShift: Record<string, number> = {};
    for (const operation of (operations ?? []) as unknown as ControlRoomOperationRow[]) {
      const shiftKey = buildShiftKey(operation.shift_date, operation.shift_type);
      hoursByShift[shiftKey] = (hoursByShift[shiftKey] ?? 0) + (operation.hours_worked || 0);
      const delayEntries = operation.delay_entries ?? [];
      const delayMinutes = delayEntries
        .filter((entry) => !entry.deleted_at)
        .reduce((sum, entry) => sum + (Number(entry.duration_hours) || 0) * MINUTES_PER_HOUR, 0);
      delayMinutesByShift[shiftKey] = (delayMinutesByShift[shiftKey] ?? 0) + delayMinutes;
    }

    const loadsByShift: Record<string, number> = {};
    for (const loadRow of loads ?? []) {
      const shiftKey = buildShiftKey(loadRow.load_date, loadRow.shift_type);
      loadsByShift[shiftKey] = (loadsByShift[shiftKey] ?? 0) + (loadRow.total_loads || 0);
    }

    return {
      kind: 'control_room',
      shiftStatuses: (shiftStatuses ?? []) as ControlRoomShiftStatusRow[],
      hoursByShift,
      delayMinutesByShift,
      loadsByShift,
    };
  }

  const { data: logs } = await db
    .from('daily_logs')
    .select('id, log_date, shift, notes, created_at')
    .eq('department_id', deptId)
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date', { ascending: false })
    .returns<DailyLogHistoryRow[]>();

  return {
    kind: 'standard',
    logs: logs ?? [],
  };
}

/**
 * Dual-tier cached department history query.
 * Route params, searchParams, and date-range defaults stay outside `'use cache'`.
 */
async function getCachedDepartmentHistory({
  deptId,
  deptSlug,
  isControlRoom,
  from,
  to,
}: GetCachedDepartmentHistoryOptions): Promise<CachedDepartmentHistoryPayload> {
  'use cache';

  const historyTag = tagDepartment(deptSlug, 'history');
  const cacheTags = [
    historyTag,
    'table:daily_logs',
    'table:machine_operations',
    ...(isControlRoom ? ['table:hourly_loads', 'table:delay_entries', 'table:shift_status'] : []),
  ];

  cacheLife('reports');

  cacheTag(historyTag);
  cacheTag('table:daily_logs');
  cacheTag('table:machine_operations');
  if (isControlRoom) {
    cacheTag('table:hourly_loads');
    cacheTag('table:delay_entries');
    cacheTag('table:shift_status');
  }

  return withCache(() => loadDepartmentHistory({ deptId, isControlRoom, from, to }), {
    category: CacheCategory.METRICS,
    keyParts: ['dept-history-v1', deptId, isControlRoom ? 'cr' : 'std', from, to],
    tags: cacheTags,
  });
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { department: deptSlug } = await params;
  const { from: fromParam, to: toParam } = await searchParams;
  const { dept, deptId, today } = await getDepartmentContext({
    department: deptSlug,
  });

  if (deptSlug === 'plant-inventory') {
    return <PlantInventoryWorkspaceClient mode="stock-required" today={today} />;
  }

  if (deptSlug === 'plant-processing') {
    const plantData = await getPlantProcessingWorkspaceData(today);
    return (
      <PlantHistoryDatabaseClient
        initialDate={plantData.currentDate}
        initialSheets={plantData.initialSheets}
        initialDelays={plantData.initialDelays}
      />
    );
  }

  const defaultFrom =
    new Date(new Date(`${today}T00:00:00Z`).getTime() - DEFAULT_HISTORY_WINDOW_DAYS * MS_PER_DAY)
      .toISOString()
      .split('T')[0] ?? today;
  const to = toParam || today;
  const from = fromParam || defaultFrom;

  const isControlRoom = dept.type === CONTROL_ROOM_DEPT_TYPE;
  const historyResult = await getCachedDepartmentHistory({
    deptId,
    deptSlug,
    isControlRoom,
    from,
    to,
  });

  const dateFilter = (
    <GlassCard>
      <Form action="" className="flex items-end gap-4">
        <div>
          <label className="mb-1 block text-[var(--text-muted)] text-sm">From</label>
          <Input type="date" name="from" defaultValue={from} className="px-4 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-[var(--text-muted)] text-sm">To</label>
          <Input type="date" name="to" defaultValue={to} className="px-4 py-2" />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--bg-tertiary)] px-4 py-2 font-medium text-[var(--text-heading)] text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
        >
          Filter
        </button>
      </Form>
    </GlassCard>
  );

  // ─── Control Room branch ───────────────────────────────────────────────────
  if (historyResult.kind === 'control_room') {
    const { shiftStatuses, hoursByShift, delayMinutesByShift, loadsByShift } = historyResult;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Shift History</h2>
          <Link
            href={`/${deptSlug}/reports?from=${from}&to=${to}`}
            className="rounded-lg bg-[var(--bg-tertiary)] px-4 py-2 font-medium text-[var(--accent-blue)] text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            Export CSV
          </Link>
        </div>

        {dateFilter}

        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-[var(--border-default)] border-b">
                  {[
                    { label: 'Date', align: '' },
                    { label: 'Shift', align: '' },
                    { label: 'Status', align: '' },
                    { label: 'Hours', align: 'text-right' },
                    { label: 'Loads', align: 'text-right' },
                    { label: 'Delay (min)', align: 'text-right' },
                    { label: 'Closed By', align: '' },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      scope="col"
                      className={`px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider ${align}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {shiftStatuses.map((ss) => {
                  const shiftKey = buildShiftKey(ss.shift_date, ss.shift_type);
                  const closer = Array.isArray(ss.closer) ? ss.closer[0] : ss.closer;
                  return (
                    <tr key={shiftKey} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                      <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                        {ss.shift_date}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${
                            ss.shift_type === 'day'
                              ? 'bg-accent-blue/10 text-accent-blue'
                              : 'bg-indigo-500/10 text-indigo-400'
                          }`}
                        >
                          {ss.shift_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold text-xs ${
                            ss.status === 'closed'
                              ? 'border-emerald-200/50 bg-emerald-50/70 text-emerald-700'
                              : 'border-amber-200/50 bg-amber-50/70 text-amber-700'
                          }`}
                        >
                          {ss.status === 'closed' && (
                            <span className="badge-pulse-dot bg-emerald-500" />
                          )}
                          {ss.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--text-muted)] text-sm">
                        {(hoursByShift[shiftKey] ?? 0).toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--accent-blue)] text-sm">
                        {(loadsByShift[shiftKey] ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-accent-blue text-sm">
                        {delayMinutesByShift[shiftKey] ?? 0}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-xs">
                        {closer?.full_name || '—'}
                        {ss.closed_at && (
                          <span className="block text-[10px] opacity-60">
                            {new Date(ss.closed_at).toLocaleString('en-ZA')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {shiftStatuses.length === 0 && (
                  <tr>
                    <td
                      colSpan={EMPTY_TABLE_COL_SPAN_CONTROL_ROOM}
                      className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                    >
                      No shift records found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Generic department branch ────────────────────────────────────────────
  const { logs } = historyResult;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-2xl text-[var(--text-heading)]">History</h2>
        <Link
          href={`/${deptSlug}/reports?from=${from}&to=${to}`}
          className="rounded-lg bg-[var(--bg-tertiary)] px-4 py-2 font-medium text-[var(--accent-blue)] text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
        >
          Export CSV
        </Link>
      </div>

      {dateFilter}

      {/* Logs Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b">
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Shift
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Notes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                  <td className="px-6 py-4 text-[var(--text-heading)] text-sm">{log.log_date}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${
                        log.shift === 'day'
                          ? 'bg-accent-blue/10 text-accent-blue'
                          : 'bg-indigo-500/10 text-indigo-400'
                      }`}
                    >
                      {log.shift}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-4 text-[var(--text-muted)] text-sm">
                    {log.notes || '—'}
                  </td>
                  <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={EMPTY_TABLE_COL_SPAN_STANDARD}
                    className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                  >
                    No logs found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
