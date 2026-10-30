'use client';

import { CheckCircle2, Eye, Save } from 'lucide-react';
import React, { Fragment, memo } from 'react';
import {
  computeMachineOverviewMetrics,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayKey,
} from '@/lib/shift-sheet-buckets';
import type { SmrAnomalyCheckResult } from './machine-activity-helpers';
import type {
  EngineeringLogItem,
  FleetMachineItem,
  FleetOperatorItem,
  MachineDailyOverviewRecord,
} from './reports-types';

const TD_BASE = 'whitespace-nowrap px-2.5 py-2 align-top text-xs';
const INPUT_SMR_CLASS =
  'w-24 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-right font-mono text-[var(--text-heading)] text-xs';
const SELECT_OP_CLASS =
  'w-36 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[var(--text-heading)] text-xs';
const INPUT_COMMENT_CLASS =
  'w-48 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[var(--text-heading)] text-xs';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-90 disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]';

const DELAY_GROUP_TD_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/15 border-x bg-sky-500/5 px-2 py-1.5 text-right align-top text-xs',
  nonProduction:
    'whitespace-nowrap border-amber-500/15 border-x bg-amber-500/5 px-2 py-1.5 text-right align-top text-xs',
  engineering:
    'whitespace-nowrap border-rose-500/15 border-x bg-rose-500/5 px-2 py-1.5 text-right align-top text-xs',
};

const DELAY_GROUP_INPUT_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'w-14 rounded-md border border-sky-500/40 bg-sky-50/90 px-1.5 py-1 text-right font-mono text-sky-950 text-xs',
  nonProduction:
    'w-14 rounded-md border border-amber-500/40 bg-amber-50/90 px-1.5 py-1 text-right font-mono text-amber-950 text-xs',
  engineering:
    'w-14 rounded-md border border-rose-500/40 bg-rose-50/90 px-1.5 py-1 text-right font-mono text-rose-950 text-xs',
};

const HIGH_AVAILABILITY_THRESHOLD = 80;
const MED_AVAILABILITY_THRESHOLD = 60;
const HIGH_UTILIZATION_THRESHOLD = 75;
const MED_UTILIZATION_THRESHOLD = 50;
const DECIMAL_PLACES_ONE = 1;
const DECIMAL_PLACES_TWO = 2;
const TOTAL_TABLE_COLS = 21;

export interface Machine30DaySheetRowProps {
  dayRow: MachineDailyOverviewRecord;
  activeMachine: FleetMachineItem;
  fleetOperators: readonly FleetOperatorItem[];
  isMonthSealed: boolean;
  dayIssues: readonly EngineeringLogItem[];
  hasIssue: boolean;
  anomaly?: SmrAnomalyCheckResult;
  isExpanded: boolean;
  isSaving: boolean;
  isSaved: boolean;
  onToggleExpand: (date: string) => void;
  onSmrChange: (
    dayRow: MachineDailyOverviewRecord,
    changedField: 'startSmr' | 'stopSmr',
    rawInput: string
  ) => void;
  onDelayChange: (
    dayRow: MachineDailyOverviewRecord,
    delayKey: OverviewDelayKey,
    rawInput: string
  ) => void;
  onUpsertRecord: (updatedRecord: MachineDailyOverviewRecord) => void;
  onSaveDayRow: (dayRow: MachineDailyOverviewRecord) => void;
}

