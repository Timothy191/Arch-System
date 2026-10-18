'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { getOperationalToday } from '@repo/utils/client';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Drill,
  FileText,
  Moon,
  Radio,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type Shift = 'day' | 'night';

export interface DrillOpRow {
  id?: string;
  machine_id: string;
  shift_type: Shift;
  operation_date?: string;
  open_hours: number | null;
  close_hours: number | null;
  total_hours: number | null;
  holes?: number | null;
  meters_drilled?: number | null;
  operator_name: string | null;
  block_drilled: string | null;
  site: string | null;
  external_delays_minutes: number | null;
  standard_delays_hours: number | null;
  production_delays_minutes: number | null;
  engineering_delays_minutes: number | null;
  comments: string | null;
  status?: string;
}

interface Machine {
  id: string;
  name: string;
}

interface Operator {
  id: string;
  full_name: string;
}

interface Props {
  departmentId: string;
  drills: Machine[];
  operators: Operator[];
  initialOps: DrillOpRow[];
}

const today = getOperationalToday();

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(digits);
}

export function DrillingOperationsTable({ drills, initialOps }: Props) {
  const [selectedShift, setSelectedShift] = useState<'all' | Shift>('all');

  // Map keyed by `${machine_id}:${shift_type}` pre-indexed via useMemo
  const opsByKey = useMemo(() => {
    const map = new Map<string, DrillOpRow>();
    for (const op of initialOps) {
      map.set(`${op.machine_id}:${op.shift_type}`, op);
    }
    return map;
  }, [initialOps]);

  // Single-pass computation for KPI summary totals to avoid multiple array allocations and passes
  const { totalMeters, totalHoles, totalHours, activeRigsCount } = useMemo(() => {
    let meters = 0;
    let holes = 0;
    let hours = 0;
    const activeRigs = new Set<string>();

    for (const op of initialOps) {
      if (selectedShift !== 'all' && op.shift_type !== selectedShift) {
        continue;
      }
      meters += Number(op.meters_drilled || 0);
      holes += Number(op.holes || 0);

      if (op.total_hours != null) {
        hours += Number(op.total_hours);
      } else if (
        op.open_hours != null &&
        op.close_hours != null &&
        op.close_hours >= op.open_hours
      ) {
        hours += Number(op.close_hours) - Number(op.open_hours);
      }

      if (op.machine_id) {
        activeRigs.add(op.machine_id);
      }
    }

    return {
      totalMeters: meters,
      totalHoles: holes,
      totalHours: hours,
      activeRigsCount: activeRigs.size,
    };
  }, [initialOps, selectedShift]);

  if (drills.length === 0) {
    return (
      <GlassCard className="p-12 text-center">
        <p className="text-[var(--text-muted)]">
          No active drill rigs registered. Add rigs in the Machines section first.
        </p>
      </GlassCard>
    );
  }

  const shiftsToRender: Shift[] = selectedShift === 'all' ? ['day', 'night'] : [selectedShift];

  return (
    <div className="space-y-6">
      {/* Auto-Compiled KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center gap-2">
            <Drill className="w-4 h-4 text-accent-green" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Meters Drilled
            </p>
          </div>
          <p className="text-2xl font-bold text-accent-green mt-2">{totalMeters.toFixed(1)}m</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[var(--accent-blue)]" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Holes Drilled
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--accent-blue)] mt-2">{totalHoles}</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-500" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Operating Hours
            </p>
          </div>
          <p className="text-2xl font-bold text-cyan-500 mt-2">{totalHours.toFixed(1)}h</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-green" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Rigs Logged Today
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">
            {activeRigsCount} / {drills.length}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-semibold text-[var(--text-heading)]">
                {today} — Auto-Compiled Shift Report
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                <Radio className="w-3 h-3" />
                Synced from Control Room
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Built automatically from Control Room Machine Operations (Meters, Site, Block, Holes,
              SMR &amp; Delays).
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Shift Filter */}
            <div className="inline-flex rounded-lg border border-[var(--border-default)] overflow-hidden">
              <button
                type="button"
                onClick={() => setSelectedShift('all')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedShift === 'all'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                All Shifts
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift('day')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium flex items-center gap-1 border-l border-[var(--border-default)] transition-colors',
                  selectedShift === 'day'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <Sun className="w-3 h-3" />
                Day
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift('night')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium flex items-center gap-1 border-l border-[var(--border-default)] transition-colors',
                  selectedShift === 'night'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <Moon className="w-3 h-3" />
                Night
              </button>
            </div>

            <Link
              href="/drilling/reports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
              Production Reports &amp; CSV
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border-subtle)] hover:bg-transparent">
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider sticky left-0 bg-[var(--bg-primary)] z-10">
                  Drill Rig
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">
                  Shift
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">
                  Site
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">
                  Block
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-right">
                  Meters
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-right">
                  Holes
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-right">
                  Open SMR
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-right">
                  Close SMR
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-right">
                  Hours
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">
                  Operator
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-right">
                  Delays (min)
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider text-center">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drills.flatMap((drill) =>
                shiftsToRender.map((shift) => {
                  const key = `${drill.id}:${shift}`;
                  const row = opsByKey.get(key);
                  const totalHrs =
                    row?.total_hours != null
                      ? Number(row.total_hours)
                      : row?.open_hours != null &&
                          row?.close_hours != null &&
                          row.close_hours >= row.open_hours
                        ? Number(row.close_hours) - Number(row.open_hours)
                        : null;

                  const delayMins =
                    Number(row?.external_delays_minutes || 0) +
                    Number(row?.production_delays_minutes || 0) +
                    Number(row?.engineering_delays_minutes || 0);

                  return (
                    <TableRow
                      key={key}
                      className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]/30"
                    >
                      <TableCell className="font-medium text-[var(--text-heading)] sticky left-0 bg-[var(--bg-primary)] z-10">
                        {drill.name}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            shift === 'day'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-indigo-500/10 text-indigo-600'
                          )}
                        >
                          {shift === 'day' ? (
                            <Sun className="w-3 h-3" />
                          ) : (
                            <Moon className="w-3 h-3" />
                          )}
                          {shift === 'day' ? 'Day' : 'Night'}
                        </span>
                      </TableCell>
                      <TableCell className="text-[var(--text-body)] text-sm">
                        {row?.site || '—'}
                      </TableCell>
                      <TableCell className="text-[var(--text-heading)] font-medium text-sm">
                        {row?.block_drilled || '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-accent-green tabular-nums">
                        {row?.meters_drilled != null ? `${fmt(row.meters_drilled, 1)}m` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[var(--accent-blue)] tabular-nums">
                        {row?.holes != null ? row.holes : '—'}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] font-mono text-sm tabular-nums">
                        {fmt(row?.open_hours, 1)}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] font-mono text-sm tabular-nums">
                        {fmt(row?.close_hours, 1)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-cyan-600 tabular-nums">
                        {totalHrs != null ? `${totalHrs.toFixed(2)}h` : '—'}
                      </TableCell>
                      <TableCell className="text-[var(--text-body)] text-sm">
                        {row?.operator_name || '—'}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] tabular-nums text-sm">
                        {delayMins > 0 ? `${delayMins}m` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                              row.status === 'completed'
                                ? 'bg-emerald-50/70 border-emerald-200/50 text-emerald-700'
                                : 'bg-blue-50/70 border-blue-200/50 text-blue-700'
                            )}
                          >
                            {row.status ?? 'active'}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
                            Awaiting Control Room
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
