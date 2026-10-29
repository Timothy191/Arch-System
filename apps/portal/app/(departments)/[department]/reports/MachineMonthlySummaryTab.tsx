'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Archive, ArrowUpRight, Calendar, Database, Lock } from 'lucide-react';
import {
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayKey,
} from '@/lib/shift-sheet-buckets';
import type { ArchivedMachineMonthSnapshot, MachineMonthlySummaryRow } from './reports-types';

const TH_BASE =
  'whitespace-nowrap px-2.5 py-2.5 text-left font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TH_NUM =
  'whitespace-nowrap px-2 py-2.5 text-right font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TD_BASE = 'whitespace-nowrap px-2.5 py-2.5 align-middle text-xs';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-90';
const BTN_OUTLINE =
  'inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--accent-blue)]/35 bg-[var(--accent-blue)]/10 px-2 py-1 font-semibold text-[11px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20';
const KPI_BOX_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5';

const DELAY_GROUP_TH_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/20 border-x bg-sky-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-sky-900 uppercase tracking-wider',
  nonProduction:
    'whitespace-nowrap border-amber-500/20 border-x bg-amber-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-amber-900 uppercase tracking-wider',
  engineering:
    'whitespace-nowrap border-rose-500/20 border-x bg-rose-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-rose-900 uppercase tracking-wider',
};

const DELAY_GROUP_TD_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/15 border-x bg-sky-500/5 px-2 py-2 text-right font-mono text-sky-950 text-xs',
  nonProduction:
    'whitespace-nowrap border-amber-500/15 border-x bg-amber-500/5 px-2 py-2 text-right font-mono text-amber-950 text-xs',
  engineering:
    'whitespace-nowrap border-rose-500/15 border-x bg-rose-500/5 px-2 py-2 text-right font-mono text-rose-950 text-xs',
};

const HIGH_AVAILABILITY_THRESHOLD = 80;
const MED_AVAILABILITY_THRESHOLD = 60;
const HIGH_UTILIZATION_THRESHOLD = 75;
const MED_UTILIZATION_THRESHOLD = 50;
const DECIMAL_PLACES_ONE = 1;

export interface MachineMonthlySummaryTabProps {
  selectedMonth: string;
  onSelectMonth: (monthPrefix: string) => void;
  shiftType: 'day' | 'night';
  onShiftTypeChange: (shift: 'day' | 'night') => void;
  summaryRows: readonly MachineMonthlySummaryRow[];
  archivedSnapshots: readonly ArchivedMachineMonthSnapshot[];
  isMonthSealed: boolean;
  onArchiveAndSealMonth: () => void;
  onInspectMachine30Day: (machineId: string) => void;
}

