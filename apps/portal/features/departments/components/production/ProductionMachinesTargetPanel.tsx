'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { GlassCard } from '@repo/ui/GlassCard';
import { CheckCircle2, Clock, Search, Target, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  ProductionMachineComplianceStatus,
  ProductionMachineHorizonKey,
  ProductionMachinesTargetReport,
} from './production-types';

export interface ProductionMachinesTargetPanelProps {
  report: ProductionMachinesTargetReport;
}

const HORIZON_OPTIONS: ReadonlyArray<{ key: ProductionMachineHorizonKey; label: string }> = [
  { key: 'shift', label: 'Shift' },
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
];

type StatusFilter = 'all' | ProductionMachineComplianceStatus;

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All Fleet' },
  { key: 'meeting', label: 'Meeting Target' },
  { key: 'below', label: 'Below Target' },
  { key: 'idle', label: 'Idle / No Data' },
];

const STATUS_BADGE_MAP: Record<
  ProductionMachineComplianceStatus,
  { label: string; badgeClass: string; barClass: string }
> = {
  meeting: {
    label: 'Meeting Target',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
    barClass: 'bg-emerald-600',
  },
  below: {
    label: 'Below Target',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    barClass: 'bg-amber-500',
  },
  idle: {
    label: 'Idle / No Data',
    badgeClass: 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]',
    barClass: 'bg-[var(--text-muted)]',
  },
};

const SEGMENT_GROUP_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1';
const SEGMENT_BTN_BASE = 'rounded-md px-3 py-1.5 font-medium text-xs transition';
const SEGMENT_BTN_ACTIVE = 'bg-[var(--accent-blue)] text-white shadow-sm';
const SEGMENT_BTN_INACTIVE =
  'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]';
const KPI_CARD_CLASS = 'space-y-1 border border-[var(--border-subtle)] p-4';
const TH_CLASS =
  'px-3 py-2.5 text-left font-mono text-[11px] text-[var(--text-secondary)] uppercase';
const TH_NUM_CLASS =
  'px-3 py-2.5 text-right font-mono text-[11px] text-[var(--text-secondary)] uppercase';
const TD_NUM_CLASS = 'px-3 py-2.5 text-right font-mono text-[var(--text-heading)] text-xs';

export function ProductionMachinesTargetPanel({ report }: ProductionMachinesTargetPanelProps) {
  const [horizon, setHorizon] = useState<ProductionMachineHorizonKey>('daily');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = report.summaryByHorizon[horizon];

  const filteredMachines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return report.machines.filter((m) => {
      const metrics = m.horizons[horizon];
      if (statusFilter !== 'all' && metrics.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.machineType.toLowerCase().includes(q) ||
        m.siteName.toLowerCase().includes(q)
      );
    });
  }, [report.machines, horizon, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 font-bold text-2xl text-[var(--text-heading)]">
                <Target className="h-5 w-5 text-[var(--accent-blue)]" />
                Production Fleet Target Compliance
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                As of {report.asOfDate} ({report.activeShiftLabel})
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-xs">
              Tracks haulage, excavation, and dozer fleet units against configured Shift, Daily, and
              Monthly Pit BCM, Loads, Rollover, and SMR Hour targets (≥ 90% = Meeting Target).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Target horizon" className={SEGMENT_GROUP_CLASS}>
              {HORIZON_OPTIONS.map((opt) => {
                const isActive = horizon === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setHorizon(opt.key)}
                    className={`${SEGMENT_BTN_BASE} ${isActive ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <Link
              href="/production/daily-log"
              className="rounded-lg bg-[var(--accent-blue)] px-3 py-2 font-medium text-white text-xs transition hover:bg-[var(--accent-blue)]/90"
            >
              Adjust Targets
            </Link>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className={KPI_CARD_CLASS}>
          <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">Total Fleet</p>
          <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
            {summary.totalFleet}
          </p>
          <p className="text-[var(--text-secondary)] text-xs">
            Avg Attainment: {summary.avgAttainmentPct}%
          </p>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">
              Meeting Target
            </p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="font-bold font-mono text-2xl text-emerald-700">{summary.meetingCount}</p>
          <p className="text-[var(--text-secondary)] text-xs">≥ 90% of {horizon} allocation</p>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">Below Target</p>
            <TrendingDown className="h-4 w-4 text-amber-600" />
          </div>
          <p className="font-bold font-mono text-2xl text-amber-700">{summary.belowCount}</p>
          <p className="text-[var(--text-secondary)] text-xs">&lt; 90% active production</p>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">
              Idle / No Data
            </p>
            <Clock className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <p className="font-bold font-mono text-2xl text-[var(--text-muted)]">
            {summary.idleCount}
          </p>
          <p className="text-[var(--text-secondary)] text-xs">0 loads / hours logged</p>
        </GlassCard>
      </div>

      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div role="group" aria-label="Status filter" className={SEGMENT_GROUP_CLASS}>
            {STATUS_FILTER_OPTIONS.map((opt) => {
              const isActive = statusFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(opt.key)}
                  className={`${SEGMENT_BTN_BASE} ${isActive ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="search"
              aria-label="Filter machines"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search machine, type, site…"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
              <tr>
                <th className={TH_CLASS}>Machine</th>
                <th className={TH_CLASS}>Type / Site</th>
                <th className={TH_NUM_CLASS}>Loads (Act / Tgt)</th>
                <th className={TH_NUM_CLASS}>Pit BCM (Act / Tgt)</th>
                <th className={TH_NUM_CLASS}>Rollover BCM</th>
                <th className={TH_NUM_CLASS}>SMR Hours</th>
                <th className={TH_CLASS}>Attainment</th>
                <th className={TH_CLASS}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredMachines.map((machine) => {
                const metrics = machine.horizons[horizon];
                const ui = STATUS_BADGE_MAP[metrics.status];
                return (
                  <tr key={machine.machineId} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-[var(--text-heading)]">{machine.name}</p>
                      {machine.serialNumber && (
                        <p className="font-mono text-[10px] text-[var(--text-muted)]">
                          {machine.serialNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-[var(--text-heading)]">{machine.machineType}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{machine.siteName}</p>
                    </td>
                    <td className={TD_NUM_CLASS}>
                      {metrics.actualLoads.toLocaleString('en-US')} /{' '}
                      {metrics.targetLoads.toLocaleString('en-US')}
                    </td>
                    <td className={TD_NUM_CLASS}>
                      {metrics.actualPitBcm.toLocaleString('en-US')} /{' '}
                      {metrics.targetPitBcm.toLocaleString('en-US')}
                    </td>
                    <td className={TD_NUM_CLASS}>
                      {metrics.actualRolloverBcm.toLocaleString('en-US')} /{' '}
                      {metrics.targetRolloverBcm.toLocaleString('en-US')}
                    </td>
                    <td className={TD_NUM_CLASS}>
                      {metrics.actualHours.toFixed(1)} / {metrics.targetHours.toFixed(1)}h
                    </td>
                    <td className="min-w-32 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                          <div
                            className={`h-full rounded-full ${ui.barClass}`}
                            style={{ width: `${Math.min(100, metrics.attainmentPct)}%` }}
                          />
                        </div>
                        <span className="w-11 text-right font-mono font-semibold text-[var(--text-heading)]">
                          {metrics.attainmentPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={`font-mono text-[11px] ${ui.badgeClass}`}>
                        {ui.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}

              {filteredMachines.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No production machines match the selected horizon and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
