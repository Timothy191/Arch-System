'use client';

import { Badge } from '@repo/ui';
import { RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Breakdown } from './types';

interface BreakdownsTableProps {
  breakdowns: Breakdown[];
  showStatus: boolean;
}

export function BreakdownsTable({ breakdowns, showStatus }: BreakdownsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = breakdowns.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.fleet_id.toLowerCase().includes(term) ||
      b.machine_type.toLowerCase().includes(term) ||
      b.reason.toLowerCase().includes(term)
    );
  });

  const calcDuration = (b: Breakdown): string => {
    if (!b.date_out || !b.time_out) return '—';
    const start = new Date(`${b.date_in}T${b.time_in}`);
    const end = new Date(`${b.date_out}T${b.time_out}`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '0h 0m';
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showStatus && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              placeholder="Search Fleet ID, Machine Type or Reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] py-2 pr-3 pl-10 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[#555] focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] px-3 py-2 text-[var(--text-secondary)] text-sm transition-colors hover:text-[var(--text-heading)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
            No records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-[var(--border-emphasis)] border-b">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Fleet ID
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Machine
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Date In
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Date Out
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Reason
                  </th>
                  {showStatus && (
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                    >
                      Status
                    </th>
                  )}
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                  >
                    Record
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-[var(--border-emphasis)] border-b transition-colors last:border-0 hover:bg-[var(--bg-tertiary)] ${
                      b.missing_book_in ? 'border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-violet-400">{b.fleet_id}</td>
                    <td className="px-4 py-3 text-[var(--text-heading)]">
                      {b.machine_name || b.fleet_id}
                    </td>
                    <td className="px-4 py-3 text-[#ccc]">{b.machine_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#ccc]">{b.date_in}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#ccc]">{b.date_out || '—'}</td>
                    <td className="px-4 py-3">
                      {b.status === 'completed' ? (
                        <span className="rounded-full border border-accent-green/20 bg-accent-green/10 px-2 py-0.5 text-accent-green text-xs">
                          {calcDuration(b)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#ccc]">{b.reason}</td>
                    {showStatus && (
                      <td className="px-4 py-3">
                        {b.status === 'completed' ? (
                          <Badge variant="green" contrast="low" size="sm">
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="blue" contrast="low" size="sm">
                            Pending
                          </Badge>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {b.missing_book_in ? (
                        <Badge variant="amber" contrast="low" size="sm">
                          Missing Book-In
                        </Badge>
                      ) : (
                        <span className="text-[var(--text-secondary)] text-xs">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="text-[var(--text-secondary)] text-xs">
        {filtered.length} record{filtered.length !== 1 ? 's' : ''} found
      </div>
    </div>
  );
}