export function MachineMonthlySummaryTab({
  selectedMonth,
  onSelectMonth,
  shiftType,
  onShiftTypeChange,
  summaryRows,
  archivedSnapshots,
  isMonthSealed,
  onArchiveAndSealMonth,
  onInspectMachine30Day,
}: MachineMonthlySummaryTabProps) {
  const fleetTotals = summaryRows.reduce(
    (acc, row) => {
      acc.totalSmrWorked += row.totalSmrWorked;
      acc.totalDelayHours += row.totalDelayHours;
      acc.availabilitySum += row.availabilityPercent;
      acc.utilizationSum += row.utilizationPercent;
      for (const col of OVERVIEW_DELAY_COLUMNS) {
        acc.delays[col.key] = (acc.delays[col.key] ?? 0) + (row.delays[col.key] ?? 0);
      }
      return acc;
    },
    {
      totalSmrWorked: 0,
      totalDelayHours: 0,
      availabilitySum: 0,
      utilizationSum: 0,
      delays: {} as Record<OverviewDelayKey, number>,
    }
  );

  const machineCount = summaryRows.length || 1;
  const fleetAvgAvailability = Number(
    (fleetTotals.availabilitySum / machineCount).toFixed(DECIMAL_PLACES_ONE)
  );
  const fleetAvgUtilization = Number(
    (fleetTotals.utilizationSum / machineCount).toFixed(DECIMAL_PLACES_ONE)
  );

  return (
    <div className="space-y-6" data-testid="machine-monthly-summary-tab">
      {/* Header & Safe Monthly Archive Controls */}
      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" />
              Fleet Monthly Availability, Utilization &amp; 12-Category Delay Rollup
            </div>
            <h3 className="mt-1 font-bold text-[var(--text-heading)] text-lg">
              Monthly Machine Summary — {selectedMonth} ({summaryRows.length} Machines)
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Aggregates each machine&apos;s 30/31-day activity sheet for {selectedMonth}. Click any
              machine row to open its full 30-day table, or archive and seal previous months to
              build the historical Machine Activity Database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Month:</span>
              <input
                type="month"
                aria-label="Select Summary Month"
                data-testid="monthly-summary-month-input"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) onSelectMonth(e.target.value);
                }}
                className="rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1 font-mono text-[var(--text-heading)] text-xs"
              />
            </label>

            <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-0.5">
              {(['day', 'night'] as const).map((shiftOpt) => (
                <button
                  key={shiftOpt}
                  type="button"
                  onClick={() => onShiftTypeChange(shiftOpt)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-semibold text-xs ${
                    shiftType === shiftOpt
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {shiftOpt === 'day' ? 'Day Shift' : 'Night Shift'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onArchiveAndSealMonth}
              data-testid="seal-monthly-summary-archive-btn"
              className={BTN_PRIMARY}
            >
              {isMonthSealed ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {isMonthSealed
                ? `Month ${selectedMonth} Archived & Sealed`
                : `Archive & Seal ${selectedMonth} to Machine DB`}
            </button>
          </div>
        </div>

        {/* Fleet Monthly KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Working Fleet Count
            </div>
            <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-xl">
              {summaryRows.length} Machines
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              30-day tables tracked for {selectedMonth}
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Total Monthly SMR Worked
            </div>
            <div className="mt-1 font-bold font-mono text-[var(--accent-blue)] text-xl">
              {fleetTotals.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)} h
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Total Delays: {fleetTotals.totalDelayHours.toFixed(DECIMAL_PLACES_ONE)} h
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Fleet Availability
            </div>
            <div className="mt-1 font-bold font-mono text-accent-green text-xl">
              {fleetAvgAvailability.toFixed(DECIMAL_PLACES_ONE)}%
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Across all {summaryRows.length} machine 30-day tables
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Fleet Utilization
            </div>
            <div className="mt-1 font-bold font-mono text-[var(--accent-blue)] text-xl">
              {fleetAvgUtilization.toFixed(DECIMAL_PLACES_ONE)}%
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Archived Months in DB: {archivedSnapshots.length}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Archived Months Vault Strip (Safe Historical Machine Activity Database) */}
      <GlassCard className="space-y-3 p-5" data-testid="archived-machine-months-vault">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--accent-blue)]" />
            <h4 className="font-bold text-[var(--text-heading)] text-sm uppercase tracking-wider">
              Safe Monthly Machine Activity Database ({archivedSnapshots.length} Archived Months)
            </h4>
          </div>
          <span className="text-[var(--text-secondary)] text-xs">
            Select any archived month below to load its 30-day per-machine tables
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {archivedSnapshots.map((snap) => {
            const isSelected = snap.month === selectedMonth;
            return (
              <div
                key={snap.month}
                data-testid={`archived-month-card-${snap.month}`}
                className={`rounded-xl border p-3.5 transition-colors ${
                  isSelected
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/8'
                    : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                    {snap.month}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 font-semibold text-[10px] text-accent-green">
                    <Lock className="h-2.5 w-2.5" />
                    {snap.isSealed ? 'Sealed Archive' : 'Active Month'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Machines</div>
                    <div className="font-bold text-[var(--text-heading)]">{snap.machineCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">SMR Worked</div>
                    <div className="font-bold text-[var(--accent-blue)]">
                      {snap.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Avail / Util</div>
                    <div className="font-bold text-accent-green">
                      {snap.fleetAvailabilityPercent.toFixed(DECIMAL_PLACES_ONE)}% /{' '}
                      {snap.fleetUtilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectMonth(snap.month)}
                    data-testid={`load-archived-month-${snap.month}`}
                    className={BTN_OUTLINE}
                  >
                    {isSelected ? 'Viewing Month' : `Load ${snap.month} Tables`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Full Fleet Monthly Summary Table (Matching /control-room/engineering-notes columns) */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table
            aria-label={`Monthly Machine Summary Table for ${selectedMonth}`}
            className="min-w-full border-collapse text-left text-xs"
          >
            <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80">
              <tr>
                <th className={TH_BASE}>Machine ID</th>
                <th className={TH_NUM}>Start SMR</th>
                <th className={TH_NUM}>Stop SMR</th>
                <th className={TH_NUM}>Total SMR Worked</th>
                {OVERVIEW_DELAY_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    data-delay-group={col.delayGroup}
                    className={DELAY_GROUP_TH_CLASS[col.delayGroup]}
                  >
                    <div>{col.label}</div>
                  </th>
                ))}
                <th className={TH_NUM}>Days Logged</th>
                <th className={TH_NUM}>Availability</th>
                <th className={TH_NUM}>Utilization</th>
                <th className={TH_BASE}>30-Day Table</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-white/80">
              {summaryRows.map((row) => (
                <tr
                  key={row.machineId}
                  onClick={() => onInspectMachine30Day(row.machineId)}
                  data-testid={`monthly-summary-row-${row.machineId}`}
                  className="cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]/50"
                >
                  <td className={TD_BASE}>
                    <div className="font-bold text-[var(--text-heading)]">{row.machineName}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {row.machineType} · {row.siteName}
                    </div>
                  </td>
                  <td className={`${TD_BASE} text-right font-mono`}>
                    {row.openingSmr.toFixed(DECIMAL_PLACES_ONE)}
                  </td>
                  <td className={`${TD_BASE} text-right font-mono`}>
                    {row.closingSmr.toFixed(DECIMAL_PLACES_ONE)}
                  </td>
                  <td
                    className={`${TD_BASE} text-right font-bold font-mono text-[var(--accent-blue)]`}
                  >
                    {row.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h
                  </td>
                  {OVERVIEW_DELAY_COLUMNS.map((col) => (
                    <td key={col.key} className={DELAY_GROUP_TD_CLASS[col.delayGroup]}>
                      {(row.delays[col.key] ?? 0).toFixed(DECIMAL_PLACES_ONE)}h
                    </td>
                  ))}
                  <td className={`${TD_BASE} text-right font-mono`}>
                    {row.activeDaysLogged} / {row.daysInMonth}d
                  </td>
                  <td className={`${TD_BASE} text-right font-bold font-mono`}>
                    <span
                      className={
                        row.availabilityPercent >= HIGH_AVAILABILITY_THRESHOLD
                          ? 'text-accent-green'
                          : row.availabilityPercent >= MED_AVAILABILITY_THRESHOLD
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }
                    >
                      {row.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
                    </span>
                  </td>
                  <td className={`${TD_BASE} text-right font-bold font-mono`}>
                    <span
                      className={
                        row.utilizationPercent >= HIGH_UTILIZATION_THRESHOLD
                          ? 'text-[var(--accent-blue)]'
                          : row.utilizationPercent >= MED_UTILIZATION_THRESHOLD
                            ? 'text-[var(--text-heading)]'
                            : 'text-amber-600'
                      }
                    >
                      {row.utilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
                    </span>
                  </td>
                  <td className={TD_BASE}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectMachine30Day(row.machineId);
                      }}
                      data-testid={`open-machine-30d-${row.machineId}`}
                      className={BTN_OUTLINE}
                    >
                      30-Day Sheet
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
