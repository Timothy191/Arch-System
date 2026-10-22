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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold text-[var(--text-heading)]">
                Drilling Production Report &amp; Live Stats
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Live Telemetry &amp; Control Room Sync
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
                {currentShift === 'day' ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
                Active Shift: {currentShift.toUpperCase()} ({todayStr})
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Total Meters Drilled
              </span>
              <Drill className="w-4 h-4 text-accent-green" />
            </div>
            <p className="text-2xl font-bold text-accent-green mt-1.5 font-mono">
              {kpi.totalMeters.toFixed(1)}m
            </p>
          </div>
          <div className="mt-3 space-y-1">
            <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
              <div
                className="bg-amber-500 h-full"
                style={{
                  width: `${kpi.totalMeters > 0 ? Math.round((kpi.dayMeters / kpi.totalMeters) * 100) : 50}%`,
                }}
              />
              <div
                className="bg-indigo-500 h-full"
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

        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Total Holes Drilled
              </span>
              <ClipboardList className="w-4 h-4 text-[var(--accent-blue)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--accent-blue)] mt-1.5 font-mono">
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

        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Operating Hours</span>
              <Clock className="w-4 h-4 text-[var(--accent-blue)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-1.5 font-mono">
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

        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Penetration Rate</span>
              <Gauge className="w-4 h-4 text-accent-green" />
            </div>
            <p className="text-2xl font-bold text-accent-green mt-1.5 font-mono">
              {kpi.penetrationRate.toFixed(1)} m/h
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Status</span>
            <span className="px-2 py-0.5 rounded-full font-semibold bg-accent-green/10 text-accent-green">
              {kpi.penetrationRate >= 15 ? 'Optimal' : kpi.penetrationRate > 0 ? 'Active' : 'Idle'}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Total Delays</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-1.5 font-mono">
              {formatDelay(kpi.totalDelaysMin)}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Delay Minutes</span>
            <span className="font-mono">{Math.round(kpi.totalDelaysMin)}m</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Drill Fleet</span>
              <Activity className="w-4 h-4 text-[var(--accent-blue)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-1.5 font-mono">
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Drilling Report Subtabs"
            className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'shift'}
              onClick={() => setActiveSubTab('shift')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'shift'
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-blue)] shadow-sm border border-[var(--border-default)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Shift</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
                {filteredOps.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'day'}
              onClick={() => setActiveSubTab('day')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'day'
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-blue)] shadow-sm border border-[var(--border-default)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Day</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-accent-green/10 text-accent-green">
                {dailyRows.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'archived'}
              onClick={() => setActiveSubTab('archived')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'archived'
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-blue)] shadow-sm border border-[var(--border-default)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>Archived</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                {monthlyRollups.length}m
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] p-0.5 text-xs">
              {(['all', 'day', 'night'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftFilter(s)}
                  className={`px-2.5 py-1.5 rounded-md font-medium capitalize transition-colors ${
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
                <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <select
                  aria-label="Filter by drill rig"
                  value={rigFilter}
                  onChange={(e) => setRigFilter(e.target.value)}
                  className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent-blue)]"
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
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rig, block, operator..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* SUBTAB 1: SHIFT */}
      {activeSubTab === 'shift' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[var(--accent-blue)]" />
                    Day vs. Night Shift Drilling Split
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Meters drilled and shift count across Day and Night shifts
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <Sun className="w-3.5 h-3.5" />
                      Day Shift
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {kpi.dayCount} shifts
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-[var(--text-heading)]">
                    {kpi.dayMeters.toFixed(1)}m
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                      <Moon className="w-3.5 h-3.5" />
                      Night Shift
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {kpi.nightCount} shifts
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-[var(--text-heading)]">
                    {kpi.nightMeters.toFixed(1)}m
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
                <Drill className="w-4 h-4 text-accent-green" />
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
                      <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-green rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {rigBreakdown.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                    No drill rig logs found for the selected filter.
                  </p>
                )}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-heading)]">
                Shift Drilling Operations Log
              </h3>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {filteredOps.length} shift records
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50">
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Shift
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Drill Rig
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Operator
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Block
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Holes
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Meters
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Delays
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredOps.map((op) => {
                    const totalOpDelays =
                      op.production_delays + op.non_productional_delays + op.engineering_delays;
                    return (
                      <tr key={op.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                        <td className="px-5 py-3.5 text-[var(--text-heading)] text-sm font-mono">
                          {op.operation_date}
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              op.shift_type === 'day'
                                ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-700 border border-indigo-500/20'
                            }`}
                          >
                            {op.shift_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-heading)] text-sm font-semibold">
                          {op.machine_name}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-body)] text-sm">
                          {op.operator_name || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-body)] text-sm">
                          {op.site || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-heading)] text-sm font-medium">
                          {op.block_drilled || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)] text-sm text-right font-mono">
                          {op.total_hours ? op.total_hours.toFixed(1) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--accent-blue)] text-sm text-right font-mono font-medium">
                          {op.holes || 0}
                        </td>
                        <td className="px-5 py-3.5 text-accent-green text-sm text-right font-mono font-bold">
                          {op.meters_drilled ? Number(op.meters_drilled).toFixed(1) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--accent-blue)] text-sm text-right font-mono">
                          {formatDelay(totalOpDelays)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              op.status === 'active' || op.status === 'completed'
                                ? 'bg-emerald-50/70 border-emerald-200/50 text-emerald-700'
                                : 'bg-amber-50/70 border-amber-200/50 text-amber-700'
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
            <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Daily Consolidated Drilling Log (Day + Night Combined)
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  24-hour daily rollup of meters drilled, holes, operating hours, and delays
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {dailyRows.length} days
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50">
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Active Rigs
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Blocks
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Day Meters
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Night Meters
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total Meters
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total Holes
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Delays
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {dailyRows.map((day) => (
                    <tr key={day.date} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono font-semibold text-[var(--text-heading)]">
                        {day.date}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--text-body)]">
                        {Array.from(day.rigsSet).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                        {Array.from(day.blocksSet).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono text-amber-700">
                        {day.dayMeters.toFixed(1)}m
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono text-indigo-700">
                        {day.nightMeters.toFixed(1)}m
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono font-bold text-accent-green">
                        {day.totalMeters.toFixed(1)}m
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono text-[var(--accent-blue)]">
                        {day.holes}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono text-[var(--text-heading)]">
                        {day.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono text-[var(--text-muted)]">
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
                <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[var(--accent-blue)]" />
                  Historical &amp; Archived Date Range Query
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Query historical drilling logs and monthly rollups across any date window
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">From Date</label>
                  <Input type="date" name="from" defaultValue={fromDateStr} className="h-9" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">To Date</label>
                  <Input type="date" name="to" defaultValue={toDateStr} className="h-9" />
                </div>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold hover:bg-[var(--accent-blue)]/90 transition-colors"
                >
                  Load Archive Window
                </button>
              </div>
            </form>
          </GlassCard>

          {monthlyRollups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {monthlyRollups.map((m) => (
                <GlassCard key={m.month} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-[var(--text-heading)]">
                      {m.month}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                      {m.shiftsCount} shifts
                    </span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-accent-green">
                    {m.meters.toFixed(1)}m
                  </p>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-default)]">
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
