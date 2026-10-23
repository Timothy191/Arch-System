'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import { SecondaryButton } from '@repo/ui/SecondaryButton';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Calendar,
  ClipboardList,
  Clock,
  Drill,
  Filter,
  Gauge,
  Moon,
  Radio,
  Search,
  Sun,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export interface CompiledDrillReportRow {
  id: string;
  machine_id: string;
  machine_name: string;
  operation_date: string;
  shift_type: string;
  operator_name: string | null;
  site: string | null;
  block_drilled: string | null;
  total_hours: number | null;
  holes: number;
  meters_drilled: number;
  production_delays: number;
  non_productional_delays: number;
  engineering_delays: number;
  status: string;
}

interface DrillingReportsDashboardClientProps {
  todayStr: string;
  fromDateStr: string;
  toDateStr: string;
  currentShift: 'day' | 'night';
  operations: CompiledDrillReportRow[];
  drillRigNames: string[];
  csvContent: string;
}

type ReportSubTab = 'shift' | 'day' | 'archived';

function formatDelay(minutes: number): string {
  if (!minutes || minutes === 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function DrillingReportsDashboardClient({
  todayStr,
  fromDateStr,
  toDateStr,
  currentShift,
  operations,
  drillRigNames,
  csvContent,
}: DrillingReportsDashboardClientProps) {
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('shift');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  const [rigFilter, setRigFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return operations.filter((op) => {
      if (shiftFilter !== 'all' && op.shift_type.toLowerCase() !== shiftFilter) return false;
      if (rigFilter !== 'all' && op.machine_name !== rigFilter) return false;
      if (q) {
        const hay =
          `${op.operation_date} ${op.shift_type} ${op.machine_name} ${op.operator_name || ''} ${op.site || ''} ${op.block_drilled || ''} ${op.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [operations, shiftFilter, rigFilter, searchQuery]);

  // Performance Optimization: Single-pass accumulator replaces 4 reduce calls and 2 array filter passes
  // ($O(N)$ vs $O(6N)$ iteration overhead), preventing array allocations and CPU thrashing during filtering.
  const kpi = useMemo(() => {
    let totalMeters = 0;
    let totalHoles = 0;
    let totalHours = 0;
    let totalDelaysMin = 0;
    let dayMeters = 0;
    let nightMeters = 0;
    let dayCount = 0;
    let nightCount = 0;

    for (const op of filteredOps) {
      const meters = Number(op.meters_drilled) || 0;
      const holes = Number(op.holes) || 0;
      const hours = Number(op.total_hours) || 0;
      const delays =
        (op.production_delays || 0) +
        (op.non_productional_delays || 0) +
        (op.engineering_delays || 0);

      totalMeters += meters;
      totalHoles += holes;
      totalHours += hours;
      totalDelaysMin += delays;

      if (op.shift_type.toLowerCase() === 'night') {
        nightMeters += meters;
        nightCount += 1;
      } else if (op.shift_type.toLowerCase() === 'day') {
        dayMeters += meters;
        dayCount += 1;
      }
    }

    const penetrationRate = totalHours > 0 ? totalMeters / totalHours : 0;
    const avgHoleDepth = totalHoles > 0 ? totalMeters / totalHoles : 0;

    return {
      totalMeters,
      totalHoles,
      totalHours,
      totalDelaysMin,
      dayMeters,
      nightMeters,
      dayCount,
      nightCount,
      penetrationRate,
      avgHoleDepth,
    };
  }, [filteredOps]);

  const rigBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { rig: string; meters: number; holes: number; hours: number; delaysMin: number }
    >();
    for (const op of filteredOps) {
      const rig = op.machine_name || 'Unknown';
      const existing = map.get(rig) ?? { rig, meters: 0, holes: 0, hours: 0, delaysMin: 0 };
      existing.meters += Number(op.meters_drilled) || 0;
      existing.holes += Number(op.holes) || 0;
      existing.hours += Number(op.total_hours) || 0;
      existing.delaysMin +=
        op.production_delays + op.non_productional_delays + op.engineering_delays;
      map.set(rig, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.meters - a.meters);
  }, [filteredOps]);

  const dailyRows = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        dayMeters: number;
        nightMeters: number;
        totalMeters: number;
        holes: number;
        hours: number;
        delaysMin: number;
        rigsSet: Set<string>;
        blocksSet: Set<string>;
      }
    >();

    for (const op of filteredOps) {
      const existing = map.get(op.operation_date) ?? {
        date: op.operation_date,
        dayMeters: 0,
        nightMeters: 0,
        totalMeters: 0,
        holes: 0,
        hours: 0,
        delaysMin: 0,
        rigsSet: new Set<string>(),
        blocksSet: new Set<string>(),
      };
      const meters = Number(op.meters_drilled) || 0;
      if (op.shift_type.toLowerCase() === 'night') {
        existing.nightMeters += meters;
      } else {
        existing.dayMeters += meters;
      }
      existing.totalMeters += meters;
      existing.holes += Number(op.holes) || 0;
      existing.hours += Number(op.total_hours) || 0;
      existing.delaysMin +=
        op.production_delays + op.non_productional_delays + op.engineering_delays;
      if (op.machine_name) existing.rigsSet.add(op.machine_name);
      if (op.block_drilled) existing.blocksSet.add(op.block_drilled);
      map.set(op.operation_date, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredOps]);

  const monthlyRollups = useMemo(() => {
    const map = new Map<
      string,
      { month: string; meters: number; holes: number; hours: number; shiftsCount: number }
    >();
    for (const op of filteredOps) {
      const month = op.operation_date.slice(0, 7);
      const existing = map.get(month) ?? {
        month,
        meters: 0,
        holes: 0,
        hours: 0,
        shiftsCount: 0,
      };
      existing.meters += Number(op.meters_drilled) || 0;
      existing.holes += Number(op.holes) || 0;
      existing.hours += Number(op.total_hours) || 0;
      existing.shiftsCount += 1;
      map.set(month, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredOps]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">
                Drilling Production Report &amp; Live Stats
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-medium text-accent-green text-xs">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Live Telemetry &amp; Control Room Sync
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                {currentShift === 'day' ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                Active Shift: {currentShift.toUpperCase()} ({todayStr})
              </span>
            </div>
            <p className="mt-1 text-[var(--text-muted)] text-xs">
              Compiled from Drilling &amp; Control Room machine operations ({fromDateStr} to{' '}
              {toDateStr}) across Shift, Day, and Archived views.
            </p>
          </div>
          <SecondaryButton variant="rounded-lg" size="sm" asChild>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`}
              download={`drilling-report-${fromDateStr}-to-${toDateStr}.csv`}
            >
              Download CSV
            </a>
          </SecondaryButton>
        </div>
      </GlassCard>

      {/* Live Stats KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Total Meters Drilled
              </span>
              <Drill className="h-4 w-4 text-accent-green" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-accent-green">
              {kpi.totalMeters.toFixed(1)}m
            </p>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full bg-amber-500"
                style={{
                  width: `${kpi.totalMeters > 0 ? Math.round((kpi.dayMeters / kpi.totalMeters) * 100) : 50}%`,
                }}
              />
              <div
                className="h-full bg-indigo-500"
                style={{
                  width: `${kpi.totalMeters > 0 ? Math.round((kpi.nightMeters / kpi.totalMeters) * 100) : 50}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Day: {kpi.dayMeters.toFixed(0)}m</span>
              <span>Night: {kpi.nightMeters.toFixed(0)}m</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Total Holes Drilled
              </span>
              <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--accent-blue)]">
              {kpi.totalHoles.toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Avg Depth/Hole</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {kpi.avgHoleDepth.toFixed(1)}m
            </span>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Operating Hours</span>
              <Clock className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {kpi.totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Shifts Logged</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {filteredOps.length}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Penetration Rate</span>
              <Gauge className="h-4 w-4 text-accent-green" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-accent-green">
              {kpi.penetrationRate.toFixed(1)} m/h
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Status</span>
            <span className="rounded-full bg-accent-green/10 px-2 py-0.5 font-semibold text-accent-green">
              {kpi.penetrationRate >= 15 ? 'Optimal' : kpi.penetrationRate > 0 ? 'Active' : 'Idle'}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Total Delays</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {formatDelay(kpi.totalDelaysMin)}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Delay Minutes</span>
            <span className="font-mono">{Math.round(kpi.totalDelaysMin)}m</span>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Drill Fleet</span>
              <Activity className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {drillRigNames.length} Rigs
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Active in Period</span>
            <span className="font-mono font-semibold text-accent-green">
              {rigBreakdown.length} Rigs
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Subtabs & Filter Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div
            role="tablist"
            aria-label="Drilling Report Subtabs"
            className="inline-flex items-center self-start rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'shift'}
              onClick={() => setActiveSubTab('shift')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
                activeSubTab === 'shift'
                  ? 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--accent-blue)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Sun className="h-4 w-4" />
              <span>Shift</span>
              <span className="rounded-full bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent-blue)]">
                {filteredOps.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'day'}
              onClick={() => setActiveSubTab('day')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
                activeSubTab === 'day'
                  ? 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--accent-blue)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Day</span>
              <span className="rounded-full bg-accent-green/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-green">
                {dailyRows.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'archived'}
              onClick={() => setActiveSubTab('archived')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
                activeSubTab === 'archived'
                  ? 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--accent-blue)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Archive className="h-4 w-4" />
              <span>Archived</span>
              <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                {monthlyRollups.length}m
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-0.5 text-xs">
              {(['all', 'day', 'night'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftFilter(s)}
                  className={`rounded-md px-2.5 py-1.5 font-medium capitalize transition-colors ${
                    shiftFilter === s
                      ? 'bg-[var(--bg-secondary)] text-[var(--text-heading)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {s === 'all' ? 'All Shifts' : `${s} Shift`}
                </button>
              ))}
            </div>

            {drillRigNames.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <select
                  aria-label="Filter by drill rig"
                  value={rigFilter}
                  onChange={(e) => setRigFilter(e.target.value)}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none"
                >
                  <option value="all">All Drill Rigs ({drillRigNames.length})</option>
                  {drillRigNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative min-w-[210px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rig, block, operator..."
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* SUBTAB 1: SHIFT */}
      {activeSubTab === 'shift' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GlassCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                    <BarChart3 className="h-4 w-4 text-[var(--accent-blue)]" />
                    Day vs. Night Shift Drilling Split
                  </h3>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                    Meters drilled and shift count across Day and Night shifts
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 text-xs">
                      <Sun className="h-3.5 w-3.5" />
                      Day Shift
                    </span>
                    <span className="font-mono text-[var(--text-muted)] text-xs">
                      {kpi.dayCount} shifts
                    </span>
                  </div>
                  <p className="font-bold font-mono text-[var(--text-heading)] text-xl">
                    {kpi.dayMeters.toFixed(1)}m
                  </p>
                </div>
                <div className="space-y-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 text-xs">
                      <Moon className="h-3.5 w-3.5" />
                      Night Shift
                    </span>
                    <span className="font-mono text-[var(--text-muted)] text-xs">
                      {kpi.nightCount} shifts
                    </span>
                  </div>
                  <p className="font-bold font-mono text-[var(--text-heading)] text-xl">
                    {kpi.nightMeters.toFixed(1)}m
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                <Drill className="h-4 w-4 text-accent-green" />
                Drill Rig Performance Breakdown
              </h3>
              <div className="space-y-3">
                {rigBreakdown.map((rig) => {
                  const maxMeters = rigBreakdown[0]?.meters || 1;
                  const pct = Math.max(5, Math.round((rig.meters / maxMeters) * 100));
                  return (
                    <div key={rig.rig} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-heading)]">{rig.rig}</span>
                        <span className="font-mono text-[var(--text-muted)]">
                          {rig.meters.toFixed(1)}m • {rig.holes} holes • {rig.hours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                        <div
                          className="h-full rounded-full bg-accent-green"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {rigBreakdown.length === 0 && (
                  <p className="py-4 text-center text-[var(--text-muted)] text-xs">
                    No drill rig logs found for the selected filter.
                  </p>
                )}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
              <h3 className="font-semibold text-[var(--text-heading)] text-base">
                Shift Drilling Operations Log
              </h3>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {filteredOps.length} shift records
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/50">
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Shift
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Drill Rig
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Operator
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Block
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Holes
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Meters
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Delays
                    </th>
                    <th className="px-5 py-3 text-center font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredOps.map((op) => {
                    const totalOpDelays =
                      op.production_delays + op.non_productional_delays + op.engineering_delays;
                    return (
                      <tr key={op.id} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                        <td className="px-5 py-3.5 font-mono text-[var(--text-heading)] text-sm">
                          {op.operation_date}
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs capitalize ${
                              op.shift_type === 'day'
                                ? 'border border-amber-500/20 bg-amber-500/10 text-amber-700'
                                : 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-700'
                            }`}
                          >
                            {op.shift_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-[var(--text-heading)] text-sm">
                          {op.machine_name}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-body)] text-sm">
                          {op.operator_name || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-body)] text-sm">
                          {op.site || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[var(--text-heading)] text-sm">
                          {op.block_drilled || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[var(--text-muted)] text-sm">
                          {op.total_hours ? op.total_hours.toFixed(1) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                          {op.holes || 0}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold font-mono text-accent-green text-sm">
                          {op.meters_drilled ? Number(op.meters_drilled).toFixed(1) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                          {formatDelay(totalOpDelays)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold text-xs ${
                              op.status === 'active' || op.status === 'completed'
                                ? 'border-emerald-200/50 bg-emerald-50/70 text-emerald-700'
                                : 'border-amber-200/50 bg-amber-50/70 text-amber-700'
                            }`}
                          >
                            {op.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOps.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                      >
                        No drilling shift logs found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* SUBTAB 2: DAY */}
      {activeSubTab === 'day' && (
        <div className="space-y-6">
          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Daily Consolidated Drilling Log (Day + Night Combined)
                </h3>
                <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                  24-hour daily rollup of meters drilled, holes, operating hours, and delays
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {dailyRows.length} days
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/50">
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Active Rigs
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Blocks
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Day Meters
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Night Meters
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total Meters
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total Holes
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Delays
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {dailyRows.map((day) => (
                    <tr key={day.date} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                      <td className="px-5 py-3.5 font-mono font-semibold text-[var(--text-heading)] text-sm">
                        {day.date}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-body)] text-xs">
                        {Array.from(day.rigsSet).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">
                        {Array.from(day.blocksSet).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-amber-700 text-sm">
                        {day.dayMeters.toFixed(1)}m
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-indigo-700 text-sm">
                        {day.nightMeters.toFixed(1)}m
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold font-mono text-accent-green text-sm">
                        {day.totalMeters.toFixed(1)}m
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                        {day.holes}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-heading)] text-sm">
                        {day.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-muted)] text-sm">
                        {formatDelay(day.delaysMin)}
                      </td>
                    </tr>
                  ))}
                  {dailyRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                      >
                        No daily drilling records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* SUBTAB 3: ARCHIVED */}
      {activeSubTab === 'archived' && (
        <div className="space-y-6">
          <GlassCard className="p-5">
            <form method="GET" className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                  <Archive className="h-4 w-4 text-[var(--accent-blue)]" />
                  Historical &amp; Archived Date Range Query
                </h3>
                <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                  Query historical drilling logs and monthly rollups across any date window
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-[var(--text-muted)] text-xs">From Date</label>
                  <Input type="date" name="from" defaultValue={fromDateStr} className="h-9" />
                </div>
                <div>
                  <label className="mb-1 block text-[var(--text-muted)] text-xs">To Date</label>
                  <Input type="date" name="to" defaultValue={toDateStr} className="h-9" />
                </div>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[var(--accent-blue)] px-4 font-semibold text-white text-xs transition-colors hover:bg-[var(--accent-blue)]/90"
                >
                  Load Archive Window
                </button>
              </div>
            </form>
          </GlassCard>

          {monthlyRollups.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {monthlyRollups.map((m) => (
                <GlassCard key={m.month} className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                      {m.month}
                    </span>
                    <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 font-semibold text-[10px] text-[var(--text-muted)]">
                      {m.shiftsCount} shifts
                    </span>
                  </div>
                  <p className="font-bold font-mono text-2xl text-accent-green">
                    {m.meters.toFixed(1)}m
                  </p>
                  <div className="flex items-center justify-between border-[var(--border-default)] border-t pt-2 text-[var(--text-muted)] text-xs">
                    <span>Holes: {m.holes}</span>
                    <span>Hours: {m.hours.toFixed(1)}h</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
