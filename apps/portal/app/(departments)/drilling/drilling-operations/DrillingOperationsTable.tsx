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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GlassCard>
          <div className="flex items-center gap-2">
            <Drill className="h-4 w-4 text-accent-green" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Meters Drilled
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-accent-green">{totalMeters.toFixed(1)}m</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Holes Drilled
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--accent-blue)]">{totalHoles}</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Operating Hours
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-cyan-500">{totalHours.toFixed(1)}h</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent-green" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Rigs Logged Today
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
            {activeRigsCount} / {drills.length}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-subtle)] border-b p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-semibold text-[var(--text-heading)] text-lg">
                {today} — Auto-Compiled Shift Report
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-medium text-accent-green text-xs">
                <Radio className="h-3 w-3" />
                Synced from Control Room
              </span>
            </div>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Built automatically from Control Room Machine Operations (Meters, Site, Block, Holes,
              SMR &amp; Delays).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Shift Filter */}
            <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-default)]">
              <button
                type="button"
                onClick={() => setSelectedShift('all')}
                className={cn(
                  'px-3 py-1.5 font-medium text-xs transition-colors',
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
                  'flex items-center gap-1 border-[var(--border-default)] border-l px-3 py-1.5 font-medium text-xs transition-colors',
                  selectedShift === 'day'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <Sun className="h-3 w-3" />
                Day
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift('night')}
                className={cn(
                  'flex items-center gap-1 border-[var(--border-default)] border-l px-3 py-1.5 font-medium text-xs transition-colors',
                  selectedShift === 'night'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <Moon className="h-3 w-3" />
                Night
              </button>
            </div>

            <Link
              href="/drilling/reports"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <FileText className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              Production Reports &amp; CSV
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--border-subtle)] border-b hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 bg-[var(--bg-primary)] font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Drill Rig
                </TableHead>
                <TableHead className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Shift
                </TableHead>
                <TableHead className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Site
                </TableHead>
                <TableHead className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Block
                </TableHead>
                <TableHead className="text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Meters
                </TableHead>
                <TableHead className="text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Holes
                </TableHead>
                <TableHead className="text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Open SMR
                </TableHead>
                <TableHead className="text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Close SMR
                </TableHead>
                <TableHead className="text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Hours
                </TableHead>
                <TableHead className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Operator
                </TableHead>
                <TableHead className="text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Delays (min)
                </TableHead>
                <TableHead className="text-center font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
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
                      className="border-[var(--border-subtle)] border-b hover:bg-[var(--bg-tertiary)]/30"
                    >
                      <TableCell className="sticky left-0 z-10 bg-[var(--bg-primary)] font-medium text-[var(--text-heading)]">
                        {drill.name}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs',
                            shift === 'day'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-indigo-500/10 text-indigo-600'
                          )}
                        >
                          {shift === 'day' ? (
                            <Sun className="h-3 w-3" />
                          ) : (
                            <Moon className="h-3 w-3" />
                          )}
                          {shift === 'day' ? 'Day' : 'Night'}
                        </span>
                      </TableCell>
                      <TableCell className="text-[var(--text-body)] text-sm">
                        {row?.site || '—'}
                      </TableCell>
                      <TableCell className="font-medium text-[var(--text-heading)] text-sm">
                        {row?.block_drilled || '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-accent-green tabular-nums">
                        {row?.meters_drilled != null ? `${fmt(row.meters_drilled, 1)}m` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[var(--accent-blue)] tabular-nums">
                        {row?.holes != null ? row.holes : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--text-muted)] text-sm tabular-nums">
                        {fmt(row?.open_hours, 1)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--text-muted)] text-sm tabular-nums">
                        {fmt(row?.close_hours, 1)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-cyan-600 tabular-nums">
                        {totalHrs != null ? `${totalHrs.toFixed(2)}h` : '—'}
                      </TableCell>
                      <TableCell className="text-[var(--text-body)] text-sm">
                        {row?.operator_name || '—'}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] text-sm tabular-nums">
                        {delayMins > 0 ? `${delayMins}m` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold text-xs',
                              row.status === 'completed'
                                ? 'border-emerald-200/50 bg-emerald-50/70 text-emerald-700'
                                : 'border-blue-200/50 bg-blue-50/70 text-blue-700'
                            )}
                          >
                            {row.status ?? 'active'}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">
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
