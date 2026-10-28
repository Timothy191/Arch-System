'use client';

import { useMemo } from 'react';
import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, Clock, TrendingUp } from 'lucide-react';
import type { PlantDelayEntry } from './types';

export interface PlantDelaysMetrics {
  totalEvents: number;
  totalMinutes: number;
  totalHours: number;
  availabilityPct: number;
  topCircuit: string;
  topMins: number;
}

interface PlantDelaysWrapupSectionProps {
  delays: PlantDelayEntry[];
  metrics: PlantDelaysMetrics;
}

export function PlantDelaysWrapupSection({ delays, metrics }: PlantDelaysWrapupSectionProps) {
  const pareto = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const d of delays) {
      const key = d.category ?? d.circuit ?? 'Uncategorized';
      const current = grouped.get(key) ?? 0;
      grouped.set(key, current + d.durationMinutes);
    }
    const rows = Array.from(grouped.entries())
      .map(([label, minutes]) => ({ label, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .map((row, idx, arr) => {
        const cumulative = arr.slice(0, idx + 1).reduce((sum, r) => sum + r.minutes, 0);
        return {
          ...row,
          cumulativePct: ((cumulative ?? 0) / (metrics.totalMinutes ?? 1)) * 100,
        };
      });
    return rows;
  }, [delays, metrics.totalMinutes]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Delay Wrapup Summary (logs and visuals) */}
      <GlassCard
        className="flex flex-col gap-4 p-5 xl:col-span-7"
        data-testid="card-plant-delays-wrapup"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="font-bold text-[var(--text-secondary)] text-sm uppercase tracking-wider">
              Plant Delays Wrapup — Logs &amp; Visuals
            </h3>
          </div>
          <span className="font-mono font-bold text-sm text-[var(--text-heading)]">
            {delays.length} events · {metrics.totalMinutes} min
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {/* Mini Pareto Bar Chart — delay by category/circuit */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <p className="mb-2 font-mono text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Delays by category (minutes) — Pareto
            </p>
            <div className="flex items-end gap-3">
              {pareto.map((row) => (
                <div key={row.label} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-[var(--accent-blue)]/30"
                    style={{
                      height: `${Math.max(4, (row.minutes / 600) * 100)}%`,
                    }}
                  />
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
            {(metrics.totalMinutes ?? 0) > 0 && (
              <div className="mt-2 flex items-end justify-between font-mono text-[10px] text-[var(--text-secondary)]">
                <span>100%</span>
                <span>{((metrics.totalMinutes ?? 0) / 600) * 100}% of window</span>
              </div>
            )}
          </div>

          {/* Latest delay timeline as a mini bar chart */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <p className="mb-2 font-mono text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Last 5 delay events
            </p>
            <div className="flex items-end gap-2">
              {delays
                .slice(0, 5)
                .reverse()
                .map((d, idx) => (
                  <div key={`${d.id}-${idx}`} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-full max-w-[36px] rounded-t-md ${
                        !d.endTime
                          ? 'bg-amber-500/60'
                          : d.status === 'Resolved'
                            ? 'bg-emerald-500/60'
                            : 'bg-red-500/60'
                      }`}
                      style={{
                        height: `${Math.max(4, (d.durationMinutes / 120) * 100)}%`,
                      }}
                    />
                    <span className="font-mono text-[9px] text-[var(--text-secondary)]">
                      {d.date} {d.shift}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Plant Delay Table — detailed delay event log */}
      <GlassCard
        className="flex flex-col gap-3 p-5 xl:col-span-5"
        data-testid="card-plant-delay-table"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--text-secondary)] text-sm uppercase tracking-wider">
              <Clock className="mr-1.5 h-4 w-4 text-[var(--accent-amber)]" />
              Delay Event Table
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              Latest logged delays for Plant Processing
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--text-muted)]">{delays.length} rows</span>
        </div>

        {delays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No delay events logged yet.</p>
            <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
              Log a delay on the{' '}
              <a className="text-[var(--accent-blue)] underline" href="/plant-processing/delays">
                Delays tab
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-black/[0.025] font-semibold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Circuit / Category</th>
                  <th className="px-3 py-2">Booked In / Out</th>
                  <th className="px-3 py-2 text-right">Duration</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {delays.map((d) => {
                  const isOpen = !d.endTime || d.status === 'Active';
                  return (
                    <tr
                      key={d.id}
                      className={`transition-colors ${
                        isOpen
                          ? 'bg-amber-500/[0.04]'
                          : d.status === 'Resolved'
                            ? 'bg-emerald-500/[0.04]'
                            : 'bg-red-500/[0.04]'
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] font-semibold text-[var(--text-heading)]">
                        {d.date}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-[11px] font-semibold text-[var(--text-heading)]">
                          {d.circuit}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 font-semibold text-[9px] uppercase text-[var(--text-secondary)]">
                            {d.category}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {d.impactType}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                        <div>{d.startTime}</div>
                        <div className="font-semibold text-amber-700">{d.endTime ?? 'Pending'}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-amber-700">
                        {d.endTime ? `${d.durationMinutes} min` : 'Open'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase ${
                            d.status === 'Resolved' && d.endTime
                              ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-800'
                              : 'border border-amber-500/30 bg-amber-500/15 text-amber-800'
                          }`}
                        >
                          {isOpen ? 'Open' : d.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] text-[var(--text-secondary)]">
                        {d.reason ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
