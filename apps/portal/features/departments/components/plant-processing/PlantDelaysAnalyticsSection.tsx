'use client';

import { Edit3, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PlantDelayEntry } from './types';

export interface PlantDelaysMetrics {
  totalEvents: number;
  totalMinutes: number;
  totalHours: number;
  availabilityPct: number;
  topCircuit: string;
  topMins: number;
}

export function PlantDelaysKpiRow({ metrics }: { metrics: PlantDelaysMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <div className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
          Logged Delay Events
        </div>
        <div className="mt-1 font-bold font-mono text-2xl text-[var(--text-heading)]">
          {metrics.totalEvents}
        </div>
        <div className="mt-0.5 text-[var(--text-secondary)] text-xs">
          Across Day &amp; Night wash plant shifts
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <div className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
          Cumulative Downtime
        </div>
        <div className="mt-1 font-bold font-mono text-2xl text-amber-700">
          {metrics.totalMinutes} <span className="font-normal text-sm">mins</span>
        </div>
        <div className="mt-0.5 text-[var(--text-secondary)] text-xs">
          {metrics.totalHours} hours total lost run time
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <div className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
          Plant Circuit Availability
        </div>
        <div className="mt-1 font-bold font-mono text-2xl text-emerald-700">
          {metrics.availabilityPct}%
        </div>
        <div className="mt-0.5 text-[var(--text-secondary)] text-xs">
          Target availability ≥ 92.0%
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <div className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
          Primary Bottleneck Circuit
        </div>
        <div className="mt-1 truncate font-bold text-[var(--text-heading)] text-base">
          {metrics.topCircuit}
        </div>
        <div className="mt-0.5 text-[var(--text-secondary)] text-xs">
          {metrics.topMins} mins total delay impact
        </div>
      </div>
    </div>
  );
}

interface PlantDelaysAnalyticsSectionProps {
  delays: PlantDelayEntry[];
  categoryOptions: string[];
  selectedDelayId: string | null;
  onSelectDelay: (entry: PlantDelayEntry) => void;
}

export function PlantDelaysAnalyticsSection({
  delays,
  categoryOptions,
  selectedDelayId,
  onSelectDelay,
}: PlantDelaysAnalyticsSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredDelays = useMemo(() => {
    return delays.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      const isItemOpen = !item.endTime || item.status === 'Active';
      if (statusFilter === 'OPEN' && !isItemOpen) {
        return false;
      }
      if (statusFilter === 'RESOLVED' && isItemOpen) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          item.circuit.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          item.correctiveAction.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [delays, categoryFilter, statusFilter, searchQuery]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-sm xl:col-span-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-default)] border-b px-5 py-4">
        <div>
          <h2 className="font-bold text-[var(--text-heading)] text-sm uppercase tracking-wider">
            Plant &amp; Processing Delay Database ({filteredDelays.length})
          </h2>
          <p className="text-[var(--text-secondary)] text-xs">
            Select any delay log below to pull its information into the form and update or log its
            End Time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by delay status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'RESOLVED')}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Booked In (Awaiting End Time)</option>
            <option value="RESOLVED">Resolved (End Time Logged)</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <select
              aria-label="Filter by delay category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs"
            >
              <option value="ALL">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <input
            type="search"
            aria-label="Search plant delays"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circuit or cause..."
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 text-[var(--text-heading)] text-xs"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-[var(--border-default)] border-b bg-black/[0.025] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
              <th className="px-4 py-3">Date / Shift</th>
              <th className="px-4 py-3">Circuit &amp; Category</th>
              <th className="px-4 py-3">Booked In / End Time</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3">Root Cause &amp; Corrective Action</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {filteredDelays.map((d) => {
              const isSelected = selectedDelayId === d.id;
              const isOpenDelay = !d.endTime || d.status === 'Active';
              return (
                <tr
                  key={d.id}
                  onClick={() => onSelectDelay(d)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--accent-blue)]/10' : 'hover:bg-black/[0.02]'
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono">
                    <div className="font-semibold text-[var(--text-heading)]">{d.date}</div>
                    <div className="text-[11px] text-[var(--text-muted)] uppercase">
                      {d.shift} shift
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--text-heading)]">{d.circuit}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-semibold text-[10px] text-amber-800">
                        {d.category}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">{d.impactType}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)]">
                    <div>In: {d.startTime}</div>
                    <div className="text-[11px]">
                      {d.endTime ? (
                        <span>Out: {d.endTime}</span>
                      ) : (
                        <span className="font-semibold text-amber-700">Out: Pending</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold font-mono text-amber-700">
                    {d.endTime ? `${d.durationMinutes} min` : 'Open'}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <div className="font-medium text-[var(--text-heading)]">{d.reason}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      <span className="font-semibold">Action:</span> {d.correctiveAction}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase ${
                        d.status === 'Resolved' && d.endTime
                          ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-800'
                          : 'border border-amber-500/30 bg-amber-500/15 text-amber-800'
                      }`}
                    >
                      {isOpenDelay ? 'Booked In (Open)' : d.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDelay(d);
                      }}
                      data-testid={`select-delay-${d.id}`}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold text-[11px] transition-colors ${
                        isOpenDelay
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25'
                          : 'border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.04]'
                      }`}
                    >
                      <Edit3 className="h-3 w-3" />
                      {isOpenDelay ? 'Log End Time' : 'Select / Update'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
