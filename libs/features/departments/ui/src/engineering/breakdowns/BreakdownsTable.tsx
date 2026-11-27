'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Breakdown } from './types';

interface BreakdownsTableProps {
  breakdowns: Breakdown[];
  showStatus: boolean;
}

const SEARCH_INPUT_CLASS =
  'gold-steel-border gold-steel-border-slim w-full rounded-lg py-2 pr-3 pl-10 text-[var(--text-heading)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none';

const SELECT_FILTER_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-lg px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none';

const REFRESH_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg bg-white/90 px-3.5 py-2 font-medium text-[var(--text-heading)] text-sm shadow-2xs transition-all hover:bg-white';

const TH_CLASS =
  'px-4 py-3 text-left font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';

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

  // #12 Omit empty "No records found." block cleanly when overview table has zero rows
  if (!showStatus && filtered.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showStatus && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              aria-label="Search breakdown records"
              placeholder="Search Fleet ID, Machine Type or Reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={SEARCH_INPUT_CLASS}
            />
          </div>
          <select
            aria-label="Filter breakdown status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={SELECT_FILTER_CLASS}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <button type="button" onClick={() => router.refresh()} className={REFRESH_BTN_CLASS}>
            <RefreshCw className="h-4 w-4 text-accent-gold" aria-hidden="true" />
            Refresh
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <GoldenPanel noBodyPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Machine breakdowns ledger">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  <th scope="col" className={TH_CLASS}>
                    Fleet ID
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Machine
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Type
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Date In
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Date Out
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Duration
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Reason
                  </th>
                  {showStatus && (
                    <th scope="col" className={TH_CLASS}>
                      Status
                    </th>
                  )}
                  <th scope="col" className={TH_CLASS}>
                    Record
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className={cn(
                      'transition-colors hover:bg-white/60',
                      b.missing_book_in && 'border-l-2 border-l-sky-600'
                    )}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-dept-engineering">
                      {b.fleet_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                      {b.machine_name || b.fleet_id}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{b.machine_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)] text-xs">
                      {b.date_in}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)] text-xs">
                      {b.date_out || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {b.status === 'completed' ? (
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2 py-0.5 font-medium text-emerald-800 text-xs">
                          {calcDuration(b)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-[var(--text-secondary)]">
                      {b.reason}
                    </td>
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
        </GoldenPanel>
      )}

      {/* Count */}
      {showStatus && (
        <div className="text-[var(--text-secondary)] text-xs">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''} found
        </div>
      )}
    </div>
  );
}
