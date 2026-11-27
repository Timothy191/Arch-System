'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { MachineOperationLogItem } from './reports-types';
import {
  computeShiftActivityKpis,
  deriveShiftActivityDates,
  deriveShiftActivityRows,
  filterShiftActivityRows,
  paginateShiftActivityRows,
  SHIFT_ACTIVITY_PAGE_SIZE,
  type ShiftActivityShiftFilter,
  type ShiftActivitySortDirection,
  type ShiftActivitySortKey,
  type ShiftActivityStatusFilter,
  sortShiftActivityRows,
} from './shift-activity-utils';

const GLASS_SURFACE_CLASS =
  'liquid-glass-light gold-steel-border border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md';

const SORTABLE_COLUMNS: ReadonlyArray<{ key: ShiftActivitySortKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'shift', label: 'Shift' },
  { key: 'machineName', label: 'Machine' },
  { key: 'siteName', label: 'Site' },
  { key: 'operatorName', label: 'Operator' },
  { key: 'hoursWorked', label: 'Hours' },
  { key: 'bcmMoved', label: 'BCM' },
  { key: 'delayMinutes', label: 'Delays' },
];

export interface ShiftActivityDashboardProps {
  departmentId: string;
  logs: readonly MachineOperationLogItem[];
}

export function ShiftActivityDashboard({ departmentId, logs }: ShiftActivityDashboardProps) {
  const [shiftFilter, setShiftFilter] = useState<ShiftActivityShiftFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ShiftActivityStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const deferredSearch = useDeferredValue(searchInput);
  const [sortKey, setSortKey] = useState<ShiftActivitySortKey>('date');
  const [sortDirection, setSortDirection] = useState<ShiftActivitySortDirection>('desc');
  const [page, setPage] = useState<number>(1);

  const router = useRouter();
  const supabaseClient = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useSupabaseRealtime({
    supabaseClient,
    table: 'machine_operations',
    filter: `department_id=eq.${departmentId}`,
    event: '*',
    enabled: Boolean(supabaseClient && departmentId),
    onChange: () => router.refresh(),
  });

  const activityRows = useMemo(() => deriveShiftActivityRows(logs), [logs]);
  const availableDates = useMemo(() => deriveShiftActivityDates(activityRows), [activityRows]);

  useEffect(() => {
    setPage(1);
  }, [shiftFilter, statusFilter, dateFilter, deferredSearch, sortKey, sortDirection]);

  const filteredRows = useMemo(
    () =>
      filterShiftActivityRows(activityRows, {
        shift: shiftFilter,
        status: statusFilter,
        date: dateFilter,
        search: deferredSearch,
      }),
    [activityRows, shiftFilter, statusFilter, dateFilter, deferredSearch]
  );

  const sortedRows = useMemo(
    () => sortShiftActivityRows(filteredRows, sortKey, sortDirection),
    [filteredRows, sortKey, sortDirection]
  );

  const paginated = useMemo(
    () => paginateShiftActivityRows(sortedRows, page, SHIFT_ACTIVITY_PAGE_SIZE),
    [sortedRows, page]
  );

  const kpis = useMemo(() => computeShiftActivityKpis(filteredRows), [filteredRows]);

  const handleSort = (nextKey: ShiftActivitySortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('asc');
  };

  return (
    <section aria-label="Shift activity dashboard" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className={`${GLASS_SURFACE_CLASS} p-4`}>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            Active machines
          </p>
          <p className="font-bold text-2xl text-[var(--text-primary)]">{kpis.activeMachines}</p>
        </GlassCard>
        <GlassCard className={`${GLASS_SURFACE_CLASS} p-4`}>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">Delays</p>
          <p className="font-bold text-2xl text-[var(--text-primary)]">
            {kpis.totalDelayMinutes} min
          </p>
        </GlassCard>
        <GlassCard className={`${GLASS_SURFACE_CLASS} p-4`}>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            Production
          </p>
          <p className="font-bold text-2xl text-[var(--text-primary)]">
            {kpis.totalBcm.toFixed(0)} BCM
          </p>
        </GlassCard>
        <GlassCard className={`${GLASS_SURFACE_CLASS} p-4`}>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            Completion
          </p>
          <p className="font-bold text-2xl text-[var(--text-primary)]">{kpis.completionPercent}%</p>
        </GlassCard>
      </div>

      <GlassCard className={`${GLASS_SURFACE_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <label
            className="font-semibold text-[var(--text-secondary)] text-xs"
            htmlFor="activity-shift-filter"
          >
            Shift
          </label>
          <select
            id="activity-shift-filter"
            aria-label="Activity shift filter"
            data-testid="activity-shift-filter"
            value={shiftFilter}
            onChange={(event) => setShiftFilter(event.target.value as ShiftActivityShiftFilter)}
            className="rounded-lg border border-[var(--border-default)] bg-white px-2 py-1.5 text-[var(--text-primary)] text-sm"
          >
            <option value="all">All shifts</option>
            <option value="day">Day shift</option>
            <option value="night">Night shift</option>
          </select>

          <label
            className="font-semibold text-[var(--text-secondary)] text-xs"
            htmlFor="activity-status-filter"
          >
            Status
          </label>
          <select
            id="activity-status-filter"
            aria-label="Activity status filter"
            data-testid="activity-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ShiftActivityStatusFilter)}
            className="rounded-lg border border-[var(--border-default)] bg-white px-2 py-1.5 text-[var(--text-primary)] text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          <label
            className="font-semibold text-[var(--text-secondary)] text-xs"
            htmlFor="activity-date-filter"
          >
            Date
          </label>
          <select
            id="activity-date-filter"
            aria-label="Activity date filter"
            data-testid="activity-date-filter"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-white px-2 py-1.5 text-[var(--text-primary)] text-sm"
          >
            <option value="all">All dates</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>

          <input
            type="search"
            aria-label="Search shift activity"
            data-testid="activity-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search machine, operator, site or block"
            className="min-w-52 flex-1 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-[var(--text-primary)] text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
          <table aria-label="Shift activity" className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-black/[0.03] text-left">
                {SORTABLE_COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className="px-2.5 py-2 font-semibold">
                    <button
                      type="button"
                      aria-label={`Sort by ${column.label}`}
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-1 text-[var(--text-secondary)]"
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.rows.map((row) => (
                <tr key={row.id} className="border-[var(--border-subtle)] border-t">
                  <td className="whitespace-nowrap px-2.5 py-2 text-[var(--text-body)]">
                    {row.date}
                  </td>
                  <td className="px-2.5 py-2 text-[var(--text-body)] capitalize">{row.shift}</td>
                  <td className="px-2.5 py-2 text-[var(--text-primary)]">{row.machineName}</td>
                  <td className="px-2.5 py-2 text-[var(--text-body)]">{row.siteName}</td>
                  <td className="px-2.5 py-2 text-[var(--text-body)]">{row.operatorName}</td>
                  <td
                    className={
                      row.status === 'active'
                        ? 'px-2.5 py-2 font-semibold text-[var(--accent-green)]'
                        : 'px-2.5 py-2 text-[var(--text-secondary)]'
                    }
                  >
                    {row.status === 'active' ? 'Active' : 'Completed'}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-[var(--text-body)]">
                    {row.hoursWorked.toFixed(1)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-[var(--text-body)]">
                    {row.bcmMoved.toFixed(0)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-[var(--text-body)]">
                    {row.delayMinutes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginated.rows.length === 0 && (
            <p role="status" className="p-4 text-center text-[var(--text-secondary)]">
              No shift activity matches the current filters.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-[var(--text-secondary)] text-xs">
            Page {paginated.page} of {paginated.pageCount} · {filteredRows.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous activity page"
              disabled={paginated.page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-[var(--text-primary)] text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              aria-label="Next activity page"
              disabled={paginated.page >= paginated.pageCount}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-[var(--text-primary)] text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