export const Machine30DaySheetRow = memo(function Machine30DaySheetRow({
  dayRow,
  activeMachine,
  fleetOperators,
  isMonthSealed,
  dayIssues,
  hasIssue,
  anomaly,
  isExpanded,
  isSaving,
  isSaved,
  onToggleExpand,
  onSmrChange,
  onDelayChange,
  onUpsertRecord,
  onSaveDayRow,
}: Machine30DaySheetRowProps) {
  const metrics = computeMachineOverviewMetrics(dayRow.startSmr, dayRow.stopSmr, dayRow.delays);
  const paddedDay = String(dayRow.dayOfMonth).padStart(DECIMAL_PLACES_TWO, '0');

  return (
    <Fragment>
      <tr
        data-testid={`machine-day-row-${dayRow.date}`}
        className={
          hasIssue ? 'bg-amber-500/8 hover:bg-amber-500/12' : 'hover:bg-[var(--bg-secondary)]/40'
        }
      >
        {/* 1. Day / Date */}
        <td className={TD_BASE}>
          <div className="flex items-center gap-1.5">
            <span className="font-bold font-mono text-[var(--text-heading)]">
              Day {paddedDay} · {dayRow.date}
            </span>
            {hasIssue && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-[9px] text-amber-900 uppercase">
                Issue
              </span>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase">
            {dayRow.shiftType} shift · {activeMachine.name}
          </div>
        </td>

        {/* 2. Start SMR */}
        <td className={`${TD_BASE} text-right`}>
          <div className="flex flex-col items-end gap-1">
            <input
              type="number"
              step="0.1"
              min="0"
              disabled={isMonthSealed}
              aria-label={`Start SMR ${dayRow.date}`}
              value={dayRow.startSmr}
              onChange={(e) => onSmrChange(dayRow, 'startSmr', e.target.value)}
              className={INPUT_SMR_CLASS}
            />
            {anomaly?.hasInversion && (
              <span
                data-testid={`smr-anomaly-inversion-${dayRow.date}`}
                title={anomaly.message ?? undefined}
                className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1 py-0.2 font-mono font-semibold text-[9px] text-rose-800"
              >
                Inversion: {anomaly.deltaFromPrevious.toFixed(DECIMAL_PLACES_ONE)}h
              </span>
            )}
            {anomaly?.hasGapJump && (
              <span
                data-testid={`smr-anomaly-gap-${dayRow.date}`}
                title={anomaly.message ?? undefined}
                className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.2 font-mono font-semibold text-[9px] text-amber-800"
              >
                Gap: +{anomaly.deltaFromPrevious.toFixed(DECIMAL_PLACES_ONE)}h
              </span>
            )}
          </div>
        </td>

        {/* 3. Stop SMR */}
        <td className={`${TD_BASE} text-right`}>
          <input
            type="number"
            step="0.1"
            min={dayRow.startSmr}
            max={Number((dayRow.startSmr + MAX_SHIFT_HOURS).toFixed(DECIMAL_PLACES_TWO))}
            disabled={isMonthSealed}
            aria-label={`Stop SMR ${dayRow.date}`}
            value={dayRow.stopSmr}
            onChange={(e) => onSmrChange(dayRow, 'stopSmr', e.target.value)}
            className={INPUT_SMR_CLASS}
          />
        </td>

        {/* 4. Total SMR Worked */}
        <td className={`${TD_BASE} text-right font-bold font-mono text-[var(--accent-blue)]`}>
          <div>{metrics.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h</div>
          <div className="font-normal text-[10px] text-[var(--text-secondary)]">
            {metrics.maxDelaysAllowedHours.toFixed(DECIMAL_PLACES_ONE)}h delay cap
          </div>
        </td>

        {/* 5..16. All 12 Delay Category Columns */}
        {OVERVIEW_DELAY_COLUMNS.map((col) => {
          const delayHours = dayRow.delays[col.key] ?? 0;
          return (
            <td
              key={col.key}
              data-delay-group={col.delayGroup}
              className={DELAY_GROUP_TD_CLASS[col.delayGroup]}
            >
              <input
                type="number"
                step="0.1"
                min="0"
                max={metrics.maxDelaysAllowedHours}
                disabled={isMonthSealed}
                aria-label={`${col.label} ${dayRow.date}`}
                value={delayHours}
                onChange={(e) => onDelayChange(dayRow, col.key, e.target.value)}
                className={DELAY_GROUP_INPUT_CLASS[col.delayGroup]}
              />
            </td>
          );
        })}

        {/* 17. Operator */}
        <td className={TD_BASE}>
          <select
            disabled={isMonthSealed}
            aria-label={`Operator ${dayRow.date}`}
            value={dayRow.operatorId ?? ''}
            onChange={(e) => {
              const opMatch = fleetOperators.find((op) => op.id === e.target.value);
              onUpsertRecord({
                ...dayRow,
                operatorId: e.target.value || null,
                operatorName: opMatch?.fullName ?? null,
                hasExistingOperation: true,
              });
            }}
            className={SELECT_OP_CLASS}
          >
            <option value="">
              {dayRow.operatorName ? dayRow.operatorName : 'Assigned Operator'}
            </option>
            {fleetOperators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.fullName}
              </option>
            ))}
          </select>
        </td>

        {/* 18. Comments */}
        <td className={TD_BASE}>
          <input
            type="text"
            disabled={isMonthSealed}
            aria-label={`Comments ${dayRow.date}`}
            value={dayRow.comment}
            onChange={(e) =>
              onUpsertRecord({
                ...dayRow,
                comment: e.target.value,
                hasExistingOperation: true,
              })
            }
            className={INPUT_COMMENT_CLASS}
          />
        </td>

        {/* 19. Availability */}
        <td className={`${TD_BASE} text-right font-bold font-mono`}>
          <span
            className={
              metrics.availabilityPercent >= HIGH_AVAILABILITY_THRESHOLD
                ? 'text-accent-green'
                : metrics.availabilityPercent >= MED_AVAILABILITY_THRESHOLD
                  ? 'text-amber-600'
                  : 'text-red-600'
            }
          >
            {metrics.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
          </span>
        </td>

        {/* 20. Utilization */}
        <td className={`${TD_BASE} text-right font-bold font-mono`}>
          <span
            className={
              metrics.utilizationPercent >= HIGH_UTILIZATION_THRESHOLD
                ? 'text-[var(--accent-blue)]'
                : metrics.utilizationPercent >= MED_UTILIZATION_THRESHOLD
                  ? 'text-[var(--text-heading)]'
                  : 'text-amber-600'
            }
          >
            {metrics.utilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
          </span>
        </td>

        {/* 21. Actions & CEO Day Detail Inspector Toggle */}
        <td className={TD_BASE}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isMonthSealed || isSaving}
              onClick={() => onSaveDayRow(dayRow)}
              data-testid={`save-machine-day-${dayRow.date}`}
              className={BTN_PRIMARY}
            >
              <Save className="h-3 w-3" />
              {isSaving ? '...' : 'Save'}
            </button>

            <button
              type="button"
              onClick={() => onToggleExpand(dayRow.date)}
              data-testid={`inspect-day-details-${dayRow.date}`}
              className={BTN_SECONDARY}
            >
              <Eye className="h-3 w-3" />
              {isExpanded ? 'Hide' : 'Details'}
            </button>

            {isSaved && (
              <span className="inline-flex items-center text-[10px] text-accent-green">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Expandable CEO Per-Day Underlying Issue & Delay Breakdown Panel */}
      {isExpanded && (
        <tr data-testid={`day-detail-panel-${dayRow.date}`} className="bg-[var(--bg-secondary)]/90">
          <td colSpan={TOTAL_TABLE_COLS} className="px-4 py-3 text-xs">
            <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b pb-2">
                <div className="font-bold text-[var(--text-heading)]">
                  Underlying Daily Operational &amp; Engineering Report — {activeMachine.name} on{' '}
                  {dayRow.date} ({dayRow.shiftType} shift)
                </div>
                <div className="font-mono text-[var(--text-secondary)]">
                  Worked: {metrics.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h · Prod Delays:{' '}
                  {metrics.productionDelayHours.toFixed(DECIMAL_PLACES_ONE)}h · Non-Prod:{' '}
                  {metrics.nonProductionDelayHours.toFixed(DECIMAL_PLACES_ONE)}h · Eng Downtime:{' '}
                  {metrics.engineeringDelayHours.toFixed(DECIMAL_PLACES_ONE)}h
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                    Shift Note &amp; Delay Explanation
                  </div>
                  <p className="mt-1 text-[var(--text-heading)]">
                    {dayRow.comment || 'No shift comment recorded.'}
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                    Linked Breakdowns &amp; Engineering Notes ({dayIssues.length})
                  </div>
                  {dayIssues.length === 0 ? (
                    <p className="mt-1 text-[var(--text-secondary)]">
                      No separate breakdown tickets or engineering notes logged on this date.
                    </p>
                  ) : (
                    <div className="mt-1 space-y-1.5">
                      {dayIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2"
                        >
                          <div className="flex items-center justify-between font-semibold text-amber-950">
                            <span>
                              [{issue.source.toUpperCase()}] {issue.category} (
                              {issue.severity.toUpperCase()})
                            </span>
                            <span className="uppercase">{issue.status}</span>
                          </div>
                          <p className="mt-0.5 text-[var(--text-heading)]">{issue.description}</p>
                          {issue.actionTaken && (
                            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                              Action: {issue.actionTaken}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
});
