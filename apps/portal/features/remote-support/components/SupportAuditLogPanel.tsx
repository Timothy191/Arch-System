'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Download, History, Search } from 'lucide-react';
import { useState } from 'react';
import { sanitizeCsvCell } from '@/lib/api/csv-utils';
import type { SupportAuditEventView } from '../types/remote-support-ui';

export interface SupportAuditLogPanelProps {
  readonly events: readonly SupportAuditEventView[];
}

export function SupportAuditLogPanel({ events }: SupportAuditLogPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  const filtered = events.filter((event) => {
    if (eventFilter !== 'all' && event.event_type !== eventFilter) return false;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      event.event_type.toLowerCase().includes(query) ||
      event.session_id.toLowerCase().includes(query) ||
      (event.actor_employee_id ?? '').toLowerCase().includes(query)
    );
  });

  const handleExportCsv = () => {
    const header = [
      'id',
      'created_at',
      'event_type',
      'session_id',
      'actor_employee_id',
      'metadata',
    ];
    const lines = filtered.map((row) =>
      [
        row.id,
        row.created_at,
        row.event_type,
        row.session_id,
        row.actor_employee_id ?? '',
        JSON.stringify(row.metadata ?? {}),
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `remote-support-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <GlassCard className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--accent-blue)]" />
          <h3 className="font-semibold text-[var(--text-heading)] text-sm">
            Immutable Remote Support Audit Trail
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by session or event…"
              className="h-8 rounded-lg border border-black/10 bg-white pr-3 pl-8 text-xs"
            />
          </div>

          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs"
          >
            <option value="all">All Events</option>
            <option value="session_created">session_created</option>
            <option value="consent_granted">consent_granted</option>
            <option value="consent_rejected">consent_rejected</option>
            <option value="cobrowse_granted">cobrowse_granted</option>
            <option value="tier2_token_issued">tier2_token_issued</option>
            <option value="session_revoked">session_revoked</option>
            <option value="session_ended">session_ended</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.03] px-3 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto rounded-xl border border-black/[0.07] bg-white/80">
        <table className="w-full text-left text-xs">
          <thead className="border-black/[0.06] border-b bg-black/[0.02] font-mono text-[10px] text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-[var(--text-muted)]">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-[var(--text-heading)]">
                    {row.event_type}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                    {row.session_id.slice(0, 8)}…
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 font-mono text-[10px] text-[var(--text-muted)]">
                    {JSON.stringify(row.metadata ?? {})}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
